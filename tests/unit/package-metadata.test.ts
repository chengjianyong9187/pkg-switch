// ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

interface PackageJson {
  private?: boolean;
  license?: string;
  bin?: Record<string, string>;
  files?: string[];
  repository?: {
    type?: string;
    url?: string;
  };
  publishConfig?: {
    registry?: string;
  };
}

const projectRoot = path.resolve(import.meta.dirname, "../..");

describe("package metadata", () => {
  it("应满足公开 npm 包发布的基础元数据要求", async () => {
    const packageJson = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8")) as PackageJson;

    expect(packageJson.private).not.toBe(true);
    expect(packageJson.license).toBe("MIT");
    expect(packageJson.bin?.["pkg-switch"]).toBe("dist/index.js");
    expect(packageJson.files).toEqual(
      expect.arrayContaining([
        "dist",
        "README.md",
        "README.zh-CN.md",
        "CHANGELOG.md",
        "LICENSE",
        "docs/user-manual.en.md",
        "docs/user-manual.zh-CN.md",
        "docs/release-notes.en.md",
        "docs/release-notes.zh-CN.md"
      ])
    );
    expect(packageJson.repository).toEqual({
      type: "git",
      url: "git+ssh://git@github.com/chengjianyong9187/pkg-switch.git"
    });
    expect(packageJson.publishConfig?.registry).toBe("https://registry.npmjs.org/");
    await expect(readFile(path.join(projectRoot, "CHANGELOG.md"), "utf8")).resolves.toContain("## [0.2.0]");
    await expect(readFile(path.join(projectRoot, "LICENSE"), "utf8")).resolves.toContain("MIT License");
  });
});
