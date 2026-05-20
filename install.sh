#!/usr/bin/env bash
# agents-tracing-dashboard installer
# Usage: curl -fsSL https://raw.githubusercontent.com/camtrik/agents-tracing-dashboard/main/install.sh | bash
set -e

REPO="camtrik/agents-tracing-dashboard"
INSTALL_DIR="${AGENTS_TRACING_INSTALL_DIR:-${HOME}/.agents-tracing/app}"
BIN_DIR="${AGENTS_TRACING_BIN_DIR:-${HOME}/.local/bin}"
REQUIRED_NODE_MAJOR=20

# ── helpers ───────────────────────────────────────────────────────────────────
red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
bold()  { printf '\033[1m%s\033[0m\n' "$*"; }

die() { red "Error: $*"; exit 1; }

# ── detect OS / arch ──────────────────────────────────────────────────────────
OS="$(uname -s)"
ARCH="$(uname -m)"

case "${OS}" in
  Linux)  PLATFORM="linux" ;;
  Darwin) PLATFORM="darwin" ;;
  *) die "Unsupported OS: ${OS}. Use Docker instead." ;;
esac

case "${ARCH}" in
  x86_64|amd64) ARCH_TAG="x64" ;;
  arm64|aarch64) ARCH_TAG="arm64" ;;
  *) die "Unsupported architecture: ${ARCH}. Use Docker instead." ;;
esac

TARBALL_OS="${PLATFORM}-${ARCH_TAG}"

# ── check Node.js ─────────────────────────────────────────────────────────────
if ! command -v node >/dev/null 2>&1; then
  die "Node.js is required but not found. Install Node.js ${REQUIRED_NODE_MAJOR}+ from https://nodejs.org"
fi

NODE_MAJOR="$(node -e 'process.stdout.write(String(process.versions.node.split(".")[0]))')"
if [ "${NODE_MAJOR}" -lt "${REQUIRED_NODE_MAJOR}" ]; then
  die "Node.js ${REQUIRED_NODE_MAJOR}+ required, found ${NODE_MAJOR}. Upgrade at https://nodejs.org"
fi

# ── fetch latest release tag ──────────────────────────────────────────────────
bold "Fetching latest release..."
LATEST_TAG="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
  | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"\(.*\)".*/\1/')"

if [ -z "${LATEST_TAG}" ]; then
  die "Could not determine latest release. Check https://github.com/${REPO}/releases"
fi

green "Latest release: ${LATEST_TAG}"

# ── download & extract ────────────────────────────────────────────────────────
TARBALL_NAME="agents-tracing-dashboard-${LATEST_TAG}-${TARBALL_OS}.tar.gz"
DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${LATEST_TAG}/${TARBALL_NAME}"

bold "Downloading ${TARBALL_NAME}..."
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

curl -fsSL --progress-bar "${DOWNLOAD_URL}" -o "${TMP_DIR}/${TARBALL_NAME}" \
  || die "Download failed. Is ${LATEST_TAG} released? Check https://github.com/${REPO}/releases"

bold "Installing to ${INSTALL_DIR}..."
rm -rf "${INSTALL_DIR}"
mkdir -p "${INSTALL_DIR}"
tar -xzf "${TMP_DIR}/${TARBALL_NAME}" -C "${INSTALL_DIR}"
chmod +x "${INSTALL_DIR}/start.sh"

# ── install wrapper command ───────────────────────────────────────────────────
mkdir -p "${BIN_DIR}"
cat > "${BIN_DIR}/agents-tracing" <<EOF
#!/usr/bin/env bash
exec "${INSTALL_DIR}/start.sh" "\$@"
EOF
chmod +x "${BIN_DIR}/agents-tracing"

# ── PATH hint ─────────────────────────────────────────────────────────────────
bold ""
green "Installation complete!"
echo ""
echo "  Run the dashboard:   agents-tracing"
echo "  Open in browser:     http://localhost:3000"
echo ""

if ! echo "${PATH}" | grep -q "${BIN_DIR}"; then
  echo "  Add to PATH (add this to ~/.bashrc or ~/.zshrc):"
  echo "    export PATH=\"\${PATH}:${BIN_DIR}\""
  echo ""
fi

bold "Or use Docker (no Node.js required):"
echo "  docker compose up -d"
echo "  (requires docker-compose.yml from the repo)"
