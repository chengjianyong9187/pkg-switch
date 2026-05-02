// ts
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createAppPaths } from "../../src/storage/app-paths.js";
import { readJsonFile, readOptionalJsonFile, writeJsonFile } from "../../src/storage/config-repo.js";

describe("createAppPaths", () => {
  it("应在用户目录下生成 .pkg-switch 路径集合", () => {
    const homeDir = path.join("C:", "Users", "CJY");
    const paths = createAppPaths(homeDir);

    expect(paths.rootDir).toBe(path.join(homeDir, ".pkg-switch"));
    expect(paths.configFile).toBe(path.join(homeDir, ".pkg-switch", "config.json"));
    expect(paths.stateFile).toBe(path.join(homeDir, ".pkg-switch", "state.json"));
    expect(paths.backupDir).toBe(path.join(homeDir, ".pkg-switch", "backups"));
    expect(paths.logDir).toBe(path.join(homeDir, ".pkg-switch", "logs"));
  });

  it("应拒绝空用户目录", () => {
    expect(() => createAppPaths("")).toThrow("homeDir is required");
  });
});

describe("config-repo", () => {
  let tempDir: string | undefined;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { force: true, recursive: true });
      tempDir = undefined;
    }
  });

  it("应读取和写入格式化 JSON 文件", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "pkg-switch-repo-"));
    const filePath = path.join(tempDir, ".pkg-switch", "state.json");

    await writeJsonFile(filePath, { activeProfile: "work" });

    await expect(readJsonFile<{ activeProfile: string }>(filePath)).resolves.toEqual({
      activeProfile: "work"
    });
    await expect(readFile(filePath, "utf8")).resolves.toContain("\n");
  });

  it("应在可选 JSON 文件不存在时返回 undefined", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "pkg-switch-repo-"));

    await expect(readOptionalJsonFile(path.join(tempDir, "missing.json"))).resolves.toBeUndefined();
  });

  it("应在 JSON 损坏时输出包含路径的错误", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "pkg-switch-repo-"));
    const filePath = path.join(tempDir, "broken.json");
    await writeFile(filePath, "{", "utf8");

    await expect(readJsonFile(filePath)).rejects.toThrow(`Invalid JSON file: ${filePath}`);
  });
});
