# pkg-switch 中文操作手册

## 文档信息

- **文档编号**: pkg-switch-OPS-ZH-001
- **文档类型**: 操作手册
- **适用范围**: `pkg-switch` 安装、配置、profile 切换、诊断、备份与恢复
- **当前版本**: 1.1
- **状态**: 正式
- **更新日期**: 2026-05-02

## 1. 工具定位

`pkg-switch` 用命名 profile 管理用户级包管理器配置，主要覆盖：

- `npm` 用户配置：写入 `.npmrc`
- `yarn` 用户配置：写入 `.yarnrc.yml`
- `pnpm` 相关配置：通过 `.npmrc` 和缓存清理命令协同生效
- 切换前备份、失败回滚、当前状态记录、环境诊断

典型场景：

- 工作 profile 使用企业私有 registry。
- 个人 profile 使用公开 registry 或国内稳定镜像。
- 发布 profile 保留 npmjs host 级 token，同时日常安装仍走镜像。

## 2. 安装方式

公开 npm 包安装：

```bash
npm install --global pkg-switch
pkg-switch --help
```

使用 pnpm 安装：

```bash
pnpm add --global pkg-switch
pkg-switch --help
```

从源码开发安装：

```bash
git clone git@github.com:chengjianyong9187/pkg-switch.git
cd pkg-switch
pnpm install
pnpm build
pnpm link --global
pkg-switch --help
```

## 3. 运行时文件

Windows 默认位置：

