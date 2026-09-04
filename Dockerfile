FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# The app binds to 127.0.0.1 by default; inside a container it must listen
# on all interfaces for published ports to reach it.
ENV HOST=0.0.0.0
ENV PORT=3000

RUN apk add --no-cache curl
USER node

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://127.0.0.1:3000/health || exit 1

EXPOSE 3000
ENTRYPOINT ["node", "mcpServer.js", "--streamable-http"]
