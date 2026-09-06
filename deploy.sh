#!/bin/bash
set -e

echo "==> Killing any running DevFlow instances..."
pkill -9 -f dev-flow 2>/dev/null || true

echo "==> Building release bundle..."
npm run tauri build

DEB_PATH=$(find src-tauri/target/release/bundle/deb -name "*.deb" | head -n 1)

if [ -z "$DEB_PATH" ]; then
  echo "ERROR: No .deb file found after build."
  exit 1
fi

echo "==> Installing $DEB_PATH..."
sudo dpkg -i "$DEB_PATH"

echo "==> Done. Launch DevFlow from the app menu, or run: dev-flow"
