// ts
import { mergeProfileConfig } from "./config-merge.js";
import type { PkgSwitchConfig, ResolvedProfileConfig } from "../shared/types.js";

function assertValidUrl(value: string | undefined, fieldName: string): void {
  if (!value) {
    return;
  }

  try {
    new URL(value);
  } catch {
    throw new Error(`Invalid URL for ${fieldName}: ${value}`);
  }
}

export function resolveProfileConfig(config: PkgSwitchConfig, profileName: string): ResolvedProfileConfig {
  const profile = config.profiles[profileName];

  if (!profile) {
    throw new Error(`Profile not found: ${profileName}`);
  }

  const resolved = mergeProfileConfig(config.common ?? {}, profile);
  validateResolvedProfileConfig(resolved);

  return resolved;
}

export function validateResolvedProfileConfig(config: ResolvedProfileConfig): void {
  assertValidUrl(config.npm?.registry, "npm.registry");
  assertValidUrl(config.yarn?.npmRegistryServer, "yarn.npmRegistryServer");

  for (const [scopeName, scope] of Object.entries(config.scopes ?? {})) {
    assertValidUrl(scope.registry, `scopes.${scopeName}.registry`);
  }
}
