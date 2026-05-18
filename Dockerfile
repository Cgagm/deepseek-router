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

# -- Production stage --
FROM node:20-alpine AS runtime

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

COPY --from=build /app/packages/core/dist/ /app/packages/core/dist/
COPY --from=build /app/packages/core/package.json /app/packages/core/
COPY --from=build /app/packages/cli/dist/ /app/packages/cli/dist/
COPY --from=build /app/packages/cli/package.json /app/packages/cli/

# Only install production deps for the CLI (which pulls core as workspace dep)
WORKDIR /app/packages/cli
COPY pnpm-workspace.yaml /app/
COPY packages/core/package.json /app/packages/core/
COPY pnpm-lock.yaml /app/
RUN pnpm install --frozen-lockfile --prod

EXPOSE 8788

ENV NODE_ENV=production

ENTRYPOINT ["node", "dist/cli.js"]
