import js from "@eslint/js";
import agentRules from "@david/eslint-plugin-agent-rules";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      "agent-rules": agentRules,
    },
    rules: {
      "agent-rules/no-date-footguns": "error",
      "agent-rules/no-low-value-local-function": "error",
      "no-irregular-whitespace": ["error", {skipTemplates: true}],
    },
  },
];
