// ts
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PkgSwitchState } from "../shared/types.js";

export interface BackupTarget {
  filePath: string;
  backupName?: string;
}

export interface BackupManifestFile {
  targetPath: string;
  backupName: string;
  existed: boolean;
}

export interface BackupManifest {
  id: string;
  createdAt: string;
  files: BackupManifestFile[];
  stateSnapshot?: PkgSwitchState | null;
}

export interface CreateBackupOptions {
  now?: Date;
  stateSnapshot?: PkgSwitchState | null;
}

function hasErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function assertSafeBackupId(backupId: string): void {
  if (!backupId.trim()) {
    throw new Error("backup id is required");
  }

  if (backupId.includes("/") || backupId.includes("\\") || backupId.includes("..")) {
    throw new Error(`Invalid backup id: ${backupId}`);
  }
}

function createBackupId(now: Date): string {
  return `backup-${now.toISOString().replace(/[:.]/g, "-")}`;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await readFile(filePath);
    return true;
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) {
      return false;
    }

    throw error;
  }
}

function resolveCreateBackupOptions(nowOrOptions: Date | CreateBackupOptions): Required<Pick<CreateBackupOptions, "now">> &
  Pick<CreateBackupOptions, "stateSnapshot"> {
  if (nowOrOptions instanceof Date) {
    return {
      now: nowOrOptions
    };
  }

  return {
    now: nowOrOptions.now ?? new Date(),
    stateSnapshot: nowOrOptions.stateSnapshot
  };
}

export async function createBackup(
  backupDir: string,
  targets: BackupTarget[],
  nowOrOptions: Date | CreateBackupOptions = new Date()
): Promise<string> {
  const { now, stateSnapshot } = resolveCreateBackupOptions(nowOrOptions);
  const backupId = createBackupId(now);
  const backupRoot = path.join(backupDir, backupId);
  const manifest: BackupManifest = {
    id: backupId,
    createdAt: now.toISOString(),
    files: [],
    stateSnapshot
  };

  await mkdir(backupRoot, { recursive: true });

  for (const target of targets) {
    const backupName = target.backupName ?? path.basename(target.filePath);
    const existed = await fileExists(target.filePath);

    manifest.files.push({
      targetPath: target.filePath,
      backupName,
      existed
    });

    if (existed) {
      await copyFile(target.filePath, path.join(backupRoot, backupName));
    }
  }

  await writeFile(path.join(backupRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return backupId;
}

export async function restoreBackup(backupDir: string, backupId: string): Promise<BackupManifest> {
  const backupRoot = path.join(backupDir, backupId);
  const manifest = JSON.parse(await readFile(path.join(backupRoot, "manifest.json"), "utf8")) as BackupManifest;

  for (const file of manifest.files) {
    if (file.existed) {
      await copyFile(path.join(backupRoot, file.backupName), file.targetPath);
      continue;
    }

    // 原文件不存在时，恢复动作应删除本次切换产生的目标文件。
    await rm(file.targetPath, { force: true });
  }

  return manifest;
}

async function readBackupManifest(backupDir: string, backupId: string): Promise<BackupManifest> {
  assertSafeBackupId(backupId);
  return JSON.parse(await readFile(path.join(backupDir, backupId, "manifest.json"), "utf8")) as BackupManifest;
}

export async function deleteBackup(backupDir: string, backupId: string): Promise<void> {
  await readBackupManifest(backupDir, backupId);
  await rm(path.join(backupDir, backupId), { force: true, recursive: true });
}

export async function pruneBackups(backupDir: string, keep: number): Promise<BackupManifest[]> {
  if (!Number.isInteger(keep) || keep < 0) {
    throw new Error(`Invalid keep count: ${String(keep)}`);
  }

  const backups = await listBackups(backupDir);
  const backupsToDelete = backups.slice(keep);

  for (const backup of backupsToDelete) {
    await deleteBackup(backupDir, backup.id);
  }

  return backupsToDelete;
}

export async function listBackups(backupDir: string): Promise<BackupManifest[]> {
  let entries;

  try {
    entries = await readdir(backupDir, { withFileTypes: true });
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) {
      return [];
    }

    throw error;
  }

  const manifests = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => readBackupManifest(backupDir, entry.name))
  );

  return manifests.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
