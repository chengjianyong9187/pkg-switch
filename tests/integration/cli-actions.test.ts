// ts
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCli } from "../../src/index.js";
import { createAppPaths } from "../../src/storage/app-paths.js";
import { createBackup } from "../../src/storage/backup-repo.js";
import { writeJsonFile } from "../../src/storage/config-repo.js";

describe("cli actions", () => {
  let homeDir: string | undefined;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.exitCode = undefined;
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    process.exitCode = undefined;

    if (homeDir) {
      await rm(homeDir, { force: true, recursive: true });
      homeDir = undefined;
    }
  });

  async function prepareHome(): Promise<string> {
    homeDir = await mkdtemp(path.join(os.tmpdir(), "pkg-switch-cli-"));
    const appPaths = createAppPaths(homeDir);

    await writeJsonFile(appPaths.configFile, {
      defaults: {
        writeTargets: ["npm", "yarn"],
        backupBeforeWrite: true
      },
      common: {
        npm: {
          registry: "https://registry.npmmirror.com/"
        },
        yarn: {
          nodeLinker: "node-modules"
        }
      },
      profiles: {
        "CJY-WORK": {
          npm: {
            registry: "https://nexus.example.com/repository/npm-group/",
            authToken: "plain-text-token"
          }
        },
        "CJY-PERSONAL": {
          npm: {
            authToken: null
          }
        }
      }
    });

    return homeDir;
  }

  function loggedText(): string {
    return logSpy.mock.calls.map((call) => call.join(" ")).join("\n");
  }

  it("profile list/show 应读取配置并脱敏展示", async () => {
    const preparedHome = await prepareHome();

    await runCli(["profile", "list"], { homeDir: preparedHome });
    await runCli(["profile", "show", "CJY-WORK"], { homeDir: preparedHome });

    const output = loggedText();
    expect(output).toContain("CJY-PERSONAL");
    expect(output).toContain("CJY-WORK");
    expect(output).toContain("pla***ken");
    expect(output).not.toContain("plain-text-token");
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("switch 和 current 应切换配置并展示当前状态", async () => {
    const preparedHome = await prepareHome();

    await runCli(["switch", "CJY-WORK"], { homeDir: preparedHome });
    await runCli(["current"], { homeDir: preparedHome });

    expect(errorSpy).not.toHaveBeenCalled();
    const npmrc = await readFile(path.join(preparedHome, ".npmrc"), "utf8");
    const output = loggedText();

    expect(npmrc).toContain("registry=https://nexus.example.com/repository/npm-group/");
    expect(output).toContain("Switched to CJY-WORK");
    expect(output).toContain("Active profile: CJY-WORK");
  });

  it("doctor 应输出诊断摘要", async () => {
    const preparedHome = await prepareHome();

    await runCli(["doctor"], {
      homeDir: preparedHome,
      commandExists: async (commandName) => commandName !== "yarn"
    });

    const output = loggedText();
    expect(output).toContain("Doctor status: warning");
    expect(output).toContain("yarn-command: warning");
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("switch --cache-clean 应按单次指定模式执行缓存清理", async () => {
    const preparedHome = await prepareHome();
    const commands: Array<{ command: string; args: string[] }> = [];

    await runCli(["switch", "CJY-WORK", "--cache-clean", "smart"], {
      homeDir: preparedHome,
      runCacheCommand: async (command, args) => {
        commands.push({ command, args });
      }
    });

    expect(commands).toEqual([
      { command: "npm", args: ["cache", "clean", "--force"] },
      { command: "yarn", args: ["cache", "clean"] }
    ]);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("switch --no-cache-clean 应跳过配置默认启用的缓存清理", async () => {
    const preparedHome = await prepareHome();
    const appPaths = createAppPaths(preparedHome);

    await writeJsonFile(appPaths.configFile, {
      defaults: {
        writeTargets: ["npm"],
        backupBeforeWrite: false,
        clearCacheOnSwitch: true,
        cacheCleanMode: "smart"
      },
      profiles: {
        "CJY-WORK": {
          npm: {
            registry: "https://nexus.example.com/repository/npm-group/"
          }
        }
      }
    });

    await runCli(["switch", "CJY-WORK", "--no-cache-clean"], {
      homeDir: preparedHome,
      runCacheCommand: async () => {
        throw new Error("cache clean should not run");
      }
    });

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("switch --cache-clean 非法模式应设置失败退出码且不写入 rc 文件", async () => {
    const preparedHome = await prepareHome();

    await runCli(["switch", "CJY-WORK", "--cache-clean", "invalid"], { homeDir: preparedHome });

    const errorOutput = errorSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(errorOutput).toContain("Invalid cache clean mode: invalid");
    await expect(readFile(path.join(preparedHome, ".npmrc"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    expect(process.exitCode).toBe(1);
  });

  it("switch --cache-clean 缺少模式时应设置失败退出码且不写入 rc 文件", async () => {
    const preparedHome = await prepareHome();

    await runCli(["switch", "CJY-WORK", "--cache-clean"], { homeDir: preparedHome });

    const errorOutput = errorSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(errorOutput).toContain("cache clean mode is required");
    await expect(readFile(path.join(preparedHome, ".npmrc"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    expect(process.exitCode).toBe(1);
  });

  it("backup list 应输出可恢复备份摘要", async () => {
    const preparedHome = await prepareHome();
    const appPaths = createAppPaths(preparedHome);
    const npmrcFile = path.join(preparedHome, ".npmrc");

    await writeFile(npmrcFile, "registry=https://old.example.com/\n", "utf8");
    const backupId = await createBackup(appPaths.backupDir, [{ filePath: npmrcFile }], new Date("2026-01-01T00:00:00.000Z"));

    await runCli(["backup", "list"], { homeDir: preparedHome });

    const output = loggedText();
    expect(output).toContain(backupId);
    expect(output).toContain("2026-01-01T00:00:00.000Z");
    expect(output).toContain("files=1");
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
