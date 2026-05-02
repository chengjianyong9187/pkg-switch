// js
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(currentFile), "..");
const packageJson = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8"));
const tagName = process.argv[2] ?? process.env.GITHUB_REF_NAME;

if (!tagName) {
  throw new Error("Release tag is required");
}

if (!/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tagName)) {
  throw new Error(`Invalid release tag: ${tagName}`);
}

const expectedTag = `v${packageJson.version}`;

if (tagName !== expectedTag) {
  throw new Error(`Release tag ${tagName} does not match package version ${packageJson.version}`);
}

console.log(`Release tag verified: ${tagName}`);
