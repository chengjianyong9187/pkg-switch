// ts
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const distDir = path.join(projectRoot, "dist");
const shellPath = process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : "/bin/sh";
const shellArgs = process.platform === "win32" ? ["/d", "/s", "/c", "pnpm build"] : ["-lc", "pnpm build"];

describe("build contract", () => {
  it("应生成与 bin 匹配的 dist/index.js，且不产出 dist/tests", () => {
    // 每次测试前先清理旧产物，避免历史构建结果掩盖契约问题。
    rmSync(distDir, { force: true, recursive: true });

    execFileSync(shellPath, shellArgs, {
      cwd: projectRoot,
      stdio: "pipe"
    });

    const packageJson = JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8")) as {
      bin: Record<string, string>;
    };
    const binEntry = path.join(projectRoot, packageJson.bin["pkg-switch"]);

    expect(existsSync(binEntry)).toBe(true);
    expect(existsSync(path.join(distDir, "tests"))).toBe(false);
  });
});
