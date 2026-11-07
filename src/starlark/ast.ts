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

/**
 * Abstract syntax tree for the Starlark dialect used by Bazel.
 *
 * Positions are UTF-16 code unit offsets into the source text, the units
 * `TextDocument.positionAt` expects. Use {@link LineIndex} to convert them
 * to line/column pairs when needed.
 */

/** A half-open range of offsets into the source text. */
export interface Span {
  start: number;
  end: number;
}

export interface StringLiteral extends Span {
  kind: "string";
  value: string;
  /** Whether the literal used triple quotes. */
  triple: boolean;
}

export interface IntLiteral extends Span {
  kind: "int";
  /** Textual form; integers may exceed the double range. */
  text: string;
}

export interface FloatLiteral extends Span {
  kind: "float";
  text: string;
}

export interface Identifier extends Span {
  kind: "ident";
  name: string;
}

export interface Argument extends Span {
  kind: "arg";
  /** Keyword name for `name = value` arguments. */
  name?: string;
  nameSpan?: Span;
  /** `*` or `**` for splat arguments. */
  star?: "*" | "**";
  value: Expr;
}

export interface CallExpr extends Span {
  kind: "call";
  func: Expr;
  args: Argument[];
  /** Offset of the opening parenthesis. */
  lparen: number;
}

export interface AttrExpr extends Span {
  kind: "attr";
  object: Expr;
  name: string;
  nameSpan: Span;
}

export interface IndexExpr extends Span {
  kind: "index";
  object: Expr;
  index: Expr;
}

export interface SliceExpr extends Span {
  kind: "slice";
  object: Expr;
  lo?: Expr;
  hi?: Expr;
  step?: Expr;
}

export interface ListExpr extends Span {
  kind: "list";
  elements: Expr[];
}

export interface TupleExpr extends Span {
  kind: "tuple";
  elements: Expr[];
}

export interface DictEntry extends Span {
  key: Expr;
  value: Expr;
}

export interface DictExpr extends Span {
  kind: "dict";
  entries: DictEntry[];
}

export interface ForClause extends Span {
  kind: "forClause";
  target: Expr;
  iter: Expr;
}

export interface IfClause extends Span {
  kind: "ifClause";
  test: Expr;
}

export interface Comprehension extends Span {
  kind: "comprehension";
  /** `[` for list, `{` for dict. */
  curly: boolean;
  body: Expr | DictEntry;
  clauses: (ForClause | IfClause)[];
}

export interface UnaryExpr extends Span {
  kind: "unary";
  op: string;
  operand: Expr;
}

export interface BinaryExpr extends Span {
  kind: "binary";
  op: string;
  left: Expr;
  right: Expr;
}

export interface ConditionalExpr extends Span {
  kind: "conditional";
  test: Expr;
  then: Expr;
  else: Expr;
}

export interface Parameter extends Span {
  kind: "param";
  name: string;
  nameSpan: Span;
  star?: "*" | "**";
  default?: Expr;
}

export interface LambdaExpr extends Span {
  kind: "lambda";
  params: Parameter[];
  body: Expr;
}

export interface ParenExpr extends Span {
  kind: "paren";
  inner: Expr;
}

/** Placeholder produced when the parser recovers from a syntax error. */
export interface BadExpr extends Span {
  kind: "bad";
}

export type Expr =
  | StringLiteral
  | IntLiteral
  | FloatLiteral
  | Identifier
  | CallExpr
  | AttrExpr
  | IndexExpr
  | SliceExpr
  | ListExpr
  | TupleExpr
  | DictExpr
  | Comprehension
  | UnaryExpr
  | BinaryExpr
  | ConditionalExpr
  | LambdaExpr
  | ParenExpr
  | BadExpr;

export interface ExprStmt extends Span {
  kind: "expr";
  expr: Expr;
}

export interface AssignStmt extends Span {
  kind: "assign";
  /** `=` or an augmented operator such as `+=`. */
  op: string;
  target: Expr;
  value: Expr;
}

export interface DefStmt extends Span {
  kind: "def";
  name: string;
  nameSpan: Span;
  params: Parameter[];
  body: Stmt[];
  docstring?: string;
}

export interface IfStmt extends Span {
  kind: "if";
  test: Expr;
  then: Stmt[];
  /** `elif` chains are represented as a nested `if` in `else`. */
  else: Stmt[];
}

export interface ForStmt extends Span {
  kind: "for";
  target: Expr;
  iter: Expr;
  body: Stmt[];
}

export interface WhileStmt extends Span {
  kind: "while";
  test: Expr;
  body: Stmt[];
}

export interface LoadSymbol extends Span {
  /** The name bound in this file. */
  local: string;
  /** Span of the local name as written (identifier or string). */
  localSpan: Span;
  /** The name exported by the loaded module. */
  original: string;
  /** The string literal naming the original symbol. */
  originalLiteral: StringLiteral;
}

export interface LoadStmt extends Span {
  kind: "load";
  module: StringLiteral;
  symbols: LoadSymbol[];
}

export interface ReturnStmt extends Span {
  kind: "return";
  value?: Expr;
}

export interface SimpleStmt extends Span {
  kind: "pass" | "break" | "continue";
}

