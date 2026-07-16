FROM node:24-alpine AS deps
WORKDIR /app
RUN corepack enable
RUN corepack prepare pnpm@11.13.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY packages/collector/package.json packages/collector/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/notifier/package.json packages/notifier/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
ARG NEXT_PUBLIC_API_BASE
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG NEXT_PUBLIC_DEMO_MODE=false
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_DEMO_MODE=$NEXT_PUBLIC_DEMO_MODE
RUN pnpm run build

FROM node:24-alpine AS web
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
RUN corepack prepare pnpm@11.13.0 --activate
COPY --from=build /app ./
EXPOSE 3000
CMD ["pnpm", "start"]

FROM deps AS services
WORKDIR /app
COPY packages ./packages
CMD ["node", "packages/collector/src/server.ts"]
