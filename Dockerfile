# -- Build stage --
FROM node:20-alpine AS build

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/core/package.json packages/core/
COPY packages/cli/package.json packages/cli/

RUN pnpm install --frozen-lockfile

COPY tsconfig.json turbo.json ./
COPY packages/core/ packages/core/
COPY packages/cli/ packages/cli/

RUN pnpm run build

# Prune production deps for the CLI, resolving workspace:* to actual deps
RUN pnpm --filter=deepseek-router --prod deploy /prod

# -- Production stage --
FROM node:20-alpine AS runtime

COPY --from=build /prod /app
WORKDIR /app

EXPOSE 8788

ENV NODE_ENV=production

ENTRYPOINT ["node", "dist/cli.js"]
