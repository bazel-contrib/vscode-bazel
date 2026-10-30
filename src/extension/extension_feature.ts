import * as vscode from "vscode";
import {
  logInfo,
  logWarn,
  logError,
  showUserMessage,
  logDebug,
} from "./logger";
import { ILogger } from "./logger_interface";
import { affectsRenamedSetting, getRenamedSetting } from "./settings_migration";
import { ToolKey } from "../external-tools/tool_config";
import { getToolRegistry } from "../external-tools/tool_registry_instance";

/**
 * Represents a feature of the Bazel extension.
 * A feature is a discrete piece of functionality that can be enabled/disabled.
 *
 * This base class enforces a common design to how this toggle mechanism is implemented:
 * - A feature instance is created during the extensions activate() method
 * - A feature instance is disposed of when the extension is disposed of or deactivated
 * - A feature can be toggled on/off by toggling its configKey.
 * - Toggling can be done multiple times and takes effect immediately, without reload.
 * - Upon disabling, a feature disposes of all it's internal resources
 * - Upon enabling, a feature recreates it's internal resources
 * - Upon enabling, a feature checks it's required constraints and signals success or failure.
 * - A feature lists the external tools it requires (`requiredTools`). While one is missing, the feature waits
 * instead of failing, and is enabled as soon as the tool becomes available. It restarts when a tool it uses changes.
 * - A named logger is used to log messages to the output pane.
 *
 * To comply with the design, a feature must:
 * - have a unique `featureName`
 * - have a corresponding config for enabling: `bazel.<featureName>.enable`,
 * clustering the rest of the feature's settings under the same
 * `bazel.<featureName>` section (see e.g. `bazel.buildifier.*`)
 * - have a corresponding context key to communicate its current state: `bazel.feature.<featureName>.enabled`
 * and `bazel.feature.<featureName>.waiting` (enabled in settings, but waiting for a tool)
 */
