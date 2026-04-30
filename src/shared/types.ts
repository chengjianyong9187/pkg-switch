// ts
export type WriteTarget = "npm" | "yarn" | "pnpm";

export type CacheCleanMode = "smart" | "full" | "none";

export interface NpmConfig {
  registry?: string;
  cache?: string;
  strictSsl?: boolean;
  alwaysAuth?: boolean;
  authToken?: string;
}

export interface PnpmConfig {
  storeDir?: string;
}

export interface YarnConfig {
  nodeLinker?: string;
  npmRegistryServer?: string;
  npmAlwaysAuth?: boolean;
  npmAuthToken?: string;
}

export interface ScopeConfig {
  registry?: string;
  alwaysAuth?: boolean;
  authToken?: string;
}

export interface ResolvedProfileConfig {
  npm?: NpmConfig;
  pnpm?: PnpmConfig;
  yarn?: YarnConfig;
  scopes?: Record<string, ScopeConfig>;
}

export type ConfigPatch<T> = {
  [K in keyof T]?: T[K] extends Array<unknown>
    ? T[K] | null
    : NonNullable<T[K]> extends object
      ? ConfigPatch<NonNullable<T[K]>> | null
      : T[K] | null;
};

export type ProfileConfig = ConfigPatch<ResolvedProfileConfig>;

export interface PkgSwitchConfig {
  meta?: {
    version: number;
    updatedAt?: string;
  };
  defaults?: {
    writeTargets?: WriteTarget[];
    backupBeforeWrite?: boolean;
    clearCacheOnSwitch?: boolean;
    cacheCleanMode?: CacheCleanMode;
  };
  common?: ResolvedProfileConfig;
  profiles: Record<string, ProfileConfig>;
}

export interface PkgSwitchState {
  activeProfile?: string;
  lastSwitchedAt?: string;
  lastBackupId?: string;
  lastWriteTargets?: WriteTarget[];
  lastSwitchStatus?: "success" | "warning" | "failed";
}
