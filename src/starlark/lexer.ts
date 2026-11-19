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

import { SyntaxError } from "./ast";

export enum TokenKind {
  EOF,
  NEWLINE,
  INDENT,
  DEDENT,
  IDENT,
  INT,
  FLOAT,
  STRING,
  /** Keywords and operators, with the token text in `text`. */
  PUNCT,
  KEYWORD,
}

export interface Token {
  kind: TokenKind;
  text: string;
  start: number;
  end: number;
  /** Decoded value for strings. */
  value?: string;
  /** Whether a string literal used triple quotes. */
  triple?: boolean;
}

const KEYWORDS = new Set([
  "and",
  "break",
  "continue",
  "def",
  "elif",
  "else",
  "for",
  "if",
  "in",
  "lambda",
  "load",
  "not",
  "or",
  "pass",
  "return",
  "while",
]);

/** Keywords that can only begin a statement, never continue a bracket. */
const STATEMENT_KEYWORDS = new Set(["def", "load", "if", "for"]);

// Longest operators first so that greedy matching works.
const PUNCTUATION = [
  "**=",
  "//=",
  "<<=",
  ">>=",
  "!=",
  "%=",
  "&=",
  "**",
  "*=",
  "+=",
  "-=",
  "//",
  "/=",
  "<<",
  "<=",
  "==",
  ">=",
  ">>",
  "^=",
  "|=",
  "%",
  "&",
  "(",
  ")",
  "*",
  "+",
  ",",
  "-",
  ".",
  "/",
  ":",
  ";",
  "<",
  "=",
  ">",
  "[",
  "]",
  "^",
  "{",
  "|",
  "}",
  "~",
];

/** The operators starting with each character, longest first. */
const PUNCTUATION_BY_FIRST_CHAR = new Map<number, string[]>();
for (const p of PUNCTUATION) {
  const c = p.charCodeAt(0);
  PUNCTUATION_BY_FIRST_CHAR.set(c, [
    ...(PUNCTUATION_BY_FIRST_CHAR.get(c) ?? []),
    p,
  ]);
}

const HEX2 = /^[0-9a-fA-F]{2}$/;
const HEX4 = /^[0-9a-fA-F]{4}$/;
const HEX8 = /^[0-9a-fA-F]{8}$/;

function isIdentStart(c: number): boolean {
  return (
    (c >= 65 && c <= 90) || // A-Z
    (c >= 97 && c <= 122) || // a-z
    c === 95 || // _
    c > 127 // permissive for unicode identifiers
  );
}

function isDigit(c: number): boolean {
  return c >= 48 && c <= 57;
}

function isIdentPart(c: number): boolean {
  return isIdentStart(c) || isDigit(c);
}

/**
 * Tokenizes Starlark source text.
 *
 * The lexer is tolerant: it never throws, and malformed input produces the
 * best-effort token stream plus entries in {@link errors}.
 */
export class Lexer {
  public readonly tokens: Token[] = [];
  public readonly errors: SyntaxError[] = [];

  private pos = 0;
  private readonly indents: number[] = [0];
  /** Depth of open brackets; newlines are insignificant when > 0. */
  private depth = 0;
  /** Offsets of newline characters, for recovery heuristics. */
  private atLineStart = true;

  constructor(private readonly src: string) {}

  public tokenize(): Token[] {
    while (this.pos < this.src.length) {
      if (this.atLineStart) {
        this.atLineStart = false;
        if (this.handleLineStart()) {
          continue;
        }
      }
      this.scanToken();
    }
    this.finish();
    return this.tokens;
  }

  /**
   * Processes indentation at the start of a physical line. Returns true if
   * the whole line was consumed (blank or comment-only line).
   */
  private handleLineStart(): boolean {
    const lineStart = this.pos;
    let col = 0;
    while (this.pos < this.src.length) {
      const ch = this.src.charCodeAt(this.pos);
      if (ch === 32) {
        col++;
      } else if (ch === 9) {
        col += 8 - (col % 8);
      } else {
        break;
      }
      this.pos++;
    }
    const c = this.src.charCodeAt(this.pos);
    // Blank or comment-only lines don't affect indentation.
    if (this.pos >= this.src.length || c === 10 || c === 13 || c === 35) {
      if (c === 35) {
        this.skipComment();
      }
      this.consumeNewlineChars();
      this.atLineStart = true;
      return true;
    }
    if (this.depth > 0) {
      // Inside brackets, indentation is irrelevant. However, a call or a
      // statement keyword in column 0 almost certainly means an unclosed
      // bracket above: buildifier never places continuation content in
      // column 0. Recover by closing the brackets so that the rest of the
      // file still parses. Keyword arguments or strings in column 0 are
      // left alone, since hand-formatted files do contain those.
      if (col === 0 && this.startsStatement()) {
        this.errors.push({
          start: lineStart,
          end: this.pos,
          message: "unclosed bracket before this line",
        });
        this.depth = 0;
        this.push(TokenKind.NEWLINE, "\n", lineStart, lineStart);
        this.emitIndentation(col, lineStart);
      }
      return false;
    }
    this.emitIndentation(col, lineStart);
    return false;
  }

