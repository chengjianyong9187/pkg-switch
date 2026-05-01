// ts
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runDoctor } from "../../src/core/doctor-service.js";
import { createAppPaths } from "../../src/storage/app-paths.js";
import { writeJsonFile } from "../../src/storage/config-repo.js";

describe("runDoctor", () => {
  let homeDir: string | undefined;

  afterEach(async () => {
    if (homeDir) {
      await rm(homeDir, { force: true, recursive: true });
      homeDir = undefined;
    }
  });

  it("应返回目录写权限和 npm、pnpm、yarn 的可用性检查结果", async () => {
    homeDir = await mkdtemp(path.join(os.tmpdir(), "pkg-switch-doctor-"));

    const result = await runDoctor({
      homeDir,
      commandExists: async (commandName) => commandName !== "yarn"
    });

    expect(result.status).toBe("warning");
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "app-root-writable", status: "ok" }),
        expect.objectContaining({ name: "npm-command", status: "ok" }),
        expect.objectContaining({ name: "pnpm-command", status: "ok" }),
        expect.objectContaining({ name: "yarn-command", status: "warning" })
      ])
    );
  });

  it("应诊断 activeProfile 不存在、registry 非法和 alwaysAuth 缺少 token", async () => {
    homeDir = await mkdtemp(path.join(os.tmpdir(), "pkg-switch-doctor-config-"));
    const appPaths = createAppPaths(homeDir);

    await writeJsonFile(appPaths.configFile, {
      meta: {
        version: 1
      },
      common: {
        npm: {
          registry: "not-a-url"
        }
      },
      profiles: {
        "CJY-WORK": {
          npm: {
            alwaysAuth: true
          }
        }
      }
    });
    await writeJsonFile(appPaths.stateFile, {
      activeProfile: "MISSING"
    });

    const result = await runDoctor({
      homeDir,
      commandExists: async () => true
    });

    expect(result.status).toBe("error");
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "config-readable", status: "ok" }),
        expect.objectContaining({ name: "state-active-profile", status: "error" }),
        expect.objectContaining({ name: "registry-url-valid", status: "error" }),
        expect.objectContaining({ name: "auth-token-present", status: "warning" })
      ])
    );
  });

  it("alwaysAuth 使用 host 级 extraConfig 鉴权时不应误报缺少 token", async () => {
    homeDir = await mkdtemp(path.join(os.tmpdir(), "pkg-switch-doctor-extra-auth-"));
    const appPaths = createAppPaths(homeDir);

    await writeJsonFile(appPaths.configFile, {
      meta: {
        version: 1
      },
      profiles: {
        "CJY-WORK": {
          npm: {
            registry: "https://nexus.example.com/repository/npm-public/",
            alwaysAuth: true,
            extraConfig: {
              "//nexus.example.com/repository/npm-public/:_authToken": "plain-text-token"
            }
          }
        }
      }
    });

    const result = await runDoctor({
      homeDir,
      commandExists: async () => true
    });

    expect(result.checks).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "auth-token-present", status: "ok" })])
    );
  });
});
