# ──────────────────────────────────────────────────────────────────────
# CXbox — Customer Wiki Manager
# Production container: app + Pandoc, data/config external
# ──────────────────────────────────────────────────────────────────────
FROM node:22-alpine

# Install Pandoc for universal document conversion
RUN apk add --no-cache pandoc

WORKDIR /app

# ── Dependencies ──────────────────────────────────────────────────────
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── Application ───────────────────────────────────────────────────────
COPY src/ ./src/
COPY public/ ./public/
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# ── External volumes ──────────────────────────────────────────────────
# /data   — All customer data (documents, wikis, indexes, configs)
# /config — Optional: override shared zone files (schema.md, config.json)
RUN mkdir -p /data /config
VOLUME ["/data", "/config"]

# ── Runtime ───────────────────────────────────────────────────────────
EXPOSE 3000

ENV NODE_ENV=production
ENV DATA_ROOT=/data
ENV CONFIG_ROOT=/config

ENTRYPOINT ["/entrypoint.sh"]
