#!/usr/bin/env bash
# Abre o Studio Nova; inicia o servidor local se ainda não estiver rodando.
set -u

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
URL="http://127.0.0.1:3000"
LOG="$APP_DIR/.studio-nova.log"
PID_FILE="$APP_DIR/.studio-nova.pid"
export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

cd "$APP_DIR" || exit 1

if ! curl -s -o /dev/null --max-time 2 "$URL/api/health"; then
  # Evita duplicar o servidor se outro processo já estiver subindo.
  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE" 2>/dev/null)" 2>/dev/null; then
    :
  else
    nohup pnpm dev > "$LOG" 2>&1 &
    echo $! > "$PID_FILE"
  fi

  for _ in $(seq 1 60); do
    if curl -s -o /dev/null --max-time 1 "$URL/api/health"; then
      break
    fi
    sleep 0.5
  done
fi

if [ "${1:-}" != "--no-open" ]; then
  xdg-open "$URL" >/dev/null 2>&1 &
fi
