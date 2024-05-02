// @ts-check

const globals = require("globals");
const eslint = require("@eslint/js");
const tseslint = require("typescript-eslint");
const jsdoc = require("eslint-plugin-jsdoc");
const eslintConfigPrettier = require("eslint-config-prettier");

module.exports = tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintConfigPrettier,
  {
    ignores: ["out/", "src/protos/protos.js", "src/protos/protos.d.ts"],
  },
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        project: true,
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      jsdoc,
    },
    rules: {
      "@typescript-eslint/adjacent-overload-signatures": "error",
      "@typescript-eslint/array-type": [
        "error",
        {
          default: "array",
        },
      ],
      "@typescript-eslint/ban-types": [
        "error",
        {
          types: {
            Object: {
              message: "Avoid using the `Object` type. Did you mean `object`?",
            },
            Function: {
              message:
                "Avoid using the `Function` type. Prefer a specific function " +
                "type, like `() => void`.",
            },
            // eslint-disable-next-line id-denylist
            Boolean: {
              message:
                "Avoid using the `Boolean` type. Did you mean `boolean`?",
            },
            // eslint-disable-next-line id-denylist
            Number: {
              message: "Avoid using the `Number` type. Did you mean `number`?",
            },
            // eslint-disable-next-line id-denylist
            String: {
              message: "Avoid using the `String` type. Did you mean `string`?",
            },
            Symbol: {
              message: "Avoid using the `Symbol` type. Did you mean `symbol`?",
            },
          },
        },
      ],
      "@typescript-eslint/consistent-type-assertions": "error",
      "@typescript-eslint/dot-notation": "error",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "variable",
          format: ["camelCase", "UPPER_CASE", "PascalCase"],
          leadingUnderscore: "allow",
          trailingUnderscore: "forbid",
        },
      ],
      "@typescript-eslint/no-empty-function": "error",
      "@typescript-eslint/no-empty-interface": "error",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-new": "error",
      "@typescript-eslint/no-namespace": "error",
      "@typescript-eslint/no-parameter-properties": "off",
      "@typescript-eslint/no-shadow": [
        "error",
        {
          hoist: "all",
        },
      ],
      "@typescript-eslint/no-unused-expressions": "error",
      "@typescript-eslint/no-use-before-define": "off",
      "@typescript-eslint/no-var-requires": "error",
      "@typescript-eslint/prefer-for-of": "error",
      "@typescript-eslint/prefer-function-type": "error",
      "@typescript-eslint/prefer-namespace-keyword": "error",
      "@typescript-eslint/triple-slash-reference": [
        "error",
        {
          path: "always",
          types: "prefer-import",
          lib: "always",
        },
      ],
      "@typescript-eslint/typedef": "off",
      "@typescript-eslint/unified-signatures": "error",
      complexity: "off",
      "constructor-super": "error",
      "dot-notation": "off",
      eqeqeq: ["error", "smart"],
      "guard-for-in": "error",
      "id-denylist": [
        "error",
        "any",
        "Number",
        "number",
        "String",
        "string",
        "Boolean",
        "boolean",
        "Undefined",
        "undefined",
      ],
      "id-match": "error",
      "jsdoc/check-alignment": "error",
      "jsdoc/check-indentation": "error",
      "max-len": [
        "error",
        {
          ignorePattern: "^(import |export)",
          ignoreComments: true,
          ignoreTemplateLiterals: true,
          code: 80,
        },
      ],
      "new-parens": "error",
      "no-bitwise": "error",
      "no-caller": "error",
      "no-cond-assign": "error",
      "no-console": "error",
      "no-debugger": "error",
      "no-empty": "error",
      "no-empty-function": "off",
      "no-eval": "error",
      "no-fallthrough": "off",
      "no-invalid-this": "off",
      "no-new-wrappers": "error",
      "no-shadow": "off",
      "no-throw-literal": "error",
      "no-trailing-spaces": "error",
      "no-undef-init": "error",
      "no-underscore-dangle": "off",
      "no-unsafe-finally": "error",
      "no-unused-expressions": "off",
      "no-unused-labels": "error",
      "no-use-before-define": "off",
      "no-var": "error",
      "object-shorthand": "error",
      "one-var": ["error", "never"],
      "prefer-arrow-callback": "error",
      "prefer-const": "error",
      radix: "error",
      "spaced-comment": [
        "error",
        "always",
        {
          markers: ["/"],
        },
      ],
      "use-isnan": "error",
      "valid-typeof": "off",
    },
  },
  {
    // `@eslint/js` is currently missing type information.
    // Re-enable the type checks as soon as we have type infos.
    // For vscode-test.js, we also don't use TypeScript, yet.
    files: ["eslint.config.js", ".vscode-test.js"],
    extends: [tseslint.configs.disableTypeChecked],
    rules: {
      // Re-enable as soon as we are using ES modules for the config files.
      "@typescript-eslint/no-var-requires": "off",
    },
  },
);
