// ts
import YAML from "yaml";
import type { ResolvedProfileConfig, ScopeConfig } from "../shared/types.js";

type YarnrcObject = Record<string, unknown>;

function setStringValue(target: YarnrcObject, key: string, value: string | undefined): void {
  if (value) {
    target[key] = value;
  }
}

function setBooleanValue(target: YarnrcObject, key: string, value: boolean | undefined): void {
  if (typeof value === "boolean") {
    target[key] = value;
  }
}

function stripScopePrefix(scopeName: string): string {
  return scopeName.startsWith("@") ? scopeName.slice(1) : scopeName;
}

function toYarnScopeConfig(scope: ScopeConfig): YarnrcObject {
  const output: YarnrcObject = {};

  setStringValue(output, "npmRegistryServer", scope.registry);
  setBooleanValue(output, "npmAlwaysAuth", scope.alwaysAuth);
  setStringValue(output, "npmAuthToken", scope.authToken);

  return output;
}

export function renderYarnrc(config: ResolvedProfileConfig): string {
  const output: YarnrcObject = {};
  const npm = config.npm;
  const yarn = config.yarn;

  setStringValue(output, "nodeLinker", yarn?.nodeLinker);
  setStringValue(output, "npmRegistryServer", yarn?.npmRegistryServer ?? npm?.registry);
  setBooleanValue(output, "npmAlwaysAuth", yarn?.npmAlwaysAuth ?? npm?.alwaysAuth);
  setStringValue(output, "npmAuthToken", yarn?.npmAuthToken ?? npm?.authToken);

  const npmScopes: Record<string, YarnrcObject> = {};
  for (const [scopeName, scope] of Object.entries(config.scopes ?? {}).sort(([left], [right]) => left.localeCompare(right))) {
    const renderedScope = toYarnScopeConfig(scope);
    if (Object.keys(renderedScope).length > 0) {
      // Yarn Berry 的 npmScopes key 不带 @ 前缀。
      npmScopes[stripScopePrefix(scopeName)] = renderedScope;
    }
  }

  if (Object.keys(npmScopes).length > 0) {
    output.npmScopes = npmScopes;
  }

  return YAML.stringify(output);
}
