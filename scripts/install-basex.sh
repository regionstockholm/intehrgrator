#!/usr/bin/env bash
# Install BaseX (XQuery 3.1 CLI) for optional intEHRgrator engine golden tests.
# Idempotent. No root required. Java 17+ must already be on PATH.
set -euo pipefail

if ! command -v java >/dev/null 2>&1; then
  echo "install-basex: Java 17+ is required (java not on PATH)" >&2
  exit 1
fi

DEST="${BASEX_HOME:-$HOME/basex}"
# Pin BaseX 12.4. Version folders use BaseX124.zip (not BaseX.zip).
# Official alias: https://files.basex.org/releases/BaseX.zip
# Snapshot (changes): https://files.basex.org/releases/BaseX-latest.zip
# Do not use …/releases/latest/BaseX-latest.zip — that 404s.
ZIP_URL="${BASEX_ZIP_URL:-https://files.basex.org/releases/12.4/BaseX124.zip}"

print_env() {
  echo "export BASEX_HOME=$DEST"
  echo "export PATH=\$BASEX_HOME/bin:\$PATH"
}

if [[ -x "$DEST/bin/basex" ]]; then
  echo "install-basex: already present at $DEST/bin/basex"
  "$DEST/bin/basex" -q 1
  print_env
  exit 0
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
echo "install-basex: downloading $ZIP_URL"
curl -fsSL "$ZIP_URL" -o "$TMP/basex.zip"
mkdir -p "$TMP/unpack"
unzip -q "$TMP/basex.zip" -d "$TMP/unpack"
# Zip root is usually BaseX/
ROOT="$(find "$TMP/unpack" -maxdepth 2 -type d -name bin | head -n 1 | sed 's|/bin$||')"
if [[ -z "$ROOT" ]]; then
  echo "install-basex: zip did not contain bin/" >&2
  exit 1
fi
mkdir -p "$(dirname "$DEST")"
rm -rf "$DEST"
mv "$ROOT" "$DEST"
chmod +x "$DEST/bin/"* || true
echo "install-basex: installed $DEST"
"$DEST/bin/basex" -q 1
print_env
