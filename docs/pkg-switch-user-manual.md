# pkg-switch 安装部署与操作手册

## 文档信息

- **文档编号**: pkg-switch-OPS-001
- **文档类型**: 操作手册
- **适用范围**: `pkg-switch` CLI 安装、部署、profile 配置、切换、诊断、备份与恢复
- **当前版本**: 1.0
- **状态**: 正式
- **更新日期**: 2026-05-01

## 1. 当前本机结论

截至 2026-05-01，本机结论如下：

| 项目 | 结论 |
| --- | --- |
| 全局 `pkg-switch` 命令 | 未安装；`Get-Command pkg-switch` 返回 `NOT_INSTALLED` |
| 仓库构建产物 | 已存在，`node dist/index.js --help` 可运行 |
| 当前激活 profile | `CJY-WORK` |
| 当前 profile 列表 | `CJY-WORK`、`CJY-PERSONAL` |
| 当前 Node.js | `v22.22.0` |
| 当前 pnpm | `10.31.0` |
| 当前 Git | `2.30.1.windows.1` |

说明：

- 本机现在可以通过 `node dist/index.js <command>` 运行工具。
- 若希望在任意目录直接执行 `pkg-switch`，还需要执行“本机开发安装”中的全局 link 步骤。
- 当前包的 `package.json` 包含 `bin.pkg-switch=dist/index.js`，并已准备公开 npm 发布所需的基础元数据。

## 2. 工具定位

`pkg-switch` 用命名 profile 管理用户级包管理器配置，主要覆盖：

- `npm` 用户配置：写入 `%USERPROFILE%\.npmrc`
- `yarn` 用户配置：写入 `%USERPROFILE%\.yarnrc.yml`
- `pnpm` 缓存目录配置：参与 profile 合并和缓存清理
- 切换前备份、失败回滚、当前状态记录、环境诊断

该工具面向“同一台开发机需要在内网私服配置和个人公开镜像配置之间切换”的场景。

## 3. 本机开发安装

公开包发布到 npmjs 后，新机器可直接安装：

```powershell
npm install --global pkg-switch
pkg-switch --help
```

或使用 pnpm：

```powershell
pnpm add --global pkg-switch
pkg-switch --help
```

若需要基于源码开发或验证未发布版本，使用下面的本地仓库安装方式。

在已有仓库 `D:\WorkingSpace\AI_TOOLS\pkg-switch` 上安装全局 CLI：

```powershell
cd D:\WorkingSpace\AI_TOOLS\pkg-switch
pnpm install
pnpm build
pnpm link --global
```

验证：

```powershell
pkg-switch --help
pkg-switch current
pkg-switch doctor
```

如果 `pkg-switch` 命令仍然找不到：

- 重新打开 PowerShell，刷新 PATH。
- 检查 pnpm 全局 bin 目录是否在 PATH 中。
- 临时验证可使用 `node dist/index.js --help`。

解除本机全局 link：

```powershell
pnpm remove --global pkg-switch
```

更新本机 CLI：

```powershell
cd D:\WorkingSpace\AI_TOOLS\pkg-switch
git pull
pnpm install
pnpm build
pnpm link --global
pkg-switch --help
```

## 4. 全新 PC 部署方式

### 4.1 必须环境

| 环境 | 建议 |
| --- | --- |
| Git | `2.30.x`，与当前团队基线一致 |
| Node.js | 使用 `nvm` 管理，建议安装 Node.js 22 LTS |
| pnpm | 使用 `corepack` 或 npm 安装，项目当前声明 `pnpm@10.31.0` |
| PowerShell | Windows 自带 PowerShell 可用，建议安装 PowerShell 7 |

最小验证命令：

```powershell
git --version
nvm version
node -v
npm -v
pnpm -v
```

### 4.2 安装步骤

1. 安装 Git、nvm，并通过 nvm 安装 Node.js。

```powershell
nvm install 22
nvm use 22
node -v
```

2. 启用 pnpm。

```powershell
corepack enable
corepack prepare pnpm@10.31.0 --activate
pnpm -v
```

如果当前 Node.js 发行包未启用 corepack，可使用：

```powershell
npm install --global pnpm@10.31.0
pnpm -v
```

3. 拉取或复制仓库。

```powershell
cd D:\WorkingSpace\AI_TOOLS
git clone git@github.com:chengjianyong9187/pkg-switch.git
cd D:\WorkingSpace\AI_TOOLS\pkg-switch
```

4. 安装依赖、构建并注册全局命令。

```powershell
pnpm install --frozen-lockfile
pnpm build
pnpm link --global
pkg-switch --help
```

