// ts
import { describe, expect, it } from "vitest";
import { addProfile, listProfiles, removeProfile, showProfile } from "../../src/core/profile-service.js";
import type { PkgSwitchConfig } from "../../src/shared/types.js";

describe("profile service", () => {
  const config: PkgSwitchConfig = {
    common: {
      npm: {
        registry: "https://registry.npmmirror.com/",
        authToken: "common-token"
      },
      scopes: {
        "@company": {
          registry: "https://nexus.example.com/repository/npm-group/"
        }
      }
    },
    profiles: {
      "CJY-WORK": {
        npm: {
          registry: "https://nexus.example.com/repository/npm-group/",
          authToken: "plain-text-token"
        }
      },
      "CJY-PERSONAL": {
        npm: {
          authToken: null
        },
        scopes: {
          "@company": null
        }
      }
    }
  };

  it("应返回排序后的全部 profile 名称", () => {
    expect(listProfiles(config)).toEqual(["CJY-PERSONAL", "CJY-WORK"]);
  });

  it("应返回合并后的 profile 详情并默认脱敏 token", () => {
    const detail = showProfile(config, "CJY-WORK");

    expect(detail.npm?.registry).toBe("https://nexus.example.com/repository/npm-group/");
    expect(detail.npm?.authToken).toBe("pla***ken");
    expect(detail.scopes?.["@company"]?.registry).toBe("https://nexus.example.com/repository/npm-group/");
  });

  it("应保留 null 删除继承字段后的展示结果", () => {
    const detail = showProfile(config, "CJY-PERSONAL");

    expect(detail.npm).not.toHaveProperty("authToken");
    expect(detail.scopes).toEqual({});
  });

  it("应在 profile 不存在时抛出明确错误", () => {
    expect(() => showProfile(config, "MISSING")).toThrow("Profile not found: MISSING");
  });

  it("应新增空 profile 且不修改原配置对象", () => {
    const result = addProfile(config, "CJY-TEST");

    expect(result.profiles["CJY-TEST"]).toEqual({});
    expect(config.profiles["CJY-TEST"]).toBeUndefined();
  });

  it("新增已存在 profile 时应抛出明确错误", () => {
    expect(() => addProfile(config, "CJY-WORK")).toThrow("Profile already exists: CJY-WORK");
  });

  it("应删除非激活 profile 且不修改原配置对象", () => {
    const result = removeProfile(config, "CJY-PERSONAL", { activeProfile: "CJY-WORK" });

    expect(result.profiles["CJY-PERSONAL"]).toBeUndefined();
    expect(config.profiles["CJY-PERSONAL"]).toBeDefined();
  });

  it("删除当前激活 profile 时应抛出明确错误", () => {
    expect(() => removeProfile(config, "CJY-WORK", { activeProfile: "CJY-WORK" })).toThrow("Cannot remove active profile: CJY-WORK");
  });
});
