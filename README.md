# Services

A [NestJS](https://nestjs.com/) backend service built with TypeScript. It shares the platform database schema via the [`db-schema`](https://github.com/memohit18/db-schema) Git submodule — the same source of truth used by `auth-service` and other APIs.

## Prerequisites

- [Node.js](https://nodejs.org/) (v20 or later recommended)
- npm
- PostgreSQL and MongoDB (local or remote)
- Git with SSH access to `git@github.com:memohit18/db-schema.git`

## Getting started

### 1. Clone with submodules

```bash
git clone --recurse-submodules git@github.com:memohit18/services.git
cd services
```

If you already cloned without submodules:

```bash
git submodule update --init --recursive
```

### 2. Install dependencies

```bash
npm install
```

`postinstall` initializes the `db-schema` submodule and runs `prisma generate`.

### 3. Environment setup

```bash
cp .env.example .env
```

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP port the server listens on | `3303` |
| `DATABASE_URL` | PostgreSQL connection string (Prisma) | — |
| `MONGODB_URL` | MongoDB connection string (Mongoose) | — |
| `JWT_ACCESS_SECRET` | Access token secret (must match auth-service) | — |
| `JWT_REFRESH_SECRET` | Refresh token secret (must match auth-service) | — |
| `JWT_ACCESS_EXPIRES_IN` | Access token TTL | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL | `30d` |

Set these in your local `.env` only — never commit real values.

### 4. Database setup

**PostgreSQL (Prisma)** — schema lives in the submodule:

```bash
npm run prisma:generate
npm run prisma:migrate
```

**MongoDB (Mongoose)** — schemas are imported from `db-schema/mongodb/schemas/`. Collections are created when the service connects and writes.

### 5. Run the application

```bash
npm run start:dev
```

The server starts at **http://localhost:3303** by default.

## Shared database schema (`db-schema` submodule)

```
db-schema/                          # git submodule
├── postgres/prisma/
│   ├── schema.prisma               # PostgreSQL models (User, Session, etc.)
│   └── migrations/                 # Prisma migration history
└── mongodb/schemas/
    └── activity-log.schema.ts      # Mongoose schemas for NestJS
```

This repo does **not** own the schema. Changes are made in [memohit18/db-schema](https://github.com/memohit18/db-schema) and pulled into services:

```bash
npm run submodule:pull
npm run prisma:generate
```

See `db-schema/README.md` for full schema documentation.

## Project structure

```
src/
├── main.ts
├── app.module.ts
├── auth/
│   ├── auth.module.ts              # Global JWT guard + auth middleware
│   ├── guards/jwt-auth.guard.ts
│   ├── strategies/jwt.strategy.ts  # Prisma user validation
│   └── middleware/auth.middleware.ts
├── common/
│   └── filters/global-exception.filter.ts
├── config/
│   └── configuration.ts
├── health/
│   ├── health.module.ts
│   ├── health.controller.ts        # GET /health
│   └── health.service.ts
├── prisma/
│   ├── prisma.module.ts            # Global Prisma client (PostgreSQL)
│   └── prisma.service.ts
└── mongodb/
    └── mongodb.module.ts           # Mongoose connection + shared schemas
db-schema/                          # Submodule — shared schema for all services
prisma.config.ts                    # Prisma CLI config (schema path, migrations)
```

## API

### Health check

`GET /health` — returns API status, database connectivity, and uptime.

**200 OK** when all checks pass:

```json
{
  "status": "ok",
  "api": { "status": "ok" },
  "db": {
    "postgres": { "status": "ok" },
    "mongodb": { "status": "ok" }
  },
  "uptime": {
    "seconds": 42.15,
    "formatted": "42s"
  }
}
```

**503 Service Unavailable** when PostgreSQL or MongoDB is unreachable (same body shape with `"status": "error"`).

### Authentication

All routes require a valid Bearer access token **except** `GET /health`.

The global `JwtAuthGuard` verifies the JWT using `JWT_ACCESS_SECRET`, then loads the user from PostgreSQL via Prisma. Access is denied if:

- The token is missing, invalid, or expired
- The user does not exist in the database
- The user is marked as deleted (`isDeleted: true`)

**401 Unauthorized** — invalid or expired token:

```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Invalid access token",
  "path": "/example",
  "timestamp": "2026-06-17T12:00:00.000Z"
}
```

**403 Forbidden** — token valid but user not allowed:

```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Access denied",
  "path": "/example",
  "timestamp": "2026-06-17T12:00:00.000Z"
}
```

Send requests with:

```
Authorization: Bearer <access_token>
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run start` | Start the app (loads `.env`) |
| `npm run start:dev` | Start in watch mode |
| `npm run start:prod` | Run compiled build |
| `npm run build` | Compile TypeScript (`prisma generate` runs first) |
| `npm run submodule:init` | Initialize `db-schema` submodule |
| `npm run submodule:pull` | Pull latest `db-schema` from remote |
| `npm run prisma:generate` | Generate Prisma client from submodule schema |
| `npm run prisma:migrate` | Create/apply migrations (development) |
| `npm run prisma:migrate:deploy` | Apply migrations (staging/production) |
| `npm run lint` | Lint source files |

## Using Prisma and MongoDB in code

**PostgreSQL** — inject `PrismaService`:

```typescript
constructor(private readonly prisma: PrismaService) {}

await this.prisma.user.findMany();
```

**MongoDB** — import models from the submodule and use `@InjectModel()`:

```typescript
import { ACTIVITY_LOG_MODEL } from '../../db-schema/mongodb/schemas/activity-log.schema';

constructor(
  @InjectModel(ACTIVITY_LOG_MODEL) private activityLogModel: Model<ActivityLogDocument>,
) {}
```

## Learn more

- [NestJS documentation](https://docs.nestjs.com/)
- [Prisma documentation](https://www.prisma.io/docs)
- [Mongoose NestJS integration](https://docs.nestjs.com/techniques/mongodb)
