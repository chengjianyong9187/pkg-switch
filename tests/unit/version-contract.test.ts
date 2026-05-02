// ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { pkgSwitchVersion } from "../../src/version.js";

interface PackageJson {
  version: string;
}

const projectRoot = path.resolve(import.meta.dirname, "../..");

describe("version contract", () => {
  it("应以 package.json 作为唯一版本号来源", async () => {
    const packageJson = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8")) as PackageJson;
    const versionSource = await readFile(path.join(projectRoot, "src/version.ts"), "utf8");

    expect(pkgSwitchVersion).toBe(packageJson.version);
    expect(versionSource).not.toMatch(/pkgSwitchVersion\s*=\s*["']\d+\.\d+\.\d+/);
  });
});
