FROM node:22.12-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install

COPY . .

# Listen on all interfaces inside the container (app defaults to 127.0.0.1)
ENV HOST=0.0.0.0

# Install curl for health check
RUN apk --no-cache add curl

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

ENTRYPOINT ["node", "mcpServer.js", "--streamable-http"]
