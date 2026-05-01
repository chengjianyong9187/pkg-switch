// ts
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { restoreProfileBackup } from "../../src/core/restore-service.js";
import { createAppPaths } from "../../src/storage/app-paths.js";
import { createBackup } from "../../src/storage/backup-repo.js";
import { readOptionalJsonFile, writeJsonFile } from "../../src/storage/config-repo.js";
import type { PkgSwitchState } from "../../src/shared/types.js";

describe("restoreProfileBackup", () => {
  let homeDir: string | undefined;

  afterEach(async () => {
    if (homeDir) {
      await rm(homeDir, { force: true, recursive: true });
      homeDir = undefined;
    }
  });

  it("应从指定备份恢复用户级 rc 文件", async () => {
    homeDir = await mkdtemp(path.join(os.tmpdir(), "pkg-switch-restore-"));
    const appPaths = createAppPaths(homeDir);
    const npmrcFile = path.join(homeDir, ".npmrc");

    await writeFile(npmrcFile, "registry=https://old.example.com/\n", "utf8");
    const backupId = await createBackup(appPaths.backupDir, [{ filePath: npmrcFile }]);
    await writeFile(npmrcFile, "registry=https://new.example.com/\n", "utf8");

    const result = await restoreProfileBackup({ homeDir, backupId });

    await expect(readFile(npmrcFile, "utf8")).resolves.toBe("registry=https://old.example.com/\n");
    expect(result).toEqual({ status: "success", backupId });
  });

  it("应在恢复备份后同步恢复备份时的 state 快照", async () => {
    homeDir = await mkdtemp(path.join(os.tmpdir(), "pkg-switch-restore-state-"));
    const appPaths = createAppPaths(homeDir);
    const npmrcFile = path.join(homeDir, ".npmrc");

    await writeFile(npmrcFile, "registry=https://old.example.com/\n", "utf8");
    const previousState: PkgSwitchState = {
      activeProfile: "old",
      lastBackupId: "backup-old",
      lastSwitchStatus: "success"
    };
    const backupId = await createBackup(appPaths.backupDir, [{ filePath: npmrcFile }], {
      stateSnapshot: previousState
    });
    await writeFile(npmrcFile, "registry=https://new.example.com/\n", "utf8");
    await writeJsonFile(appPaths.stateFile, {
      activeProfile: "new",
      lastBackupId: backupId,
      lastSwitchStatus: "success"
    });

    await restoreProfileBackup({ homeDir, backupId });

    await expect(readOptionalJsonFile<PkgSwitchState>(appPaths.stateFile)).resolves.toEqual(previousState);
  });
});
