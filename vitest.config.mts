import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    // .claude/ holds agent worktrees (full repo copies with their own node_modules), which must not run here.
    exclude: ["**/node_modules/**", ".next/**", ".claude/**"],
  },
});
