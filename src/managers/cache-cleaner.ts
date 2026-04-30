// ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { CacheCleanMode, WriteTarget } from "../shared/types.js";

const execFileAsync = promisify(execFile);

export type CacheCleanStatus = "success" | "warning" | "skipped";

export interface CacheCleanWarning {
  target: WriteTarget | "all";
  command: string;
  message: string;
}

export interface CacheCleanCommandResult {
  target: WriteTarget;
  command: string;
  status: Exclude<CacheCleanStatus, "skipped">;
  message?: string;
}

export interface CacheCleanResult {
  mode: CacheCleanMode;
  status: CacheCleanStatus;
  commands: CacheCleanCommandResult[];
  warnings: CacheCleanWarning[];
}

export interface CleanCachesInput {
  mode: CacheCleanMode;
  targets: WriteTarget[];
  runCommand?: (command: string, args: string[]) => Promise<void>;
}

interface CacheCommand {
  target: WriteTarget;
  command: string;
  args: string[];
}

const smartCommands: Record<WriteTarget, CacheCommand> = {
  npm: {
    target: "npm",
    command: "npm",
    args: ["cache", "clean", "--force"]
  },
  pnpm: {
    target: "pnpm",
    command: "pnpm",
    args: ["store", "prune"]
  },
  yarn: {
    target: "yarn",
    command: "yarn",
    args: ["cache", "clean"]
  }
};

function formatCommand(command: string, args: string[]): string {
  return [command, ...args].join(" ");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function uniqueTargets(targets: WriteTarget[]): WriteTarget[] {
  return [...new Set(targets)];
}

async function defaultRunCommand(command: string, args: string[]): Promise<void> {
  await execFileAsync(command, args, {
    timeout: 30_000,
    windowsHide: true
  });
}

export async function cleanCaches(input: CleanCachesInput): Promise<CacheCleanResult> {
  if (input.mode === "none") {
    return {
      mode: input.mode,
      status: "skipped",
      commands: [],
      warnings: []
    };
  }

  if (input.mode === "full") {
    return {
      mode: input.mode,
      status: "warning",
      commands: [],
      warnings: [
        {
          target: "all",
          command: "full cache clean",
          message: "full cache clean is unsupported because it may delete user-managed cache directories"
        }
      ]
    };
  }

  const runCommand = input.runCommand ?? defaultRunCommand;
  const commands = uniqueTargets(input.targets).map((target) => smartCommands[target]);
  const results: CacheCleanCommandResult[] = [];
  const warnings: CacheCleanWarning[] = [];

  for (const cacheCommand of commands) {
    const commandLabel = formatCommand(cacheCommand.command, cacheCommand.args);

    try {
      await runCommand(cacheCommand.command, cacheCommand.args);
      results.push({
        target: cacheCommand.target,
        command: commandLabel,
        status: "success"
      });
    } catch (error) {
      const message = errorMessage(error);

      results.push({
        target: cacheCommand.target,
        command: commandLabel,
        status: "warning",
        message
      });
      warnings.push({
        target: cacheCommand.target,
        command: commandLabel,
        message
      });
    }
  }

  return {
    mode: input.mode,
    status: warnings.length > 0 ? "warning" : "success",
    commands: results,
    warnings
  };
}
