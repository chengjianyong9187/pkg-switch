// ts
import type { PkgSwitchState } from "../shared/types.js";
import { createAppPaths } from "../storage/app-paths.js";
import { readOptionalJsonFile } from "../storage/config-repo.js";

export interface CurrentStatusInput {
  homeDir: string;
}

export interface CurrentStatus {
  active: boolean;
  activeProfile?: string;
  lastBackupId?: string;
  lastSwitchStatus?: PkgSwitchState["lastSwitchStatus"];
  configFile: string;
  stateFile: string;
}

export async function getCurrentStatus(input: CurrentStatusInput): Promise<CurrentStatus> {
  const appPaths = createAppPaths(input.homeDir);
  const state = await readOptionalJsonFile<PkgSwitchState>(appPaths.stateFile);

  return {
    active: Boolean(state?.activeProfile),
    activeProfile: state?.activeProfile,
    lastBackupId: state?.lastBackupId,
    lastSwitchStatus: state?.lastSwitchStatus,
    configFile: appPaths.configFile,
    stateFile: appPaths.stateFile
  };
}
