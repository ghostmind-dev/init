#!/bin/bash

set -e

echo "==========================================================================="
echo "Feature       : Init"
echo "Description   : Initialize development environment with configurable options"
echo "Id            : $(basename "$(dirname "$0")" 2>/dev/null || echo "Unknown")"
echo "Version       : 1.0.1"
echo "Documentation : https://github.com/ghostmind-dev/features/tree/main/features/src/init"
echo "==========================================================================="

echo "Installing Init feature..."

# Function to convert camelCase to UPPER_SNAKE_CASE
camel_to_snake() {
    echo "$1" | sed -E 's/([a-z])([A-Z])/\1_\2/g' | tr '[:lower:]' '[:upper:]'
}

# Function to set environment variable in all shell profiles
set_env_var() {
    local var_name="$1"
    local var_value="$2"

    echo "Setting environment variable ${var_name}=${var_value}..."

    # Add environment variable to bash profile
    echo "export ${var_name}=\"${var_value}\"" >>/etc/bash.bashrc

    # Add environment variable to profile for compatibility
    echo "export ${var_name}=\"${var_value}\"" >>/etc/profile

    # Add to ZSH profile if it exists
    if [ -f /etc/zsh/zshrc ]; then
        echo "export ${var_name}=\"${var_value}\"" >>/etc/zsh/zshrc
    fi

    # Also add to /etc/environment for system-wide availability
    echo "${var_name}=${var_value}" >>/etc/environment

    echo "✅ Environment variable ${var_name} set to ${var_value}"
}

# Import and process all feature options
RESET_LIVE=${RESETLIVE:-"false"}
BASE_ZSHRC=${BASEZSHRC:-"true"}
DENO_CONFIG=${DENOCONFIG:-"true"}
CORE_SECRETS=${CORESECRETS:-"true"}
LOGIN_NPM=${LOGINNPM:-"false"}
LOGIN_GCP=${LOGINGCP:-"true"}
LOGIN_GHCR=${LOGINGHCR:-"true"}
LOGIN_VAULT=${LOGINVAULT:-"true"}
LOGIN_CLOUDFLARE=${LOGINCLOUDFLARE:-"true"}
DOCKER_CONFIG=${DOCKERCONFIG:-"true"}
TMUX_CONFIG=${TMUXCONFIG:-"true"}

echo "Processing feature options:"
echo "    RESETLIVE=\"${RESET_LIVE}\""
echo "    BASEZSHRC=\"${BASE_ZSHRC}\""
echo "    DENOCONFIG=\"${DENO_CONFIG}\""
echo "    CORESECRETS=\"${CORE_SECRETS}\""
echo "    LOGINNPM=\"${LOGIN_NPM}\""
echo "    LOGINGCP=\"${LOGIN_GCP}\""
echo "    LOGINGHCR=\"${LOGIN_GHCR}\""
echo "    LOGINVAULT=\"${LOGIN_VAULT}\""
echo "    LOGINCLOUDFLARE=\"${LOGIN_CLOUDFLARE}\""
echo "    DOCKERCONFIG=\"${DOCKER_CONFIG}\""
echo "    TMUXCONFIG=\"${TMUX_CONFIG}\""

# Set environment variables with INIT_ prefix
set_env_var "INIT_RESET_LIVE" "${RESET_LIVE}"
set_env_var "INIT_BASE_ZSHRC" "${BASE_ZSHRC}"
set_env_var "INIT_DENO_CONFIG" "${DENO_CONFIG}"
set_env_var "INIT_CORE_SECRETS" "${CORE_SECRETS}"
set_env_var "INIT_LOGIN_NPM" "${LOGIN_NPM}"
set_env_var "INIT_LOGIN_GCP" "${LOGIN_GCP}"
set_env_var "INIT_LOGIN_GHCR" "${LOGIN_GHCR}"
set_env_var "INIT_LOGIN_VAULT" "${LOGIN_VAULT}"
set_env_var "INIT_LOGIN_CLOUDFLARE" "${LOGIN_CLOUDFLARE}"
set_env_var "INIT_DOCKER_CONFIG" "${DOCKER_CONFIG}"
set_env_var "INIT_TMUX_CONFIG" "${TMUX_CONFIG}"

echo ""
echo "✅ All INIT_* environment variables have been configured"
echo "✅ Variables are available in bash, zsh, and system-wide"
echo "✅ Init feature installation completed successfully!"
echo ""
echo "🔍 To verify the variables are set, you can run:"
echo "    env | grep INIT_"
echo ""
