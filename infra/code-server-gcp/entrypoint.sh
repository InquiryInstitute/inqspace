#!/usr/bin/env bash
set -euo pipefail

WS="/home/coder/workspace"
cd "$WS"

if [[ -n "${GIT_CLONE_URL:-}" ]] || [[ -n "${GIT_REPO_URL:-}" ]]; then
  if [[ ! -d "${WS}/.git" ]]; then
    url="${GIT_CLONE_URL:-${GIT_REPO_URL}}"
    if [[ -n "${GIT_TOKEN:-}" ]] && [[ "${url}" == https://github.com/* ]]; then
      rest="${url#https://github.com/}"
      url="https://x-access-token:${GIT_TOKEN}@github.com/${rest}"
    fi
    ref="${GIT_REF:-main}"
    git clone --depth 1 --branch "${ref}" "${url}" "${WS}" 2>/dev/null || git clone --depth 1 "${url}" "${WS}"
  fi
fi

TR_ARGS=()
if [[ -n "${TRUSTED_ORIGINS:-}" ]]; then
  TR_ARGS=(--trusted-origins "${TRUSTED_ORIGINS}")
fi

exec dumb-init /usr/bin/code-server \
  --bind-addr "0.0.0.0:8080" \
  --auth password \
  "${TR_ARGS[@]}" \
  "${WS}"
