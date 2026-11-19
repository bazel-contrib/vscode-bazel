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

import {
  Argument,
  DictEntry,
  Expr,
  ForClause,
  IfClause,
  LoadStmt,
  LoadSymbol,
  Module,
  Parameter,
  Stmt,
  StringLiteral,
  SyntaxError,
} from "./ast";
import { Lexer, Token, TokenKind } from "./lexer";

class ParseFailure extends Error {
  constructor(
    public readonly at: Token,
    message: string,
  ) {
    super(message);
  }
}

const COMPARISON_OPS = new Set(["<", ">", "<=", ">=", "==", "!="]);
const AUGMENTED_OPS = new Set([
  "+=",
  "-=",
  "*=",
  "/=",
  "//=",
  "%=",
  "&=",
  "|=",
  "^=",
  "<<=",
  ">>=",
]);

/**
 * Parses a Starlark module.
 *
 * Parsing never throws. Syntax errors are recorded in the returned module and
 * the parser resynchronizes at the next statement so that as much of the
 * file as possible is still represented.
 */
export function parseModule(src: string): Module {
  const lexer = new Lexer(src);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, lexer.errors);
  try {
    return parser.parseModule();
  } catch (e) {
    // Only pathological nesting gets here, by exhausting the stack.
    const message = e instanceof Error ? e.message : String(e);
    lexer.errors.push({
      start: 0,
      end: 0,
      message: `cannot parse: ${message}`,
    });
    return { stmts: [], errors: lexer.errors };
  }
}

