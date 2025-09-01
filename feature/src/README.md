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

## How It Works

This feature provides a dynamic system for setting environment variables in your DevContainer. Each feature option is automatically mapped to an `INIT_*` environment variable using the following pattern:

- **Option**: `loginVault: true` → **Environment Variable**: `INIT_LOGIN_VAULT=true`
- **Option**: `baseZshrc: false` → **Environment Variable**: `INIT_BASE_ZSHRC=false`
- **Option**: `pythonVersion: "3.11"` → **Environment Variable**: `INIT_PYTHON_VERSION=3.11`

## Options

| Option            | Type    | Default   | Environment Variable    | Description                               |
| ----------------- | ------- | --------- | ----------------------- | ----------------------------------------- |
| `resetLive`       | boolean | `false`   | `INIT_RESET_LIVE`       | Reset live environment settings           |
| `baseZshrc`       | boolean | `true`    | `INIT_BASE_ZSHRC`       | Configure base ZSH configuration          |
| `denoConfig`      | boolean | `true`    | `INIT_DENO_CONFIG`      | Setup Deno configuration                  |
| `denoJupyter`     | boolean | `false`   | `INIT_DENO_JUPYTER`     | Enable Deno Jupyter integration           |
| `coreSecrets`     | boolean | `true`    | `INIT_CORE_SECRETS`     | Setup core secrets management             |
| `loginNpm`        | boolean | `false`   | `INIT_LOGIN_NPM`        | Configure NPM login                       |
| `loginGcp`        | boolean | `true`    | `INIT_LOGIN_GCP`        | Configure Google Cloud Platform login     |
| `loginGhcr`       | boolean | `true`    | `INIT_LOGIN_GHCR`       | Configure GitHub Container Registry login |
| `loginNvcr`       | boolean | `true`    | `INIT_LOGIN_NVCR`       | Configure NVIDIA Container Registry login |
| `loginVault`      | boolean | `true`    | `INIT_LOGIN_VAULT`      | Configure HashiCorp Vault login           |
| `loginCloudflare` | boolean | `true`    | `INIT_LOGIN_CLOUDFLARE` | Configure Cloudflare login                |
| `pythonVersion`   | string  | `"3.9.7"` | `INIT_PYTHON_VERSION`   | Python version to configure               |

| `tmuxConfig` | boolean | `false` | `INIT_TMUX_CONFIG` | Setup TMUX configuration |
| `quoteAi` | boolean | `true` | `INIT_QUOTE_AI` | Enable AI quote feature |

## Examples

### Enable the feature

```json
{
  "features": {
    "ghcr.io/ghostmind-dev/features/init:1": {
      "enableFeature": true
    }
  }
}
```

This will set `INIT_FEATURE_ENABLED=true` in the container environment.

### Use default (disabled)

```json
{
  "features": {
    "ghcr.io/ghostmind-dev/features/init:1": {}
  }
}
```

This will set `INIT_FEATURE_ENABLED=false` in the container environment.

## Accessing the Environment Variable

Once the container is built, you can access the environment variable:

### In Shell

```bash
echo $INIT_FEATURE_ENABLED
```

### In ZSH

```zsh
echo $INIT_FEATURE_ENABLED
```

### In Scripts

```bash
if [ "$INIT_FEATURE_ENABLED" = "true" ]; then
    echo "Init feature is enabled"
else
    echo "Init feature is disabled"
fi
```

## Installation

The environment variable is made available in:

- Bash sessions (`/etc/bash.bashrc`)
- ZSH sessions (`/etc/zsh/zshrc`)
- System-wide (`/etc/environment`)
- Profile sessions (`/etc/profile`)

This ensures the variable is accessible regardless of the shell or session type.
