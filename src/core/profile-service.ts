// ts
import { resolveProfileConfig } from "./config-validate.js";
import { maskSecret } from "../shared/mask.js";
import type { PkgSwitchConfig, ResolvedProfileConfig } from "../shared/types.js";

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
