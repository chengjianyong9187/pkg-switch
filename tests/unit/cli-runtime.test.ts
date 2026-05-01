// ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCli } from "../../src/index.js";

describe("runCli", () => {
  const originalExitCode = process.exitCode;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.exitCode = undefined;
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.exitCode = originalExitCode;
    vi.restoreAllMocks();
  });

  it("应在 --help 时输出全局帮助与已注册命令", () => {
    runCli(["--help"]);

    const helpOutput = logSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(helpOutput).toContain("Usage");
    expect(helpOutput).toContain("current");
    expect(helpOutput).toContain("switch <name>");
    expect(errorSpy).not.toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();
  });

  it("应在 --version 时输出包版本号", () => {
    runCli(["--version"]);

    const output = logSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(output).toContain("pkg-switch/0.2.0");
    expect(errorSpy).not.toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();
  });

  it("应在 switch 缺少 profile 名称时设置失败退出码", () => {
    runCli(["switch"]);

    const errorOutput = errorSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(errorOutput).toContain("missing required args for command `switch <name>`");
    expect(process.exitCode).toBe(1);
  });

  it("应在遇到未知命令时设置失败退出码", () => {
    runCli(["unknown"]);

    const errorOutput = errorSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(errorOutput).toContain("Invalid command: unknown");
    expect(process.exitCode).toBe(1);
  });
});
