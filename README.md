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

## 常用命令

```bash
pkg-switch switch CJY-WORK
pkg-switch current
pkg-switch profile list
pkg-switch profile show CJY-WORK
pkg-switch doctor
pkg-switch restore <backupId>
```

当前 CLI 已接入核心服务。`profile show` 默认脱敏 token。

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
- 已完成示例配置、样例输出与 CLI 使用说明
- 下一步：整理提交或继续补充缓存清理与更完整诊断

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
