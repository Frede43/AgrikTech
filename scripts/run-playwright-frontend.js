const { spawn } = require("node:child_process");
const path = require("node:path");

const nextBin = require.resolve("next/dist/bin/next");
const host = process.env.PLAYWRIGHT_FRONTEND_HOST || "127.0.0.1";
const port = process.env.PLAYWRIGHT_FRONTEND_PORT || "3100";

const env = {
  ...process.env,
  NEXT_DIST_DIR: process.env.NEXT_DIST_DIR || ".next-playwright",
};

function runNext(args, onExit) {
  const child = spawn(process.execPath, [nextBin, ...args], {
    cwd: path.resolve(__dirname, ".."),
    env,
    stdio: "inherit",
  });

  child.on("exit", (code) => onExit(code ?? 1));
  child.on("error", () => onExit(1));
  return child;
}

runNext(["build"], (buildCode) => {
  if (buildCode !== 0) {
    process.exit(buildCode);
  }

  const server = runNext(["start", "--hostname", host, "--port", port], (startCode) => {
    process.exit(startCode);
  });

  const forwardSignal = (signal) => {
    if (!server.killed) {
      server.kill(signal);
    }
  };

  process.on("SIGINT", forwardSignal);
  process.on("SIGTERM", forwardSignal);
});