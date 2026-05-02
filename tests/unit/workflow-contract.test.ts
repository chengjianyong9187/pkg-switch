// ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "../..");

async function readWorkflow(relativePath: string): Promise<{ raw: string; parsed: Record<string, unknown> }> {
  const raw = await readFile(path.join(projectRoot, relativePath), "utf8");
  return {
    raw,
    parsed: YAML.parse(raw) as Record<string, unknown>
  };
}

describe("GitHub Actions workflows", () => {
  it("CI workflow 应在 push/PR 时执行 lint、test、build 和 npm pack 预检", async () => {
    const { raw, parsed } = await readWorkflow(".github/workflows/ci.yml");

    expect(parsed.name).toBe("CI");
    expect(raw).toContain("uses: actions/checkout@v6");
    expect(raw).toContain("uses: actions/setup-node@v6");
    expect(raw).toContain("corepack prepare pnpm@10.31.0 --activate");
    expect(raw).toContain("pnpm lint");
    expect(raw).toContain("pnpm test");
    expect(raw).toContain("pnpm build");
    expect(raw).toContain("npm pack --dry-run --registry=https://registry.npmjs.org/");
  });

  it("release workflow 应在 v* tag 后校验并自动发布 npmjs", async () => {
    const { raw, parsed } = await readWorkflow(".github/workflows/release.yml");

    expect(parsed.name).toBe("Release");
    expect(raw).toContain("tags:");
    expect(raw).toContain("\"v*.*.*\"");
    expect(raw).toContain("id-token: write");
    expect(raw).toContain("NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}");
    expect(raw).toContain("node scripts/verify-release-tag.mjs");
    expect(raw).toContain("npm publish --provenance --registry=https://registry.npmjs.org/");
  });
});
