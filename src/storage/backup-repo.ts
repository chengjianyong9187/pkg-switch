// ts
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

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
}

function hasErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
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

export async function createBackup(backupDir: string, targets: BackupTarget[], now = new Date()): Promise<string> {
  const backupId = createBackupId(now);
  const backupRoot = path.join(backupDir, backupId);
  const manifest: BackupManifest = {
    id: backupId,
    createdAt: now.toISOString(),
    files: []
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

export async function restoreBackup(backupDir: string, backupId: string): Promise<void> {
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
}

async function readBackupManifest(backupDir: string, backupId: string): Promise<BackupManifest> {
  return JSON.parse(await readFile(path.join(backupDir, backupId, "manifest.json"), "utf8")) as BackupManifest;
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
