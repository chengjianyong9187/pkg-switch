# 包管理器工作区配置切换工具设计

## 1. 目标

构建一个纯 CLI 的前端包管理器配置切换工具，解决同一台开发机在公司工作区与个人工作区之间切换 `npm`、`yarn`、`pnpm` 全局配置的问题。

本工具一期目标：

- 支持命名工作区配置档，例如 `CJY-WORK`、`CJY-PERSONAL`
- 支持通用配置与工作区差异配置合并
- 支持一键切换并全局生效
- 支持切换前备份、切换失败回滚、切换后缓存清理
- 优先适配 Windows 本机开发环境
- 以开发者常用 CLI 体验为主

## 2. 范围

### 2.1 包含范围

- 用户级 `.npmrc` 生成与覆盖
- 用户级 `.yarnrc.yml` 生成与覆盖
- `npm` / `pnpm` / `yarn` 的切换后清理与诊断
- 工具自有配置、状态、备份管理
- 基于命名配置档的显式切换命令
- 对敏感字段的展示脱敏

### 2.2 不包含范围

- 按目录自动识别并切换工作区
- GUI、TUI 或桌面应用界面
- Windows 凭据管理器集成
- 多设备同步
- 项目级 `.npmrc` 合并或局部 patch
- 远程配置中心

## 3. 关键约束与设计决策

### 3.1 工具形态

采用 `Node.js + TypeScript` 实现单包 CLI，不依赖 Electron，不复用现有 `env-switch-studio`。

这样做的原因：

- 更贴合 `pnpm` 开发习惯
- 测试与发布链路更稳定
- 后续可继续扩展到更多包管理器规则

### 3.2 工作区模型

工作区采用命名配置档模式，由用户显式执行命令切换，例如：

- `pkg-switch switch CJY-WORK`
- `pkg-switch switch CJY-PERSONAL`

一期不做目录探测与自动切换，避免误判和隐式状态漂移。

### 3.3 敏感信息存储

私服鉴权信息允许保存在工具自己的用户级配置文件中，由工具负责生成最终的 `.npmrc` / `.yarnrc.yml`。

该决策的优先级是“切换简单、行为稳定”，而不是“避免明文存储”。

### 3.4 主配置存放位置

主配置默认放在用户目录固定位置：

