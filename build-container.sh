#!/usr/bin/env bash
#
# build-container.sh — Build CXbox into a production Podman container.
#
# The resulting container contains ONLY:
#   - The compiled frontend (static files)
#   - The backend server code + node_modules
#   - Pandoc for document extraction
#
# External volumes (mounted at runtime):
#   /data           — All customer data, wiki pages, documents, config
#   /config         — Optional: override config.json, schema.md, etc.
#   /root/.copilot  — GitHub Copilot CLI auth & config (persisted login)
#
# Usage:
#   ./build-container.sh                  # Build with default tag
#   ./build-container.sh --tag cxbox:latest
#   ./build-container.sh --tag myregistry/cxbox:v1.0 --push
#

set -euo pipefail

# ── Defaults ──────────────────────────────────────────────────────────
IMAGE_TAG="cxbox:latest"
PUSH=false
NO_CACHE=false
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR=""

# ── Container engine: prefer podman, fall back to docker ──────────────
CONTAINER_ENGINE="podman"
if ! command -v podman &>/dev/null; then
  CONTAINER_ENGINE="docker"
fi

# ── Colours ───────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${CYAN}▶ $*${NC}"; }
ok()   { echo -e "${GREEN}✔ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠ $*${NC}"; }
err()  { echo -e "${RED}✘ $*${NC}" >&2; }

# ── Parse args ────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag)   IMAGE_TAG="$2"; shift 2 ;;
    --push)  PUSH=true; shift ;;
    --no-cache) NO_CACHE=true; shift ;;
    --help|-h)
      echo "Usage: $0 [--tag NAME:TAG] [--push] [--no-cache]"
      exit 0
      ;;
    *) err "Unknown option: $1"; exit 1 ;;
  esac
done

# ── Prerequisites ─────────────────────────────────────────────────────
check_cmd() {
  if ! command -v "$1" &>/dev/null; then
    err "$1 is required but not installed."
    exit 1
  fi
}

log "Checking prerequisites..."
check_cmd node
check_cmd npm
check_cmd "$CONTAINER_ENGINE"

NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
if [[ "$NODE_MAJOR" -lt 22 ]]; then
  err "Node.js 22+ required (found $(node -v))"
  exit 1
fi

ok "Prerequisites OK (Node $(node -v), $CONTAINER_ENGINE $($CONTAINER_ENGINE --version))"

# ── Step 1: Build frontend ────────────────────────────────────────────
log "Building frontend (client/)..."
cd "$SCRIPT_DIR/client"

if [[ ! -d "node_modules" ]]; then
  log "  Installing client dependencies..."
  npm ci --silent
fi

npm run build 2>&1 | tail -5
ok "Frontend built → public/"

cd "$SCRIPT_DIR"

# ── Step 2: Prepare production bundle ─────────────────────────────────
log "Preparing production bundle..."

BUILD_DIR=$(mktemp -d "${TMPDIR:-/tmp}/cxbox-build.XXXXXX")
trap 'rm -rf "$BUILD_DIR"' EXIT

# Backend source
mkdir -p "$BUILD_DIR/src"
cp -R src/* "$BUILD_DIR/src/"

# Built frontend → public/
mkdir -p "$BUILD_DIR/public"
cp -R public/* "$BUILD_DIR/public/"

# Package files
cp package.json package-lock.json entrypoint.sh "$BUILD_DIR/"

# Containerfile
cp Containerfile "$BUILD_DIR/Containerfile"

# .dockerignore (works for both podman and docker)
cat > "$BUILD_DIR/.containerignore" << 'IGNORE'
node_modules
.git
.gitignore
data
client
*.md
!Containerfile
.DS_Store
.vscode
*.log
coverage
dist
IGNORE

# Podman also reads .dockerignore
cp "$BUILD_DIR/.containerignore" "$BUILD_DIR/.dockerignore"

ok "Bundle prepared in $BUILD_DIR"

# ── Step 3: Build container image ─────────────────────────────────────
log "Building image: $IMAGE_TAG (engine: $CONTAINER_ENGINE)"

BUILD_ARGS=(
  build
  -t "$IMAGE_TAG"
  -f Containerfile
)

if $NO_CACHE; then
  BUILD_ARGS+=(--no-cache)
fi

BUILD_ARGS+=(".")

"$CONTAINER_ENGINE" "${BUILD_ARGS[@]}" 2>&1

ok "Image built: $IMAGE_TAG"

# ── Step 4: Optional push ─────────────────────────────────────────────
if $PUSH; then
  log "Pushing image: $IMAGE_TAG"
  "$CONTAINER_ENGINE" push "$IMAGE_TAG"
  ok "Image pushed"
fi

# ── Summary ───────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  CXbox container built successfully!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "  Image:  $IMAGE_TAG"

# Size reporting differs between podman and docker
if [[ "$CONTAINER_ENGINE" == "podman" ]]; then
  SIZE=$("$CONTAINER_ENGINE" image inspect "$IMAGE_TAG" --format='{{.Size}}' 2>/dev/null | awk '{printf "%.0f MB", $1/1024/1024}' || echo "n/a")
else
  SIZE=$("$CONTAINER_ENGINE" image inspect "$IMAGE_TAG" --format='{{.Size}}' 2>/dev/null | awk '{printf "%.0f MB", $1/1024/1024}' || echo "n/a")
fi
echo "  Size:   $SIZE"
echo ""
echo "  Run with:"
echo "    $CONTAINER_ENGINE run -d \\"
echo "      -p 3000:3000 \\"
echo "      -v \$(pwd)/data:/data \\"
echo "      -v \$(pwd)/config:/config:ro \\"
echo "      -v \$(pwd)/copilot-config:/root/.copilot \\"
echo "      -e PORT=3000 \\"
echo "      -e DATA_ROOT=/data \\"
echo "      -e CONFIG_ROOT=/config \\"
echo "      --name cxbox \\"
echo "      $IMAGE_TAG"
echo ""
echo "  Copilot config directory (required for AI features):"
echo "    Login once inside the container: $CONTAINER_ENGINE exec -it cxbox copilot"
echo "    Auth tokens are persisted in ./copilot-config/"
echo ""
echo "  Config directory (optional):"
echo "    Place schema.md, config.json, index.md, log.md in ./config/"
echo "    These are copied to /data/shared on first boot (no overwrite)."
echo ""
