module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  parserOptions: {
    project: ["./tsconfig.eslint.json"] // Specify it only for TypeScript files
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "prettier"
  ],
  rules: {
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-unused-vars": [
      "error",
      { varsIgnorePattern: "^_", argsIgnorePattern: "^_", ignoreRestSiblings: true }
    ],
    "@typescript-eslint/no-unnecessary-condition": "error"
  },
  overrides: [
    {
      files: ["src/antlr/SqlBaseLexer.ts", "src/antlr/SqlBaseParser.ts"],
      rules: {
        "no-useless-escape": "off",
        "@typescript-eslint/no-unused-vars": "off",
        "@typescript-eslint/no-unnecessary-condition": "off"
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
