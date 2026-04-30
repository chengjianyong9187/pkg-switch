// ts
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveProfileConfig } from "./config-validate.js";
import { renderNpmrc } from "../managers/npmrc-renderer.js";
import { renderYarnrc } from "../managers/yarnrc-renderer.js";
import { SwitchError } from "../shared/errors.js";
import type { PkgSwitchConfig, PkgSwitchState, WriteTarget } from "../shared/types.js";
import { createAppPaths } from "../storage/app-paths.js";
import { createBackup, restoreBackup } from "../storage/backup-repo.js";
import { readJsonFile, writeJsonFile } from "../storage/config-repo.js";

export interface SwitchProfileInput {
  homeDir: string;
  profileName: string;
  skipCacheClean?: boolean;
}

export interface SwitchProfileResult {
  status: "success" | "warning";
  profileName: string;
  backupId?: string;
  writeTargets: WriteTarget[];
}

export interface SwitchProfileDependencies {
  writeTextFile?: (filePath: string, content: string) => Promise<void>;
}

interface TargetFile {
  target: WriteTarget;
  filePath: string;
  content: string;
}

const defaultWriteTargets: WriteTarget[] = ["npm", "yarn", "pnpm"];

function uniqueTargets(targets: WriteTarget[]): WriteTarget[] {
  return [...new Set(targets)];
}

function createTargetFiles(homeDir: string, targets: WriteTarget[], npmrc: string, yarnrc: string): TargetFile[] {
  const targetFiles: TargetFile[] = [];

  if (targets.includes("npm") || targets.includes("pnpm")) {
    targetFiles.push({
      target: "npm",
      filePath: path.join(homeDir, ".npmrc"),
      content: npmrc
    });
  }

  if (targets.includes("yarn")) {
    targetFiles.push({
      target: "yarn",
      filePath: path.join(homeDir, ".yarnrc.yml"),
      content: yarnrc
    });
  }

  return targetFiles;
}

function createState(profileName: string, backupId: string | undefined, writeTargets: WriteTarget[]): PkgSwitchState {
  return {
    activeProfile: profileName,
    lastSwitchedAt: new Date().toISOString(),
    lastBackupId: backupId,
    lastWriteTargets: writeTargets,
    lastSwitchStatus: "success"
  };
}

async function defaultWriteTextFile(filePath: string, content: string): Promise<void> {
  await writeFile(filePath, content, "utf8");
}

export async function switchProfile(
  input: SwitchProfileInput,
  dependencies: SwitchProfileDependencies = {}
): Promise<SwitchProfileResult> {
  const appPaths = createAppPaths(input.homeDir);
  const writeTextFile = dependencies.writeTextFile ?? defaultWriteTextFile;
  const config = await readJsonFile<PkgSwitchConfig>(appPaths.configFile);
  const writeTargets = uniqueTargets(config.defaults?.writeTargets ?? defaultWriteTargets);
  const resolved = resolveProfileConfig(config, input.profileName);
  const targetFiles = createTargetFiles(input.homeDir, writeTargets, renderNpmrc(resolved), renderYarnrc(resolved));
  const shouldBackup = config.defaults?.backupBeforeWrite ?? true;
  const backupId = shouldBackup
    ? await createBackup(
        appPaths.backupDir,
        targetFiles.map((targetFile) => ({ filePath: targetFile.filePath }))
      )
    : undefined;

  try {
    for (const targetFile of targetFiles) {
      await writeTextFile(targetFile.filePath, targetFile.content);
    }
  } catch (error) {
    let rolledBack = false;

    if (backupId) {
      await restoreBackup(appPaths.backupDir, backupId);
      rolledBack = true;
    }

    throw new SwitchError("Failed to write package manager config files", {
      code: "WRITE_TARGET_FAILED",
      rolledBack,
      backupId,
      cause: error
    });
  }

  await writeJsonFile(appPaths.stateFile, createState(input.profileName, backupId, writeTargets));

  return {
    status: "success",
    profileName: input.profileName,
    backupId,
    writeTargets
  };
}
