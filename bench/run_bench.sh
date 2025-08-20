#!/usr/bin/env bash
set -euo pipefail
DUR=30; MODE="wasm"; ROOM="demo"
while [[ $# -gt 0 ]]; do
  case $1 in
    --duration) DUR="$2"; shift 2 ;;
    --mode) MODE="$2"; shift 2 ;;
    --room) ROOM="$2"; shift 2 ;;
    *) echo "Unknown arg $1"; exit 1 ;;
  esac
done
curl -s "http://localhost:3000/bench/start?duration=${DUR}&mode=${MODE}&room=${ROOM}" > /dev/null
sleep $((DUR + 3))
curl -s "http://localhost:3000/metrics.json" | tee metrics.json