/** Placeholder produced when the parser recovers from a syntax error. */
export interface BadStmt extends Span {
  kind: "badStmt";
}

export type Stmt =
  | ExprStmt
  | AssignStmt
  | DefStmt
  | IfStmt
  | ForStmt
  | WhileStmt
  | LoadStmt
  | ReturnStmt
  | SimpleStmt
  | BadStmt;

export interface SyntaxError extends Span {
  message: string;
}

export interface Module {
  stmts: Stmt[];
  errors: SyntaxError[];
}

/** Converts between offsets and (line, column) pairs for a source text. */
export class LineIndex {
  private readonly lineStarts: number[] = [0];

  constructor(text: string) {
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) === 10 /* \n */) {
        this.lineStarts.push(i + 1);
      }
    }
  }

  /** Returns the 0-based line and column for an offset. */
  public position(offset: number): { line: number; column: number } {
    let lo = 0;
    let hi = this.lineStarts.length - 1;
    while (lo < hi) {
      const mid = Math.floor((lo + hi + 1) / 2);
      if (this.lineStarts[mid] <= offset) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    return { line: lo, column: offset - this.lineStarts[lo] };
  }

  /** Returns the offset of the start of a 0-based line. */
  public offsetOfLine(line: number): number {
    if (line < 0) {
      return 0;
    }
    if (line >= this.lineStarts.length) {
      return this.lineStarts[this.lineStarts.length - 1];
    }
    return this.lineStarts[line];
  }

  public get lineCount(): number {
    return this.lineStarts.length;
  }
}

/** Dotted name of a callee, e.g. `attr.label_list` or `native.filegroup`. */
export function calleeName(func: Expr): string | undefined {
  if (func.kind === "ident") {
    return func.name;
  }
  if (func.kind === "attr") {
    const base = calleeName(func.object);
    return base === undefined ? undefined : `${base}.${func.name}`;
  }
  return undefined;
}

/** Visits every expression node reachable from `node`, depth first. */
export function walkExpr(node: Expr, visit: (e: Expr) => boolean | void) {
  if (visit(node) === false) {
    return;
  }
  switch (node.kind) {
    case "call":
      walkExpr(node.func, visit);
      for (const arg of node.args) {
        walkExpr(arg.value, visit);
      }
      break;
    case "attr":
      walkExpr(node.object, visit);
      break;
    case "index":
      walkExpr(node.object, visit);
      walkExpr(node.index, visit);
      break;
    case "slice":
      walkExpr(node.object, visit);
      if (node.lo) {
        walkExpr(node.lo, visit);
      }
      if (node.hi) {
        walkExpr(node.hi, visit);
      }
      if (node.step) {
        walkExpr(node.step, visit);
      }
      break;
    case "list":
    case "tuple":
      for (const e of node.elements) {
        walkExpr(e, visit);
      }
      break;
    case "dict":
      for (const entry of node.entries) {
        walkExpr(entry.key, visit);
        walkExpr(entry.value, visit);
      }
      break;
    case "comprehension":
      if ("kind" in node.body) {
        walkExpr(node.body, visit);
      } else {
        walkExpr(node.body.key, visit);
        walkExpr(node.body.value, visit);
      }
      for (const clause of node.clauses) {
        if (clause.kind === "forClause") {
          walkExpr(clause.target, visit);
          walkExpr(clause.iter, visit);
        } else {
          walkExpr(clause.test, visit);
        }
      }
      break;
    case "unary":
      walkExpr(node.operand, visit);
      break;
    case "binary":
      walkExpr(node.left, visit);
      walkExpr(node.right, visit);
      break;
    case "conditional":
      walkExpr(node.test, visit);
      walkExpr(node.then, visit);
      walkExpr(node.else, visit);
      break;
    case "lambda":
      for (const p of node.params) {
        if (p.default) {
          walkExpr(p.default, visit);
        }
      }
      walkExpr(node.body, visit);
      break;
    case "paren":
      walkExpr(node.inner, visit);
      break;
    default:
      break;
  }
}

/** Visits every statement reachable from `stmts`, depth first. */
export function walkStmts(stmts: Stmt[], visit: (s: Stmt) => boolean | void) {
  for (const stmt of stmts) {
    if (visit(stmt) === false) {
      continue;
    }
    switch (stmt.kind) {
      case "def":
        walkStmts(stmt.body, visit);
        break;
      case "if":
        walkStmts(stmt.then, visit);
        walkStmts(stmt.else, visit);
        break;
      case "for":
      case "while":
        walkStmts(stmt.body, visit);
        break;
      default:
        break;
    }
  }
}

/** Returns the expressions directly owned by a statement. */
export function stmtExprs(stmt: Stmt): Expr[] {
  switch (stmt.kind) {
    case "expr":
      return [stmt.expr];
    case "assign":
      return [stmt.target, stmt.value];
    case "def":
      return stmt.params.flatMap((p) => (p.default ? [p.default] : []));
    case "if":
      return [stmt.test];
    case "for":
      return [stmt.target, stmt.iter];
    case "while":
      return [stmt.test];
    case "load":
      return [stmt.module, ...stmt.symbols.map((s) => s.originalLiteral)];
    case "return":
      return stmt.value ? [stmt.value] : [];
    default:
      return [];
  }
}
