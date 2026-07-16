# salaryCalc

A salary calculator with user accounts, secure sign-in, and per-user saved
calculation history.

## Architecture

Monorepo (npm workspaces) with shared types between frontend and backend:

```
salary-calc/
├── apps/
│   ├── web/        # React + Vite frontend
│   └── api/        # NestJS + Prisma backend (REST, /api/v1)
├── packages/
│   └── shared/     # Zod schemas & types shared by web + api
└── docker-compose.yml   # PostgreSQL 16 for local dev
```

**Stack:** TypeScript · NestJS · PostgreSQL · Prisma · Argon2 password hashing ·
JWT access + rotating refresh tokens (httpOnly cookies).

## Prerequisites

- Node.js 20+ and npm 10+
- Docker (for local PostgreSQL)

## Getting started

```bash
# 1. Install all workspace dependencies
npm install

# 2. Start PostgreSQL
npm run db:up

# 3. Configure backend env (already created for dev; copy the example otherwise)
cp apps/api/.env.example apps/api/.env   # then set strong JWT secrets

# 4. Build shared types, generate Prisma client, apply migrations, seed
npm run build --workspace @salary-calc/shared
npm run db:migrate
npm run db:seed --workspace @salary-calc/api

# 5. Run the apps (in two terminals)
npm run dev:api    # http://localhost:3000/api/v1
npm run dev:web    # http://localhost:5173
```

## API endpoints

| Method | Route                     | Auth | Description                    |
|--------|---------------------------|------|--------------------------------|
| GET    | `/api/v1/health`          | –    | Liveness + DB check            |
| POST   | `/api/v1/auth/register`   | –    | Create account, sets cookies   |
| POST   | `/api/v1/auth/login`      | –    | Sign in, sets cookies          |
| POST   | `/api/v1/auth/refresh`    | cookie | Rotate tokens                |
| POST   | `/api/v1/auth/logout`     | cookie | Revoke refresh token         |
| GET    | `/api/v1/auth/me`         | ✔    | Current user                   |
| GET    | `/api/v1/calculations`    | ✔    | List *your* calculations       |
| POST   | `/api/v1/calculations`    | ✔    | Save a calculation             |
| GET    | `/api/v1/calculations/:id`| ✔    | Get one (404 if not yours)     |
| PATCH  | `/api/v1/calculations/:id`| ✔    | Update one                     |
| DELETE | `/api/v1/calculations/:id`| ✔    | Delete one                     |

Every calculation is scoped to the authenticated user; there is no way to read
or mutate another user's data.

## Useful scripts (run from repo root)

| Command              | Description                          |
|----------------------|--------------------------------------|
| `npm run db:up`      | Start PostgreSQL (Docker)            |
| `npm run db:down`    | Stop PostgreSQL                      |
| `npm run db:migrate` | Create & apply a Prisma migration    |
| `npm run db:studio`  | Open Prisma Studio (DB browser)      |
| `npm run dev:api`    | Run backend in watch mode            |
| `npm run dev:web`    | Run frontend dev server              |
| `npm run build`      | Build all workspaces                 |
