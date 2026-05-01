// ts
import { access } from "node:fs/promises";
import { createAppPaths } from "../storage/app-paths.js";
import { writeJsonFile } from "../storage/config-repo.js";
import type { PkgSwitchConfig } from "../shared/types.js";

export interface InitConfigInput {
  homeDir: string;
  force?: boolean;
}

export interface InitConfigResult {
  created: boolean;
  overwritten: boolean;
  configFile: string;
}

function hasErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) {
      return false;
    }

    throw error;
  }
}

function createDefaultConfig(now = new Date()): PkgSwitchConfig {
  return {
    meta: {
      version: 1,
      updatedAt: now.toISOString()
    },
    defaults: {
      writeTargets: ["npm", "yarn", "pnpm"],
      backupBeforeWrite: true,
      clearCacheOnSwitch: false,
      cacheCleanMode: "smart"
    },
    common: {
      npm: {
        registry: "https://registry.npmmirror.com/",
        cache: "${HOME}/.cache/npm",
        strictSsl: true
      },
      pnpm: {
        storeDir: "${HOME}/.local/share/pnpm/store"
      },
      yarn: {
        nodeLinker: "node-modules"
      }
    },
    profiles: {
      work: {},
      personal: {
        npm: {
          registry: "https://registry.npmmirror.com/",
          alwaysAuth: false
        }
      }
    }
  };
}

export async function initConfig(input: InitConfigInput): Promise<InitConfigResult> {
  const appPaths = createAppPaths(input.homeDir);
  const exists = await fileExists(appPaths.configFile);

  if (exists && !input.force) {
    throw new Error(`config.json already exists: ${appPaths.configFile}`);
  }

  await writeJsonFile(appPaths.configFile, createDefaultConfig());

  return {
    created: !exists,
    overwritten: exists,
    configFile: appPaths.configFile
  };
}
