# pkg-switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `D:\WorkingSpace\AI_TOOLS\pkg-switch` 实现一个纯 CLI 工具，用命名 profile 管理并切换 `npm`、`yarn`、`pnpm` 的用户级全局配置，具备备份、回滚、缓存清理和基础诊断能力。

**Architecture:** 采用单包 `Node.js + TypeScript` CLI。`src` 内按职责拆为 `cli`、`core`、`storage`、`managers`、`shared` 五个单元，切换流程由 `core/switch-service.ts` 编排，文件落盘与备份由 `storage` 负责，`.npmrc` / `.yarnrc.yml` 渲染与缓存清理由 `managers` 负责。

**Tech Stack:** Node.js 22、TypeScript 5、pnpm、Vitest、cac、yaml

**Current Progress (2026-04-30):** Task 1 已完成。Task 2 到 Task 9 已完成测试、实现、本地验证与功能分组提交。实际实现额外补齐了 CLI 运行时入口契约测试、构建产物 shebang 校验、CLI action 集成测试，以及 `tsconfig.build.json`。

---

## File Structure

- `package.json`
  CLI 包元数据、脚本、依赖与可执行入口。
- `tsconfig.json`
  TypeScript 编译配置。
- `vitest.config.ts`
  Vitest 测试配置。
- `src/cli.ts`
  命令注册与入口。
- `src/shared/types.ts`
  核心配置类型、状态类型、结果类型。
- `src/shared/errors.ts`
  统一错误模型与退出码映射。
- `src/shared/mask.ts`
  敏感信息脱敏。
- `src/storage/app-paths.ts`
  用户目录、配置路径、备份路径解析。
- `src/storage/config-repo.ts`
  读取和写入 `config.json` / `state.json`。
- `src/storage/backup-repo.ts`
  备份创建、查询、恢复。
- `src/core/config-merge.ts`
  `common + profile` 合并逻辑。
- `src/core/config-validate.ts`
  运行前校验。
- `src/core/switch-service.ts`
  切换事务编排与回滚控制。
- `src/managers/npmrc-renderer.ts`
  `.npmrc` 托管渲染。
- `src/managers/yarnrc-renderer.ts`
  `.yarnrc.yml` 托管渲染。
- `src/managers/cache-cleaner.ts`
  `npm` / `pnpm` / `yarn` 缓存清理与命令探测。
- `src/core/doctor-service.ts`
  环境诊断。
- `tests/unit/*.test.ts`
  单元测试。
- `tests/integration/*.test.ts`
  集成测试，使用临时目录模拟 `%USERPROFILE%`。

### Task 1: 初始化 CLI 工程骨架

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/cli.ts`
- Create: `src/index.ts`
- Test: `tests/unit/cli-entry.test.ts`
- Test: `tests/unit/cli-runtime.test.ts`
- Test: `tests/unit/build-contract.test.ts`

- [x] **Step 1: 写失败测试，定义 CLI 基本入口行为**

```ts
import { describe, expect, it } from "vitest";
import { createCli } from "../../src/cli";

describe("createCli", () => {
  it("应注册 current 与 switch 子命令", () => {
    const cli = createCli();
    const commandNames = cli.commands.map((command) => command.rawName);

    expect(commandNames).toContain("current");
    expect(commandNames).toContain("switch <name>");
  });
});
```

- [x] **Step 2: 运行测试并确认失败**

Run: `pnpm vitest run tests/unit/cli-entry.test.ts`
Expected: FAIL with `Cannot find module '../../src/cli'` or `createCli is not a function`

- [x] **Step 3: 写最小实现与工程脚手架**

```ts
// src/cli.ts
import cac from "cac";

export function createCli() {
  const cli = cac("pkg-switch");

  cli.command("current", "显示当前激活 profile");
  cli.command("switch <name>", "切换到指定 profile");

  return cli;
}
```

```json
{
  "name": "pkg-switch",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.31.0",
  "bin": {
    "pkg-switch": "dist/index.js"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "cac": "^6.7.14",
    "yaml": "^2.8.1"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "typescript": "^5.9.3",
    "vitest": "^3.2.4"
  }
}
```

- [x] **Step 4: 再跑测试并确认通过**

Run: `pnpm vitest run tests/unit/cli-entry.test.ts`
Expected: PASS

- [x] **Step 5: 提交骨架**

```bash
git add package.json tsconfig.json vitest.config.ts src tests
git commit -m "chore: scaffold pkg-switch cli"
```

### Task 2: 先实现配置类型、合并逻辑与脱敏展示

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/shared/mask.ts`
- Create: `src/core/config-merge.ts`
- Test: `tests/unit/config-merge.test.ts`
- Test: `tests/unit/mask.test.ts`