  /** Whether a statement keyword or a call begins at the cursor. */
  private startsStatement(): boolean {
    let end = this.pos;
    while (end < this.src.length && isIdentPart(this.src.charCodeAt(end))) {
      end++;
    }
    const word = this.src.slice(this.pos, end);
    if (word === "") {
      return false;
    }
    if (STATEMENT_KEYWORDS.has(word)) {
      return true;
    }
    while (this.src[end] === " " || this.src[end] === "\t") {
      end++;
    }
    return this.src[end] === "(";
  }

  private emitIndentation(col: number, at: number) {
    const current = this.indents[this.indents.length - 1];
    if (col > current) {
      this.indents.push(col);
      this.push(TokenKind.INDENT, "", at, at);
    } else {
      while (col < this.indents[this.indents.length - 1]) {
        this.indents.pop();
        this.push(TokenKind.DEDENT, "", at, at);
      }
      if (col !== this.indents[this.indents.length - 1]) {
        this.errors.push({
          start: at,
          end: this.pos,
          message: "inconsistent indentation",
        });
      }
    }
  }

  private consumeNewlineChars() {
    while (this.pos < this.src.length) {
      const c = this.src.charCodeAt(this.pos);
      if (c === 10 || c === 13) {
        this.pos++;
      } else {
        break;
      }
    }
  }

  private skipComment() {
    while (this.pos < this.src.length) {
      const c = this.src.charCodeAt(this.pos);
      if (c === 10 || c === 13) {
        break;
      }
      this.pos++;
    }
  }

  private scanToken() {
    const src = this.src;
    const c = src.charCodeAt(this.pos);

    // Whitespace within a line.
    if (c === 32 || c === 9 || c === 12) {
      this.pos++;
      return;
    }

    // Line continuation.
    if (c === 92 /* \ */) {
      const next = src.charCodeAt(this.pos + 1);
      if (next === 10 || next === 13) {
        this.pos++;
        this.consumeNewlineChars();
        return;
      }
      this.errors.push({
        start: this.pos,
        end: this.pos + 1,
        message: "unexpected character '\\'",
      });
      this.pos++;
      return;
    }

    if (c === 35 /* # */) {
      this.skipComment();
      return;
    }

    if (c === 10 || c === 13) {
      const start = this.pos;
      this.consumeNewlineChars();
      if (this.depth === 0) {
        this.push(TokenKind.NEWLINE, "\n", start, start + 1);
      }
      this.atLineStart = true;
      return;
    }

    if (isIdentStart(c)) {
      // String prefixes: r, b, rb, br.
      const prefixEnd = this.stringPrefixEnd();
      if (prefixEnd !== undefined) {
        this.scanString(this.pos, prefixEnd);
        return;
      }
      const start = this.pos;
      while (this.pos < src.length && isIdentPart(src.charCodeAt(this.pos))) {
        this.pos++;
      }
      const text = src.slice(start, this.pos);
      this.push(
        KEYWORDS.has(text) ? TokenKind.KEYWORD : TokenKind.IDENT,
        text,
        start,
        this.pos,
      );
      return;
    }

    if (isDigit(c) || (c === 46 && isDigit(src.charCodeAt(this.pos + 1)))) {
      this.scanNumber();
      return;
    }

    if (c === 34 || c === 39) {
      this.scanString(this.pos, this.pos);
      return;
    }

    for (const p of PUNCTUATION_BY_FIRST_CHAR.get(c) ?? []) {
      if (src.startsWith(p, this.pos)) {
        const start = this.pos;
        this.pos += p.length;
        if (p === "(" || p === "[" || p === "{") {
          this.depth++;
        } else if (p === ")" || p === "]" || p === "}") {
          if (this.depth > 0) {
            this.depth--;
          }
        }
        this.push(TokenKind.PUNCT, p, start, this.pos);
        return;
      }
    }

    this.errors.push({
      start: this.pos,
      end: this.pos + 1,
      message: `unexpected character ${JSON.stringify(src[this.pos])}`,
    });
    this.pos++;
  }

  /** If a string prefix starts here, returns the offset of the quote. */
  private stringPrefixEnd(): number | undefined {
    const src = this.src;
    let i = this.pos;
    let sawR = false;
    let sawB = false;
    for (let n = 0; n < 2 && i < src.length; n++) {
      const ch = src[i].toLowerCase();
      if (ch === "r" && !sawR) {
        sawR = true;
      } else if (ch === "b" && !sawB) {
        sawB = true;
      } else {
        break;
      }
      i++;
    }
    if (i === this.pos) {
      return undefined;
    }
    const q = src.charCodeAt(i);
    return q === 34 || q === 39 ? i : undefined;
  }

