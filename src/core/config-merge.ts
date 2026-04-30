// ts
import type { ConfigPatch } from "../shared/types.js";

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function mergeProfileConfig<T extends object>(common: T, profile: ConfigPatch<T>): T {
  const output = structuredClone(common) as JsonObject;

  applyConfigPatch(output, profile as JsonObject);

  return output as T;
}

function applyConfigPatch(target: JsonObject, patch: JsonObject): void {
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      // profile 中的 null 表示显式删除 common 继承值。
      delete target[key];
      continue;
    }

    if (isJsonObject(value)) {
      const currentValue = target[key];
      const nextTarget = isJsonObject(currentValue) ? currentValue : {};
      target[key] = nextTarget;
      applyConfigPatch(nextTarget, value);
      continue;
    }

    target[key] = value;
  }
}
