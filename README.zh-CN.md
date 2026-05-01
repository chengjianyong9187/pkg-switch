# pkg-switch

中文 | [English](README.md)

`pkg-switch` 是一个纯 CLI 工具，用于在同一台开发机上切换用户级 `npm`、`pnpm`、`yarn` 配置档。

它适合在多个 registry 环境之间切换，例如工作私有 registry、个人公开镜像、开源发布 registry 等场景。

## 安装

```bash
npm install --global pkg-switch
pkg-switch --help
```

也可以使用 pnpm：

```bash
pnpm add --global pkg-switch
pkg-switch --help
```

## 配置文件

默认运行时文件位置：

- Windows：`%USERPROFILE%\.pkg-switch\config.json`
- Linux/macOS：`$HOME/.pkg-switch/config.json`
- 状态文件：`.pkg-switch/state.json`
- 备份目录：`.pkg-switch/backups/`
- npm 输出文件：`.npmrc`
- yarn 输出文件：`.yarnrc.yml`

可以从示例配置开始：

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.pkg-switch"
Copy-Item .\examples\config.example.json "$env:USERPROFILE\.pkg-switch\config.json"
```

真实 token 只应保存在本机 `config.json` 中，不要提交到仓库。

## 常用命令

```bash
pkg-switch current
pkg-switch profile list
pkg-switch profile show work
pkg-switch profile add staging
pkg-switch profile remove staging
pkg-switch switch work
pkg-switch switch personal --no-cache-clean
pkg-switch switch work --cache-clean smart
pkg-switch doctor
pkg-switch backup list
pkg-switch restore <backupId>
```

`profile show` 会自动脱敏 token、auth、password、username、email 等敏感字段。

## 缓存清理

切换成功后，工具会根据 `defaults.clearCacheOnSwitch` 和 `defaults.cacheCleanMode` 决定是否清理缓存。

- `smart`：按写入目标执行安全命令：`npm cache clean --force`、`pnpm store prune`、`yarn cache clean`
- `none`：跳过缓存清理
- `full`：当前不会删除目录，仅返回 warning，避免误删用户自管缓存目录

单次切换可覆盖默认行为：

```bash
pkg-switch switch work --no-cache-clean
pkg-switch switch work --cache-clean smart
pkg-switch switch work --cache-clean none
```

## 诊断

```bash
pkg-switch doctor
```

`doctor` 会检查：

- 应用目录是否可写
- `config.json` 是否可读
- 当前激活 profile 是否存在
- registry URL 是否合法
- 必要的鉴权 token 是否存在
- `npm`、`pnpm`、`yarn` 命令是否可用

## 文档

- [中文操作手册](docs/user-manual.zh-CN.md)
- [English User Manual](docs/user-manual.en.md)
- [示例配置](examples/config.example.json)
- [示例 `.npmrc` 输出](examples/output.npmrc)
- [示例 `.yarnrc.yml` 输出](examples/output.yarnrc.yml)

## 本地开发

```bash
pnpm install
pnpm lint
pnpm test
pnpm build
```

本地全局 link：

```bash
pnpm build
pnpm link --global
pkg-switch --help
```
