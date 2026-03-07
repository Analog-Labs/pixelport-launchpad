#!/bin/zsh
set -euo pipefail

TOKEN="$("$HOME/.pixelport/get-secret.sh" DO_API_TOKEN)"

export DIGITALOCEAN_API_TOKEN="$TOKEN"

exec npx -y @digitalocean/mcp --services droplets,accounts,networking,marketplace
