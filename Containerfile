# ──────────────────────────────────────────────────────────────────────
# CXbox — Customer Wiki Manager
# Production container: app + Pandoc, data/config external
# ──────────────────────────────────────────────────────────────────────
FROM node:22-alpine

# Install Pandoc for universal document conversion
# Install GitHub Copilot CLI for AI wiki processing
RUN apk add --no-cache pandoc && \
    npm install -g @github/copilot

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
# /data           — All customer data (documents, wikis, indexes, configs)
# /config         — Optional: override shared zone files (schema.md, config.json)
# /copilot-config — GitHub Copilot CLI auth & config (persisted login)
RUN mkdir -p /data /config /copilot-config && \
    ln -sf /copilot-config /root/.copilot
VOLUME ["/data", "/config", "/copilot-config"]

# ── Runtime ───────────────────────────────────────────────────────────
EXPOSE 3000

ENV NODE_ENV=production
ENV DATA_ROOT=/data
ENV CONFIG_ROOT=/config

ENTRYPOINT ["/entrypoint.sh"]
