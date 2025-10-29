# Init Feature

Initialize development environment with configurable options that are dynamically set as `INIT_*` environment variables.

## Usage

```json
{
  "features": {
    "ghcr.io/ghostmind-dev/features/init:1": {
      "loginVault": true,
      "loginGcp": false,
      "pythonVersion": "3.11.0"
    }
  }
}
```

## Options

| Option            | Type    | Default   | Environment Variable    | Description                               |
| ----------------- | ------- | --------- | ----------------------- | ----------------------------------------- |
| `resetLive`       | boolean | `false`   | `INIT_RESET_LIVE`       | Reset live environment settings           |
| `baseZshrc`       | boolean | `true`    | `INIT_BASE_ZSHRC`       | Configure base ZSH configuration          |
| `denoConfig`      | boolean | `true`    | `INIT_DENO_CONFIG`      | Setup Deno configuration                  |
| `coreSecrets`     | boolean | `true`    | `INIT_CORE_SECRETS`     | Setup core secrets management             |
| `loginNpm`        | boolean | `false`   | `INIT_LOGIN_NPM`        | Configure NPM login                       |
| `loginGcp`        | boolean | `true`    | `INIT_LOGIN_GCP`        | Configure Google Cloud Platform login     |
| `loginGhcr`       | boolean | `true`    | `INIT_LOGIN_GHCR`       | Configure GitHub Container Registry login |
| `loginVault`      | boolean | `true`    | `INIT_LOGIN_VAULT`      | Configure HashiCorp Vault login           |
| `loginCloudflare` | boolean | `true`    | `INIT_LOGIN_CLOUDFLARE` | Configure Cloudflare login                |
| `pythonVersion`   | string  | `"3.9.7"` | `INIT_PYTHON_VERSION`   | Python version to configure               |
| `tmuxConfig`      | boolean | `false`   | `INIT_TMUX_CONFIG`      | Setup TMUX configuration                  |
