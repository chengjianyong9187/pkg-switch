// ts
import { resolveProfileConfig } from "./config-validate.js";
import { maskSecret } from "../shared/mask.js";
import type { PkgSwitchConfig, PkgSwitchState, ProfileConfig, ResolvedProfileConfig } from "../shared/types.js";

type MutableConfigObject = Record<string, unknown>;

export function listProfiles(config: Pick<PkgSwitchConfig, "profiles">): string[] {
  return Object.keys(config.profiles).sort();
}

function maskResolvedProfile(config: ResolvedProfileConfig): ResolvedProfileConfig {
  const output = structuredClone(config);

  if (output.npm?.authToken) {
    output.npm.authToken = maskSecret(output.npm.authToken);
  }

  for (const [key, value] of Object.entries(output.npm?.extraConfig ?? {})) {
    if (/(token|_auth|password|passwd|username|email)/i.test(key) && typeof value === "string") {
      output.npm!.extraConfig![key] = maskSecret(value);
    }
  }

  if (output.yarn?.npmAuthToken) {
    output.yarn.npmAuthToken = maskSecret(output.yarn.npmAuthToken);
  }

  for (const scope of Object.values(output.scopes ?? {})) {
    if (scope.authToken) {
      scope.authToken = maskSecret(scope.authToken);
    }
  }

  return output;
}

export function showProfile(config: PkgSwitchConfig, profileName: string): ResolvedProfileConfig {
  // 默认展示必须脱敏，避免 profile show 泄露 token。
  return maskResolvedProfile(resolveProfileConfig(config, profileName));
}

function assertProfileName(profileName: string): void {
  if (!profileName.trim()) {
    throw new Error("profile name is required");
  }
}

function assertProfileExists(config: PkgSwitchConfig, profileName: string): void {
  if (!config.profiles[profileName]) {
    throw new Error(`Profile not found: ${profileName}`);
  }
}

function parseProfilePath(configPath: string): string[] {
  if (!configPath.trim()) {
    throw new Error("profile value path is required");
  }

  const segments: string[] = [];
  let buffer = "";

  for (let index = 0; index < configPath.length; index += 1) {
    const char = configPath[index];

    if (char === ".") {
      if (!buffer) {
        throw new Error(`Invalid profile value path: ${configPath}`);
      }

      segments.push(buffer);
      buffer = "";
      continue;
    }

    if (char === "[") {
      if (buffer) {
        segments.push(buffer);
        buffer = "";
      }

      const endIndex = configPath.indexOf("]", index + 1);
      if (endIndex < 0) {
        throw new Error(`Invalid profile value path: ${configPath}`);
      }

      const bracketValue = configPath.slice(index + 1, endIndex);
      if (!bracketValue) {
        throw new Error(`Invalid profile value path: ${configPath}`);
      }

      segments.push(bracketValue);
      index = endIndex;
      continue;
    }

    buffer += char;
  }

  if (buffer) {
    segments.push(buffer);
  }

  if (segments.length === 0) {
    throw new Error(`Invalid profile value path: ${configPath}`);
  }

  return segments;
}

function parseProfileValue(value: string): string | boolean | null {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  if (value === "null") {
    return null;
  }

  return value;
}

function getParentObject(root: MutableConfigObject, segments: string[], createMissing: boolean): MutableConfigObject | undefined {
  let current = root;

  for (const segment of segments.slice(0, -1)) {
    const value = current[segment];

    if (value === undefined) {
      if (!createMissing) {
        return undefined;
      }

      current[segment] = {};
    } else if (typeof value !== "object" || value === null || Array.isArray(value)) {
      if (!createMissing) {
        return undefined;
      }

      current[segment] = {};
    }

    current = current[segment] as MutableConfigObject;
  }

  return current;
}

export function addProfile(config: PkgSwitchConfig, profileName: string, profile: ProfileConfig = {}): PkgSwitchConfig {
  assertProfileName(profileName);

  if (config.profiles[profileName]) {
    throw new Error(`Profile already exists: ${profileName}`);
  }

  return {
    ...structuredClone(config),
    profiles: {
      ...structuredClone(config.profiles),
      [profileName]: structuredClone(profile)
    }
  };
}

export function removeProfile(
  config: PkgSwitchConfig,
  profileName: string,
  state: Pick<PkgSwitchState, "activeProfile"> = {}
): PkgSwitchConfig {
  assertProfileName(profileName);

  if (!config.profiles[profileName]) {
    throw new Error(`Profile not found: ${profileName}`);
  }

  if (state.activeProfile === profileName) {
    throw new Error(`Cannot remove active profile: ${profileName}`);
  }

  const nextConfig = structuredClone(config);
  delete nextConfig.profiles[profileName];

  return nextConfig;
}

export function setProfileValue(
  config: PkgSwitchConfig,
  profileName: string,
  configPath: string,
  rawValue: string
): PkgSwitchConfig {
  assertProfileName(profileName);
  assertProfileExists(config, profileName);

  const nextConfig = structuredClone(config);
  const segments = parseProfilePath(configPath);
  const profile = nextConfig.profiles[profileName] as MutableConfigObject;
  const parent = getParentObject(profile, segments, true)!;

  parent[segments.at(-1)!] = parseProfileValue(rawValue);

  return nextConfig;
}

export function unsetProfileValue(config: PkgSwitchConfig, profileName: string, configPath: string): PkgSwitchConfig {
  assertProfileName(profileName);
  assertProfileExists(config, profileName);

  const nextConfig = structuredClone(config);
  const segments = parseProfilePath(configPath);
  const profile = nextConfig.profiles[profileName] as MutableConfigObject;
  const parent = getParentObject(profile, segments, false);

  if (parent) {
    delete parent[segments.at(-1)!];
  }

  return nextConfig;
}
