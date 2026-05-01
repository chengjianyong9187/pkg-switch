// ts
import { resolveProfileConfig } from "./config-validate.js";
import { maskSecret } from "../shared/mask.js";
import type { PkgSwitchConfig, PkgSwitchState, ProfileConfig, ResolvedProfileConfig } from "../shared/types.js";

export function listProfiles(config: Pick<PkgSwitchConfig, "profiles">): string[] {
  return Object.keys(config.profiles).sort();
}

function maskResolvedProfile(config: ResolvedProfileConfig): ResolvedProfileConfig {
  const output = structuredClone(config);

  if (output.npm?.authToken) {
    output.npm.authToken = maskSecret(output.npm.authToken);
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
