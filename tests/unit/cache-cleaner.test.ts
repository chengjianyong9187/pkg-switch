// ts
import { describe, expect, it } from "vitest";
import { cleanCaches } from "../../src/managers/cache-cleaner.js";

describe("cleanCaches", () => {
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
});
