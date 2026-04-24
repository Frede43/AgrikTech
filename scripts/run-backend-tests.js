const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const testArgs = ["-m", "unittest", "discover", "-s", "backend/tests", "-p", "test_*.py", "-v"];

function getCandidateCommands() {
  const commands = [];
  if (process.env.BACKEND_PYTHON) {
    commands.push(process.env.BACKEND_PYTHON);
  }

  const localVenvPython = process.platform === "win32"
    ? path.join("backend", "venv", "Scripts", "python.exe")
    : path.join("backend", "venv", "bin", "python");

  if (fs.existsSync(path.join(process.cwd(), localVenvPython))) {
    commands.push(localVenvPython);
  }

  commands.push("python", "python3");
  return [...new Set(commands)];
}

for (const command of getCandidateCommands()) {
  const result = spawnSync(command, testArgs, { stdio: "inherit" });

  if (result.error && result.error.code === "ENOENT") {
    continue;
  }

  if (result.error) {
    console.error(`Failed to launch backend tests with '${command}':`, result.error.message);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

console.error("Unable to find a Python executable for backend tests. Set BACKEND_PYTHON to override.");
process.exit(1);