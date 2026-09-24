#!/usr/bin/env sh
# mdv installer: installs dependencies, builds, and puts `mdv` on your PATH.
#
# Usage:
#   ./install.sh                    # symlink binary into ~/.local/bin
#   MDV_BIN_DIR=/usr/local/bin ./install.sh   # install somewhere else
#
# Requirements: Node.js 18+ and npm.

set -eu

# ── helpers ────────────────────────────────────────────────────────────────
info()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn()  { printf '\033[1;33mwarning:\033[0m %s\n' "$*" >&2; }
die()   { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }

# Run from the project root, no matter where the script is invoked from.
cd "$(dirname "$0")"

# ── checks ─────────────────────────────────────────────────────────────────
command -v node >/dev/null 2>&1 || die "Node.js is not installed. Install Node 18+ from https://nodejs.org"
command -v npm  >/dev/null 2>&1 || die "npm is not installed. Install Node 18+ from https://nodejs.org"

NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
[ "$NODE_MAJOR" -ge 18 ] || die "Node.js 18+ required (found $(node --version))"

info "Installing dependencies"
if [ -f package-lock.json ]; then
    npm ci || npm install
else
    npm install
fi

info "Building"
npm run build
[ -x dist/index.js ] || die "build did not produce dist/index.js"

# ── install the binary ────────────────────────────────────────────────────
BIN_DIR=${MDV_BIN_DIR:-$HOME/.local/bin}
TARGET="$BIN_DIR/mdv"
SOURCE="$(pwd)/dist/index.js"

mkdir -p "$BIN_DIR"
ln -sf "$SOURCE" "$TARGET"
info "Installed symlink: $TARGET -> $SOURCE"

case ":$PATH:" in
    *":$BIN_DIR:"*) ;;
    *)
        warn "'$BIN_DIR' is not on your PATH."
        warn "Add this line to your shell profile (~/.bashrc, ~/.zshrc, etc.):"
        warn "  export PATH=\"$BIN_DIR:\$PATH\""
        ;;
esac

info "Done! Try it out:"
echo "  mdv README.md"