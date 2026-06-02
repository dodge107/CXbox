FROM node:22-alpine

WORKDIR /app

# Install Pandoc for universal document conversion
RUN apk add --no-cache pandoc

# Install dependencies first (layer caching)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy application code
COPY src/ ./src/
COPY public/ ./public/

# Create data volume mount point
RUN mkdir -p /data
VOLUME /data

EXPOSE 3000

ENV NODE_ENV=production
ENV DATA_ROOT=/data

CMD ["node", "src/index.js"]