| 文件 | 用途 |
| --- | --- |
| `%USERPROFILE%\.pkg-switch\config.json` | profile 主配置 |
| `%USERPROFILE%\.pkg-switch\state.json` | 当前激活 profile、最近备份、最近切换状态 |
| `%USERPROFILE%\.pkg-switch\backups\` | 切换前自动备份目录 |
| `%USERPROFILE%\.npmrc` | npm / pnpm 用户级配置输出 |
| `%USERPROFILE%\.yarnrc.yml` | yarn 用户级配置输出 |

Linux/macOS 默认位置：

| 文件 | 用途 |
| --- | --- |
| `$HOME/.pkg-switch/config.json` | profile 主配置 |
| `$HOME/.pkg-switch/state.json` | 当前激活 profile、最近备份、最近切换状态 |
| `$HOME/.pkg-switch/backups/` | 切换前自动备份目录 |
| `$HOME/.npmrc` | npm / pnpm 用户级配置输出 |
| `$HOME/.yarnrc.yml` | yarn 用户级配置输出 |

## 4. 配置结构

`config.json` 顶层结构：

```json
{
  "meta": {
    "version": 1
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
| `defaults.writeTargets` | 切换时写入哪些目标，常用 `npm`、`yarn` |
| `defaults.backupBeforeWrite` | 写入前是否备份已有 rc 文件 |
| `defaults.clearCacheOnSwitch` | 切换成功后是否按默认策略清理缓存 |
| `defaults.cacheCleanMode` | 缓存清理模式：`smart`、`full`、`none` |
| `common` | 多个 profile 共享的公共配置 |
| `profiles` | 按名称保存差异配置，例如 `work`、`personal` |

合并规则：

- 实际生效配置为 `common + profiles.<name>`。
- profile 中同名字段会覆盖 `common`。
- profile 中字段值为 `null` 时，表示移除从 `common` 继承的配置。
- `profile show <name>` 展示合并后的配置，并会对敏感字段脱敏。

## 5. 通用配置示例

```json
{
  "meta": {
    "version": 1
  },
  "defaults": {
    "writeTargets": ["npm", "yarn"],
    "backupBeforeWrite": true,
    "clearCacheOnSwitch": true,
    "cacheCleanMode": "smart"
  },
  "common": {
    "npm": {
      "registry": "https://registry.npmmirror.com/",
      "cache": "${HOME}/.cache/npm",
      "strictSsl": true,
      "extraConfig": {
        "prefix": "${HOME}/.local/npm-global",
        "electron_mirror": "https://cdn.npmmirror.com/binaries/electron/",
        "sass_binary_site": "https://registry.npmmirror.com/-/binary/node-sass"
      }
    },
    "pnpm": {
      "storeDir": "${HOME}/.local/share/pnpm/store"
    },
    "yarn": {
      "nodeLinker": "node-modules"
    }
  },
  "profiles": {
    "work": {
      "npm": {
        "registry": "https://registry.example.com/repository/npm-group/",
        "alwaysAuth": true,
        "authToken": "<private-registry-token>"
      },
      "scopes": {
        "@example": {
          "registry": "https://registry.example.com/repository/npm-group/"
        }
      }
    },
    "personal": {
      "npm": {
        "registry": "https://registry.npmmirror.com/",
        "alwaysAuth": false,
        "authToken": null,
        "extraConfig": {
          "//registry.npmjs.org/:_authToken": "<npmjs-publish-token>"
        }
      },
      "scopes": {
        "@example": null
      }
    }
  }
}
```

说明：

- 示例中的 `${HOME}` 和 token 占位符需要按本机环境替换。
- host 级鉴权放在 `npm.extraConfig` 中，例如 `//registry.npmjs.org/:_authToken`。
- 发布到 npmjs 的项目建议在自身 `package.json` 中声明 `publishConfig.registry=https://registry.npmjs.org/`。

## 6. profile 管理

查看当前状态：

```bash
pkg-switch current
```

列出全部 profile：

```bash
pkg-switch profile list
```

查看合并后的 profile 配置：

```bash
pkg-switch profile show work
pkg-switch profile show personal
```

新增空 profile：

```bash
pkg-switch profile add staging
```

删除非激活 profile：

```bash
pkg-switch profile remove staging
```

注意：

- 新增同名 profile 会失败。
- 删除当前激活 profile 会失败。
- `profile show` 会脱敏 token、auth、password、username、email 等敏感字段。

## 7. profile 切换

切换到工作配置：

```bash
pkg-switch switch work
```

切换到个人配置：

```bash
pkg-switch switch personal
```

切换但跳过本次缓存清理：

```bash
pkg-switch switch personal --no-cache-clean
```

单次指定缓存清理模式：

```bash
pkg-switch switch work --cache-clean smart
pkg-switch switch work --cache-clean none
pkg-switch switch work --cache-clean full
```

缓存模式说明：

| 模式 | 行为 |
| --- | --- |
| `smart` | 执行安全命令：`npm cache clean --force`、`pnpm store prune`、`yarn cache clean` |
| `none` | 不清理缓存 |
| `full` | 当前不会删除目录，仅返回 warning，避免误删用户自管缓存目录 |

## 8. 诊断、备份与恢复

执行诊断：

```bash
pkg-switch doctor
```

查看备份：

```bash
pkg-switch backup list
```

恢复指定备份：

```bash
pkg-switch restore <backupId>
```

建议：

- 保持 `backupBeforeWrite=true`。
- 恢复前先执行 `pkg-switch backup list` 确认备份编号。
- 恢复后执行 `pkg-switch current` 和 `pkg-switch doctor` 复核状态。

## 9. npmjs 发布建议

个人或开源 profile 可以保留日常安装镜像，同时加 npmjs host 级 token：

```json
{
  "npm": {
    "registry": "https://registry.npmmirror.com/",
    "alwaysAuth": false,
    "extraConfig": {
      "//registry.npmjs.org/:_authToken": "<npmjs-publish-token>"
    }
  }
}
```

项目发布时建议显式指定官方 registry：

```bash
npm publish --registry=https://registry.npmjs.org/
```

或在项目 `package.json` 中声明：

```json
{
  "publishConfig": {
    "registry": "https://registry.npmjs.org/"
  }
}
```

## 10. 常见问题

### 10.1 `pkg-switch` 命令找不到

```bash
npm install --global pkg-switch
pkg-switch --help
```

如果仍然找不到，重新打开终端，并确认 npm 全局 bin 目录已加入 PATH。

### 10.2 `doctor` 报包管理器命令不可用

先确认当前 shell 能否找到命令：

```bash
npm -v
pnpm -v
yarn -v
```

缺少哪个命令，就安装或修复对应工具的 PATH。

### 10.3 registry URL 不合法

registry 必须是合法 URL，例如：

```json
{
  "npm": {
    "registry": "https://registry.npmmirror.com/"
  }
}
```

不要写成 `registry.npmmirror.com` 或空字符串。

## 11. 验收清单

```bash
pkg-switch --help
pkg-switch profile list
pkg-switch profile show personal
pkg-switch doctor
pkg-switch switch personal --no-cache-clean
pkg-switch current
pkg-switch backup list
```

预期结果：

- `pkg-switch --help` 能展示命令列表。
- `profile list` 包含预期 profile。
- `profile show` 不输出明文 token。
- `doctor` 不出现配置读取、registry、鉴权相关 error。
- `current` 显示刚切换的 profile。

## 12. 关联文档

- [English User Manual](user-manual.en.md)
- [README](../README.md)
- [中文 README](../README.zh-CN.md)
- [示例配置](../examples/config.example.json)

## 13. 变更记录

| 版本 | 日期 | 作者 | 变更内容 |
| --- | --- | --- | --- |
| v1.1 | 2026-05-02 | Codex | 去除个人化 profile、本机路径和私有环境信息，补充通用发布配置说明 |
