// ts
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveProfileConfig } from "./config-validate.js";
import { cleanCaches } from "../managers/cache-cleaner.js";
import type { CacheCleanResult, CleanCachesInput } from "../managers/cache-cleaner.js";
import { renderNpmrc } from "../managers/npmrc-renderer.js";
import { renderYarnrc } from "../managers/yarnrc-renderer.js";
import { SwitchError } from "../shared/errors.js";
import type { CacheCleanMode, PkgSwitchConfig, PkgSwitchState, WriteTarget } from "../shared/types.js";
import { createAppPaths } from "../storage/app-paths.js";
import { createBackup, restoreBackup } from "../storage/backup-repo.js";
import { readJsonFile, readOptionalJsonFile, writeJsonFile } from "../storage/config-repo.js";

export interface SwitchProfileInput {
  homeDir: string;
  profileName: string;
  skipCacheClean?: boolean;
  cacheCleanModeOverride?: CacheCleanMode;
}

export interface SwitchProfileResult {
  status: "success" | "warning";
  profileName: string;
  backupId?: string;
  writeTargets: WriteTarget[];
  cacheClean?: CacheCleanResult;
}

export interface SwitchProfileDependencies {
  writeTextFile?: (filePath: string, content: string) => Promise<void>;
  runCacheCommand?: CleanCachesInput["runCommand"];
}

export interface SwitchTargetFile {
  target: WriteTarget;
  filePath: string;
  content: string;
}

const defaultWriteTargets: WriteTarget[] = ["npm", "yarn", "pnpm"];

function uniqueTargets(targets: WriteTarget[]): WriteTarget[] {
  return [...new Set(targets)];
}

export function resolveWriteTargets(config: PkgSwitchConfig): WriteTarget[] {
  return uniqueTargets(config.defaults?.writeTargets ?? defaultWriteTargets);
}

function createTargetFiles(homeDir: string, targets: WriteTarget[], npmrc: string, yarnrc: string): SwitchTargetFile[] {
  const targetFiles: SwitchTargetFile[] = [];

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

export function createSwitchTargetFiles(homeDir: string, config: PkgSwitchConfig, profileName: string): SwitchTargetFile[] {
  const writeTargets = resolveWriteTargets(config);
  const resolved = resolveProfileConfig(config, profileName);

  return createTargetFiles(homeDir, writeTargets, renderNpmrc(resolved), renderYarnrc(resolved));
}

function createState(
  profileName: string,
  backupId: string | undefined,
  writeTargets: WriteTarget[],
  status: SwitchProfileResult["status"]
): PkgSwitchState {
  return {
    activeProfile: profileName,
    lastSwitchedAt: new Date().toISOString(),
    lastBackupId: backupId,
    lastWriteTargets: writeTargets,
    lastSwitchStatus: status
  };
}

async function defaultWriteTextFile(filePath: string, content: string): Promise<void> {
  await writeFile(filePath, content, "utf8");
}

function shouldCleanCache(input: SwitchProfileInput, config: PkgSwitchConfig): boolean {
  if (input.skipCacheClean) {
    return false;
  }

  // 显式 CLI 覆盖优先于配置默认值，便于单次试运行不同清理策略。
  if (input.cacheCleanModeOverride) {
    return true;
  }

  return config.defaults?.clearCacheOnSwitch ?? false;
}

export async function switchProfile(
  input: SwitchProfileInput,
  dependencies: SwitchProfileDependencies = {}
): Promise<SwitchProfileResult> {
  const appPaths = createAppPaths(input.homeDir);
  const writeTextFile = dependencies.writeTextFile ?? defaultWriteTextFile;
  const config = await readJsonFile<PkgSwitchConfig>(appPaths.configFile);
  const writeTargets = resolveWriteTargets(config);
  const targetFiles = createSwitchTargetFiles(input.homeDir, config, input.profileName);
  const shouldBackup = config.defaults?.backupBeforeWrite ?? true;
  const previousState = await readOptionalJsonFile<PkgSwitchState>(appPaths.stateFile);
  const backupId = shouldBackup
    ? await createBackup(
        appPaths.backupDir,
        targetFiles.map((targetFile) => ({ filePath: targetFile.filePath })),
        {
          stateSnapshot: previousState ?? null
        }
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

  const cacheCleanMode = input.cacheCleanModeOverride ?? config.defaults?.cacheCleanMode ?? "smart";
  const cacheClean = shouldCleanCache(input, config)
    ? await cleanCaches({
        mode: cacheCleanMode,
        targets: writeTargets,
        runCommand: dependencies.runCacheCommand
      })
    : undefined;
  const status: SwitchProfileResult["status"] = cacheClean?.status === "warning" ? "warning" : "success";

  await writeJsonFile(appPaths.stateFile, createState(input.profileName, backupId, writeTargets, status));

  return {
    status,
    profileName: input.profileName,
    backupId,
    writeTargets,
    cacheClean
  };
}
