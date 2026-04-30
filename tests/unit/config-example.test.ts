// ts
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { switchProfile } from "../../src/core/switch-service.js";
import { createAppPaths } from "../../src/storage/app-paths.js";
import { writeJsonFile } from "../../src/storage/config-repo.js";

describe("config example", () => {
  let homeDir: string | undefined;

  afterEach(async () => {
    if (homeDir) {
      await rm(homeDir, { force: true, recursive: true });
      homeDir = undefined;
    }
  });

  it("应包含 CJY-WORK 与 CJY-PERSONAL，并可切换生成样例输出", async () => {
    const projectRoot = path.resolve(import.meta.dirname, "../..");
    const config = JSON.parse(await readFile(path.join(projectRoot, "examples", "config.example.json"), "utf8")) as {
      profiles: Record<string, unknown>;
    };

    expect(Object.keys(config.profiles)).toEqual(expect.arrayContaining(["CJY-WORK", "CJY-PERSONAL"]));

    homeDir = await mkdtemp(path.join(os.tmpdir(), "pkg-switch-example-"));
    const appPaths = createAppPaths(homeDir);

    await writeJsonFile(appPaths.configFile, config);
    await switchProfile({ homeDir, profileName: "CJY-WORK", skipCacheClean: true });

    await expect(readFile(path.join(homeDir, ".npmrc"), "utf8")).resolves.toBe(
      await readFile(path.join(projectRoot, "examples", "output.npmrc"), "utf8")
    );
    await expect(readFile(path.join(homeDir, ".yarnrc.yml"), "utf8")).resolves.toBe(
      await readFile(path.join(projectRoot, "examples", "output.yarnrc.yml"), "utf8")
    );
  });
});
