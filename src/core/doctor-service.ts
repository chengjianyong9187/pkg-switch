// ts
import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { mergeProfileConfig } from "./config-merge.js";
import { validateResolvedProfileConfig } from "./config-validate.js";
import type { PkgSwitchConfig, PkgSwitchState, ResolvedProfileConfig } from "../shared/types.js";
import { createAppPaths } from "../storage/app-paths.js";
import { readOptionalJsonFile } from "../storage/config-repo.js";

const execFileAsync = promisify(execFile);

export type DoctorCheckStatus = "ok" | "warning" | "error";

export interface DoctorCheck {
  name: string;
  status: DoctorCheckStatus;
  message: string;
}

export interface DoctorResult {
  status: DoctorCheckStatus;
  checks: DoctorCheck[];
}

export interface DoctorInput {
  homeDir: string;
  commandExists?: (commandName: string) => Promise<boolean>;
}

async function defaultCommandExists(commandName: string): Promise<boolean> {
  try {
    await execFileAsync(commandName, ["--version"], {
      timeout: 5000,
      windowsHide: true,
      shell: process.platform === "win32"
    });
    return true;
  } catch {
    return false;
  }
}

function aggregateStatus(checks: DoctorCheck[]): DoctorCheckStatus {
  if (checks.some((check) => check.status === "error")) {
    return "error";
  }

  if (checks.some((check) => check.status === "warning")) {
    return "warning";
  }

  return "ok";
}

async function checkAppRootWritable(homeDir: string): Promise<DoctorCheck> {
  const appPaths = createAppPaths(homeDir);
  const probeFile = path.join(appPaths.rootDir, ".write-probe");

  try {
    await mkdir(appPaths.rootDir, { recursive: true });
    await writeFile(probeFile, "ok", "utf8");
    await rm(probeFile, { force: true });

    return {
      name: "app-root-writable",
      status: "ok",
      message: `${appPaths.rootDir} is writable`
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      name: "app-root-writable",
      status: "error",
      message
    };
  }
}

async function checkCommand(commandName: string, commandExists: (commandName: string) => Promise<boolean>): Promise<DoctorCheck> {
  const exists = await commandExists(commandName);

  return {
    name: `${commandName}-command`,
    status: exists ? "ok" : "warning",
    message: exists ? `${commandName} is available` : `${commandName} command not found`
  };
}

function createCheck(name: string, status: DoctorCheckStatus, message: string): DoctorCheck {
  return {
    name,
    status,
    message
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function readConfigCheck(homeDir: string): Promise<{ config?: PkgSwitchConfig; check: DoctorCheck }> {
  const appPaths = createAppPaths(homeDir);

  try {
    const config = await readOptionalJsonFile<PkgSwitchConfig>(appPaths.configFile);

    if (!config) {
      return {
        check: createCheck("config-readable", "warning", `Config file not found: ${appPaths.configFile}`)
      };
    }

    return {
      config,
      check: createCheck("config-readable", "ok", `Config file is readable: ${appPaths.configFile}`)
    };
  } catch (error) {
    return {
      check: createCheck("config-readable", "error", getErrorMessage(error))
    };
  }
}

async function readState(homeDir: string): Promise<PkgSwitchState | undefined> {
  return readOptionalJsonFile<PkgSwitchState>(createAppPaths(homeDir).stateFile);
}

function checkActiveProfile(config: PkgSwitchConfig | undefined, state: PkgSwitchState | undefined): DoctorCheck {
  if (!config) {
    return createCheck("state-active-profile", "warning", "Skipped because config is unavailable");
  }

  if (!state?.activeProfile) {
    return createCheck("state-active-profile", "warning", "No active profile recorded");
  }

  if (!config.profiles?.[state.activeProfile]) {
    return createCheck("state-active-profile", "error", `Active profile not found in config: ${state.activeProfile}`);
  }

  return createCheck("state-active-profile", "ok", `Active profile exists: ${state.activeProfile}`);
}

function resolveProfiles(config: PkgSwitchConfig): Array<{ name: string; config: ResolvedProfileConfig }> {
  return Object.entries(config.profiles ?? {}).map(([name, profile]) => ({
    name,
    config: mergeProfileConfig(config.common ?? {}, profile)
  }));
}

function checkRegistryUrls(config: PkgSwitchConfig | undefined): DoctorCheck {
  if (!config) {
    return createCheck("registry-url-valid", "warning", "Skipped because config is unavailable");
  }

  const errors: string[] = [];

  for (const profile of resolveProfiles(config)) {
    try {
      validateResolvedProfileConfig(profile.config);
    } catch (error) {
      errors.push(`${profile.name}: ${getErrorMessage(error)}`);
    }
  }

  if (errors.length > 0) {
    return createCheck("registry-url-valid", "error", errors.join("; "));
  }

  return createCheck("registry-url-valid", "ok", "All configured registry URLs are valid");
}

function collectMissingAuthTokens(profileName: string, config: ResolvedProfileConfig): string[] {
  const warnings: string[] = [];
  const hasNpmExtraAuth = Object.entries(config.npm?.extraConfig ?? {}).some(
    ([key, value]) => /:(_authToken|_auth)$/i.test(key) && Boolean(value)
  );

  if (config.npm?.alwaysAuth === true && !config.npm.authToken && !hasNpmExtraAuth) {
    warnings.push(`${profileName}: npm.alwaysAuth requires npm.authToken`);
  }

  if (config.yarn?.npmAlwaysAuth === true && !config.yarn.npmAuthToken) {
    warnings.push(`${profileName}: yarn.npmAlwaysAuth requires yarn.npmAuthToken`);
  }

  for (const [scopeName, scope] of Object.entries(config.scopes ?? {})) {
    if (scope.alwaysAuth === true && !scope.authToken) {
      warnings.push(`${profileName}: scopes.${scopeName}.alwaysAuth requires authToken`);
    }
  }

  return warnings;
}

function checkAuthTokens(config: PkgSwitchConfig | undefined): DoctorCheck {
  if (!config) {
    return createCheck("auth-token-present", "warning", "Skipped because config is unavailable");
  }

  const warnings = resolveProfiles(config).flatMap((profile) => collectMissingAuthTokens(profile.name, profile.config));

  if (warnings.length > 0) {
    return createCheck("auth-token-present", "warning", warnings.join("; "));
  }

  return createCheck("auth-token-present", "ok", "Auth tokens are present when alwaysAuth is enabled");
}

async function checkStateActiveProfile(homeDir: string, config: PkgSwitchConfig | undefined): Promise<DoctorCheck> {
  try {
    return checkActiveProfile(config, await readState(homeDir));
  } catch (error) {
    return createCheck("state-active-profile", "error", getErrorMessage(error));
  }
}

export async function runDoctor(input: DoctorInput): Promise<DoctorResult> {
  const commandExists = input.commandExists ?? defaultCommandExists;
  const configResult = await readConfigCheck(input.homeDir);
  const checks = [
    await checkAppRootWritable(input.homeDir),
    configResult.check,
    await checkStateActiveProfile(input.homeDir, configResult.config),
    checkRegistryUrls(configResult.config),
    checkAuthTokens(configResult.config),
    await checkCommand("npm", commandExists),
    await checkCommand("pnpm", commandExists),
    await checkCommand("yarn", commandExists)
  ];

  return {
    status: aggregateStatus(checks),
    checks
  };
}
