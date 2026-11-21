// v1's portrait cropper (tools/album-portraits/portraits.py) on a folder in an album's shape: the faces on the book's plates,
// cut for the cast to bind. Runs on the Python NOVEL_PORTRAIT_PYTHON names (python3 otherwise).
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

async function cropperPath(): Promise<string> {
  let directory = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    try {
      const pkg = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
      if (pkg.name === "story-graph") return join(directory, "tools", "album-portraits", "portraits.py");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const parent = dirname(directory);
    if (parent === directory) throw new Error("Portrait cropper not installed with this CLI");
    directory = parent;
  }
}
/** v1's portrait cropper (tools/album-portraits/portraits.py) on a folder in an album's shape; `check` asks only whether it can run. */
export async function cropper(novelDir: string, check: boolean, env: NodeJS.ProcessEnv): Promise<Record<string, unknown>> {
  const childEnv: NodeJS.ProcessEnv = { PYTHONUTF8: "1", PYTHONDONTWRITEBYTECODE: "1" };
  for (const key of ["PATH", "HOME", "TMPDIR", "XDG_CACHE_HOME", "HF_HOME", "HF_HUB_CACHE", "HF_HUB_OFFLINE", "TRANSFORMERS_OFFLINE"]) {
    if (env[key] !== undefined) childEnv[key] = env[key];
  }
  const script = await cropperPath();
  return new Promise((resolveResult, reject) => {
    const child = spawn(env.NOVEL_PORTRAIT_PYTHON || "python3", [script, novelDir, ...(check ? ["--check"] : [])], {
      env: childEnv, stdio: ["ignore", "pipe", "pipe"], timeout: check ? 15000 : 300000, killSignal: "SIGKILL",
    });
    const stop = () => { child.kill("SIGKILL"); };
    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);
    const chunks: Buffer[] = [];
    let bytes = 0;
    let oversized = false;
    child.stdout.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 256000) { oversized = true; child.kill("SIGKILL"); }
      else chunks.push(chunk);
    });
    child.stderr.resume();
    child.once("error", () => reject(new Error("Portrait Python unavailable; configure NOVEL_PORTRAIT_PYTHON on the host")));
    child.once("close", (code) => {
      process.removeListener("SIGTERM", stop);
      process.removeListener("SIGINT", stop);
      if (code !== 0 || oversized) { reject(new Error("Portrait cropper failed or exceeded its budget; existing assignments were preserved. Check the local Python installation, cached models and album assets.")); return; }
      try {
        const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected object");
        resolveResult(value);
      }
      catch { reject(new Error("Portrait cropper returned an invalid result")); }
    });
  });
}
