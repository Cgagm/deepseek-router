#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────
# CC China Stack — One-click Claude Code + 5 Chinese AI providers
# Supports: macOS · Linux · Windows (Git Bash / WSL)
# ──────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

banner() {
  echo ""
  echo -e "${CYAN}  ╔══════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}  ║    CC China Stack — Setup                ║${NC}"
  echo -e "${CYAN}  ║    Claude Code + 5 Chinese AI Providers   ║${NC}"
  echo -e "${CYAN}  ╚══════════════════════════════════════════╝${NC}"
  echo ""
}

ok()   { echo -e "  ${GREEN}[OK]${NC}   $1"; }
warn() { echo -e "  ${YELLOW}[WARN]${NC} $1"; }
fail() { echo -e "  ${RED}[FAIL]${NC} $1"; exit 1; }
info() { echo -e "  ${CYAN}[..]${NC}  $1"; }

# ── Step 1: Detect platform ──
detect_platform() {
  case "$(uname -s)" in
    Darwin)  PLATFORM="macOS" ;;
    Linux)   PLATFORM="linux" ;;
    MINGW*|MSYS*|CYGWIN*) PLATFORM="windows" ;;
    *)       PLATFORM="unknown" ;;
  esac
  ok "Platform: $PLATFORM"
}

# ── Step 2: Check Node.js ──
check_node() {
  if command -v node &>/dev/null; then
    NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
      ok "Node.js $(node -v)"
    else
      fail "Node.js $(node -v) is too old. Need >= 18. Install from https://nodejs.org"
    fi
  else
    fail "Node.js not found. Install from https://nodejs.org (v18+)"
  fi
}

# ── Step 3: Install Claude Code CLI ──
install_claude_code() {
  if command -v claude &>/dev/null; then
    ok "Claude Code CLI already installed: $(claude --version 2>/dev/null || echo 'ok')"
  else
    info "Installing Claude Code CLI..."
    npm install -g @anthropic-ai/claude-code 2>&1 || {
      warn "npm install -g failed (maybe permissions). Trying with sudo..."
      sudo npm install -g @anthropic-ai/claude-code 2>&1 || \
        fail "Failed to install Claude Code CLI. Check your Node.js/npm setup."
    }
    ok "Claude Code CLI installed"
  fi
}

# ── Step 4: Install deepseek-router ──
ROUTER_TARBALL="https://github.com/Cgagm/deepseek-router/releases/download/v1.0.10/deepseek-router-1.0.10.tgz"

install_router() {
  if command -v deepseek-router &>/dev/null; then
    ok "deepseek-router already installed"
  else
    info "Installing deepseek-router from GitHub release..."
    npm install -g "$ROUTER_TARBALL" 2>&1 || {
      warn "npm install -g failed. Trying with sudo..."
      sudo npm install -g "$ROUTER_TARBALL" 2>&1 || \
        fail "Failed to install deepseek-router."
    }
    ok "deepseek-router installed"
  fi
}

# ── Step 5: Configure ──
configure() {
  CONFIG_DIR="$HOME/.deepseek-router"
  mkdir -p "$CONFIG_DIR"

  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  CONFIG_SRC="$SCRIPT_DIR/router.config.json"

  if [ -f "$CONFIG_SRC" ]; then
    if [ ! -f "$CONFIG_DIR/router.config.json" ]; then
      cp "$CONFIG_SRC" "$CONFIG_DIR/router.config.json"
      ok "Config copied to $CONFIG_DIR/router.config.json"
    else
      ok "Config already exists at $CONFIG_DIR/router.config.json (not overwriting)"
    fi
  else
    # Generate default config from deepseek-router if available
    info "Generating default config..."
    deepseek-router --print-config 2>/dev/null > "$CONFIG_DIR/router.config.json" || {
      warn "Could not generate config. Copy router.config.json from the zip manually."
    }
  fi

  ok "Config directory: $CONFIG_DIR"
}

# ── Step 6: Verify ──
verify() {
  echo ""
  echo -e "${CYAN}────────────────────────────────────────────${NC}"
  echo -e "${CYAN}  Verification${NC}"
  echo -e "${CYAN}────────────────────────────────────────────${NC}"

  ERRORS=0

  if command -v claude &>/dev/null; then
    ok "claude CLI: $(command -v claude)"
  else
    fail "claude CLI not found in PATH"
    ERRORS=$((ERRORS + 1))
  fi

  if command -v deepseek-router &>/dev/null; then
    ok "deepseek-router: $(command -v deepseek-router)"
  else
    fail "deepseek-router not found in PATH"
    ERRORS=$((ERRORS + 1))
  fi

  if [ -f "$HOME/.deepseek-router/router.config.json" ]; then
    ok "Config file: $HOME/.deepseek-router/router.config.json"
  else
    warn "Config file missing. Run setup again or copy manually."
  fi

  if [ $ERRORS -gt 0 ]; then
    fail "$ERRORS verification error(s). Fix the issues above and re-run setup.sh."
  fi
}

# ── Step 7: Next steps ──
next_steps() {
  echo ""
  echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║  Setup complete!                                             ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo "  Next steps:"
  echo ""
  echo "  1. Set your provider API keys:"
  echo ""
  echo "     export DEEPSEEK_API_KEY='sk-your-deepseek-key'"
  echo "     export TENCENT_API_KEY='your-tencent-key'"
  echo ""
  echo "     (Add these to ~/.bashrc or ~/.zshrc to persist)"
  echo ""
  echo "  2. Point Claude Code at the router:"
  echo ""
  echo "     export ANTHROPIC_BASE_URL='http://localhost:8788'"
  echo "     export ANTHROPIC_API_KEY='router'  # any value works"
  echo ""
  echo "  3. Start coding:"
  echo ""
  echo "     claude"
  echo ""
  echo "  Docs: https://github.com/Cgagm/deepseek-router"
  echo ""
}

# ── Main ──
main() {
  banner
  detect_platform
  check_node
  install_claude_code
  install_router
  configure
  verify
  next_steps
}

main "$@"
