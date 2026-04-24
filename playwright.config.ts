import fs from "node:fs";
import path from "node:path";

import { defineConfig, devices } from "@playwright/test";
import {
  PLAYWRIGHT_API_URL,
  PLAYWRIGHT_BACKEND_PORT,
  PLAYWRIGHT_FRONTEND_PORT,
  PLAYWRIGHT_FRONTEND_URL,
  PLAYWRIGHT_HOST,
} from "./e2e/test-config";

const apiUrl = PLAYWRIGHT_API_URL;
const frontendUrl = PLAYWRIGHT_FRONTEND_URL;
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === "true";
const backendPython = process.env.BACKEND_PYTHON
  ?? (process.platform === "win32" && fs.existsSync(path.join(process.cwd(), "backend", "venv", "Scripts", "python.exe"))
    ? "venv\\Scripts\\python.exe"
    : fs.existsSync(path.join(process.cwd(), "backend", "venv", "bin", "python"))
      ? "venv/bin/python"
      : "python");
const processEnv = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
);

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: frontendUrl,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: "node scripts/run-playwright-frontend.js",
      cwd: ".",
      url: frontendUrl,
      timeout: 120_000,
      reuseExistingServer,
      env: {
        ...processEnv,
        NEXT_DIST_DIR: ".next-playwright",
        NEXT_DISABLE_GOOGLE_FONTS: "true",
        NEXT_PUBLIC_API_URL: apiUrl,
        PLAYWRIGHT_FRONTEND_HOST: PLAYWRIGHT_HOST,
        PLAYWRIGHT_FRONTEND_PORT: String(PLAYWRIGHT_FRONTEND_PORT),
      },
    },
    {
      command: `${backendPython} main.py`,
      cwd: "backend",
      url: apiUrl,
      timeout: 120_000,
      reuseExistingServer,
      env: {
        ...processEnv,
        BACKEND_HOST: PLAYWRIGHT_HOST,
        BACKEND_PORT: String(PLAYWRIGHT_BACKEND_PORT),
        FRONTEND_URL: frontendUrl,
      },
    },
  ],
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});