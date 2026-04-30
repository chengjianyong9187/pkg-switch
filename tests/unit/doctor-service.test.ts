// ts
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runDoctor } from "../../src/core/doctor-service.js";

describe("runDoctor", () => {
  let homeDir: string | undefined;

  afterEach(async () => {
    if (homeDir) {
      await rm(homeDir, { force: true, recursive: true });
      homeDir = undefined;
    }
  });

  it("应返回目录写权限和 npm、pnpm、yarn 的可用性检查结果", async () => {
    homeDir = await mkdtemp(path.join(os.tmpdir(), "pkg-switch-doctor-"));

    const result = await runDoctor({
      homeDir,
      commandExists: async (commandName) => commandName !== "yarn"
    });

    expect(result.status).toBe("warning");
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "app-root-writable", status: "ok" }),
        expect.objectContaining({ name: "npm-command", status: "ok" }),
        expect.objectContaining({ name: "pnpm-command", status: "ok" }),
        expect.objectContaining({ name: "yarn-command", status: "warning" })
      ])
    );
  });
});
