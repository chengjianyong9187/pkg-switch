// ts
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getCurrentStatus } from "../../src/core/current-service.js";
import { createAppPaths } from "../../src/storage/app-paths.js";
import { writeJsonFile } from "../../src/storage/config-repo.js";

describe("getCurrentStatus", () => {
  let homeDir: string | undefined;

  afterEach(async () => {
    if (homeDir) {
      await rm(homeDir, { force: true, recursive: true });
      homeDir = undefined;
    }
  });

  it("应读取当前激活 profile 与状态文件路径", async () => {
    homeDir = await mkdtemp(path.join(os.tmpdir(), "pkg-switch-current-"));
    const appPaths = createAppPaths(homeDir);

    await writeJsonFile(appPaths.stateFile, {
      activeProfile: "CJY-WORK",
      lastBackupId: "backup-001",
      lastSwitchStatus: "success"
    });

    await expect(getCurrentStatus({ homeDir })).resolves.toEqual({
      active: true,
      activeProfile: "CJY-WORK",
      lastBackupId: "backup-001",
      lastSwitchStatus: "success",
      configFile: appPaths.configFile,
      stateFile: appPaths.stateFile
    });
  });

  it("应在 state.json 不存在时返回未激活状态", async () => {
    homeDir = await mkdtemp(path.join(os.tmpdir(), "pkg-switch-current-"));
    const appPaths = createAppPaths(homeDir);

    await expect(getCurrentStatus({ homeDir })).resolves.toEqual({
      active: false,
      configFile: appPaths.configFile,
      stateFile: appPaths.stateFile
    });
  });
});
