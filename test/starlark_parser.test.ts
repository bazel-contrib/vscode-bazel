import * as assert from "assert";
import { parseModule } from "../src/starlark";

describe("Starlark parser", () => {
  it("parses rule calls with keyword arguments", () => {
    const module = parseModule(
      [
        "cc_library(",
        '    name = "lib",',
        '    srcs = ["a.cc", "b.cc"],',
        '    deps = [":dep"] + select({"//:x": []}),',
        ")",
        "",
      ].join("\n"),
    );
    assert.strictEqual(module.errors.length, 0);
    assert.strictEqual(module.stmts.length, 1);
    const stmt = module.stmts[0];
    assert.strictEqual(stmt.kind, "expr");
    if (stmt.kind !== "expr" || stmt.expr.kind !== "call") {
      throw new Error("expected a call");
    }
    assert.deepStrictEqual(
      stmt.expr.args.map((a) => a.name),
      ["name", "srcs", "deps"],
    );
  });

  it("parses load statements with aliases", () => {
    const module = parseModule(
      'load("@rules_python//python:defs.bzl", ' +
        '"py_binary", lib = "py_library")\n',
    );
    assert.strictEqual(module.errors.length, 0);
    const stmt = module.stmts[0];
    assert.strictEqual(stmt.kind, "load");
    if (stmt.kind !== "load") {
      return;
    }
    assert.strictEqual(stmt.module.value, "@rules_python//python:defs.bzl");
    assert.deepStrictEqual(
      stmt.symbols.map((s) => [s.local, s.original]),
      [
        ["py_binary", "py_binary"],
        ["lib", "py_library"],
      ],
    );
  });

  it("parses function definitions, control flow and comprehensions", () => {
    const src = [
      "def f(a, b = 1, *args, **kwargs):",
      '    """Doc."""',
      "    if a and not b:",
      "        return [x for x in args if x]",
      "    elif a:",
      "        pass",
      "    else:",
      "        for k, v in kwargs.items():",
      "            print(k, v)",
      "    return {k: v for k, v in kwargs.items()}",
      "",
      "x = f(1) if True else None",
      "y = lambda z: z ** 2",
      "s = 'a' + \"b\" + '''c''' + r\"\\d\"",
      "n = 0x1f + 1.5e3 - -2",
    ].join("\n");
    const module = parseModule(src);
    assert.deepStrictEqual(module.errors, []);
    assert.deepStrictEqual(
      module.stmts.map((s) => s.kind),
      ["def", "assign", "assign", "assign", "assign"],
    );
    const def = module.stmts[0];
    if (def.kind === "def") {
      assert.strictEqual(def.docstring, "Doc.");
      assert.deepStrictEqual(
        def.params.map((p) => `${p.star ?? ""}${p.name}`),
        ["a", "b", "*args", "**kwargs"],
      );
    }
  });

  it("decodes string escapes", () => {
    const module = parseModule('x = "a\\tb\\n\\x41\\u00e9\\\\"');
    const stmt = module.stmts[0];
    if (stmt.kind === "assign" && stmt.value.kind === "string") {
      assert.strictEqual(stmt.value.value, "a\tb\nA\u00e9\\");
    } else {
      throw new Error("expected a string assignment");
    }
  });

  it("recovers from an unclosed call and keeps parsing later rules", () => {
    const src = [
      "cc_library(",
      '    name = "a",',
      '    srcs = ["a.cc",',
      ")",
      "",
      "cc_library(",
      '    name = "b",',
      ")",
      'foo(name = "c"',
      'bar(name = "d")',
    ].join("\n");
    const module = parseModule(src);
    assert.ok(module.errors.length > 0);
    const names = module.stmts
      .filter((s) => s.kind === "expr")
      .map((s) => {
        if (s.kind !== "expr" || s.expr.kind !== "call") {
          return undefined;
        }
        const arg = s.expr.args.find((a) => a.name === "name");
        return arg?.value.kind === "string" ? arg.value.value : undefined;
      });
    assert.ok(names.includes("b"), `parsed names: ${names}`);
    assert.ok(names.includes("d"), `parsed names: ${names}`);
  });

  it("keeps hand-formatted calls with arguments in column 0", () => {
    const module = parseModule(
      ["http_archive(", 'name = "a",', "urls = [", 'r"u",', "],", ")"].join(
        "\n",
      ),
    );
    assert.deepStrictEqual(module.errors, []);
    const stmt = module.stmts[0];
    assert.ok(stmt.kind === "expr" && stmt.expr.kind === "call");
    assert.deepStrictEqual(
      stmt.expr.args.map((a) => a.name),
      ["name", "urls"],
    );
  });

  it("survives pathologically nested input", () => {
    const module = parseModule("x = " + "(".repeat(5000));
    assert.ok(module.errors.length > 0);
    assert.deepStrictEqual(module.stmts, []);
  });

  it("tolerates incomplete input while typing", () => {
    const module = parseModule('cc_library(\n    name = "lib",\n    srcs = [');
    assert.ok(module.errors.length > 0);
    // Must not throw and must still represent the module.
    assert.ok(Array.isArray(module.stmts));
  });

  it("records positions as offsets", () => {
    const src = 'a = 1\nfoo(name = "x")\n';
    const module = parseModule(src);
    const call = module.stmts[1];
    assert.strictEqual(src.slice(call.start, call.end), 'foo(name = "x")');
  });
});
