import * as vscode from "vscode";
import { logInfo, logWarn, logError, showUserMessage } from "./logger";

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
 * - A named logger is used to log messages to the output pane.
 *
 * To comply with the design, a feature must:
 * - have a unique `featureName`
 * - have a corresponding config for enabling: `bazel.enable<featureName>`
 * - have a corresponding context key to communicate its current state: `bazel.feature.<featureName>.enabled`
 */
export abstract class BaseExtensionFeature implements vscode.Disposable {
  /**
   * Name of the feature, used in settings.
   */
  readonly featureName: string;
  private readonly configKey: string;
  private readonly contextKey: string;

  /**
   * Whether the feature is currently enabled.
   */
  private isEnabled: boolean = false;

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
    this.configKey = `bazel.enable${featureName}`;
    this.contextKey = `bazel.feature.${featureName}.enabled`;
    this.context = context;

    // Register configuration change listener
    this.configCallback = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(this.configKey)) {
        this.onConfigurationChanged(vscode.workspace.getConfiguration());
      }
    });
  }

  /**
   * Static Factory pattern for creating and ensuring a subsequent call for initialization.
   * The feature will be initialized based on the current configuration.
   */
  static create<T extends BaseExtensionFeature>(
    this: new (context: vscode.ExtensionContext) => T,
    context: vscode.ExtensionContext,
  ): T {
    const instance = new this(context);
    // Enable/Disable feature based on current configuration
    instance.onConfigurationChanged(vscode.workspace.getConfiguration());
    return instance;
  }

  /**
   * Called when the feature's configuration changes.
   * Calls enable or disable as required by config change.
   * Keeps the context key in sync with the feature state.
   * Logs erros in case of a activation failure.
   * @param config The new configuration for the feature.
   */
  private onConfigurationChanged(config: vscode.WorkspaceConfiguration): void {
    const shouldBeEnabled = this.isEnabledInConfig(config);
    if (shouldBeEnabled && !this.isEnabled) {
      this.logInfo(`Enabling ${this.constructor.name}`);
      if (!this.enable(this.context)) {
        showUserMessage(
          `Failed to enable ${this.constructor.name}`,
          vscode.LogLevel.Error,
          true,
        );
        return;
      }
      this.isEnabled = true;
    } else if (!shouldBeEnabled && this.isEnabled) {
      this.logInfo(`Disabling ${this.constructor.name}`);
      if (!this.disable()) {
        this.logError(`Failed to disable ${this.constructor.name}`);
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
   * Returns true if the feature is enabled in the current configuration
   * @param config The configuration to check
   */
  private isEnabledInConfig(config: vscode.WorkspaceConfiguration): boolean {
    return config.get<boolean>(this.configKey);
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
  protected abstract enable(context: vscode.ExtensionContext): boolean;

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
   * Internal helpers to prepend featureName to log messages.
   */
  protected logInfo(
    message: string,
    showMessage: boolean = false,
    ...args: unknown[]
  ): void {
    logInfo(`[${this.featureName}] ${message}`, showMessage, ...args);
  }
  protected logWarn(
    message: string,
    showMessage: boolean = false,
    ...args: unknown[]
  ): void {
    logWarn(`[${this.featureName}] ${message}`, showMessage, ...args);
  }
  protected logError(
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
  }
}
