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
// Cherche un interpréteur Python : backend/venv, puis venv racine, puis PATH.
// (Les chemins relatifs sont résolus depuis cwd: "backend" du webServer.)
function findBackendPython(): string {
  if (process.env.BACKEND_PYTHON) return process.env.BACKEND_PYTHON;
  const candidates = process.platform === "win32"
    ? [
        { abs: path.join(process.cwd(), "backend", "venv", "Scripts", "python.exe"), rel: "venv\\Scripts\\python.exe" },
        { abs: path.join(process.cwd(), "venv", "Scripts", "python.exe"), rel: "..\\venv\\Scripts\\python.exe" },
      ]
    : [
        { abs: path.join(process.cwd(), "backend", "venv", "bin", "python"), rel: "venv/bin/python" },
        { abs: path.join(process.cwd(), "venv", "bin", "python"), rel: "../venv/bin/python" },
      ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate.abs)) return candidate.rel;
  }
  return "python";
}
const backendPython = findBackendPython();
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
        E2E_TEST_MODE: "true",
        // Base dédiée aux e2e (réinitialisée au démarrage), distincte de la base de dev.
        DATABASE_URL: "sqlite:///agriconnect.e2e.db",
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