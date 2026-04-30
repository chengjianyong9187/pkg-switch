// ts
import { describe, expect, it } from "vitest";
import { mergeProfileConfig } from "../../src/core/config-merge.js";
import type { ProfileConfig, ResolvedProfileConfig } from "../../src/shared/types.js";

describe("mergeProfileConfig", () => {
  it("应允许 profile 覆盖 common 并用 null 移除继承字段", () => {
    const common: ResolvedProfileConfig = {
      npm: {
        registry: "https://registry.npmmirror.com/",
        authToken: "work-token",
        strictSsl: true
      },
      scopes: {
        "@company": {
          registry: "https://nexus.example.com/"
        }
      }
    };
    const profile: ProfileConfig = {
      npm: {
        authToken: null,
        alwaysAuth: false
      },
      scopes: {
        "@company": null
      }
    };

    const result = mergeProfileConfig(common, profile);

    expect(result.npm?.registry).toBe("https://registry.npmmirror.com/");
    expect("authToken" in result.npm!).toBe(false);
    expect(result.npm?.strictSsl).toBe(true);
    expect(result.npm?.alwaysAuth).toBe(false);
    expect(result.scopes).toEqual({});
  });

  it("应保持 common 输入对象不被修改", () => {
    const common: ResolvedProfileConfig = {
      npm: {
        registry: "https://registry.npmmirror.com/",
        authToken: "plain-text-token"
      }
    };

    mergeProfileConfig(common, {
      npm: {
        authToken: null
      }
    });

    expect(common.npm?.authToken).toBe("plain-text-token");
  });
});
