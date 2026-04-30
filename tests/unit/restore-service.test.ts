// ts
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { restoreProfileBackup } from "../../src/core/restore-service.js";
import { createAppPaths } from "../../src/storage/app-paths.js";
import { createBackup } from "../../src/storage/backup-repo.js";

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
});
