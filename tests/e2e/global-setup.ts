import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const SERVER_URL = "http://localhost:3000";
const SERVER_STATE_PATH = "test-results/e2e-server.json";

async function isServerReady() {
  try {
    const response = await fetch(SERVER_URL);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (await isServerReady()) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${SERVER_URL}`);
}

export default async function globalSetup() {
  if (await isServerReady()) return;

  const command = process.platform === "win32" ? "cmd.exe" : "npm";
  const args = process.platform === "win32" ? ["/c", "npm run dev"] : ["run", "dev"];
  const child = spawn(command, args, {
    cwd: process.cwd(),
    detached: true,
    env: process.env,
    stdio: "ignore",
  });
  child.unref();

  await mkdir(dirname(SERVER_STATE_PATH), { recursive: true });
  await writeFile(SERVER_STATE_PATH, JSON.stringify({ pid: child.pid }), "utf8");
  await waitForServer();
}
