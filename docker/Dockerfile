FROM node:24-alpine AS base
WORKDIR /app
RUN corepack enable
RUN corepack prepare pnpm@11.13.0 --activate

FROM base AS build-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY packages/upgrade-availability/package.json packages/upgrade-availability/package.json
RUN pnpm install --frozen-lockfile --filter @multi-coc/dashboard...

FROM build-deps AS build
COPY apps/dashboard apps/dashboard
COPY packages/upgrade-availability/index.ts packages/upgrade-availability/index.ts
ARG NEXT_PUBLIC_API_BASE
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG NEXT_PUBLIC_DEMO_MODE=false
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_DEMO_MODE=$NEXT_PUBLIC_DEMO_MODE
RUN pnpm --filter @multi-coc/dashboard build

FROM node:24-alpine AS web
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=build /app/apps/dashboard/.next/standalone ./
COPY --from=build /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
COPY --from=build /app/apps/dashboard/public ./apps/dashboard/public
EXPOSE 3000
CMD ["node", "apps/dashboard/server.js"]

FROM base AS service-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/collector/package.json packages/collector/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/notifier/package.json packages/notifier/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --prod --frozen-lockfile --filter @multi-coc/collector... --filter @multi-coc/notifier...

FROM node:24-alpine AS services
WORKDIR /app
ENV NODE_ENV=production
COPY --from=service-deps /app ./
COPY packages/collector/src packages/collector/src
COPY packages/database/index.ts packages/database/index.ts
COPY packages/database/schema.sql packages/database/schema.sql
COPY packages/notifier/src packages/notifier/src
COPY packages/shared/snapshot.ts packages/shared/snapshot.ts
CMD ["node", "packages/collector/src/server.ts"]
