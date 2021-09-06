module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
  rules: {
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-unused-vars": [
      "error",
      { varsIgnorePattern: "^_", argsIgnorePattern: "^_", ignoreRestSiblings: true }
    ]
  },
  overrides: [
    {
      files: ["src/antlr/SqlBaseLexer.ts", "src/antlr/SqlBaseParser.ts"],
      rules: {
        "no-useless-escape": "off",
        "@typescript-eslint/no-unused-vars": "off"
      }
    },
    {
      files: ["src/antlr/SqlBaseParser.ts"],
      rules: {
        "no-empty": "off"
      }
    }
  ]
};
