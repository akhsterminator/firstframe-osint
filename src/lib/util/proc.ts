import { spawn } from "node:child_process";

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface RunOptions {
  timeoutMs?: number;
  /** Resolve instead of rejecting on non-zero exit. */
  allowFailure?: boolean;
  input?: Buffer;
  maxBuffer?: number;
}

export class CommandError extends Error {
  constructor(
    public readonly cmd: string,
    public readonly result: RunResult,
  ) {
    const tail = result.stderr.trim().split("\n").slice(-3).join(" | ");
    super(`${cmd} exited with ${result.code}: ${tail}`);
    this.name = "CommandError";
  }
}

export function run(cmd: string, args: string[], opts: RunOptions = {}): Promise<RunResult> {
  const { timeoutMs = 120_000, allowFailure = false, maxBuffer = 32 * 1024 * 1024 } = opts;
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.on("data", (d: Buffer) => {
      if (stdout.length < maxBuffer) stdout += d.toString();
    });
    child.stderr.on("data", (d: Buffer) => {
      if (stderr.length < maxBuffer) stderr += d.toString();
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(
        (err as NodeJS.ErrnoException).code === "ENOENT"
          ? new Error(`${cmd} is not installed or not on PATH`)
          : err,
      );
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const result = { code: code ?? -1, stdout, stderr };
      if (killed) return reject(new Error(`${cmd} timed out after ${Math.round(timeoutMs / 1000)}s`));
      if (code !== 0 && !allowFailure) return reject(new CommandError(cmd, result));
      resolve(result);
    });
    if (opts.input) child.stdin.end(opts.input);
    else child.stdin.end();
  });
}

export async function hasCommand(cmd: string, versionArg = "--version"): Promise<boolean> {
  try {
    await run(cmd, [versionArg], { timeoutMs: 10_000, allowFailure: true });
    return true;
  } catch {
    return false;
  }
}