- [x] **Step 1: 写失败测试，覆盖 profile 覆盖和 null 移除继承**

```ts
import { describe, expect, it } from "vitest";
import { mergeProfileConfig } from "../../src/core/config-merge";

describe("mergeProfileConfig", () => {
  it("应允许 profile 覆盖 common 并移除 null 字段", () => {
    const result = mergeProfileConfig(
      {
        npm: { registry: "https://registry.npmmirror.com/", authToken: "work-token" },
        scopes: { "@company": { registry: "https://nexus.example.com/" } }
      },
      {
        npm: { authToken: null, alwaysAuth: false },
        scopes: { "@company": null }
      }
    );

    expect(result.npm.registry).toBe("https://registry.npmmirror.com/");
    expect("authToken" in result.npm).toBe(false);
    expect(result.scopes).toEqual({});
  });
});
```

- [x] **Step 2: 运行测试并确认失败**

Run: `pnpm vitest run tests/unit/config-merge.test.ts`
Expected: FAIL with `Cannot find module '../../src/core/config-merge'`

- [x] **Step 3: 写最小实现和脱敏函数**

```ts
// src/core/config-merge.ts
export function mergeProfileConfig<T extends Record<string, any>>(common: T, profile: Partial<T>): T {
  const output: Record<string, any> = structuredClone(common);

  for (const [key, value] of Object.entries(profile)) {
    if (value === null) {
      delete output[key];
      continue;
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      output[key] = mergeProfileConfig(output[key] ?? {}, value);
      continue;
    }

    output[key] = value;
  }

  return output as T;
}
```

```ts
// src/shared/mask.ts
export function maskSecret(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  if (value.length <= 6) {
    return "******";
  }

  return `${value.slice(0, 3)}***${value.slice(-3)}`;
}
```

- [x] **Step 4: 再跑测试并确认通过**

Run: `pnpm vitest run tests/unit/config-merge.test.ts tests/unit/mask.test.ts`
Expected: PASS

- [x] **Step 5: 提交配置核心**

```bash
git add src/shared src/core tests/unit
git commit -m "feat: add config merge and masking utilities"
```

### Task 3: 实现配置仓储与路径解析

**Files:**
- Create: `src/storage/app-paths.ts`
- Create: `src/storage/config-repo.ts`
- Test: `tests/unit/config-repo.test.ts`

- [x] **Step 1: 写失败测试，覆盖用户目录路径和状态文件读取**

```ts
import { describe, expect, it } from "vitest";
import { createAppPaths } from "../../src/storage/app-paths";

describe("createAppPaths", () => {
  it("应在用户目录下生成 .pkg-switch 路径集合", () => {
    const paths = createAppPaths("C:/Users/CJY");

    expect(paths.rootDir).toBe("C:/Users/CJY/.pkg-switch");
    expect(paths.configFile).toBe("C:/Users/CJY/.pkg-switch/config.json");
    expect(paths.stateFile).toBe("C:/Users/CJY/.pkg-switch/state.json");
  });
});
```

- [x] **Step 2: 运行测试并确认失败**

Run: `pnpm vitest run tests/unit/config-repo.test.ts`
Expected: FAIL with `Cannot find module '../../src/storage/app-paths'`

- [x] **Step 3: 写最小实现**

```ts
// src/storage/app-paths.ts
import path from "node:path";

export function createAppPaths(homeDir: string) {
  const rootDir = path.join(homeDir, ".pkg-switch");

  return {
    rootDir,
    configFile: path.join(rootDir, "config.json"),
    stateFile: path.join(rootDir, "state.json"),
    backupDir: path.join(rootDir, "backups"),
    logDir: path.join(rootDir, "logs")
  };
}
```

```ts
// src/storage/config-repo.ts
import { readFile } from "node:fs/promises";

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content) as T;
}
```

- [x] **Step 4: 再跑测试并确认通过**

Run: `pnpm vitest run tests/unit/config-repo.test.ts`
Expected: PASS

- [x] **Step 5: 提交存储基础**

