// ts
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const personalizedProfilePattern = /\bCJY-[A-Z0-9-]+\b/;

async function listFiles(dirPath: string): Promise<string[]> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dirPath, entry.name);
      return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
    })
  );

  return files.flat();
}

describe("public fixtures", () => {
  it("测试样例不应残留个人化 profile 名称", async () => {
    const testFiles = (await listFiles(path.join(projectRoot, "tests"))).filter((filePath) => filePath.endsWith(".ts"));
    const matches: string[] = [];

    for (const filePath of testFiles) {
      const content = await readFile(filePath, "utf8");
      if (personalizedProfilePattern.test(content)) {
        matches.push(path.relative(projectRoot, filePath));
      }
    }

    expect(matches).toEqual([]);
  });
});
