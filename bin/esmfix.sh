#!/usr/bin/env bash
CLI_PATH=$(readlink -f "$(dirname "${BASH_SOURCE[0]}")/../lib/cli.js")
node --experimental-import-meta-resolve "${CLI_PATH}" -- "$@"
