// ts
import { describe, expect, it } from "vitest";
import { createCli } from "../../src/cli.js";

describe("createCli", () => {
  it("应注册 current 与 switch 子命令", () => {
    const cli = createCli();
    const commandNames = cli.commands.map((command: { rawName: string }) => command.rawName);

    expect(commandNames).toContain("current");
    expect(commandNames).toContain("switch <name>");
  });
});
