# Dev Deploy Tooling

This folder contains a development deploy workflow to push files to a router for testing based on `bash + ssh/scp`.

## Files

- `.dev-deploy/dev-deploy.sh` - main dev deploy script
- `.dev-deploy/mapping.tsv` - explicit file mapping (`src -> dst -> mode -> policy`)
- `.dev-deploy/target.env.example` - target configuration template
- `.dev-deploy/target.env` - local router access settings (ignored by git)

## Requirements

- Bash (Linux/macOS, or Git Bash/WSL on Windows)
- OpenSSH client tools in PATH: `ssh`, `scp`
- Git in PATH (used to validate executable bit in repository index)
- SSH key access to router

## Mapping Format (`mapping.tsv`)

Each row contains four columns separated by one or more tabs:

1. local path relative to `.dev-deploy/`
2. absolute remote path on router
3. mode (for example `644`, `755`)
4. policy

Supported policies:

- `overwrite` - always copy the local file over the remote file
- `keep-if-exists` - copy only when the remote file does not exist

If the policy column is omitted, deploy uses `overwrite`.

Notes:

- Empty lines are allowed.
- Comment lines start with `#`.
- You can align columns using extra tab characters.
- `clean` skips `keep-if-exists` files to avoid deleting router-local configuration.

## Target Configuration (`target.env`)

Create local config first:

```bash
cp .dev-deploy/target.env.example .dev-deploy/target.env
```

Expected variables:

- `ROUTER_HOST`
- `ROUTER_USER`
- `ROUTER_PORT`
- `SSH_KEY_PATH` (optional)

## SSH Key Bootstrap

- If `SSH_KEY_PATH` is set, deploy uses that key.
- If `SSH_KEY_PATH` is empty, deploy uses project key `.dev-deploy/.ssh/id_ed25519`.
- If the project key does not exist, deploy prompts to generate it on first run.
- Deploy tries to publish the public key to `/etc/dropbear/authorized_keys`.
- If auto-publish is not possible, deploy exits with exact manual commands to install the key on router.
- For non-interactive runs, set `DEPLOY_AUTO_YES=1` to auto-confirm key generation.

## Usage

Run from `luci-app-speedtest-ng`:

```bash
.dev-deploy/dev-deploy.sh
.dev-deploy/dev-deploy.sh deploy
.dev-deploy/dev-deploy.sh clean
```

Modes:

- `deploy` (default) - auth + copy + chmod + post-sync commands
- `clean` - auth + remove `overwrite` target files only

## Behavior

- Running `.dev-deploy/dev-deploy.sh` is the same as `.dev-deploy/dev-deploy.sh deploy`.
- Uploads mapped files via `scp -p`.
- Applies `chmod` only when remote mode differs from expected mode.
- Runs post-sync commands after copy/perms in deploy mode.
- Post-sync commands restart `rpcd` and ask the Speedtest NG schedule helper to refresh cron.

## What This Is

This is developer-only tooling for fast iteration on a real OpenWrt router. It is not the public install path, release pipeline, or package build process.

Use it when you are editing files in this repository and want to quickly push the current working tree to a test router without building and installing a new package. The mapping file describes exactly which repository files land on which router paths, which permissions they should have, and whether an existing router-side file should be overwritten.

Router-local state is intentionally protected. For example, `/etc/config/speedtest-ng` uses `keep-if-exists`, so the default config is only seeded when the file is missing, and result/runtime files are not deployed by this workflow.
