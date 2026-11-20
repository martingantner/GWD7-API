import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "@playwright/test";

const envFile = resolve(process.cwd(), ".env");
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

export default defineConfig(
  {
    testDir: "./tests",
    testMatch: /.*\.spec\.ts/,
    reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  }
);