5. 创建用户配置目录和配置文件。

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.pkg-switch"
Copy-Item .\examples\config.example.json "$env:USERPROFILE\.pkg-switch\config.json"
```

复制后需要编辑 `%USERPROFILE%\.pkg-switch\config.json`，将 registry、scope、缓存目录和鉴权占位符替换为真实值。不要把包含真实 token 的配置文件提交到仓库。

6. 执行诊断并切换 profile。

```powershell
pkg-switch doctor
pkg-switch switch CJY-WORK --no-cache-clean
pkg-switch current
pkg-switch backup list
```

### 4.3 新 PC 目录建议

- 源码仓库建议放在非 C 盘，例如 `D:\WorkingSpace\AI_TOOLS\pkg-switch`。
- nvm、Node.js 全局包目录、npm cache、pnpm store 建议放在非 C 盘。
- 运行时安装目录和业务源码目录分开，避免升级 Node.js 或清理缓存时误伤源码。

## 5. 配置文件说明

默认文件位置：

| 文件 | 用途 |
| --- | --- |
| `%USERPROFILE%\.pkg-switch\config.json` | profile 主配置 |
| `%USERPROFILE%\.pkg-switch\state.json` | 当前激活 profile、最近备份、最近切换状态 |
| `%USERPROFILE%\.pkg-switch\backups\` | 切换前自动备份目录 |
| `%USERPROFILE%\.npmrc` | npm 用户级配置输出 |
| `%USERPROFILE%\.yarnrc.yml` | yarn 用户级配置输出 |

`config.json` 顶层结构：

```json
{
  "meta": {
    "version": 1,
    "updatedAt": "2026-05-01T00:00:00+08:00"
  },
  "defaults": {
    "writeTargets": ["npm", "yarn"],
    "backupBeforeWrite": true,
    "clearCacheOnSwitch": true,
    "cacheCleanMode": "smart"
  },
  "common": {},
  "profiles": {}
}
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `defaults.writeTargets` | 切换时写入哪些目标，目前常用 `npm`、`yarn` |
| `defaults.backupBeforeWrite` | 写入前是否备份已有 rc 文件 |
| `defaults.clearCacheOnSwitch` | 切换成功后是否按默认策略清理缓存 |
| `defaults.cacheCleanMode` | 缓存清理模式：`smart`、`full`、`none` |
| `common` | 多个 profile 共享的公共配置 |
| `profiles` | 按名称保存差异配置，例如 `CJY-WORK`、`CJY-PERSONAL` |

合并规则：

- 实际生效配置为 `common + profiles.<name>`。
- profile 中同名字段会覆盖 `common`。
- profile 中字段值为 `null` 时，表示移除从 `common` 继承的配置。
- `profile show <name>` 展示的是合并后的配置，并会对敏感字段脱敏。

## 6. CJY 推荐配置样例

以下是脱敏后的配置形态，真实 token、账号、邮箱等敏感信息必须仅保存在本机 `%USERPROFILE%\.pkg-switch\config.json`。

```json
{
  "defaults": {
    "writeTargets": ["npm", "yarn"],
    "backupBeforeWrite": true,
    "clearCacheOnSwitch": true,
    "cacheCleanMode": "smart"
  },
  "common": {
    "npm": {
      "cache": "D:\\DevTools\\nvm\\node_cache",
      "extraConfig": {
        "prefix": "D:\\DevTools\\nvm\\node_global",
        "electron_builder_binaries_mirror": "https://npmmirror.com/mirrors/electron-builder-binaries/",
        "electron_mirror": "https://cdn.npmmirror.com/binaries/electron/",
        "sass_binary_site": "https://registry.npmmirror.com/-/binary/node-sass",
        "python": "D:\\DevTools\\Python312\\python.exe",
        "msvs_version": "2022"
      }
    }
  },
  "profiles": {
    "CJY-WORK": {
      "npm": {
        "registry": "http://nexus.rongji.com:8081/repository/npm-public",
        "alwaysAuth": true,
        "extraConfig": {
          "//nexus.rongji.com:8081/repository/npm-public/:_auth": "<WORK_AUTH>",
          "//nexus.rongji.com:8081/repository/npm-public/:email": "<WORK_EMAIL>"
        }
      }
    },
    "CJY-PERSONAL": {
      "npm": {
        "registry": "https://registry.npmmirror.com/",
        "alwaysAuth": false
      }
    }
  }
}
```

`npm.extraConfig` 用于承载 `.npmrc` 中不属于标准结构的键，例如：

- `prefix`
- `electron_mirror`
- `sass_binary_site`
- `python`
- `msvs_version`
- `//host/path/:_auth`
- `//host/path/:_authToken`
- `//host/path/:email`

## 7. profile 操作命令

查看当前状态：

```powershell
pkg-switch current
```

列出全部 profile：

```powershell
pkg-switch profile list
```

查看合并后的 profile 配置：

```powershell
pkg-switch profile show CJY-WORK
pkg-switch profile show CJY-PERSONAL
```

新增空 profile：

```powershell
pkg-switch profile add CJY-TEST
```

删除非激活 profile：

```powershell
pkg-switch profile remove CJY-TEST
```

注意：

- `profile add` 遇到同名 profile 会失败。
- `profile remove` 不允许删除当前激活 profile。
- `profile show` 会脱敏 token、auth、password、username、email 等敏感字段。

