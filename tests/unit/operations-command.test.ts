// ts
import { describe, expect, it } from "vitest";
import { createCli } from "../../src/cli.js";

describe("operations commands", () => {
  it("应注册 doctor、restore 与 profile 子命令", () => {
    const cli = createCli();
    const commandNames = cli.commands.map((command: { rawName: string }) => command.rawName);

    expect(commandNames).toContain("doctor");
    expect(commandNames).toContain("restore <backupId>");
    expect(commandNames).toContain("profile <action> [name] [path] [value]");
  });
});
