// ts
import { readFileSync } from "node:fs";
import path from "node:path";

interface PackageMetadata {
  version?: unknown;
}

const packageJsonPath = path.resolve(import.meta.dirname, "../package.json");

function readPackageVersion(): string {
  let rawPackageJson: string;

  try {
    rawPackageJson = readFileSync(packageJsonPath, "utf8");
  } catch (cause) {
    throw new Error(`Failed to read package metadata: ${packageJsonPath}`, { cause });
  }

  let packageMetadata: PackageMetadata;

  try {
    packageMetadata = JSON.parse(rawPackageJson) as PackageMetadata;
  } catch (cause) {
    throw new Error(`Failed to parse package metadata: ${packageJsonPath}`, { cause });
  }

  if (typeof packageMetadata.version !== "string" || packageMetadata.version.trim() === "") {
    throw new Error(`Invalid package version in package metadata: ${packageJsonPath}`);
  }

  // package.json 是唯一版本来源，避免 CLI 输出与 npm 元数据漂移。
  return packageMetadata.version;
}

export const pkgSwitchVersion = readPackageVersion();
