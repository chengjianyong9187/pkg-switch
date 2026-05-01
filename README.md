# pkg-switch

用于在同一台开发机上切换 `npm`、`yarn`、`pnpm` 用户级全局配置的纯 CLI 工具。

## 安装与构建

```bash
pnpm install
pnpm build
```

构建后可执行入口为 `dist/index.js`，包入口命令名为 `pkg-switch`。

## 配置文件

默认配置文件位置：

- `%USERPROFILE%\.pkg-switch\config.json`
- `%USERPROFILE%\.pkg-switch\state.json`
- `%USERPROFILE%\.pkg-switch\backups\`

可参考 `examples/config.example.json` 创建本机配置。示例中 `authToken` 为占位值，使用前需要替换为真实 token。

从既有 `.npmrc` 迁移时，`prefix`、镜像地址、构建工具路径、host 级 `_auth/_authToken` 等非标准字段可放入 `npm.extraConfig`，切换时会原样渲染为 `.npmrc` 行；`profile show` 会对其中的鉴权字段脱敏。

## 常用命令

```bash
pkg-switch switch CJY-WORK
pkg-switch switch CJY-WORK --no-cache-clean
pkg-switch switch CJY-WORK --cache-clean smart
pkg-switch current
pkg-switch profile list
pkg-switch profile show CJY-WORK
pkg-switch profile add CJY-TEST
pkg-switch profile remove CJY-TEST
pkg-switch doctor
pkg-switch backup list
pkg-switch restore <backupId>
```

当前 CLI 已接入核心服务。`profile show` 默认脱敏 token。

## profile 管理

- `profile list`：按名称排序列出全部配置档
- `profile show <name>`：展示 `common + profile` 合并后的配置，默认脱敏 token
- `profile add <name>`：新增一个空 profile，已有同名 profile 时失败
- `profile remove <name>`：删除非激活 profile；如果目标是 `state.json` 中的当前激活 profile，则失败并保持配置不变

## 缓存清理

切换完成并成功写入 rc 文件后，工具会根据 `defaults.clearCacheOnSwitch` 和 `defaults.cacheCleanMode` 决定是否清理缓存。

- `smart`：按写入目标执行安全命令，`npm cache clean --force`、`pnpm store prune`、`yarn cache clean`
- `none`：跳过缓存清理
- `full`：当前不会执行目录级删除，仅返回 warning，避免误删用户自管缓存目录

单次切换可用 `--no-cache-clean` 跳过缓存清理，或用 `--cache-clean smart|full|none` 覆盖配置默认值。`--cache-clean` 缺少模式或模式非法时会直接失败，且不会写入用户 rc 文件。

缓存清理失败不会回滚已写入的 `.npmrc` / `.yarnrc.yml`，但本次切换状态会记录为 `warning`。

## doctor 检查范围

`pkg-switch doctor` 当前会检查：

- `%USERPROFILE%\.pkg-switch` 是否可写
- `config.json` 是否可读
- `state.json` 中的 `activeProfile` 是否存在于配置
- 各 profile 合并后的 registry URL 是否合法
- `alwaysAuth=true` 时是否缺少对应 token
- `npm` / `pnpm` / `yarn` 命令是否可用

## 备份与恢复

`pkg-switch backup list` 会按创建时间倒序列出可恢复备份，输出备份编号、创建时间和文件数量。恢复时使用对应编号：

```bash
pkg-switch restore backup-2026-01-01T00-00-00-000Z
```

当前仓库状态：

- 已完成设计规格
- 已完成实现计划
- 已完成 CLI 工程骨架
- 已完成 CLI 运行时入口契约：`--help`、未知命令、`switch` 缺参
- 已完成构建产物契约：`dist/index.js` 与 `bin` 匹配，且带 shebang
- 已完成配置类型、profile 合并逻辑与敏感信息脱敏
- 已完成配置仓储与路径解析
- 已完成 `.npmrc` 与 `.yarnrc.yml` 渲染
- 已完成备份、恢复、切换事务与写入失败回滚
- 已完成 `current`、`doctor`、`restore`、`profile list/show` 服务基础和命令接入
- 已完成 `profile add/remove` 配置档新增和删除，并保护当前激活 profile 不被删除
- 已完成 `smart` / `none` / 安全拒绝 `full` 的缓存清理编排，并接入切换 warning 状态
- 已完成 `switch --no-cache-clean` 与 `switch --cache-clean smart|full|none` 单次覆盖参数
- 已完成 `backup list` 备份摘要列表，恢复前可直接查看可用 `backupId`
- 已完成更完整的 doctor 配置、状态、registry 与鉴权一致性检查
- 已完成示例配置、样例输出与 CLI 使用说明
- 下一步：基于本机真实配置试运行 `doctor` / `backup list` / `profile add/remove` / `switch`

文档入口：

- `docs/superpowers/specs/2026-04-29-package-manager-profile-switch-design.md`
- `docs/superpowers/plans/2026-04-29-package-manager-profile-switch.md`
- `examples/config.example.json`
- `examples/output.npmrc`
- `examples/output.yarnrc.yml`

常用验证：

```bash
pnpm lint
pnpm test
pnpm build
```
