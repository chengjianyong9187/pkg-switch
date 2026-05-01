// ts
import { createAppPaths } from "../storage/app-paths.js";
import { deleteBackup, listBackups, pruneBackups } from "../storage/backup-repo.js";

export interface ListProfileBackupsInput {
  homeDir: string;
}

export interface BackupSummary {
  backupId: string;
  createdAt: string;
  fileCount: number;
}

export interface DeleteProfileBackupInput {
  homeDir: string;
  backupId: string;
}

export interface DeleteProfileBackupResult {
  status: "deleted";
  backupId: string;
}

export interface PruneProfileBackupsInput {
  homeDir: string;
  keep: number;
}

export interface PruneProfileBackupsResult {
  status: "pruned";
  deletedBackupIds: string[];
}

export async function listProfileBackups(input: ListProfileBackupsInput): Promise<BackupSummary[]> {
  const appPaths = createAppPaths(input.homeDir);
  const backups = await listBackups(appPaths.backupDir);

  return backups.map((backup) => ({
    backupId: backup.id,
    createdAt: backup.createdAt,
    fileCount: backup.files.length
  }));
}

export async function deleteProfileBackup(input: DeleteProfileBackupInput): Promise<DeleteProfileBackupResult> {
  const appPaths = createAppPaths(input.homeDir);

  await deleteBackup(appPaths.backupDir, input.backupId);

  return {
    status: "deleted",
    backupId: input.backupId
  };
}

export async function pruneProfileBackups(input: PruneProfileBackupsInput): Promise<PruneProfileBackupsResult> {
  const appPaths = createAppPaths(input.homeDir);
  const deletedBackups = await pruneBackups(appPaths.backupDir, input.keep);

  return {
    status: "pruned",
    deletedBackupIds: deletedBackups.map((backup) => backup.id)
  };
}