class Parser {
  private i = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly errors: SyntaxError[],
  ) {}

  public parseModule(): Module {
    const stmts = this.parseBlockBody(() => this.peek().kind === TokenKind.EOF);
    return { stmts, errors: this.errors };
  }

  // ---------------------------------------------------------------------
  // Token helpers

  private peek(offset = 0): Token {
    const idx = Math.min(this.i + offset, this.tokens.length - 1);
    return this.tokens[idx];
  }

  private next(): Token {
    const tok = this.tokens[this.i];
    if (this.i < this.tokens.length - 1) {
      this.i++;
    }
    return tok;
  }

  private isPunct(text: string, offset = 0): boolean {
    const t = this.peek(offset);
    return t.kind === TokenKind.PUNCT && t.text === text;
  }

  private isKeyword(text: string, offset = 0): boolean {
    const t = this.peek(offset);
    return t.kind === TokenKind.KEYWORD && t.text === text;
  }

  private acceptPunct(text: string): Token | undefined {
    return this.isPunct(text) ? this.next() : undefined;
  }

  private acceptKeyword(text: string): Token | undefined {
    return this.isKeyword(text) ? this.next() : undefined;
  }

  private expectPunct(text: string): Token {
    const t = this.acceptPunct(text);
    if (!t) {
      throw new ParseFailure(this.peek(), `expected '${text}'`);
    }
    return t;
  }

  private fail(message: string): never {
    throw new ParseFailure(this.peek(), message);
  }

  /** Skips to just past the next NEWLINE at the current block level. */
  private recover(err: ParseFailure) {
    this.errors.push({
      start: err.at.start,
      end: Math.max(err.at.end, err.at.start + 1),
      message: err.message,
    });
    for (;;) {
      const t = this.peek();
      if (t.kind === TokenKind.EOF) {
        return;
      }
      if (t.kind === TokenKind.NEWLINE) {
        this.next();
        return;
      }
      if (t.kind === TokenKind.DEDENT) {
        // Let the enclosing block handle the dedent.
        return;
      }
      if (t.kind === TokenKind.INDENT) {
        // Skip the whole indented region.
        this.next();
        let depth = 1;
        while (depth > 0 && this.peek().kind !== TokenKind.EOF) {
          const k = this.next().kind;
          if (k === TokenKind.INDENT) {
            depth++;
          } else if (k === TokenKind.DEDENT) {
            depth--;
          }
        }
        continue;
      }
      this.next();
    }
  }

  // ---------------------------------------------------------------------
  // Statements

  private parseBlockBody(atEnd: () => boolean): Stmt[] {
    const stmts: Stmt[] = [];
    while (!atEnd()) {
      const t = this.peek();
      if (t.kind === TokenKind.NEWLINE) {
        this.next();
        continue;
      }
      if (t.kind === TokenKind.INDENT) {
        // Unexpected indentation; treat the region as its own block so that
        // its statements are still parsed.
        this.errors.push({
          start: t.start,
          end: t.start + 1,
          message: "unexpected indentation",
        });
        this.next();
        stmts.push(
          ...this.parseBlockBody(
            () =>
              this.peek().kind === TokenKind.DEDENT ||
              this.peek().kind === TokenKind.EOF,
          ),
        );
        if (this.peek().kind === TokenKind.DEDENT) {
          this.next();
        }
        continue;
      }
      if (t.kind === TokenKind.DEDENT) {
        // Stray dedent at this level (after an error); ignore it.
        this.next();
        continue;
      }
      try {
        stmts.push(...this.parseStatement());
      } catch (e) {
        if (e instanceof ParseFailure) {
          const start = t.start;
          this.recover(e);
          stmts.push({ kind: "badStmt", start, end: e.at.end });
        } else {
          throw e;
        }
      }
    }
    return stmts;
  }

  /** Parses a compound statement or a line of `;`-separated statements. */
  private parseStatement(): Stmt[] {
    const t = this.peek();
    if (t.kind === TokenKind.KEYWORD) {
      switch (t.text) {
        case "def":
          return [this.parseDef()];
        case "if":
          return [this.parseIf()];
        case "for":
          return [this.parseFor()];
        case "while":
          return [this.parseWhile()];
        default:
          break;
      }
    }
    const stmts: Stmt[] = [];
    for (;;) {
      stmts.push(this.parseSimpleStatement());
      if (this.acceptPunct(";")) {
        if (this.peek().kind === TokenKind.NEWLINE) {
          break;
        }
        continue;
      }
      break;
    }
    this.expectNewline();
    return stmts;
  }

  private expectNewline() {
    const t = this.peek();
    if (t.kind === TokenKind.NEWLINE) {
      this.next();
      return;
    }
    if (t.kind === TokenKind.EOF || t.kind === TokenKind.DEDENT) {
      return;
    }
    this.fail("expected end of statement");
  }

  private parseSimpleStatement(): Stmt {
    const t = this.peek();
    if (t.kind === TokenKind.KEYWORD) {
      switch (t.text) {
        case "return": {
          this.next();
          let value: Expr | undefined;
          if (!this.atSimpleStatementEnd()) {
            value = this.parseExpressionList();
          }
          return {
            kind: "return",
            value,
            start: t.start,
            end: value ? value.end : t.end,
          };
        }
        case "pass":
        case "break":
        case "continue":
          this.next();
          return { kind: t.text, start: t.start, end: t.end };
        case "load":
          if (this.isPunct("(", 1)) {
            return this.parseLoad();
          }
          break;
        default:
          break;
      }
    }
    const expr = this.parseExpressionList();
    const op = this.peek();
    if (
      op.kind === TokenKind.PUNCT &&
      (op.text === "=" || AUGMENTED_OPS.has(op.text))
    ) {
      this.next();
      const value = this.parseExpressionList();
      return {
        kind: "assign",
        op: op.text,
        target: expr,
        value,
        start: expr.start,
        end: value.end,
      };
    }
    return { kind: "expr", expr, start: expr.start, end: expr.end };
  }

  private atSimpleStatementEnd(): boolean {
    const t = this.peek();
    return (
      t.kind === TokenKind.NEWLINE ||
      t.kind === TokenKind.EOF ||
      t.kind === TokenKind.DEDENT ||
      (t.kind === TokenKind.PUNCT && t.text === ";")
    );
  }

  private parseLoad(): LoadStmt {
    const loadTok = this.next();
    this.expectPunct("(");
    const moduleTok = this.peek();
    if (moduleTok.kind !== TokenKind.STRING) {
      this.fail("expected module string in load()");
    }
    this.next();
    const module = this.stringLiteral(moduleTok);
    const symbols: LoadSymbol[] = [];
    while (this.acceptPunct(",")) {
      if (this.isPunct(")")) {
        break;
      }
      const t = this.peek();
      if (t.kind === TokenKind.IDENT) {
        this.next();
        this.expectPunct("=");
        const s = this.peek();
        if (s.kind !== TokenKind.STRING) {
          this.fail("expected string after '=' in load()");
        }
        this.next();
        const lit = this.stringLiteral(s);
        symbols.push({
          local: t.text,
          localSpan: { start: t.start, end: t.end },
          original: lit.value,
          originalLiteral: lit,
          start: t.start,
          end: lit.end,
        });
      } else if (t.kind === TokenKind.STRING) {
        this.next();
        const lit = this.stringLiteral(t);
        symbols.push({
          local: lit.value,
          localSpan: { start: lit.start, end: lit.end },
          original: lit.value,
          originalLiteral: lit,
          start: lit.start,
          end: lit.end,
        });
      } else {
        this.fail("expected symbol in load()");
      }
    }
    const rparen = this.expectPunct(")");
    return {
      kind: "load",
      module,
      symbols,
      start: loadTok.start,
      end: rparen.end,
    };
  }

  private parseDef(): Stmt {
    const defTok = this.next();
    const nameTok = this.peek();
    if (nameTok.kind !== TokenKind.IDENT) {
      this.fail("expected function name");
    }
    this.next();
    this.expectPunct("(");
    const params = this.parseParameters(")");
    this.expectPunct(")");
    this.expectPunct(":");
    const body = this.parseSuite();
    let docstring: string | undefined;
    const first = body[0];
    if (first?.kind === "expr" && first.expr.kind === "string") {
      docstring = first.expr.value;
    }
    return {
      kind: "def",
      name: nameTok.text,
      nameSpan: { start: nameTok.start, end: nameTok.end },
      params,
      body,
      docstring,
      start: defTok.start,
      end: body.length ? body[body.length - 1].end : defTok.end,
    };
  }

  private parseParameters(closer: string): Parameter[] {
    const params: Parameter[] = [];
    while (!this.isPunct(closer)) {
      const start = this.peek().start;
      let star: "*" | "**" | undefined;
      if (this.acceptPunct("**")) {
        star = "**";
      } else if (this.acceptPunct("*")) {
        star = "*";
      }
      const nameTok = this.peek();
      if (nameTok.kind !== TokenKind.IDENT) {
        if (star === "*" && (this.isPunct(",") || this.isPunct(closer))) {
          // Bare `*` separator.
          params.push({
            kind: "param",
            name: "*",
            nameSpan: { start, end: start + 1 },
            star,
            start,
            end: start + 1,
          });
          if (!this.acceptPunct(",")) {
            break;
          }
          continue;
        }
        this.fail("expected parameter name");
      }
      this.next();
      let def: Expr | undefined;
      if (this.acceptPunct("=")) {
        def = this.parseTest();
      }
      params.push({
        kind: "param",
        name: nameTok.text,
        nameSpan: { start: nameTok.start, end: nameTok.end },
        star,
        default: def,
        start,
        end: def ? def.end : nameTok.end,
      });
      if (!this.acceptPunct(",")) {
        break;
      }
    }
    return params;
  }

  private parseIf(): Stmt {
    const ifTok = this.next();
    const test = this.parseTest();
    this.expectPunct(":");
    const then = this.parseSuite();
    let elseBody: Stmt[] = [];
    if (this.isKeyword("elif")) {
      const elifTok = this.peek();
      // Reuse the `if` parser by treating `elif` as `if`.
      this.tokens[this.i] = { ...elifTok, text: "if" };
      elseBody = [this.parseIf()];
    } else if (this.acceptKeyword("else")) {
      this.expectPunct(":");
      elseBody = this.parseSuite();
    }
    const last = elseBody[elseBody.length - 1] ?? then[then.length - 1];
    return {
      kind: "if",
      test,
      then,
      else: elseBody,
      start: ifTok.start,
      end: last ? last.end : test.end,
    };
  }

  private parseFor(): Stmt {
    const forTok = this.next();
    const target = this.parseLoopVariables();
    if (!this.acceptKeyword("in")) {
      this.fail("expected 'in'");
    }
    const iter = this.parseExpressionList();
    this.expectPunct(":");
    const body = this.parseSuite();
    return {
      kind: "for",
      target,
      iter,
      body,
      start: forTok.start,
      end: body.length ? body[body.length - 1].end : iter.end,
    };
  }

  private parseWhile(): Stmt {
    const whileTok = this.next();
    const test = this.parseTest();
    this.expectPunct(":");
    const body = this.parseSuite();
    return {
      kind: "while",
      test,
      body,
      start: whileTok.start,
      end: body.length ? body[body.length - 1].end : test.end,
    };
  }

  /** Parses the body of a compound statement. */
  private parseSuite(): Stmt[] {
    if (this.peek().kind === TokenKind.NEWLINE) {
      this.next();
      // Skip blank lines (already dropped by the lexer) and expect INDENT.
      if (this.peek().kind !== TokenKind.INDENT) {
        this.fail("expected an indented block");
      }
      this.next();
      const body = this.parseBlockBody(
        () =>
          this.peek().kind === TokenKind.DEDENT ||
          this.peek().kind === TokenKind.EOF,
      );
      if (this.peek().kind === TokenKind.DEDENT) {
        this.next();
      }
      return body;
    }
    // Simple statements on the same line.
    const stmts: Stmt[] = [];
    for (;;) {
      stmts.push(this.parseSimpleStatement());
      if (this.acceptPunct(";")) {
        if (this.peek().kind === TokenKind.NEWLINE) {
          break;
        }
        continue;
      }
      break;
    }
    this.expectNewline();
    return stmts;
  }

  // ---------------------------------------------------------------------
  // Expressions

  /** Loop variables: `x` or `x, y` (without parentheses). */
  private parseLoopVariables(): Expr {
    const first = this.parsePrimaryWithSuffixes();
    if (!this.isPunct(",")) {
      return first;
    }
    const elements = [first];
    while (this.acceptPunct(",")) {
      if (this.isKeyword("in")) {
        break;
      }
      elements.push(this.parsePrimaryWithSuffixes());
    }
    return {
      kind: "tuple",
      elements,
      start: first.start,
      end: elements[elements.length - 1].end,
    };
  }

  /** `test (',' test)* [',']` producing a tuple when there is a comma. */
  private parseExpressionList(): Expr {
    const first = this.parseTest();
    if (!this.isPunct(",")) {
      return first;
    }
    const elements = [first];
    let end = first.end;
    while (this.acceptPunct(",")) {
      if (this.atExpressionListEnd()) {
        break;
      }
      const e = this.parseTest();
      elements.push(e);
      end = e.end;
    }
    return { kind: "tuple", elements, start: first.start, end };
  }

  private atExpressionListEnd(): boolean {
    const t = this.peek();
    if (
      t.kind === TokenKind.NEWLINE ||
      t.kind === TokenKind.EOF ||
      t.kind === TokenKind.DEDENT
    ) {
      return true;
    }
    return (
      t.kind === TokenKind.PUNCT &&
      (t.text === "=" ||
        t.text === ")" ||
        t.text === "]" ||
        t.text === "}" ||
        t.text === ";" ||
        AUGMENTED_OPS.has(t.text))
    );
  }

  /** `lambda` and conditional expressions. */
  private parseTest(): Expr {
    if (this.isKeyword("lambda")) {
      return this.parseLambda();
    }
    const expr = this.parseOr();
    if (this.isKeyword("if")) {
      this.next();
      const test = this.parseOr();
      if (!this.acceptKeyword("else")) {
        this.fail("expected 'else' in conditional expression");
      }
      const alt = this.parseTest();
      return {
        kind: "conditional",
        test,
        then: expr,
        else: alt,
        start: expr.start,
        end: alt.end,
      };
    }
    return expr;
  }

  private parseLambda(): Expr {
    const lambdaTok = this.next();
    const params = this.parseParameters(":");
    this.expectPunct(":");
    const body = this.parseTest();
    return {
      kind: "lambda",
      params,
      body,
      start: lambdaTok.start,
      end: body.end,
    };
  }

  private parseOr(): Expr {
    let left = this.parseAnd();
    while (this.isKeyword("or")) {
      this.next();
      const right = this.parseAnd();
      left = this.binary("or", left, right);
    }
    return left;
  }

  private parseAnd(): Expr {
    let left = this.parseNot();
    while (this.isKeyword("and")) {
      this.next();
      const right = this.parseNot();
      left = this.binary("and", left, right);
    }
    return left;
  }

  private parseNot(): Expr {
    if (this.isKeyword("not")) {
      const t = this.next();
      const operand = this.parseNot();
      return {
        kind: "unary",
        op: "not",
        operand,
        start: t.start,
        end: operand.end,
      };
    }
    return this.parseComparison();
  }

  private parseComparison(): Expr {
    let left = this.parseBinary(0);
    for (;;) {
      const t = this.peek();
      let op: string | undefined;
      if (t.kind === TokenKind.PUNCT && COMPARISON_OPS.has(t.text)) {
        op = t.text;
        this.next();
      } else if (this.isKeyword("in")) {
        op = "in";
        this.next();
      } else if (this.isKeyword("not") && this.isKeyword("in", 1)) {
        op = "not in";
        this.next();
        this.next();
      } else {
        return left;
      }
      const right = this.parseBinary(0);
      left = this.binary(op, left, right);
    }
  }

  private static readonly BINARY_LEVELS: string[][] = [
    ["|"],
    ["^"],
    ["&"],
    ["<<", ">>"],
    ["+", "-"],
    ["*", "/", "//", "%"],
  ];

  private parseBinary(level: number): Expr {
    if (level >= Parser.BINARY_LEVELS.length) {
      return this.parseUnary();
    }
    const ops = Parser.BINARY_LEVELS[level];
    let left = this.parseBinary(level + 1);
    for (;;) {
      const t = this.peek();
      if (t.kind === TokenKind.PUNCT && ops.includes(t.text)) {
        this.next();
        const right = this.parseBinary(level + 1);
        left = this.binary(t.text, left, right);
      } else {
        return left;
      }
    }
  }

  private parseUnary(): Expr {
    const t = this.peek();
    if (
      t.kind === TokenKind.PUNCT &&
      (t.text === "-" || t.text === "+" || t.text === "~")
    ) {
      this.next();
      const operand = this.parseUnary();
      return {
        kind: "unary",
        op: t.text,
        operand,
        start: t.start,
        end: operand.end,
      };
    }
    return this.parsePower();
  }

  private parsePower(): Expr {
    const base = this.parsePrimaryWithSuffixes();
    if (this.isPunct("**")) {
      this.next();
      const exp = this.parseUnary();
      return this.binary("**", base, exp);
    }
    return base;
  }

  private parsePrimaryWithSuffixes(): Expr {
    let expr = this.parseOperand();
    for (;;) {
      if (this.isPunct(".")) {
        this.next();
        const nameTok = this.peek();
        if (nameTok.kind !== TokenKind.IDENT) {
          this.fail("expected attribute name after '.'");
        }
        this.next();
        expr = {
          kind: "attr",
          object: expr,
          name: nameTok.text,
          nameSpan: { start: nameTok.start, end: nameTok.end },
          start: expr.start,
          end: nameTok.end,
        };
      } else if (this.isPunct("(")) {
        const lparen = this.next();
        const args = this.parseArguments();
        const rparen = this.expectPunct(")");
        expr = {
          kind: "call",
          func: expr,
          args,
          lparen: lparen.start,
          start: expr.start,
          end: rparen.end,
        };
      } else if (this.isPunct("[")) {
        this.next();
        expr = this.parseIndexOrSlice(expr);
      } else {
        return expr;
      }
    }
  }

  private parseIndexOrSlice(object: Expr): Expr {
    let lo: Expr | undefined;
    let hi: Expr | undefined;
    let step: Expr | undefined;
    if (!this.isPunct(":")) {
      lo = this.parseTest();
      if (!this.isPunct(":")) {
        const closeIndex = this.expectPunct("]");
        return {
          kind: "index",
          object,
          index: lo,
          start: object.start,
          end: closeIndex.end,
        };
      }
    }
    this.expectPunct(":");
    if (!this.isPunct("]") && !this.isPunct(":")) {
      hi = this.parseTest();
    }
    if (this.acceptPunct(":")) {
      if (!this.isPunct("]")) {
        step = this.parseTest();
      }
    }
    const rbracket = this.expectPunct("]");
    return {
      kind: "slice",
      object,
      lo,
      hi,
      step,
      start: object.start,
      end: rbracket.end,
    };
  }

  private parseArguments(): Argument[] {
    const args: Argument[] = [];
    while (!this.isPunct(")")) {
      const start = this.peek().start;
      if (this.acceptPunct("**")) {
        const value = this.parseTest();
        args.push({ kind: "arg", star: "**", value, start, end: value.end });
      } else if (this.acceptPunct("*")) {
        const value = this.parseTest();
        args.push({ kind: "arg", star: "*", value, start, end: value.end });
      } else if (this.peek().kind === TokenKind.IDENT && this.isPunct("=", 1)) {
        const nameTok = this.next();
        this.next();
        const value = this.parseTest();
        args.push({
          kind: "arg",
          name: nameTok.text,
          nameSpan: { start: nameTok.start, end: nameTok.end },
          value,
          start,
          end: value.end,
        });
      } else {
        const value = this.parseTest();
        args.push({ kind: "arg", value, start, end: value.end });
      }
      if (!this.acceptPunct(",")) {
        break;
      }
    }
    return args;
  }

  private parseOperand(): Expr {
    const t = this.peek();
    switch (t.kind) {
      case TokenKind.IDENT:
        this.next();
        return { kind: "ident", name: t.text, start: t.start, end: t.end };
      case TokenKind.INT:
        this.next();
        return { kind: "int", text: t.text, start: t.start, end: t.end };
      case TokenKind.FLOAT:
        this.next();
        return { kind: "float", text: t.text, start: t.start, end: t.end };
      case TokenKind.STRING:
        this.next();
        return this.stringLiteral(t);
      case TokenKind.PUNCT:
        switch (t.text) {
          case "(":
            return this.parseParenOrTuple();
          case "[":
            return this.parseListOrComprehension();
          case "{":
            return this.parseDictOrComprehension();
          default:
            break;
        }
        break;
      case TokenKind.KEYWORD:
        // Allow `load` to be used as an identifier outside statements.
        if (t.text === "load") {
          this.next();
          return { kind: "ident", name: t.text, start: t.start, end: t.end };
        }
        break;
      default:
        break;
    }
    return this.fail(
      t.kind === TokenKind.EOF
        ? "unexpected end of file"
        : `unexpected token ${JSON.stringify(t.text || t.kind)}`,
    );
  }

  private parseParenOrTuple(): Expr {
    const lparen = this.next();
    if (this.isPunct(")")) {
      const closeEmpty = this.next();
      return {
        kind: "tuple",
        elements: [],
        start: lparen.start,
        end: closeEmpty.end,
      };
    }
    const first = this.parseTest();
    if (this.isKeyword("for")) {
      // Generator expressions aren't Starlark, but parse them leniently.
      const clauses = this.parseCompClauses();
      const closeGen = this.expectPunct(")");
      return {
        kind: "comprehension",
        curly: false,
        body: first,
        clauses,
        start: lparen.start,
        end: closeGen.end,
      };
    }
    if (!this.isPunct(",")) {
      const closeParen = this.expectPunct(")");
      return {
        kind: "paren",
        inner: first,
        start: lparen.start,
        end: closeParen.end,
      };
    }
    const elements = [first];
    while (this.acceptPunct(",")) {
      if (this.isPunct(")")) {
        break;
      }
      elements.push(this.parseTest());
    }
    const rparen = this.expectPunct(")");
    return {
      kind: "tuple",
      elements,
      start: lparen.start,
      end: rparen.end,
    };
  }

  private parseListOrComprehension(): Expr {
    const lbracket = this.next();
    if (this.isPunct("]")) {
      const closeEmpty = this.next();
      return {
        kind: "list",
        elements: [],
        start: lbracket.start,
        end: closeEmpty.end,
      };
    }
    const first = this.parseTest();
    if (this.isKeyword("for")) {
      const clauses = this.parseCompClauses();
      const closeComp = this.expectPunct("]");
      return {
        kind: "comprehension",
        curly: false,
        body: first,
        clauses,
        start: lbracket.start,
        end: closeComp.end,
      };
    }
    const elements = [first];
    while (this.acceptPunct(",")) {
      if (this.isPunct("]")) {
        break;
      }
      elements.push(this.parseTest());
    }
    const rbracket = this.expectPunct("]");
    return {
      kind: "list",
      elements,
      start: lbracket.start,
      end: rbracket.end,
    };
  }

  private parseDictOrComprehension(): Expr {
    const lbrace = this.next();
    if (this.isPunct("}")) {
      const closeEmpty = this.next();
      return {
        kind: "dict",
        entries: [],
        start: lbrace.start,
        end: closeEmpty.end,
      };
    }
    const first = this.parseDictEntry();
    if (this.isKeyword("for")) {
      const clauses = this.parseCompClauses();
      const closeComp = this.expectPunct("}");
      return {
        kind: "comprehension",
        curly: true,
        body: first,
        clauses,
        start: lbrace.start,
        end: closeComp.end,
      };
    }
    const entries = [first];
    while (this.acceptPunct(",")) {
      if (this.isPunct("}")) {
        break;
      }
      entries.push(this.parseDictEntry());
    }
    const rbrace = this.expectPunct("}");
    return { kind: "dict", entries, start: lbrace.start, end: rbrace.end };
  }

  private parseDictEntry(): DictEntry {
    const key = this.parseTest();
    this.expectPunct(":");
    const value = this.parseTest();
    return { key, value, start: key.start, end: value.end };
  }

  private parseCompClauses(): (ForClause | IfClause)[] {
    const clauses: (ForClause | IfClause)[] = [];
    for (;;) {
      if (this.isKeyword("for")) {
        const forTok = this.next();
        const target = this.parseLoopVariables();
        if (!this.acceptKeyword("in")) {
          this.fail("expected 'in'");
        }
        const iter = this.parseOr();
        clauses.push({
          kind: "forClause",
          target,
          iter,
          start: forTok.start,
          end: iter.end,
        });
      } else if (this.isKeyword("if")) {
        const ifTok = this.next();
        const test = this.parseOr();
        clauses.push({
          kind: "ifClause",
          test,
          start: ifTok.start,
          end: test.end,
        });
      } else {
        return clauses;
      }
    }
  }

  private binary(op: string, left: Expr, right: Expr): Expr {
    return {
      kind: "binary",
      op,
      left,
      right,
      start: left.start,
      end: right.end,
    };
  }

  private stringLiteral(t: Token): StringLiteral {
    return {
      kind: "string",
      value: t.value ?? "",
      triple: t.triple ?? false,
      start: t.start,
      end: t.end,
    };
  }
}
