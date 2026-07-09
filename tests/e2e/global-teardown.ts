import { execFileSync } from "node:child_process";
import { readFile, rm } from "node:fs/promises";

const SERVER_STATE_PATH = "test-results/e2e-server.json";

export default async function globalTeardown() {
  let pid: number | undefined;
  try {
    const state = JSON.parse(await readFile(SERVER_STATE_PATH, "utf8")) as { pid?: number };
    pid = state.pid;
  } catch {
    return;
  } finally {
    await rm(SERVER_STATE_PATH, { force: true });
  }

  if (!pid) return;

  try {
    if (process.platform === "win32") {
      execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      process.kill(-pid, "SIGTERM");
    }
  } catch {
    // The server may already have exited.
  }
}
