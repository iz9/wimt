import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import onlyWarn from "eslint-plugin-only-warn";
import perfectionist from "eslint-plugin-perfectionist";
import turboPlugin from "eslint-plugin-turbo";
import tseslint from "typescript-eslint";

/**
 * A shared ESLint configuration for the repository.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const config = [
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  {
    plugins: {
      turbo: turboPlugin,
      perfectionist,
    },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
      "no-console": 2,
      "padding-line-between-statements": [
        2,
        {
          blankLine: "always",
          prev: "*",
          next: "*",
        },
        {
          blankLine: "any",
          prev: "import",
          next: "import",
        },
        {
          blankLine: "any",
          prev: "const",
          next: "const",
        },
        {
          blankLine: "any",
          prev: "expression",
          next: "expression",
        },
        {
          blankLine: "any",
          prev: "let",
          next: "let",
        },
        {
          blankLine: "never",
          prev: "case",
          next: "*",
        },
        {
          blankLine: "never",
          prev: "*",
          next: "break",
        },
      ],

      "perfectionist/sort-intersection-types": 0,
      "perfectionist/sort-imports": [
        2,
        {
          type: "natural",
          order: "asc",

          groups: [
            ["side-effect", "side-effect-style"],
            "react",
            "type",
            ["builtin", "external"],
            "internal-type",
            "internal",
            // "alias-type",
            // "alias",
            ["parent-type", "sibling-type", "index-type"],
            ["parent", "sibling", "index"],
            "style",
            "object",
            "unknown",
          ],

          customGroups: {
            value: {
              react: ["^react$", "^react-.+"],
              // alias: ['^@src\/.+'],
            },

            type: {
              react: ["^react$", "^react-.+"],
              // 'alias-type': ['^@src\/.+'],
            },
          },

          newlinesBetween: "always",
          internalPattern: ["^@wimt\/.+"],
        },
      ],

      "perfectionist/sort-modules": [
        "error",
        {
          type: "natural",
          order: "asc",
        },
      ],

      "perfectionist/sort-classes": [
        2,
        {
          type: "natural",
          order: "asc",
          groups: [
            "index-signature",
            "public-static-property",
            "property",
            "protected-property",
            "private-property",
            "constructor",
            "init",
            "destruct",
            ["public-get-method", "public-set-method"],
            ["protected-get-method", "protected-set-method"],
            "static-method",
            "static-function-property",
            "method",
            "function-property",
            "protected-method",
            "protected-function-property",
            "unknown",
            ["private-get-method", "private-set-method"],
            "private-method",
            "private-function-property",
            "static-private-method",
            "static-private-property",
          ],

          customGroups: [
            {
              groupName: "init",
              elementNamePattern: "^init$",
            },
            {
              groupName: "destruct",
              elementNamePattern: "^destruct$",
            },
          ],
        },
      ],

      "lines-between-class-members": [
        2,
        {
          enforce: [
            {
              blankLine: "always",
              prev: "*",
              next: "method",
            },
            {
              blankLine: "always",
              prev: "method",
              next: "*",
            },
            {
              blankLine: "never",
              prev: "field",
              next: "field",
            },
          ],
        },
      ],
    },
  },
  {
    plugins: {
      onlyWarn,
    },
  },
  {
    ignores: ["dist/**"],
  },
];
