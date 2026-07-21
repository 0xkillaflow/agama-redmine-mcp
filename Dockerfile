# Minimal container image for the Redmine MCP Server (stdio).
#
# The server speaks MCP over stdio, so run it with an attached stdin/stdout:
#   docker build -t redmine-mcp .
#   docker run --rm -i \
#     -e REDMINE_URL=https://redmine.example.com \
#     -e REDMINE_API_KEY=your-redmine-api-key \
#     redmine-mcp
#
# For a local Redmine to point it at, see docker-compose.yml.

# --- build stage: install all deps and bundle to dist/ ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- runtime stage: production deps + built output only ---
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# stdio server: keep stdout clean (JSON-RPC); logs go to stderr.
ENTRYPOINT ["node", "dist/index.js"]