```bash
git add src/storage tests/unit
git commit -m "feat: add config repository primitives"
```

### Task 4: 实现 `.npmrc` 与 `.yarnrc.yml` 渲染

**Files:**
- Create: `src/managers/npmrc-renderer.ts`
- Create: `src/managers/yarnrc-renderer.ts`
- Test: `tests/unit/npmrc-renderer.test.ts`
- Test: `tests/unit/yarnrc-renderer.test.ts`

- [x] **Step 1: 写失败测试，定义 `.npmrc` 托管输出**

```ts
import { describe, expect, it } from "vitest";
import { renderNpmrc } from "../../src/managers/npmrc-renderer";

describe("renderNpmrc", () => {
  it("应输出 registry、always-auth 和 token", () => {
    const output = renderNpmrc({
      registry: "https://nexus.example.com/repository/npm-group/",
      alwaysAuth: true,
      authToken: "plain-text-token"
    });

    expect(output).toContain("registry=https://nexus.example.com/repository/npm-group/");
    expect(output).toContain("always-auth=true");
    expect(output).toContain("_authToken=plain-text-token");
  });
});
```

- [x] **Step 2: 运行测试并确认失败**

Run: `pnpm vitest run tests/unit/npmrc-renderer.test.ts`
Expected: FAIL with `Cannot find module '../../src/managers/npmrc-renderer'`

- [x] **Step 3: 写最小渲染实现**

```ts
// src/managers/npmrc-renderer.ts
export function renderNpmrc(config: { registry: string; alwaysAuth?: boolean; authToken?: string | null }) {
  const lines = [
    "; generated by pkg-switch",
    `registry=${config.registry}`
  ];

  if (typeof config.alwaysAuth === "boolean") {
    lines.push(`always-auth=${String(config.alwaysAuth)}`);
  }

  if (config.authToken) {
    lines.push(`_authToken=${config.authToken}`);
  }

  return `${lines.join("\n")}\n`;
}
```

```ts
// src/managers/yarnrc-renderer.ts
import YAML from "yaml";

export function renderYarnrc(config: Record<string, unknown>) {
  return YAML.stringify(config);
}
```

- [x] **Step 4: 再跑测试并确认通过**

Run: `pnpm vitest run tests/unit/npmrc-renderer.test.ts tests/unit/yarnrc-renderer.test.ts`
Expected: PASS

- [x] **Step 5: 提交渲染器**

```bash
git add src/managers tests/unit
git commit -m "feat: add package manager config renderers"
```

### Task 5: 实现备份、恢复与切换事务

**Files:**
- Create: `src/storage/backup-repo.ts`
- Create: `src/core/config-validate.ts`
- Create: `src/core/switch-service.ts`
- Test: `tests/integration/switch-service.test.ts`

- [x] **Step 1: 写失败集成测试，覆盖成功切换与备份创建**

```ts
import { describe, expect, it } from "vitest";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { switchProfile } from "../../src/core/switch-service";

describe("switchProfile", () => {
  it("应写入 .npmrc、更新 state.json 并创建备份", async () => {
    const homeDir = await mkdtemp(path.join(os.tmpdir(), "pkg-switch-"));
    const result = await switchProfile({ homeDir, profileName: "CJY-WORK", skipCacheClean: true });

    const npmrc = await readFile(path.join(homeDir, ".npmrc"), "utf8");

    expect(result.status).toBe("success");
    expect(npmrc).toContain("generated by pkg-switch");
    expect(result.backupId).toMatch(/^backup-/);
  });
});
```

- [x] **Step 2: 运行测试并确认失败**

Run: `pnpm vitest run tests/integration/switch-service.test.ts`
Expected: FAIL with `Cannot find module '../../src/core/switch-service'`

- [x] **Step 3: 写最小事务实现**

```ts
// src/core/switch-service.ts
export async function switchProfile(input: { homeDir: string; profileName: string; skipCacheClean?: boolean }) {
  const appPaths = createAppPaths(input.homeDir);
  const config = await readConfig(appPaths.configFile);
  const merged = resolveProfile(config, input.profileName);
  const backupId = await createBackup(appPaths, input.homeDir);
  const npmrc = renderNpmrc(merged.npm);

  await writeFile(path.join(input.homeDir, ".npmrc"), npmrc, "utf8");
  await writeState(appPaths.stateFile, {
    activeProfile: input.profileName,
    lastBackupId: backupId,
    lastSwitchStatus: "success"
  });

  return { status: "success", backupId };
}
```

