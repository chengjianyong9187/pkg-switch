// ts
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { switchProfile } from "../../src/core/switch-service.js";
import { createAppPaths } from "../../src/storage/app-paths.js";
import { writeJsonFile } from "../../src/storage/config-repo.js";

describe("switchProfile rollback", () => {
  let homeDir: string | undefined;

  afterEach(async () => {
    if (homeDir) {
      await rm(homeDir, { force: true, recursive: true });
      homeDir = undefined;
    }
  });

  it("当第二个目标文件写入失败时应恢复已写入的 .npmrc", async () => {
    homeDir = await mkdtemp(path.join(os.tmpdir(), "pkg-switch-rollback-"));
    const appPaths = createAppPaths(homeDir);
    const oldNpmrc = "registry=https://old.example.com/\n";
    const oldYarnrc = "npmRegistryServer: https://old.example.com/\n";

    await writeJsonFile(appPaths.configFile, {
      meta: {
        version: 1
      },
      defaults: {
        writeTargets: ["npm", "yarn"],
        backupBeforeWrite: true
      },
      common: {
        npm: {
          registry: "https://registry.npmmirror.com/"
        }
      },
      profiles: {
        "CJY-WORK": {
          npm: {
            registry: "https://nexus.example.com/repository/npm-group/"
          }
        }
      }
    });
    await writeFile(path.join(homeDir, ".npmrc"), oldNpmrc, "utf8");
    await writeFile(path.join(homeDir, ".yarnrc.yml"), oldYarnrc, "utf8");

    await expect(
      switchProfile(
        { homeDir, profileName: "CJY-WORK", skipCacheClean: true },
        {
          writeTextFile: async (filePath, content) => {
            if (filePath.endsWith(".yarnrc.yml")) {
              throw new Error("simulated yarn write failure");
            }

            await writeFile(filePath, content, "utf8");
          }
        }
      )
    ).rejects.toMatchObject({
      code: "WRITE_TARGET_FAILED",
      rolledBack: true
    });

    await expect(readFile(path.join(homeDir, ".npmrc"), "utf8")).resolves.toBe(oldNpmrc);
    await expect(readFile(path.join(homeDir, ".yarnrc.yml"), "utf8")).resolves.toBe(oldYarnrc);
  });
});
