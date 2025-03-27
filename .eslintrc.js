module.exports = {
  root: true,
  env: {
    node: true,
    es2020: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  rules: {
    "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
    "no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": ["warn", { 
      "argsIgnorePattern": "^_",
      "varsIgnorePattern": "^_" 
    }],
  },
  overrides: [
    {
      files: ["packages/renderer/**/*.ts", "packages/renderer/**/*.tsx"],
      env: {
        browser: true,
      },
      extends: [
        "plugin:react/recommended",
        "plugin:react-hooks/recommended",
      ],
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      plugins: ["react"],
      settings: {
        react: {
          version: "detect",
        }
      },
      rules: {
        "react/react-in-jsx-scope": "off",
        "react/prop-types": "off",
      },
    },
    {
      files: ["packages/main/**/*.ts"],
      env: {
        node: true,
      },
    },
  ],
}; 