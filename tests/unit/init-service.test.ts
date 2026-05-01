// ts
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initConfig } from "../../src/core/init-service.js";
import { createAppPaths } from "../../src/storage/app-paths.js";
import { writeJsonFile } from "../../src/storage/config-repo.js";
import type { PkgSwitchConfig } from "../../src/shared/types.js";

describe("initConfig", () => {
  let homeDir: string | undefined;

  afterEach(async () => {
    if (homeDir) {
      await rm(homeDir, { force: true, recursive: true });
      homeDir = undefined;
    }
  });

  it("应创建默认配置文件并包含 work/personal profile", async () => {
    homeDir = await mkdtemp(path.join(os.tmpdir(), "pkg-switch-init-"));
    const appPaths = createAppPaths(homeDir);

    const result = await initConfig({ homeDir });
    const config = JSON.parse(await readFile(appPaths.configFile, "utf8")) as PkgSwitchConfig;

    expect(result.created).toBe(true);
    expect(result.configFile).toBe(appPaths.configFile);
    expect(config.defaults?.writeTargets).toEqual(["npm", "yarn", "pnpm"]);
    expect(config.common?.npm?.registry).toBe("https://registry.npmmirror.com/");
    expect(config.common?.pnpm?.storeDir).toBe("${HOME}/.local/share/pnpm/store");
    expect(Object.keys(config.profiles)).toEqual(["work", "personal"]);
  });

  it("配置文件已存在时默认拒绝覆盖", async () => {
    homeDir = await mkdtemp(path.join(os.tmpdir(), "pkg-switch-init-existing-"));
    const appPaths = createAppPaths(homeDir);

    await writeJsonFile(appPaths.configFile, { profiles: { existing: {} } });

    await expect(initConfig({ homeDir })).rejects.toThrow("config.json already exists");
  });

  it("force=true 时允许覆盖已有配置", async () => {
    homeDir = await mkdtemp(path.join(os.tmpdir(), "pkg-switch-init-force-"));
    const appPaths = createAppPaths(homeDir);

    await writeJsonFile(appPaths.configFile, { profiles: { existing: {} } });

    await initConfig({ homeDir, force: true });
    const config = JSON.parse(await readFile(appPaths.configFile, "utf8")) as PkgSwitchConfig;

    expect(config.profiles.existing).toBeUndefined();
    expect(config.profiles.personal).toBeDefined();
  });
});
