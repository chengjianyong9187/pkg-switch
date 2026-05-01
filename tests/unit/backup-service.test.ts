// ts
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { deleteProfileBackup, listProfileBackups, pruneProfileBackups } from "../../src/core/backup-service.js";
import { createAppPaths } from "../../src/storage/app-paths.js";
import { createBackup } from "../../src/storage/backup-repo.js";

describe("listProfileBackups", () => {
  let homeDir: string | undefined;

  afterEach(async () => {
    if (homeDir) {
      await rm(homeDir, { force: true, recursive: true });
      homeDir = undefined;
    }
  });

  it("备份目录不存在时应返回空列表", async () => {
    homeDir = await mkdtemp(path.join(os.tmpdir(), "pkg-switch-backup-empty-"));

    await expect(listProfileBackups({ homeDir })).resolves.toEqual([]);
  });

  it("应按创建时间倒序返回备份摘要", async () => {
    homeDir = await mkdtemp(path.join(os.tmpdir(), "pkg-switch-backup-list-"));
    const appPaths = createAppPaths(homeDir);
    const npmrcFile = path.join(homeDir, ".npmrc");

    await writeFile(npmrcFile, "registry=https://old.example.com/\n", "utf8");
    const olderBackupId = await createBackup(appPaths.backupDir, [{ filePath: npmrcFile }], new Date("2026-01-01T00:00:00.000Z"));
    const newerBackupId = await createBackup(appPaths.backupDir, [{ filePath: npmrcFile }], new Date("2026-01-02T00:00:00.000Z"));

    const result = await listProfileBackups({ homeDir });

    expect(result.map((backup) => backup.backupId)).toEqual([newerBackupId, olderBackupId]);
    expect(result[0]).toEqual(
      expect.objectContaining({
        backupId: newerBackupId,
        createdAt: "2026-01-02T00:00:00.000Z",
        fileCount: 1
      })
    );
  });

  it("应删除指定备份目录", async () => {
    homeDir = await mkdtemp(path.join(os.tmpdir(), "pkg-switch-backup-delete-"));
    const appPaths = createAppPaths(homeDir);
    const npmrcFile = path.join(homeDir, ".npmrc");

    await writeFile(npmrcFile, "registry=https://old.example.com/\n", "utf8");
    const backupId = await createBackup(appPaths.backupDir, [{ filePath: npmrcFile }], new Date("2026-01-01T00:00:00.000Z"));

    const result = await deleteProfileBackup({ homeDir, backupId });

    expect(result).toEqual({ status: "deleted", backupId });
    await expect(readFile(path.join(appPaths.backupDir, backupId, "manifest.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("应按创建时间保留最新 N 个备份并删除更旧备份", async () => {
    homeDir = await mkdtemp(path.join(os.tmpdir(), "pkg-switch-backup-prune-"));
    const appPaths = createAppPaths(homeDir);
    const npmrcFile = path.join(homeDir, ".npmrc");

    await writeFile(npmrcFile, "registry=https://old.example.com/\n", "utf8");
    const oldestBackupId = await createBackup(appPaths.backupDir, [{ filePath: npmrcFile }], new Date("2026-01-01T00:00:00.000Z"));
    const middleBackupId = await createBackup(appPaths.backupDir, [{ filePath: npmrcFile }], new Date("2026-01-02T00:00:00.000Z"));
    const newestBackupId = await createBackup(appPaths.backupDir, [{ filePath: npmrcFile }], new Date("2026-01-03T00:00:00.000Z"));

    const result = await pruneProfileBackups({ homeDir, keep: 2 });
    const remaining = await listProfileBackups({ homeDir });

    expect(result.deletedBackupIds).toEqual([oldestBackupId]);
    expect(remaining.map((backup) => backup.backupId)).toEqual([newestBackupId, middleBackupId]);
  });
});
