# pkg-switch

[中文文档](README.zh-CN.md) | English

`pkg-switch` is a pure CLI tool for switching user-level `npm`, `pnpm`, and `yarn` configuration profiles on the same development machine.

It is designed for developers who move between different registry environments, for example a private registry at work and a public mirror for personal or open-source projects.

## Install

```bash
npm install --global pkg-switch
pkg-switch --version
pkg-switch --help
```

Or install with pnpm:

```bash
pnpm add --global pkg-switch
pkg-switch --version
pkg-switch --help
```

## Configuration

The default runtime files are:

- `%USERPROFILE%\.pkg-switch\config.json` on Windows, or `$HOME/.pkg-switch/config.json` on Linux/macOS
- `%USERPROFILE%\.pkg-switch\state.json` or `$HOME/.pkg-switch/state.json`
- `%USERPROFILE%\.pkg-switch\backups\` or `$HOME/.pkg-switch/backups/`
- `%USERPROFILE%\.npmrc` or `$HOME/.npmrc`
- `%USERPROFILE%\.yarnrc.yml` or `$HOME/.yarnrc.yml`

Create a default config first:

```bash
pkg-switch init
```

Use `--force` only when you want to overwrite an existing config:

```bash
pkg-switch init --force
```

Or copy and edit the example:

```bash
mkdir -p "$HOME/.pkg-switch"
cp examples/config.example.json "$HOME/.pkg-switch/config.json"
```

On Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.pkg-switch"
Copy-Item .\examples\config.example.json "$env:USERPROFILE\.pkg-switch\config.json"
```

Keep real tokens only in your local `config.json`. Do not commit them to a repository.

## Common Commands

```bash
pkg-switch current
pkg-switch init
pkg-switch profile list
pkg-switch profile show work
pkg-switch profile add staging
pkg-switch profile set personal npm.registry https://registry.npmmirror.com/
pkg-switch profile set personal "npm.extraConfig[//registry.npmjs.org/:_authToken]" "YOUR_NPMJS_TOKEN"
pkg-switch profile unset personal npm.authToken
pkg-switch profile remove staging
pkg-switch switch work --dry-run
pkg-switch switch work --diff
pkg-switch switch work
pkg-switch switch personal --no-cache-clean
pkg-switch switch work --cache-clean smart
pkg-switch doctor
pkg-switch backup list
pkg-switch restore <backupId>
```

`profile show` masks sensitive values such as tokens, auth fields, passwords, usernames, and emails.

## Cache Cleaning

After a successful switch, `pkg-switch` can run safe cache-clean commands according to `defaults.clearCacheOnSwitch` and `defaults.cacheCleanMode`.

- `smart`: runs `npm cache clean --force`, `pnpm store prune`, and `yarn cache clean` for enabled targets
- `none`: skips cache cleaning
- `full`: returns a warning and does not delete user-managed cache directories

You can override the behavior for a single switch:

```bash
pkg-switch switch work --no-cache-clean
pkg-switch switch work --cache-clean smart
pkg-switch switch work --cache-clean none
```

## Diagnostics

```bash
pkg-switch doctor
```

The doctor command checks:

- Whether the app directory is writable
- Whether `config.json` is readable
- Whether the active profile exists
- Whether registry URLs are valid
- Whether required auth tokens are present
- Whether `npm`, `pnpm`, and `yarn` commands are available

## Documentation

- [English User Manual](docs/user-manual.en.md)
- [中文操作手册](docs/user-manual.zh-CN.md)
- [Example config](examples/config.example.json)
- [Example `.npmrc` output](examples/output.npmrc)
- [Example `.yarnrc.yml` output](examples/output.yarnrc.yml)

## Development

```bash
pnpm install
pnpm lint
pnpm test
pnpm build
```

Local CLI link:

```bash
pnpm build
pnpm link --global
pkg-switch --help
```
