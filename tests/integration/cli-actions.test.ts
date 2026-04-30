// ts
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCli } from "../../src/index.js";
import { createAppPaths } from "../../src/storage/app-paths.js";
import { writeJsonFile } from "../../src/storage/config-repo.js";

describe("cli actions", () => {
  let homeDir: string | undefined;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.exitCode = undefined;
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    process.exitCode = undefined;

    if (homeDir) {
      await rm(homeDir, { force: true, recursive: true });
      homeDir = undefined;
    }
  });

  async function prepareHome(): Promise<string> {
    homeDir = await mkdtemp(path.join(os.tmpdir(), "pkg-switch-cli-"));
    const appPaths = createAppPaths(homeDir);

    await writeJsonFile(appPaths.configFile, {
      defaults: {
        writeTargets: ["npm", "yarn"],
        backupBeforeWrite: true
      },
      common: {
        npm: {
          registry: "https://registry.npmmirror.com/"
        },
        yarn: {
          nodeLinker: "node-modules"
        }
      },
      profiles: {
        "CJY-WORK": {
          npm: {
            registry: "https://nexus.example.com/repository/npm-group/",
            authToken: "plain-text-token"
          }
        },
        "CJY-PERSONAL": {
          npm: {
            authToken: null
          }
        }
      }
    });

    return homeDir;
  }

  function loggedText(): string {
    return logSpy.mock.calls.map((call) => call.join(" ")).join("\n");
  }

  it("profile list/show 应读取配置并脱敏展示", async () => {
    const preparedHome = await prepareHome();

    await runCli(["profile", "list"], { homeDir: preparedHome });
    await runCli(["profile", "show", "CJY-WORK"], { homeDir: preparedHome });

    const output = loggedText();
    expect(output).toContain("CJY-PERSONAL");
    expect(output).toContain("CJY-WORK");
    expect(output).toContain("pla***ken");
    expect(output).not.toContain("plain-text-token");
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("switch 和 current 应切换配置并展示当前状态", async () => {
    const preparedHome = await prepareHome();

    await runCli(["switch", "CJY-WORK"], { homeDir: preparedHome });
    await runCli(["current"], { homeDir: preparedHome });

    const npmrc = await readFile(path.join(preparedHome, ".npmrc"), "utf8");
    const output = loggedText();

    expect(npmrc).toContain("registry=https://nexus.example.com/repository/npm-group/");
    expect(output).toContain("Switched to CJY-WORK");
    expect(output).toContain("Active profile: CJY-WORK");
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("doctor 应输出诊断摘要", async () => {
    const preparedHome = await prepareHome();

    await runCli(["doctor"], {
      homeDir: preparedHome,
      commandExists: async (commandName) => commandName !== "yarn"
    });

    const output = loggedText();
    expect(output).toContain("Doctor status: warning");
    expect(output).toContain("yarn-command: warning");
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
