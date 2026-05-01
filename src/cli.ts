// ts
import { cac } from "cac";
import os from "node:os";
import { listProfileBackups } from "./core/backup-service.js";
import { getCurrentStatus } from "./core/current-service.js";
import type { DoctorInput } from "./core/doctor-service.js";
import { runDoctor } from "./core/doctor-service.js";
import { initConfig } from "./core/init-service.js";
import { addProfile, listProfiles, removeProfile, setProfileValue, showProfile, unsetProfileValue } from "./core/profile-service.js";
import { restoreProfileBackup } from "./core/restore-service.js";
import { previewSwitchProfile } from "./core/switch-preview-service.js";
import { switchProfile } from "./core/switch-service.js";
import type { SwitchProfileDependencies } from "./core/switch-service.js";
import type { CacheCleanMode, PkgSwitchConfig, PkgSwitchState } from "./shared/types.js";
import { createAppPaths } from "./storage/app-paths.js";
import { readJsonFile, readOptionalJsonFile, writeJsonFile } from "./storage/config-repo.js";
import { pkgSwitchVersion } from "./version.js";

export interface CliRuntimeOptions {
  homeDir?: string;
  commandExists?: DoctorInput["commandExists"];
  runCacheCommand?: SwitchProfileDependencies["runCacheCommand"];
  argv?: string[];
}

interface SwitchCommandOptions {
  cacheClean?: string | boolean;
  dryRun?: boolean;
  diff?: boolean;
}

interface InitCommandOptions {
  force?: boolean;
}

const cacheCleanModes: CacheCleanMode[] = ["smart", "full", "none"];

async function readConfig(homeDir: string): Promise<PkgSwitchConfig> {
  return readJsonFile<PkgSwitchConfig>(createAppPaths(homeDir).configFile);
}

async function readState(homeDir: string): Promise<PkgSwitchState | undefined> {
  return readOptionalJsonFile<PkgSwitchState>(createAppPaths(homeDir).stateFile);
}

async function writeConfig(homeDir: string, config: PkgSwitchConfig): Promise<void> {
  await writeJsonFile(createAppPaths(homeDir).configFile, config);
}

function parseCacheCleanMode(value: string): CacheCleanMode {
  if (cacheCleanModes.includes(value as CacheCleanMode)) {
    return value as CacheCleanMode;
  }

  throw new Error(`Invalid cache clean mode: ${value}`);
}

function hasArg(argv: string[], argName: string): boolean {
  return argv.some((arg) => arg === argName || arg.startsWith(`${argName}=`));
}

export function createCli(options: CliRuntimeOptions = {}) {
  // 先完成最小命令骨架，后续任务再补充真实业务动作。
  const cli = cac("pkg-switch");
  const homeDir = options.homeDir ?? os.homedir();
  const argv = options.argv ?? process.argv.slice(2);

  cli.version(pkgSwitchVersion);

  cli
    .command("init", "创建默认 profile 配置")
    .option("--force", "覆盖已存在的 config.json")
    .action(async (commandOptions: InitCommandOptions = {}) => {
      const result = await initConfig({ homeDir, force: commandOptions.force });

      console.log(`${result.overwritten ? "Overwrote" : "Created"} config: ${result.configFile}`);
    });

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

  cli
    .command("switch <name>", "切换到指定 profile")
    .option("--no-cache-clean", "跳过本次缓存清理")
    .option("--cache-clean [mode]", "单次指定缓存清理模式：smart、full 或 none")
    .option("--dry-run", "仅预览将写入的配置，不落盘、不备份、不清理缓存")
    .option("--diff", "输出当前配置与目标配置的脱敏差异，不落盘")
    .action(async (name: string, commandOptions: SwitchCommandOptions = {}) => {
      // 对占位参数做最小保护，避免空字符串等异常输入静默通过。
      if (!name || !name.trim()) {
        throw new Error("profile name is required");
      }

      if (commandOptions.cacheClean === true && hasArg(argv, "--cache-clean")) {
        throw new Error("cache clean mode is required");
      }

      const cacheCleanModeOverride =
        typeof commandOptions.cacheClean === "string" ? parseCacheCleanMode(commandOptions.cacheClean) : undefined;

      if (commandOptions.dryRun || commandOptions.diff) {
        const result = await previewSwitchProfile({
          homeDir,
          profileName: name,
          includeDiff: commandOptions.diff
        });

        console.log(`${commandOptions.diff ? "Diff" : "Dry run"} for profile: ${result.profileName}`);

        for (const target of result.targets) {
          console.log(`[${target.target}] ${target.filePath}`);
          console.log(commandOptions.diff ? target.diff : target.maskedContent);
        }

        return;
      }

      const result = await switchProfile(
        {
          homeDir,
          profileName: name,
          skipCacheClean: commandOptions.cacheClean === false,
          cacheCleanModeOverride
        },
        {
          runCacheCommand: options.runCacheCommand
        }
      );

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

  cli.command("backup <action>", "管理备份：list").action(async (action: string) => {
    if (action === "list") {
      const backups = await listProfileBackups({ homeDir });

      if (backups.length === 0) {
        console.log("No backups found");
        return;
      }

      for (const backup of backups) {
        console.log(`${backup.backupId} ${backup.createdAt} files=${backup.fileCount}`);
      }

      return;
    }

    throw new Error(`Unknown backup action: ${action}`);
  });

  cli
    .command("profile <action> [name] [path] [value]", "管理 profile：list、show、add、remove、set、unset")
    .action(async (action: string, name?: string, configPath?: string, value?: string) => {
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

      if (action === "add") {
        if (!name || !name.trim()) {
          throw new Error("profile name is required");
        }

        await writeConfig(homeDir, addProfile(await readConfig(homeDir), name));
        console.log(`Added profile: ${name}`);
        return;
      }

      if (action === "remove") {
        if (!name || !name.trim()) {
          throw new Error("profile name is required");
        }

        await writeConfig(homeDir, removeProfile(await readConfig(homeDir), name, await readState(homeDir)));
        console.log(`Removed profile: ${name}`);
        return;
      }

      if (action === "set") {
        if (!name || !name.trim()) {
          throw new Error("profile name is required");
        }

        if (!configPath || !configPath.trim()) {
          throw new Error("profile value path is required");
        }

        if (value === undefined) {
          throw new Error("profile value is required");
        }

        await writeConfig(homeDir, setProfileValue(await readConfig(homeDir), name, configPath, value));
        console.log(`Set profile value: ${name} ${configPath}`);
        return;
      }

      if (action === "unset") {
        if (!name || !name.trim()) {
          throw new Error("profile name is required");
        }

        if (!configPath || !configPath.trim()) {
          throw new Error("profile value path is required");
        }

        await writeConfig(homeDir, unsetProfileValue(await readConfig(homeDir), name, configPath));
        console.log(`Unset profile value: ${name} ${configPath}`);
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
