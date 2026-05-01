// ts
import { rm } from "node:fs/promises";
import { createAppPaths } from "../storage/app-paths.js";
import { restoreBackup } from "../storage/backup-repo.js";
import { writeJsonFile } from "../storage/config-repo.js";
import type { PkgSwitchState } from "../shared/types.js";

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
  const manifest = await restoreBackup(appPaths.backupDir, input.backupId);

  if ("stateSnapshot" in manifest) {
    if (manifest.stateSnapshot === null) {
      await rm(appPaths.stateFile, { force: true });
    } else if (manifest.stateSnapshot) {
      await writeJsonFile(appPaths.stateFile, manifest.stateSnapshot);
    }
  } else {
    const restoredState: PkgSwitchState = {
      lastSwitchedAt: new Date().toISOString(),
      lastBackupId: input.backupId,
      lastSwitchStatus: "restored"
    };

    await writeJsonFile(appPaths.stateFile, restoredState);
  }

  return {
    status: "success",
    backupId: input.backupId
  };
}
