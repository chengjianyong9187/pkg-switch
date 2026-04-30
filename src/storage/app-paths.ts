// ts
import path from "node:path";

export interface AppPaths {
  rootDir: string;
  configFile: string;
  stateFile: string;
  backupDir: string;
  logDir: string;
}

export function createAppPaths(homeDir: string): AppPaths {
  if (!homeDir.trim()) {
    throw new Error("homeDir is required");
  }

  const rootDir = path.join(homeDir, ".pkg-switch");

  return {
    rootDir,
    configFile: path.join(rootDir, "config.json"),
    stateFile: path.join(rootDir, "state.json"),
    backupDir: path.join(rootDir, "backups"),
    logDir: path.join(rootDir, "logs")
  };
}
