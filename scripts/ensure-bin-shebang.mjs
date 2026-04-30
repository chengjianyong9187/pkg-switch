import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const shebang = "#!/usr/bin/env node\n";
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const binFile = path.join(projectRoot, "dist", "index.js");

if (!existsSync(binFile)) {
  throw new Error(`CLI build output not found: ${binFile}`);
}

const currentContent = readFileSync(binFile, "utf8");

if (!currentContent.startsWith(shebang)) {
  writeFileSync(binFile, `${shebang}${currentContent}`, "utf8");
}

try {
  chmodSync(binFile, 0o755);
} catch {
  // Windows 上 chmod 无实际意义，这里保持静默兼容。
}
