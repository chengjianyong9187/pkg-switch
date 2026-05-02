// ts
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCli } from "../../src/index.js";
import { createAppPaths } from "../../src/storage/app-paths.js";
import { createBackup } from "../../src/storage/backup-repo.js";
import { readJsonFile, writeJsonFile } from "../../src/storage/config-repo.js";
import type { PkgSwitchConfig } from "../../src/shared/types.js";

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
        "work": {
          npm: {
            registry: "https://nexus.example.com/repository/npm-group/",
            authToken: "plain-text-token"
          }
        },
        "personal": {
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
    await runCli(["profile", "show", "work"], { homeDir: preparedHome });

    const output = loggedText();
    expect(output).toContain("personal");
    expect(output).toContain("work");
    expect(output).toContain("pla***ken");
    expect(output).not.toContain("plain-text-token");
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("profile add/remove 应写回 config.json", async () => {
    const preparedHome = await prepareHome();
    const appPaths = createAppPaths(preparedHome);

    await runCli(["profile", "add", "test-profile"], { homeDir: preparedHome });
    await runCli(["profile", "remove", "test-profile"], { homeDir: preparedHome });

    const config = await readJsonFile<PkgSwitchConfig>(appPaths.configFile);
    const output = loggedText();

    expect(config.profiles["test-profile"]).toBeUndefined();
    expect(output).toContain("Added profile: test-profile");
    expect(output).toContain("Removed profile: test-profile");
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("profile set/unset 应更新 config.json 且输出不包含敏感值", async () => {
    const preparedHome = await prepareHome();
    const appPaths = createAppPaths(preparedHome);

    await runCli(["profile", "set", "personal", "npm.extraConfig[//registry.npmjs.org/:_authToken]", "plain-text-token"], {
      homeDir: preparedHome
    });
    await runCli(["profile", "unset", "personal", "npm.extraConfig[//registry.npmjs.org/:_authToken]"], {
      homeDir: preparedHome
    });

    const config = await readJsonFile<PkgSwitchConfig>(appPaths.configFile);
    const output = loggedText();

    expect(config.profiles["personal"].npm?.extraConfig?.["//registry.npmjs.org/:_authToken"]).toBeUndefined();
    expect(output).toContain("Set profile value: personal npm.extraConfig[//registry.npmjs.org/:_authToken]");
    expect(output).toContain("Unset profile value: personal npm.extraConfig[//registry.npmjs.org/:_authToken]");
    expect(output).not.toContain("plain-text-token");
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("profile clone/rename 应维护配置并在重命名激活 profile 时同步 state", async () => {
    const preparedHome = await prepareHome();
    const appPaths = createAppPaths(preparedHome);

    await writeJsonFile(appPaths.stateFile, {
      activeProfile: "work",
      lastSwitchStatus: "success"
    });

    await runCli(["profile", "clone", "work", "staging"], { homeDir: preparedHome });
    await runCli(["profile", "rename", "work", "office"], { homeDir: preparedHome });

    const config = await readJsonFile<PkgSwitchConfig>(appPaths.configFile);
    const state = (await readJsonFile(appPaths.stateFile)) as { activeProfile?: string };
    const output = loggedText();

    expect(config.profiles["staging"]).toEqual(config.profiles["office"]);
    expect(config.profiles["work"]).toBeUndefined();
    expect(state.activeProfile).toBe("office");
    expect(output).toContain("Cloned profile: work -> staging");
    expect(output).toContain("Renamed profile: work -> office");
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("profile remove 当前激活项时应失败且不写回删除", async () => {
    const preparedHome = await prepareHome();
    const appPaths = createAppPaths(preparedHome);

    await writeJsonFile(appPaths.stateFile, {
      activeProfile: "work"
    });
    await runCli(["profile", "remove", "work"], { homeDir: preparedHome });

    const config = await readJsonFile<PkgSwitchConfig>(appPaths.configFile);
    const errorOutput = errorSpy.mock.calls.map((call) => call.join(" ")).join("\n");

    expect(errorOutput).toContain("Cannot remove active profile: work");
    expect(config.profiles["work"]).toBeDefined();
    expect(process.exitCode).toBe(1);
  });

  it("switch 和 current 应切换配置并展示当前状态", async () => {
    const preparedHome = await prepareHome();

    await runCli(["switch", "work"], { homeDir: preparedHome });
    await runCli(["current"], { homeDir: preparedHome });

    expect(errorSpy).not.toHaveBeenCalled();
    const npmrc = await readFile(path.join(preparedHome, ".npmrc"), "utf8");
    const output = loggedText();

    expect(npmrc).toContain("registry=https://nexus.example.com/repository/npm-group/");
    expect(output).toContain("Switched to work");
    expect(output).toContain("Active profile: work");
  });

  it("switch --dry-run 应预览写入内容但不落盘、不创建 state", async () => {
    const preparedHome = await prepareHome();
    const appPaths = createAppPaths(preparedHome);

    await runCli(["switch", "work", "--dry-run"], { homeDir: preparedHome });

    const output = loggedText();
    expect(output).toContain("Dry run for profile: work");
    expect(output).toContain("registry=https://nexus.example.com/repository/npm-group/");
    expect(output).toContain("_authToken=pla***ken");
    expect(output).not.toContain("plain-text-token");
    await expect(readFile(path.join(preparedHome, ".npmrc"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(appPaths.stateFile, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("switch --diff 应输出脱敏差异但不落盘", async () => {
    const preparedHome = await prepareHome();

    await writeFile(path.join(preparedHome, ".npmrc"), "registry=https://old.example.com/\n_authToken=old-token\n", "utf8");
    await runCli(["switch", "work", "--diff"], { homeDir: preparedHome });

    const output = loggedText();
    expect(output).toContain("Diff for profile: work");
    expect(output).toContain("-registry=https://old.example.com/");
    expect(output).toContain("+registry=https://nexus.example.com/repository/npm-group/");
    expect(output).toContain("-_authToken=old***ken");
    expect(output).toContain("+_authToken=pla***ken");
    expect(output).not.toContain("plain-text-token");
    expect(await readFile(path.join(preparedHome, ".npmrc"), "utf8")).toBe("registry=https://old.example.com/\n_authToken=old-token\n");
  });

  it("init 应创建默认配置，已有配置时可用 --force 覆盖", async () => {
    homeDir = await mkdtemp(path.join(os.tmpdir(), "pkg-switch-cli-init-"));
    const appPaths = createAppPaths(homeDir);

    await runCli(["init"], { homeDir });
    await runCli(["init", "--force"], { homeDir });

    const config = await readJsonFile<PkgSwitchConfig>(appPaths.configFile);
    const output = loggedText();

    expect(config.profiles.work).toBeDefined();
    expect(config.profiles.personal).toBeDefined();
    expect(output).toContain(`Created config: ${appPaths.configFile}`);
    expect(output).toContain(`Overwrote config: ${appPaths.configFile}`);
    expect(errorSpy).not.toHaveBeenCalled();
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

    await runCli(["switch", "work", "--cache-clean", "smart"], {
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
        "work": {
          npm: {
            registry: "https://nexus.example.com/repository/npm-group/"
          }
        }
      }
    });

    await runCli(["switch", "work", "--no-cache-clean"], {
      homeDir: preparedHome,
      runCacheCommand: async () => {
        throw new Error("cache clean should not run");
      }
    });

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("switch --cache-clean 非法模式应设置失败退出码且不写入 rc 文件", async () => {
    const preparedHome = await prepareHome();

    await runCli(["switch", "work", "--cache-clean", "invalid"], { homeDir: preparedHome });

    const errorOutput = errorSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(errorOutput).toContain("Invalid cache clean mode: invalid");
    await expect(readFile(path.join(preparedHome, ".npmrc"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    expect(process.exitCode).toBe(1);
  });

  it("switch --cache-clean 缺少模式时应设置失败退出码且不写入 rc 文件", async () => {
    const preparedHome = await prepareHome();

    await runCli(["switch", "work", "--cache-clean"], { homeDir: preparedHome });

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

  it("backup delete/prune 应删除指定备份并裁剪旧备份", async () => {
    const preparedHome = await prepareHome();
    const appPaths = createAppPaths(preparedHome);
    const npmrcFile = path.join(preparedHome, ".npmrc");

    await writeFile(npmrcFile, "registry=https://old.example.com/\n", "utf8");
    const deleteBackupId = await createBackup(appPaths.backupDir, [{ filePath: npmrcFile }], new Date("2026-01-01T00:00:00.000Z"));
    const olderBackupId = await createBackup(appPaths.backupDir, [{ filePath: npmrcFile }], new Date("2026-01-02T00:00:00.000Z"));
    const newerBackupId = await createBackup(appPaths.backupDir, [{ filePath: npmrcFile }], new Date("2026-01-03T00:00:00.000Z"));

    await runCli(["backup", "delete", deleteBackupId], { homeDir: preparedHome });
    await runCli(["backup", "prune", "--keep", "1"], { homeDir: preparedHome });

    const output = loggedText();

    await expect(readFile(path.join(appPaths.backupDir, deleteBackupId, "manifest.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(path.join(appPaths.backupDir, olderBackupId, "manifest.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(path.join(appPaths.backupDir, newerBackupId, "manifest.json"), "utf8")).resolves.toContain(newerBackupId);
    expect(output).toContain(`Deleted backup: ${deleteBackupId}`);
    expect(output).toContain(`Pruned backups: ${olderBackupId}`);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
