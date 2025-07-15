import pluginRouter from "@tanstack/eslint-plugin-router";
import pluginQuery from "@tanstack/eslint-plugin-query";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "docker/**",
      "node_modules/**",
      ".nitro/**",
      ".tanstack/**",
      ".output/**",
    ],
  },
  ...tseslint.configs.recommended,
  ...pluginRouter.configs["flat/recommended"],
  ...pluginQuery.configs["flat/recommended"],
];
