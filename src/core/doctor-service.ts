// ts
import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { createAppPaths } from "../storage/app-paths.js";

const execFileAsync = promisify(execFile);

export type DoctorCheckStatus = "ok" | "warning" | "error";

export interface DoctorCheck {
  name: string;
  status: DoctorCheckStatus;
  message: string;
}

export interface DoctorResult {
  status: DoctorCheckStatus;
  checks: DoctorCheck[];
}

export interface DoctorInput {
  homeDir: string;
  commandExists?: (commandName: string) => Promise<boolean>;
}

async function defaultCommandExists(commandName: string): Promise<boolean> {
  try {
    await execFileAsync(commandName, ["--version"], {
      timeout: 5000,
      windowsHide: true
    });
    return true;
  } catch {
    return false;
  }
}

function aggregateStatus(checks: DoctorCheck[]): DoctorCheckStatus {
  if (checks.some((check) => check.status === "error")) {
    return "error";
  }

  if (checks.some((check) => check.status === "warning")) {
    return "warning";
  }

  return "ok";
}

async function checkAppRootWritable(homeDir: string): Promise<DoctorCheck> {
  const appPaths = createAppPaths(homeDir);
  const probeFile = path.join(appPaths.rootDir, ".write-probe");

  try {
    await mkdir(appPaths.rootDir, { recursive: true });
    await writeFile(probeFile, "ok", "utf8");
    await rm(probeFile, { force: true });

    return {
      name: "app-root-writable",
      status: "ok",
      message: `${appPaths.rootDir} is writable`
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      name: "app-root-writable",
      status: "error",
      message
    };
  }
}

async function checkCommand(commandName: string, commandExists: (commandName: string) => Promise<boolean>): Promise<DoctorCheck> {
  const exists = await commandExists(commandName);

  return {
    name: `${commandName}-command`,
    status: exists ? "ok" : "warning",
    message: exists ? `${commandName} is available` : `${commandName} command not found`
  };
}

export async function runDoctor(input: DoctorInput): Promise<DoctorResult> {
  const commandExists = input.commandExists ?? defaultCommandExists;
  const checks = [
    await checkAppRootWritable(input.homeDir),
    await checkCommand("npm", commandExists),
    await checkCommand("pnpm", commandExists),
    await checkCommand("yarn", commandExists)
  ];

  return {
    status: aggregateStatus(checks),
    checks
  };
}
