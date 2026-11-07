// Copyright 2026 The Bazel Authors. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import * as vscode from "vscode";

import { getUnpinnedRepositoryWarnings } from "../extension/configuration";
import { logWarn } from "../extension/logger";
import {
  CallExpr,
  Span,
  calleeName,
  parseModule,
  stmtExprs,
  walkExpr,
  walkStmts,
} from "../starlark";

/** What a repository rule needs to be reproducible. */
interface PinRule {
  /** Attributes any one of which pins the repository. */
  pins: string[];
  /** Explanation when none is present. */
  advice: string;
}

const GIT_PIN: PinRule = {
  pins: ["commit"],
  advice: "pin it to a `commit`; `branch` and `tag` references can move.",
};
const CHECKSUM_PIN: PinRule = {
  pins: ["integrity", "sha256"],
  advice: "add `integrity` (preferred) or `sha256` so downloads are verified.",
};

/** Repository rules and MODULE.bazel overrides that should be pinned. */
const PIN_RULES = new Map<string, PinRule>([
  ["git_repository", GIT_PIN],
  ["new_git_repository", GIT_PIN],
  ["git_override", GIT_PIN],
  ["http_archive", CHECKSUM_PIN],
  ["http_file", CHECKSUM_PIN],
  ["http_jar", CHECKSUM_PIN],
  ["archive_override", CHECKSUM_PIN],
]);

/** A finding of the unpinned-repository check. */
export interface UnpinnedRepository {
  /** The rule as Bazel knows it, e.g. `http_archive`. */
  rule: string;
  /** The `name` (or `module_name`) argument when it is a literal. */
  name?: string;
  /** Span of the callee at the call site. */
  span: Span;
  message: string;
}

/**
 * Finds repository declarations that are not pinned to a commit or
 * checksum anywhere in a Starlark file: at top level, inside functions
 * (WORKSPACE-style `def deps():` macros) and through `maybe(rule, ...)`.
 *
 * Rules are recognized by the name they were loaded under, so
 * `load("...", _http_archive = "http_archive")` and
 * `http_archive = use_repo_rule("...", "http_archive")` both work. Calls
 * that forward `**kwargs` are skipped, since the pin may arrive that way.
 */
export function findUnpinnedRepositories(text: string): UnpinnedRepository[] {
  const module = parseModule(text);
  const aliases = new Map<string, string>();
  // Functions defined in this file may add the pin themselves.
  const defined = new Set<string>();
  for (const stmt of module.stmts) {
    if (stmt.kind === "load") {
      for (const symbol of stmt.symbols) {
        aliases.set(symbol.local, symbol.original);
      }
    } else if (stmt.kind === "def") {
      defined.add(stmt.name);
    } else if (
      stmt.kind === "assign" &&
      stmt.target.kind === "ident" &&
      stmt.value.kind === "call" &&
      calleeName(stmt.value.func) === "use_repo_rule"
    ) {
      const ruleName =
        stmt.value.args.find((a) => a.name === "rule_name") ??
        stmt.value.args[1];
      if (ruleName?.value.kind === "string") {
        aliases.set(stmt.target.name, ruleName.value.value);
      }
    }
  }
  const ruleOf = (local: string | undefined) => {
    if (local === undefined) {
      return undefined;
    }
    const loaded = aliases.get(local);
    if (loaded === undefined && defined.has(local)) {
      return undefined;
    }
    return (loaded ?? local).replace(/^native\./, "");
  };

  const findings: UnpinnedRepository[] = [];
  const check = (rule: string, call: CallExpr, span: Span) => {
    const pin = PIN_RULES.get(rule);
    if (!pin) {
      return;
    }
    if (call.args.some((a) => a.star === "**")) {
      return;
    }
    const names = new Set(call.args.flatMap((a) => (a.name ? [a.name] : [])));
    if (pin.pins.some((p) => names.has(p))) {
      return;
    }
    const nameArg = call.args.find(
      (a) => a.name === "name" || a.name === "module_name",
    );
    const name =
      nameArg?.value.kind === "string" ? nameArg.value.value : undefined;
    findings.push({
      rule,
      name,
      span,
      message: `${rule}${name ? ` "${name}"` : ""} is not pinned: ${pin.advice}`,
    });
  };

  const visit = (expr: Parameters<typeof walkExpr>[0]) => {
    walkExpr(expr, (e) => {
      if (e.kind !== "call") {
        return true;
      }
      const callee = ruleOf(calleeName(e.func));
      if (callee === "maybe" && e.args[0]?.value.kind === "ident") {
        // `maybe(http_archive, name = ..., ...)`: the wrapped rule's
        // arguments are the keywords of the `maybe` call.
        const wrapped = ruleOf(e.args[0].value.name);
        if (wrapped) {
          check(wrapped, e, e.args[0].value);
        }
        return true;
      }
      if (callee && e.func.kind === "ident") {
        check(callee, e, e.func);
      } else if (callee && e.func.kind === "attr") {
        check(callee, e, e.func.nameSpan);
      }
      return true;
    });
  };
  walkStmts(module.stmts, (stmt) => {
    for (const expr of stmtExprs(stmt)) {
      visit(expr);
    }
    return true;
  });
  return findings;
}

