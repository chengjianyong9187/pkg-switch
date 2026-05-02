# pkg-switch 版本变更说明

## 文档信息

- **文档编号**: pkg-switch-REL-ZH-001
- **文档类型**: 版本变更说明
- **适用范围**: `pkg-switch` P0 / P1 能力变更、命令边界、升级验证
- **当前版本**: 1.0
- **状态**: 正式
- **更新日期**: 2026-05-02

## 1. 背景与目标

`pkg-switch@0.2.0` 集中补齐 P0 和 P1 能力，目标是让 profile 初始化、切换预览、配置维护、备份维护和恢复一致性形成闭环。

本文档只记录 `0.2.0` 相对 `0.1.1` 的新增和调整内容。完整安装、配置和日常操作见 [中文操作手册](user-manual.zh-CN.md)。

## 2. 范围与非目标

本次覆盖：

- P0：初始化、版本号、切换预览、脱敏 diff、profile set/unset、pnpm store-dir 渲染、restore state 一致性。
- P1：profile clone/rename、backup delete/prune、对应文档与测试补充。

本次不覆盖：

- 图形界面。
- 项目级 `.npmrc` 合并策略。
- registry 连通性压测。
- token 生命周期管理或密钥托管。

## 3. P0 变更

### 3.1 初始化配置

新增命令：

```bash
pkg-switch init
pkg-switch init --force
```

行为说明：

- `init` 会创建默认 `config.json`。
- 当 `config.json` 已存在时，默认拒绝覆盖。
- 只有显式传入 `--force` 时才覆盖已有配置。

### 3.2 CLI 版本号

新增命令：

```bash
pkg-switch --version
```

输出包含包名、版本、平台和 Node.js 版本，例如：

```text
pkg-switch/0.2.0 win32-x64 node-v22.x.x
```

### 3.3 切换预览与差异查看

新增命令：

```bash
pkg-switch switch work --dry-run
pkg-switch switch work --diff
```

行为说明：

- `--dry-run` 只输出将写入的目标文件内容。
- `--diff` 输出当前文件与目标文件的行级差异。
- 两者都不会写入 `.npmrc` / `.yarnrc.yml`。
- 两者都不会创建备份、修改 state 或清理缓存。
- 输出会对 token、auth、password、username、email 等敏感字段脱敏。

### 3.4 profile set/unset

新增命令：

```bash
pkg-switch profile set personal npm.registry https://registry.npmmirror.com/
pkg-switch profile set personal npm.alwaysAuth false
pkg-switch profile set personal "npm.extraConfig[//registry.npmjs.org/:_authToken]" "YOUR_NPMJS_TOKEN"
pkg-switch profile unset personal npm.authToken
pkg-switch profile unset personal "npm.extraConfig[//registry.npmjs.org/:_authToken]"
```

行为说明：

- `profile set` 支持路径式更新 profile patch。
- `true`、`false`、`null` 会按布尔值或空值解析，其它值按字符串保存。
- 路径段中包含 `.`、`/`、`:` 等字符时，使用方括号写法。
- 命令成功输出只展示 profile 名称和路径，不回显敏感值。

### 3.5 pnpm store-dir 渲染

配置：

```json
{
  "pnpm": {
    "storeDir": "${HOME}/.local/share/pnpm/store"
  }
}
```

现在会渲染到 `.npmrc`：

```ini
store-dir=${HOME}/.local/share/pnpm/store
```

### 3.6 restore state 一致性

新增行为：

- 新版本创建备份时会记录切换前的 `state.json` 快照。
- `restore <backupId>` 恢复 rc 文件后，会同步恢复备份时的 state。
- 旧备份没有 state 快照时，会写入 `lastSwitchStatus=restored` 的兼容状态。

## 4. P1 变更

### 4.1 profile clone

新增命令：

```bash
pkg-switch profile clone work staging
```

行为说明：

- 复制源 profile 的 patch 到目标 profile。
- 不会把 `common` 展开写入目标 profile。
- 源 profile 不存在或目标 profile 已存在时会失败。

### 4.2 profile rename

新增命令：

```bash
pkg-switch profile rename staging staging-v2
```

行为说明：

- 将已有 profile 重命名为新名称。
- 目标 profile 已存在时会失败。
- 如果被重命名的 profile 是当前激活 profile，会同步更新 `state.activeProfile`。

### 4.3 backup delete

新增命令：

```bash
pkg-switch backup delete <backupId>
```

行为说明：

- 删除指定备份目录。
- 删除前会读取 manifest，避免删除不存在或非法备份编号。
- 备份编号不能包含路径分隔符或 `..`。

### 4.4 backup prune

新增命令：

```bash
pkg-switch backup prune --keep 5
```

行为说明：

- 按创建时间倒序保留最新 N 个备份。
- 删除更旧的备份。
- `--keep` 必须是大于等于 0 的整数。

## 5. 边界条件与异常处理

| 场景 | 行为 |
| --- | --- |
| `init` 时配置已存在 | 默认失败，提示配置文件已存在 |
| `profile set` 缺少路径或值 | 失败并提示缺少参数 |
| `profile clone` 目标已存在 | 失败并提示 profile 已存在 |
| `profile rename` 源不存在 | 失败并提示 profile 不存在 |
| `switch --dry-run` 或 `--diff` | 不写文件、不备份、不清理缓存、不改 state |
| `backup delete` 备份不存在 | 失败并提示备份 manifest 不存在 |
| `backup prune --keep invalid` | 失败并提示保留数量非法 |

## 6. 升级验证

建议升级后执行：

```bash
pkg-switch --version
pkg-switch --help
pkg-switch doctor
pkg-switch switch personal --dry-run
pkg-switch switch personal --diff
pkg-switch profile clone personal personal-test
pkg-switch profile rename personal-test personal-temp
pkg-switch profile remove personal-temp
pkg-switch backup list
```

预期结果：

- 版本号显示 `0.2.0` 或更高版本。
- `--help` 中包含 `init`、`profile clone`、`profile rename`、`backup delete`、`backup prune`。
- `doctor` 不出现配置读取、registry 或 token 相关 error。
- dry-run / diff 不写入 rc 文件，也不输出明文 token。
- 临时 profile 可以 clone、rename、remove。

## 7. 关联文档

- [中文操作手册](user-manual.zh-CN.md)
- [English Release Notes](release-notes.en.md)
- [English User Manual](user-manual.en.md)
- [README](../README.md)
- [中文 README](../README.zh-CN.md)

## 8. 变更记录

| 版本 | 日期 | 作者 | 变更内容 |
| --- | --- | --- | --- |
| v1.0 | 2026-05-02 | Codex | 新增 P0 / P1 版本变更说明 |
