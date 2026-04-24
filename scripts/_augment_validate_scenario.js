const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const resultsPath = path.join(__dirname, "_augment_validate_scenario_results.json");

const commands = [
  {
    name: "backend",
    command: "cmd",
    args: ["/c", "npm run test:backend"],
  },
  {
    name: "typecheck",
    command: "cmd",
    args: ["/c", "npm run typecheck"],
  },
  {
    name: "e2e",
    command: "cmd",
    args: ["/c", "npx playwright test"],
  },
];

function tail(text, maxLines = 60) {
  const lines = String(text || "").split(/\r?\n/);
  return lines.slice(-maxLines).join("\n");
}

const startedAt = new Date().toISOString();
const results = {
  startedAt,
  repoRoot,
  steps: [],
  successful: false,
};

for (const step of commands) {
  const stepStart = Date.now();
  const result = spawnSync(step.command, step.args, {
    cwd: repoRoot,
    encoding: "utf-8",
    maxBuffer: 20 * 1024 * 1024,
    env: process.env,
  });

  results.steps.push({
    name: step.name,
    command: [step.command, ...step.args].join(" "),
    exitCode: result.status,
    durationSeconds: Number(((Date.now() - stepStart) / 1000).toFixed(1)),
    signal: result.signal,
    error: result.error ? String(result.error.message || result.error) : null,
    stdoutTail: tail(result.stdout),
    stderrTail: tail(result.stderr),
  });

  if (result.status !== 0) {
    results.finishedAt = new Date().toISOString();
    results.successful = false;
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2), "utf-8");
    process.exit(result.status || 1);
  }
}

results.finishedAt = new Date().toISOString();
results.successful = true;
fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2), "utf-8");
process.exit(0);