  private scanNumber() {
    const src = this.src;
    const start = this.pos;
    let isFloat = false;
    if (src[this.pos] === "0" && /[xXoObB]/.test(src[this.pos + 1] ?? "")) {
      this.pos += 2;
      while (this.pos < src.length && /[0-9a-fA-F_]/.test(src[this.pos])) {
        this.pos++;
      }
    } else {
      while (this.pos < src.length && isDigit(src.charCodeAt(this.pos))) {
        this.pos++;
      }
      if (src[this.pos] === "." && src[this.pos + 1] !== ".") {
        isFloat = true;
        this.pos++;
        while (this.pos < src.length && isDigit(src.charCodeAt(this.pos))) {
          this.pos++;
        }
      }
      if (/[eE]/.test(src[this.pos] ?? "")) {
        let j = this.pos + 1;
        if (src[j] === "+" || src[j] === "-") {
          j++;
        }
        if (isDigit(src.charCodeAt(j))) {
          isFloat = true;
          this.pos = j;
          while (this.pos < src.length && isDigit(src.charCodeAt(this.pos))) {
            this.pos++;
          }
        }
      }
    }
    this.push(
      isFloat ? TokenKind.FLOAT : TokenKind.INT,
      src.slice(start, this.pos),
      start,
      this.pos,
    );
  }

  private scanString(start: number, quoteAt: number) {
    const src = this.src;
    const prefix = src.slice(start, quoteAt).toLowerCase();
    const raw = prefix.includes("r");
    const quote = src[quoteAt];
    const triple = src.startsWith(quote.repeat(3), quoteAt);
    let i = quoteAt + (triple ? 3 : 1);
    let value = "";
    let terminated = false;
    while (i < src.length) {
      const ch = src[i];
      if (ch === "\\") {
        const next = src[i + 1];
        if (next === undefined) {
          i++;
          break;
        }
        if (raw) {
          value += ch + next;
          i += 2;
          continue;
        }
        i += 2;
        switch (next) {
          case "n":
            value += "\n";
            break;
          case "t":
            value += "\t";
            break;
          case "r":
            value += "\r";
            break;
          case "\n":
            break;
          case "\r":
            if (src[i] === "\n") {
              i++;
            }
            break;
          case "\\":
          case "'":
          case '"':
            value += next;
            break;
          case "x": {
            const hex = src.slice(i, i + 2);
            if (HEX2.test(hex)) {
              value += String.fromCharCode(parseInt(hex, 16));
              i += 2;
            } else {
              value += "\\x";
            }
            break;
          }
          case "u":
          case "U": {
            const len = next === "u" ? 4 : 8;
            const hex = src.slice(i, i + len);
            if ((len === 4 ? HEX4 : HEX8).test(hex)) {
              try {
                value += String.fromCodePoint(parseInt(hex, 16));
              } catch {
                value += "�";
              }
              i += len;
            } else {
              value += "\\" + next;
            }
            break;
          }
          default:
            if (next >= "0" && next <= "7") {
              let oct = next;
              while (oct.length < 3 && src[i] >= "0" && src[i] <= "7") {
                oct += src[i];
                i++;
              }
              value += String.fromCharCode(parseInt(oct, 8));
            } else {
              value += "\\" + next;
            }
        }
        continue;
      }
      if (ch === quote) {
        if (!triple) {
          i++;
          terminated = true;
          break;
        }
        if (src.startsWith(quote.repeat(3), i)) {
          i += 3;
          terminated = true;
          break;
        }
        value += ch;
        i++;
        continue;
      }
      if (!triple && (ch === "\n" || ch === "\r")) {
        break;
      }
      value += ch;
      i++;
    }
    if (!terminated) {
      this.errors.push({
        start,
        end: i,
        message: "unterminated string literal",
      });
    }
    this.pos = i;
    this.tokens.push({
      kind: TokenKind.STRING,
      text: src.slice(start, i),
      start,
      end: i,
      value,
      triple,
    });
  }

  private finish() {
    const end = this.src.length;
    const last = this.tokens[this.tokens.length - 1];
    if (
      last &&
      last.kind !== TokenKind.NEWLINE &&
      last.kind !== TokenKind.DEDENT
    ) {
      this.push(TokenKind.NEWLINE, "\n", end, end);
    }
    while (this.indents.length > 1) {
      this.indents.pop();
      this.push(TokenKind.DEDENT, "", end, end);
    }
    this.push(TokenKind.EOF, "", end, end);
  }

  private push(kind: TokenKind, text: string, start: number, end: number) {
    this.tokens.push({ kind, text, start, end });
  }
}
