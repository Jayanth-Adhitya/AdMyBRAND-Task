#!/usr/bin/env bash
set -euo pipefail
MODE="wasm"; NGROK=0
for arg in "$@"; do
  case $arg in
    --mode=server) MODE="server" ;;
    --mode=wasm) MODE="wasm" ;;
    --ngrok) NGROK=1 ;;
    *) echo "Unknown arg: $arg" ;;
  esac
done
NGROK_URL=""
if [ "$NGROK" -eq 1 ]; then
  if command -v ngrok >/dev/null 2>&1; then
    echo "[start] Starting ngrok..."
    # Start ngrok in the background and redirect output to a log file
    ngrok http 3000 --log=stdout --log-format=json > ngrok.log &
    
    # Wait for ngrok to start and its API to be available
    echo "[start] Waiting for ngrok to start..."
    until curl -s http://127.0.0.1:4040/api > /dev/null; do
      sleep 1
    done
    
    # Get the public URL from ngrok's API
    NGROK_API_RESPONSE=$(curl -s http://127.0.0.1:4040/api/tunnels)
    echo "[start] ngrok API response: $NGROK_API_RESPONSE"
    NGROK_URL=$(echo "$NGROK_API_RESPONSE" | grep -oP '(?<="public_url":")[^"]*' | head -n 1)
    export PUBLIC_BASE_URL="$NGROK_URL"
    echo "[start] ngrok URL: $PUBLIC_BASE_URL"
  else
    echo "[warn] ngrok not installed. Skipping ngrok tunnel."
  fi
fi

export MODE
echo "[start] Building and starting containers (MODE=$MODE)..."
docker compose up --build -d

echo "[done] Open ${PUBLIC_BASE_URL:-http://localhost:3000} (scan QR on phone)."
