// ts
import { cac } from "cac";
import os from "node:os";
import { getCurrentStatus } from "./core/current-service.js";
import type { DoctorInput } from "./core/doctor-service.js";
import { runDoctor } from "./core/doctor-service.js";
import { listProfiles, showProfile } from "./core/profile-service.js";
import { restoreProfileBackup } from "./core/restore-service.js";
import { switchProfile } from "./core/switch-service.js";
import type { PkgSwitchConfig } from "./shared/types.js";
import { createAppPaths } from "./storage/app-paths.js";
import { readJsonFile } from "./storage/config-repo.js";

export interface CliRuntimeOptions {
  homeDir?: string;
  commandExists?: DoctorInput["commandExists"];
}

async function readConfig(homeDir: string): Promise<PkgSwitchConfig> {
  return readJsonFile<PkgSwitchConfig>(createAppPaths(homeDir).configFile);
}

export function createCli(options: CliRuntimeOptions = {}) {
  // 先完成最小命令骨架，后续任务再补充真实业务动作。
  const cli = cac("pkg-switch");
  const homeDir = options.homeDir ?? os.homedir();

  cli.command("current", "显示当前激活 profile").action(async () => {
    const status = await getCurrentStatus({ homeDir });

    if (!status.active) {
      console.log("No active profile");
      console.log(`State file: ${status.stateFile}`);
      return;
    }

    console.log(`Active profile: ${status.activeProfile}`);
    console.log(`Last backup: ${status.lastBackupId ?? "-"}`);
    console.log(`Last status: ${status.lastSwitchStatus ?? "-"}`);
  });

  cli.command("switch <name>", "切换到指定 profile").action(async (name: string) => {
    // 对占位参数做最小保护，避免空字符串等异常输入静默通过。
    if (!name || !name.trim()) {
      throw new Error("profile name is required");
    }

    const result = await switchProfile({ homeDir, profileName: name, skipCacheClean: false });
    console.log(`Switched to ${result.profileName}`);
    console.log(`Backup: ${result.backupId ?? "-"}`);
  });

  cli.command("doctor", "执行环境诊断").action(async () => {
    const result = await runDoctor({ homeDir, commandExists: options.commandExists });
    console.log(`Doctor status: ${result.status}`);

    for (const check of result.checks) {
      console.log(`${check.name}: ${check.status} - ${check.message}`);
    }
  });

  cli.command("restore <backupId>", "恢复指定备份").action(async (backupId: string) => {
    if (!backupId || !backupId.trim()) {
      throw new Error("backup id is required");
    }

    const result = await restoreProfileBackup({ homeDir, backupId });
    console.log(`Restored backup: ${result.backupId}`);
  });

  cli.command("profile <action> [name]", "管理 profile：list 或 show <name>").action(async (action: string, name?: string) => {
    if (action === "list") {
      const names = listProfiles(await readConfig(homeDir));

      for (const profileName of names) {
        console.log(profileName);
      }

      return;
    }

    if (action === "show") {
      if (!name || !name.trim()) {
        throw new Error("profile name is required");
      }

      console.log(JSON.stringify(showProfile(await readConfig(homeDir), name), null, 2));
      return;
    }

    throw new Error(`Unknown profile action: ${action}`);
  });

  cli.help();

  cli.on("command:*", () => {
    // 让未知命令进入统一错误出口，后续可替换为结构化错误码。
    throw new Error(`Invalid command: ${cli.args.join(" ")}`);
  });

  return cli;
}