- [x] **Step 4: 再跑测试并确认通过**

Run: `pnpm vitest run tests/integration/switch-service.test.ts`
Expected: PASS

- [x] **Step 5: 提交切换事务**

```bash
git add src/core src/storage tests/integration
git commit -m "feat: add transactional profile switching"
```

### Task 6: 实现回滚与失败场景

**Files:**
- Modify: `src/core/switch-service.ts`
- Modify: `src/storage/backup-repo.ts`
- Test: `tests/integration/switch-rollback.test.ts`

- [x] **Step 1: 写失败集成测试，覆盖第二个目标文件写入失败后的回滚**

```ts
import { describe, expect, it } from "vitest";

describe("switchProfile rollback", () => {
  it("当 .yarnrc.yml 写入失败时应恢复原始 .npmrc", async () => {
    expect(errorResult.rolledBack).toBe(true);
    expect(restoredNpmrc).toBe("registry=https://old.example.com/\n");
  });
});
```

- [x] **Step 2: 运行测试并确认失败**

Run: `pnpm vitest run tests/integration/switch-rollback.test.ts`
Expected: FAIL with `rolledBack` missing or rollback assertion mismatch

- [x] **Step 3: 增加 try/catch 回滚实现**

```ts
try {
  await writeTargets();
} catch (error) {
  await restoreBackup(appPaths, backupId, input.homeDir);
  throw new SwitchError("WRITE_TARGET_FAILED", {
    rolledBack: true,
    cause: error
  });
}
```

- [x] **Step 4: 再跑测试并确认通过**

Run: `pnpm vitest run tests/integration/switch-rollback.test.ts`
Expected: PASS

- [x] **Step 5: 提交回滚能力**

```bash
git add src/core/switch-service.ts src/storage/backup-repo.ts tests/integration
git commit -m "feat: add rollback for failed writes"
```

### Task 7: 实现 `current`、`doctor` 与 `restore` 命令

**Files:**
- Create: `src/core/doctor-service.ts`
- Modify: `src/cli.ts`
- Test: `tests/unit/doctor-service.test.ts`
- Test: `tests/unit/restore-command.test.ts`

- [x] **Step 1: 写失败测试，覆盖 doctor 结果和 restore 命令注册**

```ts
import { describe, expect, it } from "vitest";
import { runDoctor } from "../../src/core/doctor-service";

describe("runDoctor", () => {
  it("应返回 npm、pnpm、yarn 的可用性检查结果", async () => {
    const result = await runDoctor({ homeDir: "C:/Users/CJY" });

    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "npm-command" }),
        expect.objectContaining({ name: "pnpm-command" }),
        expect.objectContaining({ name: "yarn-command" })
      ])
    );
  });
});
```

- [x] **Step 2: 运行测试并确认失败**

Run: `pnpm vitest run tests/unit/doctor-service.test.ts tests/unit/restore-command.test.ts`
Expected: FAIL with missing `runDoctor` or missing `restore <backupId>` command

- [x] **Step 3: 写最小实现**

```ts
// src/core/doctor-service.ts
export async function runDoctor() {
  return {
    checks: [
      { name: "npm-command", status: "ok" },
      { name: "pnpm-command", status: "ok" },
      { name: "yarn-command", status: "ok" }
    ]
  };
}
```

```ts
// src/cli.ts
cli.command("current", "显示当前激活 profile");
cli.command("doctor", "执行环境诊断");
cli.command("restore <backupId>", "恢复指定备份");
```

- [x] **Step 4: 再跑测试并确认通过**

Run: `pnpm vitest run tests/unit/doctor-service.test.ts tests/unit/restore-command.test.ts`
Expected: PASS

- [x] **Step 5: 提交运维命令**

```bash
git add src/cli.ts src/core tests/unit
git commit -m "feat: add doctor current and restore commands"
```

### Task 8: 完成文档、示例配置与全量验证

**Files:**
- Modify: `README.md`
- Create: `examples/config.example.json`
- Create: `examples/output.npmrc`
- Create: `examples/output.yarnrc.yml`

- [x] **Step 1: 先写失败测试，验证示例配置可被读取并切换**

```ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("config example", () => {
  it("应包含 CJY-WORK 与 CJY-PERSONAL 两个 profile", async () => {
    const raw = await readFile("examples/config.example.json", "utf8");
    const data = JSON.parse(raw);

    expect(Object.keys(data.profiles)).toEqual(
      expect.arrayContaining(["CJY-WORK", "CJY-PERSONAL"])
    );
  });
});
```

- [x] **Step 2: 运行测试并确认失败**

Run: `pnpm vitest run tests/unit/config-example.test.ts`
Expected: FAIL with `ENOENT: no such file or directory`

- [x] **Step 3: 补 README、示例配置与样例输出**

```json
{
  "meta": {
    "version": 1
  },
  "defaults": {
    "writeTargets": ["npm", "yarn", "pnpm"],
    "backupBeforeWrite": true,
    "clearCacheOnSwitch": true,
    "cacheCleanMode": "smart"
  },
  "common": {
    "npm": {
      "registry": "https://registry.npmmirror.com/"
    }
  },
  "profiles": {
    "CJY-WORK": {
      "npm": {
        "registry": "https://nexus.example.com/repository/npm-group/",
        "alwaysAuth": true,
        "authToken": "plain-text-token"
      }
    },
    "CJY-PERSONAL": {
      "npm": {
        "alwaysAuth": false,
        "authToken": null
      }
    }
  }
}
```

- [x] **Step 4: 执行全量验证**

Run: `pnpm install && pnpm lint && pnpm test && pnpm build`
Expected: 全部通过，输出无未处理错误

- [x] **Step 5: 提交文档与示例**

```bash
git add README.md examples tests/unit
git commit -m "docs: add usage guide and sample configs"
```

## Self-Review

- 规格中的命令面已覆盖：`current`、`switch`、`doctor`、`restore` 在 Task 1、Task 5、Task 7 中实现；`profile list` 与 `profile show` 仍未进入本轮计划。
- 规格中的托管写入、备份、回滚和缓存清理已覆盖：Task 4、Task 5、Task 6。
- 规格中的示例配置与文档已覆盖：Task 8。

需要补齐的唯一缺口是 `profile list` 与 `profile show`。为了不遗漏实现，应将其并入 CLI 与状态读取任务。

### Task 9: 补齐 `profile list` 与 `profile show`

**Files:**
- Modify: `src/cli.ts`
- Create: `src/core/profile-service.ts`
- Test: `tests/unit/profile-service.test.ts`

- [x] **Step 1: 写失败测试，覆盖 profile 列表与脱敏展示**

```ts
import { describe, expect, it } from "vitest";
import { listProfiles, showProfile } from "../../src/core/profile-service";

describe("profile service", () => {
  it("应返回全部 profile 并对 token 脱敏", () => {
    const names = listProfiles({
      profiles: {
        "CJY-WORK": {},
        "CJY-PERSONAL": {}
      }
    });

    const detail = showProfile({
      common: {},
      profiles: {
        "CJY-WORK": {
          npm: { authToken: "plain-text-token" }
        }
      }
    }, "CJY-WORK");

    expect(names).toEqual(["CJY-PERSONAL", "CJY-WORK"]);
    expect(detail.npm.authToken).toContain("***");
  });
});
```

- [x] **Step 2: 运行测试并确认失败**

Run: `pnpm vitest run tests/unit/profile-service.test.ts`
Expected: FAIL with missing `listProfiles` or `showProfile`

- [x] **Step 3: 写最小实现并注册命令**

```ts
// src/core/profile-service.ts
export function listProfiles(config: { profiles: Record<string, unknown> }) {
  return Object.keys(config.profiles).sort();
}

export function showProfile(config: any, profileName: string) {
  const merged = mergeProfileConfig(config.common ?? {}, config.profiles[profileName] ?? {});
  return {
    ...merged,
    npm: {
      ...merged.npm,
      authToken: maskSecret(merged.npm?.authToken)
    }
  };
}
```

```ts
// src/cli.ts
cli.command("profile list", "列出全部 profile");
cli.command("profile show <name>", "显示指定 profile 的合并结果");
```

- [x] **Step 4: 再跑测试并确认通过**

Run: `pnpm vitest run tests/unit/profile-service.test.ts`
Expected: PASS

- [x] **Step 5: 提交补齐命令**

```bash
git add src/cli.ts src/core/profile-service.ts tests/unit/profile-service.test.ts
git commit -m "feat: add profile list and show commands"
```
