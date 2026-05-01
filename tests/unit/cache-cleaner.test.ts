// ts
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach } from "vitest";
import { describe, expect, it } from "vitest";
import { cleanCaches } from "../../src/managers/cache-cleaner.js";

describe("cleanCaches", () => {
  let tempDir: string | undefined;
  let originalPath: string | undefined;

  afterEach(async () => {
    if (originalPath !== undefined) {
      process.env.PATH = originalPath;
      originalPath = undefined;
    }

    if (tempDir) {
      await rm(tempDir, { force: true, recursive: true });
      tempDir = undefined;
    }
  });

  async function writeFakeCommand(binDir: string, commandName: string): Promise<void> {
    if (process.platform === "win32") {
      await writeFile(path.join(binDir, `${commandName}.cmd`), "@echo off\r\necho ok\r\n", "utf8");
      return;
    }

    const commandFile = path.join(binDir, commandName);
    await writeFile(commandFile, "#!/bin/sh\necho ok\n", "utf8");
    await chmod(commandFile, 0o755);
  }

  it("smart 模式应按目标包管理器执行缓存清理命令", async () => {
    const commands: Array<{ command: string; args: string[] }> = [];

    const result = await cleanCaches({
      mode: "smart",
      targets: ["npm", "pnpm", "yarn"],
      runCommand: async (command, args) => {
        commands.push({ command, args });
      }
    });

    expect(result.status).toBe("success");
    expect(commands).toEqual([
      { command: "npm", args: ["cache", "clean", "--force"] },
      { command: "pnpm", args: ["store", "prune"] },
      { command: "yarn", args: ["cache", "clean"] }
    ]);
  });

  it("none 模式不应执行任何命令", async () => {
    const commands: Array<{ command: string; args: string[] }> = [];

    const result = await cleanCaches({
      mode: "none",
      targets: ["npm", "pnpm", "yarn"],
      runCommand: async (command, args) => {
        commands.push({ command, args });
      }
    });

    expect(result.status).toBe("skipped");
    expect(commands).toEqual([]);
  });

  it("命令失败时应返回 warning 而不是抛出致命异常", async () => {
    const result = await cleanCaches({
      mode: "smart",
      targets: ["npm"],
      runCommand: async () => {
        throw new Error("cache command failed");
      }
    });

    expect(result.status).toBe("warning");
    expect(result.warnings).toEqual([
      expect.objectContaining({
        target: "npm",
        command: "npm cache clean --force",
        message: "cache command failed"
      })
    ]);
  });

  it("默认命令执行器应能运行 PATH 中的包管理器命令", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "pkg-switch-cache-path-"));
    const binDir = path.join(tempDir, "bin");

    await mkdir(binDir);
    await writeFakeCommand(binDir, "npm");

    originalPath = process.env.PATH;
    process.env.PATH = binDir;

    const result = await cleanCaches({
      mode: "smart",
      targets: ["npm"]
    });

    expect(result.status).toBe("success");
    expect(result.commands).toEqual([
      expect.objectContaining({
        target: "npm",
        command: "npm cache clean --force",
        status: "success"
      })
    ]);
  });
});