## 8. profile 切换命令

切换到工作配置：

```powershell
pkg-switch switch CJY-WORK
```

切换到个人配置：

```powershell
pkg-switch switch CJY-PERSONAL
```

切换但跳过本次缓存清理：

```powershell
pkg-switch switch CJY-WORK --no-cache-clean
```

单次指定缓存清理模式：

```powershell
pkg-switch switch CJY-WORK --cache-clean smart
pkg-switch switch CJY-WORK --cache-clean none
pkg-switch switch CJY-WORK --cache-clean full
```

缓存模式说明：

| 模式 | 行为 |
| --- | --- |
| `smart` | 执行安全命令：`npm cache clean --force`、`pnpm store prune`、`yarn cache clean` |
| `none` | 不清理缓存 |
| `full` | 当前不会删除目录，仅返回 warning，避免误删用户自管缓存目录 |

切换流程：

1. 读取 `%USERPROFILE%\.pkg-switch\config.json`。
2. 合并 `common + profile`。
3. 校验 registry、鉴权配置和写入目标。
4. 按需备份已有 `.npmrc` / `.yarnrc.yml`。
5. 写入新的用户级 rc 文件。
6. 写入 `%USERPROFILE%\.pkg-switch\state.json`。
7. 按配置或命令参数执行缓存清理。

## 9. 诊断、备份与恢复

执行诊断：

```powershell
pkg-switch doctor
```

`doctor` 检查范围：

- `%USERPROFILE%\.pkg-switch` 是否可写
- `config.json` 是否可读
- `state.json` 中的 `activeProfile` 是否存在于配置
- 各 profile 的 registry URL 是否合法
- `alwaysAuth=true` 时是否存在 token 或 host 级鉴权配置
- `npm` / `pnpm` / `yarn` 命令是否可用

查看备份：

```powershell
pkg-switch backup list
```

恢复指定备份：

```powershell
pkg-switch restore backup-2026-05-01T15-16-40-573Z
```

建议：

- 每次切换前保持 `backupBeforeWrite=true`。
- 恢复前先执行 `pkg-switch backup list` 确认备份编号。
- 恢复后执行 `pkg-switch current` 和 `pkg-switch doctor` 复核状态。

## 10. 常见问题

### 10.1 `pkg-switch` 命令找不到

先判断是否已全局安装：

```powershell
Get-Command pkg-switch
```

如果找不到，回到仓库目录执行：

```powershell
pnpm build
pnpm link --global
```

仍然找不到时重新打开终端，或使用：

```powershell
node D:\WorkingSpace\AI_TOOLS\pkg-switch\dist\index.js --help
```

### 10.2 `doctor` 报 npm/pnpm/yarn command not found

先确认当前 shell 能否找到命令：

```powershell
where.exe npm
where.exe pnpm
where.exe yarn
```

如果 `where.exe` 找不到，需要修复 PATH 或重新安装对应工具。修改 PATH 后需要重新打开 PowerShell。

### 10.3 `profile remove CJY-WORK` 删除失败

如果 `CJY-WORK` 是当前激活 profile，删除会被拒绝。先切换到其它 profile：

```powershell
pkg-switch switch CJY-PERSONAL --no-cache-clean
pkg-switch profile remove CJY-WORK
```

### 10.4 registry URL 不合法

registry 必须是合法 URL，例如：

```json
{
  "npm": {
    "registry": "https://registry.npmmirror.com/"
  }
}
```

不要写成 `registry.npmmirror.com` 或空字符串。

### 10.5 host 级鉴权应该放哪里

放在 `npm.extraConfig` 中：

```json
{
  "npm": {
    "alwaysAuth": true,
    "extraConfig": {
      "//nexus.example.com/repository/npm-public/:_authToken": "<TOKEN>"
    }
  }
}
```

`pkg-switch` 渲染 `.npmrc` 时会原样输出这些键，`profile show` 展示时会脱敏。

## 11. 验收清单

本机或新 PC 完成部署后，至少执行：

```powershell
pkg-switch --help
pkg-switch profile list
pkg-switch profile show CJY-WORK
pkg-switch doctor
pkg-switch switch CJY-WORK --no-cache-clean
pkg-switch current
pkg-switch backup list
```

预期结果：

- `pkg-switch --help` 能展示命令列表。
- `profile list` 包含预期 profile。
- `profile show` 不输出明文 token。
- `doctor` 至少不应出现配置读取、registry、鉴权相关 error。
- `current` 显示刚切换的 profile。

## 12. 关联文档

- 上游文档：`README.md`
- 配置示例：`examples/config.example.json`
- 实现计划：`docs/superpowers/plans/2026-04-29-package-manager-profile-switch.md`
- 设计规格：`docs/superpowers/specs/2026-04-29-package-manager-profile-switch-design.md`

## 13. 变更记录

| 版本 | 日期 | 作者 | 变更内容 |
| --- | --- | --- | --- |
| v1.0 | 2026-05-01 | Codex | 新增安装部署与 profile 操作手册 |
