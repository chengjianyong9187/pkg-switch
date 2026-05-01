// ts
import { createAppPaths } from "../storage/app-paths.js";
import { listBackups } from "../storage/backup-repo.js";

export interface ListProfileBackupsInput {
  homeDir: string;
}

export interface BackupSummary {
  backupId: string;
  createdAt: string;
  fileCount: number;
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
