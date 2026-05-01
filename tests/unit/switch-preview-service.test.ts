// ts
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { previewSwitchProfile } from "../../src/core/switch-preview-service.js";
import { createAppPaths } from "../../src/storage/app-paths.js";
import { writeJsonFile } from "../../src/storage/config-repo.js";

describe("previewSwitchProfile", () => {
  let homeDir: string | undefined;

  afterEach(async () => {
    if (homeDir) {
      await rm(homeDir, { force: true, recursive: true });
      homeDir = undefined;
    }
  });

  async function prepareHome(): Promise<string> {
    homeDir = await mkdtemp(path.join(os.tmpdir(), "pkg-switch-preview-"));
    const appPaths = createAppPaths(homeDir);

    await writeJsonFile(appPaths.configFile, {
      defaults: {
        writeTargets: ["npm", "yarn", "pnpm"]
      },
      common: {
        npm: {
          registry: "https://registry.npmmirror.com/"
        },
        pnpm: {
          storeDir: "${HOME}/.local/share/pnpm/store"
        }
      },
      profiles: {
        work: {
          npm: {
            registry: "https://registry.example.com/repository/npm-group/",
            authToken: "plain-text-token"
          }
        }
      }
    });

    return homeDir;
  }

  it("dry-run 应返回脱敏后的目标文件内容且不写入文件", async () => {
    const preparedHome = await prepareHome();

    const result = await previewSwitchProfile({ homeDir: preparedHome, profileName: "work" });
    const npmTarget = result.targets.find((target) => target.target === "npm");

    expect(npmTarget?.maskedContent).toContain("registry=https://registry.example.com/repository/npm-group/");
    expect(npmTarget?.maskedContent).toContain("_authToken=pla***ken");
    expect(npmTarget?.maskedContent).toContain("store-dir=${HOME}/.local/share/pnpm/store");
    expect(npmTarget?.maskedContent).not.toContain("plain-text-token");
    await expect(readFile(path.join(preparedHome, ".npmrc"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("diff 应对比当前文件与目标文件并脱敏敏感值", async () => {
    const preparedHome = await prepareHome();

    await writeFile(path.join(preparedHome, ".npmrc"), "registry=https://old.example.com/\n_authToken=old-token\n", "utf8");

    const result = await previewSwitchProfile({ homeDir: preparedHome, profileName: "work", includeDiff: true });
    const npmTarget = result.targets.find((target) => target.target === "npm");

    expect(npmTarget?.diff).toContain("-registry=https://old.example.com/");
    expect(npmTarget?.diff).toContain("+registry=https://registry.example.com/repository/npm-group/");
    expect(npmTarget?.diff).toContain("-_authToken=old***ken");
    expect(npmTarget?.diff).toContain("+_authToken=pla***ken");
    expect(npmTarget?.diff).not.toContain("plain-text-token");
    expect(npmTarget?.diff).not.toContain("old-token");
  });
});
