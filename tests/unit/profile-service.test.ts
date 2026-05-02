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
      "work": {
      npm: {
        registry: "https://nexus.example.com/repository/npm-group/",
        authToken: "plain-text-token",
        extraConfig: {
          "//nexus.example.com/repository/npm-public/:_auth": "\"base64-secret\"",
          electron_mirror: "https://cdn.npmmirror.com/binaries/electron/"
        }
      }
      },
      "personal": {
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
    expect(listProfiles(config)).toEqual(["personal", "work"]);
  });

  it("应返回合并后的 profile 详情并默认脱敏 token", () => {
    const detail = showProfile(config, "work");

    expect(detail.npm?.registry).toBe("https://nexus.example.com/repository/npm-group/");
    expect(detail.npm?.authToken).toBe("pla***ken");
    expect(detail.npm?.extraConfig?.["//nexus.example.com/repository/npm-public/:_auth"]).toBe("\"ba***et\"");
    expect(detail.npm?.extraConfig?.electron_mirror).toBe("https://cdn.npmmirror.com/binaries/electron/");
    expect(detail.scopes?.["@company"]?.registry).toBe("https://nexus.example.com/repository/npm-group/");
  });

  it("应保留 null 删除继承字段后的展示结果", () => {
    const detail = showProfile(config, "personal");

    expect(detail.npm).not.toHaveProperty("authToken");
    expect(detail.scopes).toEqual({});
  });

  it("应在 profile 不存在时抛出明确错误", () => {
    expect(() => showProfile(config, "MISSING")).toThrow("Profile not found: MISSING");
  });

  it("应新增空 profile 且不修改原配置对象", () => {
    const result = addProfile(config, "test-profile");

    expect(result.profiles["test-profile"]).toEqual({});
    expect(config.profiles["test-profile"]).toBeUndefined();
  });

  it("新增已存在 profile 时应抛出明确错误", () => {
    expect(() => addProfile(config, "work")).toThrow("Profile already exists: work");
  });

  it("应删除非激活 profile 且不修改原配置对象", () => {
    const result = removeProfile(config, "personal", { activeProfile: "work" });

    expect(result.profiles["personal"]).toBeUndefined();
    expect(config.profiles["personal"]).toBeDefined();
  });

  it("删除当前激活 profile 时应抛出明确错误", () => {
    expect(() => removeProfile(config, "work", { activeProfile: "work" })).toThrow("Cannot remove active profile: work");
  });

  it("应按路径设置 profile 字段并解析 boolean/null 值", () => {
    const result = setProfileValue(config, "personal", "npm.alwaysAuth", "false");

    expect(result.profiles["personal"].npm?.alwaysAuth).toBe(false);
    expect(config.profiles["personal"].npm?.alwaysAuth).toBeUndefined();
  });

  it("应支持在 extraConfig 中设置包含点号和斜杠的键", () => {
    const result = setProfileValue(
      config,
      "personal",
      "npm.extraConfig[//registry.npmjs.org/:_authToken]",
      "plain-text-token"
    );

    expect(result.profiles["personal"].npm?.extraConfig?.["//registry.npmjs.org/:_authToken"]).toBe("plain-text-token");
  });

  it("应删除 profile 中指定路径的本地覆盖", () => {
    const result = unsetProfileValue(config, "personal", "npm.authToken");

    expect(result.profiles["personal"].npm).not.toHaveProperty("authToken");
    expect(config.profiles["personal"].npm).toHaveProperty("authToken");
  });

  it("应复制已有 profile 为新 profile 且不修改原配置对象", () => {
    const result = cloneProfile(config, "work", "staging");

    expect(result.profiles["staging"]).toEqual(config.profiles["work"]);
    expect(result.profiles["staging"]).not.toBe(config.profiles["work"]);
    expect(config.profiles["staging"]).toBeUndefined();
  });

  it("复制不存在或目标已存在的 profile 时应抛出明确错误", () => {
    expect(() => cloneProfile(config, "MISSING", "staging")).toThrow("Profile not found: MISSING");
    expect(() => cloneProfile(config, "work", "personal")).toThrow("Profile already exists: personal");
  });

  it("应重命名已有 profile 并保持其它配置不变", () => {
    const result = renameProfile(config, "personal", "home");

    expect(result.profiles["home"]).toEqual(config.profiles["personal"]);
    expect(result.profiles["personal"]).toBeUndefined();
    expect(result.profiles["work"]).toEqual(config.profiles["work"]);
  });

  it("重命名到已存在 profile 时应抛出明确错误", () => {
    expect(() => renameProfile(config, "work", "personal")).toThrow("Profile already exists: personal");
  });
});
