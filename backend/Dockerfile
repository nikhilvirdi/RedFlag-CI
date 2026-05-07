FROM node:20-alpine AS base
RUN apk add --no-cache python3 py3-pip git
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

FROM base AS build
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY prisma ./prisma/
RUN npx prisma generate
COPY src ./src/
RUN npm run build

FROM base AS production
ENV NODE_ENV=production
RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001 -G appgroup
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma/
COPY scan-engine ./scan-engine/
COPY package.json ./
RUN chown -R appuser:appgroup /app
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://localhost:3000/healthcheck || exit 1
CMD ["node", "dist/index.js"]
