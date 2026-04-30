// ts
import { createAppPaths } from "../storage/app-paths.js";
import { restoreBackup } from "../storage/backup-repo.js";

export interface RestoreProfileBackupInput {
  homeDir: string;
  backupId: string;
}

export interface RestoreProfileBackupResult {
  status: "success";
  backupId: string;
}

export async function restoreProfileBackup(input: RestoreProfileBackupInput): Promise<RestoreProfileBackupResult> {
  const appPaths = createAppPaths(input.homeDir);

  await restoreBackup(appPaths.backupDir, input.backupId);

  return {
    status: "success",
    backupId: input.backupId
  };
}
