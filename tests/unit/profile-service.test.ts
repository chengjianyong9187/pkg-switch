// ts
import { describe, expect, it } from "vitest";
import {
  addProfile,
  cloneProfile,
  listProfiles,
  removeProfile,
  renameProfile,
  setProfileValue,
  showProfile,
  unsetProfileValue
} from "../../src/core/profile-service.js";
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
        authToken: "plain-text-token",
        extraConfig: {
          "//nexus.example.com/repository/npm-public/:_auth": "\"base64-secret\"",
          electron_mirror: "https://cdn.npmmirror.com/binaries/electron/"
        }
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
    expect(detail.npm?.extraConfig?.["//nexus.example.com/repository/npm-public/:_auth"]).toBe("\"ba***et\"");
    expect(detail.npm?.extraConfig?.electron_mirror).toBe("https://cdn.npmmirror.com/binaries/electron/");
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

  it("应按路径设置 profile 字段并解析 boolean/null 值", () => {
    const result = setProfileValue(config, "CJY-PERSONAL", "npm.alwaysAuth", "false");

    expect(result.profiles["CJY-PERSONAL"].npm?.alwaysAuth).toBe(false);
    expect(config.profiles["CJY-PERSONAL"].npm?.alwaysAuth).toBeUndefined();
  });

  it("应支持在 extraConfig 中设置包含点号和斜杠的键", () => {
    const result = setProfileValue(
      config,
      "CJY-PERSONAL",
      "npm.extraConfig[//registry.npmjs.org/:_authToken]",
      "plain-text-token"
    );

    expect(result.profiles["CJY-PERSONAL"].npm?.extraConfig?.["//registry.npmjs.org/:_authToken"]).toBe("plain-text-token");
  });

  it("应删除 profile 中指定路径的本地覆盖", () => {
    const result = unsetProfileValue(config, "CJY-PERSONAL", "npm.authToken");

    expect(result.profiles["CJY-PERSONAL"].npm).not.toHaveProperty("authToken");
    expect(config.profiles["CJY-PERSONAL"].npm).toHaveProperty("authToken");
  });

  it("应复制已有 profile 为新 profile 且不修改原配置对象", () => {
    const result = cloneProfile(config, "CJY-WORK", "CJY-STAGING");

    expect(result.profiles["CJY-STAGING"]).toEqual(config.profiles["CJY-WORK"]);
    expect(result.profiles["CJY-STAGING"]).not.toBe(config.profiles["CJY-WORK"]);
    expect(config.profiles["CJY-STAGING"]).toBeUndefined();
  });

  it("复制不存在或目标已存在的 profile 时应抛出明确错误", () => {
    expect(() => cloneProfile(config, "MISSING", "CJY-STAGING")).toThrow("Profile not found: MISSING");
    expect(() => cloneProfile(config, "CJY-WORK", "CJY-PERSONAL")).toThrow("Profile already exists: CJY-PERSONAL");
  });

  it("应重命名已有 profile 并保持其它配置不变", () => {
    const result = renameProfile(config, "CJY-PERSONAL", "CJY-HOME");

    expect(result.profiles["CJY-HOME"]).toEqual(config.profiles["CJY-PERSONAL"]);
    expect(result.profiles["CJY-PERSONAL"]).toBeUndefined();
    expect(result.profiles["CJY-WORK"]).toEqual(config.profiles["CJY-WORK"]);
  });

  it("重命名到已存在 profile 时应抛出明确错误", () => {
    expect(() => renameProfile(config, "CJY-WORK", "CJY-PERSONAL")).toThrow("Profile already exists: CJY-PERSONAL");
  });
});
