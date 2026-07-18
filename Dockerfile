# One image that builds the whole monorepo and runs the NestJS API, which also
# serves the built React frontend (single origin -> cookie auth works anywhere).
FROM node:22-slim

WORKDIR /app

# openssl: required by Prisma. python3/make/g++: build the argon2 native addon.
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install all workspace dependencies.
COPY . .
RUN npm ci

# Build shared -> generate Prisma client -> build web -> build api,
# then place the web build where the API serves it from.
RUN npm run build --workspace @salary-calc/shared \
  && npm run prisma:generate --workspace @salary-calc/api \
  && npm run build --workspace @salary-calc/web \
  && npm run build --workspace @salary-calc/api \
  && mkdir -p apps/api/public \
  && cp -r apps/web/dist/. apps/api/public/

ENV NODE_ENV=production

# Apply any pending migrations, then start. The server binds to $PORT (Railway).
CMD ["sh", "-c", "cd apps/api && npx prisma migrate deploy && node dist/main.js"]