- 配置文件：`%USERPROFILE%\.pkg-switch\config.json`
- 状态文件：`%USERPROFILE%\.pkg-switch\state.json`
- 备份目录：`%USERPROFILE%\.pkg-switch\backups\`
- 日志目录：`%USERPROFILE%\.pkg-switch\logs\`

二期可考虑增加 `--config` 参数支持外部配置路径，但一期不作为主能力。

## 4. 总体架构

工具拆分为五个逻辑模块：

1. `cli`
   负责命令注册、参数解析、输出格式与退出码。
2. `storage`
   负责读取和写入 `config.json`、`state.json`、备份文件与日志文件。
3. `core`
   负责配置合并、配置校验、切换事务编排、回滚控制。
4. `managers`
   负责各包管理器配置渲染、缓存清理、命令可用性检测。
5. `shared`
   负责类型定义、错误模型、路径工具、脱敏工具、时间与文件工具。

数据流如下：

1. CLI 读取用户输入命令。
2. `storage` 读取用户目录下配置与状态。
3. `core` 校验目标 profile，合并通用配置与 profile 差异配置。
4. `core` 调用 `managers` 渲染 `.npmrc` 与 `.yarnrc.yml` 内容。
5. `storage` 先备份当前用户配置，再原子写入新文件。
6. `managers` 执行缓存清理与环境诊断。
7. `storage` 写入新的 `state.json` 与切换日志。

## 5. 命令设计

一期建议提供以下命令：

- `pkg-switch profile list`
  列出全部配置档，并标记当前激活项。

- `pkg-switch profile show <name>`
  查看某个配置档合并后的生效配置，敏感字段默认脱敏。

- `pkg-switch profile add <name>`
  创建新的命名配置档。首版可以采用模板初始化，不要求完整交互式向导。

- `pkg-switch profile remove <name>`
  删除指定配置档。当前激活配置档禁止删除。

- `pkg-switch switch <name>`
  执行切换事务：合并配置、备份、写入、清理、记录状态。

- `pkg-switch current`
  显示当前激活配置档、配置文件位置、上次切换时间和最近备份编号。

- `pkg-switch doctor`
  检查环境、命令可用性、配置完整性和用户目录写权限。

- `pkg-switch backup list`
  列出可恢复的备份记录。

- `pkg-switch restore <backup-id>`
  从指定备份恢复 `.npmrc`、`.yarnrc.yml` 和状态信息。

推荐的附加参数：

- `--no-cache-clean`
- `--cache-clean=smart|full`
- `--json`
- `--verbose`

## 6. 配置模型

最终配置采用“通用配置 + profile 差异配置”的合并模型。

### 6.1 `config.json` 结构

```json
{
  "meta": {
    "version": 1,
    "updatedAt": "2026-04-29T10:00:00+08:00"
  },
  "defaults": {
    "writeTargets": ["npm", "yarn", "pnpm"],
    "backupBeforeWrite": true,
    "clearCacheOnSwitch": true,
    "cacheCleanMode": "smart"
  },
  "common": {
    "npm": {
      "registry": "https://registry.npmmirror.com/",
      "cache": "D:/DevCaches/npm-cache",
      "strictSsl": true
    },
    "pnpm": {
      "storeDir": "D:/DevCaches/pnpm-store"
    },
    "yarn": {
      "nodeLinker": "node-modules"
    }
  },
  "profiles": {
    "CJY-WORK": {
      "npm": {
        "registry": "https://nexus.example.com/repository/npm-group/",
        "alwaysAuth": true,
        "authToken": "plain-text-token"
      },
      "scopes": {
        "@company": {
          "registry": "https://nexus.example.com/repository/npm-group/"
        }
      }
    },
    "CJY-PERSONAL": {
      "npm": {
        "alwaysAuth": false,
        "authToken": null
      },
      "scopes": {
        "@company": null
      }
    }
  }
}
```

### 6.2 合并规则

- 最终配置 = `defaults + common + profile`
- profile 中同名字段覆盖 common
- `null` 表示显式移除继承字段
- 未声明字段按默认值处理

### 6.3 状态文件

`state.json` 用于记录运行时状态，而不是配置本身。建议字段如下：

- `activeProfile`
- `lastSwitchedAt`
- `lastBackupId`
- `lastWriteTargets`
- `lastSwitchStatus`

## 7. 配置文件渲染策略

### 7.1 `.npmrc`

用户级 `.npmrc` 是一期的核心产物，同时服务于：

- `npm`
- `pnpm`
- Yarn 1

生成策略采用“完全托管”，而不是“增量修改原文件”：

- 每次切换都重新生成完整的托管内容
- 写入固定文件头注释，声明由工具生成
- 手工修改不作为持久来源，真正配置来源始终是 `config.json`

这样可以避免历史残留配置污染切换结果。

### 7.2 `.yarnrc.yml`

针对 Yarn 2/3/4，额外生成用户级 `.yarnrc.yml`。

生成内容应覆盖：

- `npmRegistryServer`
- `npmScopes`
- `npmAlwaysAuth`
- `npmAuthToken`
- `nodeLinker`

### 7.3 写入目标

一期默认写入以下位置：

- `%USERPROFILE%\.npmrc`
- `%USERPROFILE%\.yarnrc.yml`

`pnpm` 一期不单独写专属 rc 文件，优先复用 `.npmrc` 和必要的环境设置。

## 8. 切换事务设计

`pkg-switch switch <name>` 采用明确的事务步骤，保证“要么全部成功，要么尽量回滚到切换前状态”。

执行顺序：

1. 读取 `config.json` 与 `state.json`
2. 校验目标 profile 是否存在
3. 合并目标配置
4. 执行配置完整性校验
5. 生成备份编号并备份现有 `.npmrc` / `.yarnrc.yml`
6. 渲染目标文件内容
7. 原子写入配置文件
8. 执行缓存清理与命令诊断
9. 更新 `state.json`
10. 输出本次切换摘要

回滚规则：

- 若写文件前失败，不修改任何用户配置
- 若任一目标文件写入失败，立即恢复本次备份
- 若缓存清理失败，不回滚配置文件，但标记切换结果为 `warning`
- 若 `state.json` 写入失败，保留已生效配置，同时输出显式告警，并提示执行 `current` 或 `doctor`

## 9. 缓存清理策略

缓存清理默认启用，但不强制采用最重的全量清空。

### 9.1 `smart` 模式

- `npm`：`npm cache clean --force`
- `pnpm`：`pnpm store prune`
- `yarn`：根据可执行命令版本选择 `yarn cache clean`

### 9.2 `full` 模式

在 `smart` 基础上，允许增加更重的目录级清理策略，但必须先做路径校验，避免误删非目标缓存目录。

### 9.3 `none` 模式

通过 `--no-cache-clean` 或配置关闭缓存清理，仅切换配置文件。

## 10. 诊断与校验

`doctor` 命令至少应覆盖以下内容：

- 用户目录及工具目录是否可写
- `npm` / `pnpm` / `yarn` 命令是否可用
- 当前 `state.json` 对应的 profile 是否真实存在
- 当前 `.npmrc` / `.yarnrc.yml` 是否与工具状态一致
- registry 是否为合法 URL
- cache / store 路径是否为空或明显非法
- 鉴权配置是否自相矛盾，例如 `alwaysAuth=true` 但缺少 token

## 11. 异常处理

必须明确处理以下失败场景：

- profile 不存在：直接失败，不写任何文件
- 配置文件损坏：直接失败，提示修复 `config.json`
- 用户目录目标文件不可写：直接失败，输出具体路径
- 某个包管理器命令不存在：切换可继续，但在结果中给出告警
- `.yarnrc.yml` 写入失败：触发回滚，恢复所有已备份文件
- 备份目录不可写：若启用了 `backupBeforeWrite`，则切换直接失败
- 生成的配置内容不合法：在落盘前就拦截

错误输出原则：

- 指明失败步骤
- 指明受影响文件
- 明确是否已回滚
- 给出下一步建议命令，例如 `pkg-switch doctor`

## 12. 安全与可维护性约束

- 工具不会修改项目目录内的 `.npmrc`
- 工具只处理用户级全局配置
- 备份文件默认保留最近 N 份，避免无限增长
- 日志中不得明文输出 token
- `profile show`、`current` 等展示命令必须默认脱敏

## 13. 测试策略

实现阶段采用 TDD，核心行为必须先有失败测试，再写生产代码。

### 13.1 单元测试

- 配置合并逻辑
- `null` 移除继承字段
- `.npmrc` 渲染结果
- `.yarnrc.yml` 渲染结果
- profile 校验与默认值补齐
- 脱敏展示逻辑

### 13.2 集成测试

通过临时目录模拟用户主目录，验证：

- 从 `CJY-WORK` 切到 `CJY-PERSONAL`
- 切换时是否先备份后写入
- 写入失败后是否自动回滚
- `state.json` 是否按预期更新

### 13.3 命令级测试

- `profile list`
- `profile show`
- `switch`
- `current`
- `doctor`
- `restore`

首个关键失败测试建议为：

- 当存在 `common + CJY-WORK` 配置时，执行 `switch CJY-WORK`，应生成用户级 `.npmrc`、创建备份并更新 `state.json`

## 14. 一期交付物

- 可运行的 `Node.js + TypeScript` CLI 工程
- 基础命令：`profile list`、`profile show`、`switch`、`current`、`doctor`、`restore`
- 用户目录配置模板
- 备份与回滚机制
- 单元测试与集成测试
- CLI 使用说明

## 15. 暂不实现项

- 自动按目录匹配 profile
- PowerShell profile 注入或 shell hook
- 配置加密与凭据托管
- 跨设备同步配置
- GUI 管理界面