/** Publishes unpinned-repository warnings for open Starlark documents. */
export class RepositoryDiagnostics implements vscode.Disposable {
  private readonly collection =
    vscode.languages.createDiagnosticCollection("bazel");
  private readonly disposables: vscode.Disposable[] = [];
  private readonly pending = new Map<string, NodeJS.Timeout>();

  constructor() {
    this.disposables.push(
      vscode.workspace.onDidOpenTextDocument((doc) => this.schedule(doc)),
      vscode.workspace.onDidChangeTextDocument((e) =>
        this.schedule(e.document),
      ),
      vscode.workspace.onDidCloseTextDocument((doc) =>
        this.collection.delete(doc.uri),
      ),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("bazel.languageSupport")) {
          this.refreshAll();
        }
      }),
    );
    this.refreshAll();
  }

  public dispose() {
    for (const timer of this.pending.values()) {
      clearTimeout(timer);
    }
    for (const d of this.disposables) {
      d.dispose();
    }
    this.collection.dispose();
  }

  private refreshAll() {
    for (const doc of vscode.workspace.textDocuments) {
      this.schedule(doc, 0);
    }
  }

  private applies(document: vscode.TextDocument): boolean {
    return document.uri.scheme === "file" && document.languageId === "starlark";
  }

  private schedule(document: vscode.TextDocument, delay = 300) {
    if (!this.applies(document)) {
      return;
    }
    const key = document.uri.toString();
    const existing = this.pending.get(key);
    if (existing) {
      clearTimeout(existing);
    }
    this.pending.set(
      key,
      setTimeout(() => {
        this.pending.delete(key);
        if (!document.isClosed) {
          this.publish(document);
        }
      }, delay),
    );
  }

  /** Computes and publishes the diagnostics of one document. */
  public publish(document: vscode.TextDocument) {
    if (!getUnpinnedRepositoryWarnings()) {
      this.collection.delete(document.uri);
      return;
    }
    const diagnostics = this.analyze(document).map((finding) => {
      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(
          document.positionAt(finding.span.start),
          document.positionAt(finding.span.end),
        ),
        finding.message,
        vscode.DiagnosticSeverity.Warning,
      );
      diagnostic.source = "bazel";
      diagnostic.code = "unpinned-repository";
      return diagnostic;
    });
    this.collection.set(document.uri, diagnostics);
  }

  /** Runs the analysis; a document that defeats it just gets no warnings. */
  private analyze(document: vscode.TextDocument): UnpinnedRepository[] {
    try {
      return findUnpinnedRepositories(document.getText());
    } catch (err) {
      logWarn(`Skipping ${document.uri.fsPath}: ${(err as Error).message}`);
      return [];
    }
  }
}