export abstract class BaseExtensionFeature
  implements vscode.Disposable, ILogger
{
  /**
   * Name of the feature, used in settings.
   */
  readonly featureName: string;
  private readonly configKey: string;
  private readonly contextKey: string;
  private readonly waitingContextKey: string;

  /**
   * Whether the feature is currently enabled.
   */
  private isEnabled: boolean = false;

  /**
   * Whether the feature is enabled in the settings, but waits for a tool.
   */
  private isWaiting: boolean = false;
  private pendingConfigChange: Promise<void> = Promise.resolve();

  /**
   * List of disposables registered by the feature.
   * These will be disposed when the feature is disabled.
   * Array can be refilled when feature is activated again.
   */
  protected disposables: vscode.Disposable[] = [];

  /**
   * Disposable for the onDidChangeConfiguration callback.
   * It is stored seperately from the features _disposables,
   * as it needs to live longer then the disable() call to assure that a feature can be turned on again.
   */
  private configCallback: vscode.Disposable;

  /**
   * Disposable for the tool registry's change callback; lives as long as the
   * configCallback.
   */
  private toolCallback: vscode.Disposable | undefined;

  /**
   * The extension context. Will be handed to enable() method when toggled.
   */
  private context: vscode.ExtensionContext;

  /**
   * Creates a new feature instance.
   * @param featureName The name of the feature.
   * @param context The extension context.
   * @param logger The logger instance.
   */
  constructor(featureName: string, context: vscode.ExtensionContext) {
    this.featureName = featureName;
    const settingsSection = featureName[0].toLowerCase() + featureName.slice(1);
    this.configKey = `bazel.${settingsSection}.enable`;
    this.contextKey = `bazel.feature.${featureName}.enabled`;
    this.waitingContextKey = `bazel.feature.${featureName}.waiting`;
    this.context = context;

    // Register configuration change listener
    this.configCallback = vscode.workspace.onDidChangeConfiguration((e) => {
      if (affectsRenamedSetting(e, this.configKey)) {
        void this.onConfigurationChanged();
      }
    });

    // Enable a waiting feature, or restart an enabled one, when a tool it
    // depends on changes.
    this.toolCallback = getToolRegistry()?.onDidChangeTool((change) => {
      if (
        !change.initial &&
        [...this.requiredTools(), ...this.optionalTools()].includes(change.key)
      ) {
        void this.onToolsChanged();
      }
    });
  }

  /**
   * External tools the feature can't work without. The feature is only
   * enabled once all of them are resolved.
   */
  protected requiredTools(): ToolKey[] {
    return [];
  }

  /**
   * External tools the feature uses if available. The feature restarts when
   * one of them changes.
   */
  protected optionalTools(): ToolKey[] {
    return [];
  }

  /**
   * Static Factory pattern for creating and ensuring a subsequent call for initialization.
   * The feature will be initialized based on the current configuration.
   */
  static async create<T extends BaseExtensionFeature>(
    this: new (context: vscode.ExtensionContext) => T,
    context: vscode.ExtensionContext,
  ): Promise<T> {
    const instance = new this(context);
    // Enable/Disable feature based on current configuration
    await instance.onConfigurationChanged();
    return instance;
  }

  /**
   * Called when the feature's configuration changes.
   * Calls enable or disable as required by config change.
   * Keeps the context key in sync with the feature state.
   * Logs erros in case of a activation failure.
   */
  private onConfigurationChanged(): Promise<void> {
    return this.enqueue(() => this.doConfigurationChange());
  }

  /**
   * Called when a tool the feature depends on changed: restarts the feature
   * if enabled, and enables it if it was waiting for the tool.
   */
  private onToolsChanged(): Promise<void> {
    return this.enqueue(async () => {
      if (this.isEnabled) {
        this.logInfo("Restarting feature, a tool it uses changed");
        this.disable();
        this.isEnabled = false;
      }
      await this.doConfigurationChange();
    });
  }

  /** Serializes state transitions. */
  private enqueue(transition: () => Promise<void>): Promise<void> {
    const next = this.pendingConfigChange.then(transition);
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    this.pendingConfigChange = next.catch(() => {});
    return next;
  }

  private async doConfigurationChange(): Promise<void> {
    const shouldBeEnabled = this.isEnabledInConfig();
    if (shouldBeEnabled && !this.isEnabled) {
      const missingTools = await this.findMissingTools();
      if (missingTools.length > 0) {
        if (!this.isWaiting) {
          this.logInfo(`Waiting for ${missingTools.join(", ")}`);
        }
        this.setWaiting(true);
        vscode.commands.executeCommand("setContext", this.contextKey, false);
        return;
      }
      this.setWaiting(false);
      this.logInfo(`Enabling feature`);
      let enabled: boolean;
      try {
        enabled = await this.enable(this.context);
      } catch (e) {
        this.logError(`Failed to enable feature: ${e}`);
        return;
      }
      if (!enabled) {
        void showUserMessage(
          `Failed to enable ${this.featureName}`,
          vscode.LogLevel.Error,
          true,
        );
        return;
      }
      this.isEnabled = true;
    } else if (!shouldBeEnabled) {
      this.setWaiting(false);
    }
    if (!shouldBeEnabled && this.isEnabled) {
      this.logInfo(`Disabling feature`);
      if (!this.disable()) {
        this.logError(`Failed to disable feature`);
        return;
      }
      this.isEnabled = false;
    }
    vscode.commands.executeCommand(
      "setContext",
      this.contextKey,
      this.isEnabled,
    );
  }

  /**
   * Resolves the required tools; returns those that are not available.
   */
  private async findMissingTools(): Promise<ToolKey[]> {
    const registry = getToolRegistry();
    if (!registry) {
      return [];
    }
    const required = this.requiredTools();
    const states = await Promise.all(required.map((t) => registry.ensure(t)));
    return required.filter((_, i) => states[i].kind !== "resolved");
  }

  private setWaiting(waiting: boolean) {
    if (this.isWaiting === waiting) {
      return;
    }
    this.isWaiting = waiting;
    vscode.commands.executeCommand(
      "setContext",
      this.waitingContextKey,
      waiting,
    );
  }

  /**
   * Returns true if the feature is enabled in the current configuration
   */
  private isEnabledInConfig(): boolean {
    const lastDot = this.configKey.lastIndexOf(".");
    return (
      getRenamedSetting<boolean>(
        this.configKey.slice(0, lastDot),
        this.configKey.slice(lastDot + 1),
      ) ?? false
    );
  }

  /**
   * Called when the feature is enabled
   * @param context The extension context for registering disposables.
   *
   * Derived classes must implement this method. It shall:
   * - check required preconditions and return false if not all are met and the feature can not be activated
   * - create any required resources and add disposables to the `this.disposables` array.
   * - return true after successfull enabling of the functionality
   */
  protected abstract enable(context: vscode.ExtensionContext): Promise<boolean>;

  /**
   * Called when the feature is disabled.
   * Should clean up any resources used by the feature, in a way that is safe to call multiple times.
   */
  protected disable(): boolean {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    return true;
  }

  /**
   * Gets the logger instance for this feature, which can be passed to other components.
   * This allows dependency injection of feature-specific logging capabilities.
   */
  public getLogger(): ILogger {
    return this;
  }

  /**
   * Implementation of ILogger interface - public methods for external use.
   */
  public logDebug(
    message: string,
    showMessage: boolean = false,
    ...args: unknown[]
  ): void {
    logDebug(`[${this.featureName}] ${message}`, showMessage, ...args);
  }
  public logInfo(
    message: string,
    showMessage: boolean = false,
    ...args: unknown[]
  ): void {
    logInfo(`[${this.featureName}] ${message}`, showMessage, ...args);
  }
  public logWarn(
    message: string,
    showMessage: boolean = false,
    ...args: unknown[]
  ): void {
    logWarn(`[${this.featureName}] ${message}`, showMessage, ...args);
  }
  public logError(
    message: string,
    showMessage: boolean = false,
    ...args: unknown[]
  ): void {
    logError(`[${this.featureName}] ${message}`, showMessage, ...args);
  }

  /**
   * Called when the extension is deactivated.
   * Cleanup and dispose all registered disposables, instance is unusable after.
   */
  dispose() {
    this.disable();
    this.configCallback.dispose();
    this.toolCallback?.dispose();
  }
}
