# Services

A [NestJS](https://nestjs.com/) backend service for coding questions, test cases, and user profile data. It shares the platform database schema via the [`db-schema`](https://github.com/memohit18/db-schema) Git submodule — the same source of truth used by `auth-service` and other APIs.

**Default base URL:** `http://localhost:3303`

Authentication is handled by the separate **auth-service**. This service validates JWT access tokens and loads users from PostgreSQL via Prisma.

---

## Prerequisites

- [Node.js](https://nodejs.org/) (v20 or later recommended)
- npm
- PostgreSQL and MongoDB (local or remote)
- Git with SSH access to `git@github.com:memohit18/db-schema.git`
- A running **auth-service** to obtain access tokens

---

## Quick start

```bash
git clone --recurse-submodules git@github.com:memohit18/services.git
cd services
npm install
cp .env.example .env   # fill in values locally
npm run prisma:generate
npm run prisma:migrate
npm run start:dev
```

If you already cloned without submodules:

```bash
git submodule update --init --recursive
```

---

## Environment variables

Copy `.env.example` to `.env` and set values locally. **Never commit `.env`.**

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | HTTP port (default `3303`) |
| `DATABASE_URL` | Yes | PostgreSQL connection string (Prisma) |
| `MONGODB_URL` | Yes | MongoDB connection string (with credentials if auth is enabled) |
| `JWT_ACCESS_SECRET` | Yes | Must match auth-service |
| `JWT_REFRESH_SECRET` | Yes | Must match auth-service |
| `JWT_ACCESS_EXPIRES_IN` | No | Access token TTL (default `15m`) |
| `JWT_REFRESH_EXPIRES_IN` | No | Refresh token TTL (default `30d`) |

**MongoDB with auth example:**

```env
MONGODB_URL="mongodb://USERNAME:PASSWORD@localhost:27017/services_logs?authSource=admin"
```

---

## Postman

Import the collection:

```
docs/services.postman_collection.json
```

Set the `accessToken` collection variable with a JWT from auth-service. All protected requests use `Authorization: Bearer {{accessToken}}`.

---

## API

### Authentication

All routes require a valid Bearer access token **except** `GET /health`.

Tokens are issued by **auth-service** (e.g. `POST /auth/login` on port `3302`). This service:

1. Verifies the JWT with `JWT_ACCESS_SECRET`
2. Loads the user from PostgreSQL via Prisma
3. Returns **401 Unauthorized** if the token is missing, invalid, expired, or the user does not exist / is deleted

```
Authorization: Bearer <access_token>
```

**401 response shape:**

```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Invalid access token",
  "path": "/profile",
  "timestamp": "2026-06-17T12:00:00.000Z"
}
```

---

### Health

`GET /health` — public, no auth.

**200** when API, PostgreSQL, and MongoDB are healthy:

```json
{
  "status": "ok",
  "api": { "status": "ok" },
  "db": {
    "postgres": { "status": "ok" },
    "mongodb": { "status": "ok" }
  },
  "uptime": { "seconds": 42.15, "formatted": "42s" }
}
```

**503** when a database check fails.

---

### Profile

`GET /profile` — protected.

Returns the authenticated user's profile from PostgreSQL:

```json
{
  "name": "Mohit Kumar",
  "email": "user@example.com",
  "phone": "+919876543210",
  "avatar": "https://...",
  "role": "user"
}
```

```bash
curl -s http://localhost:3303/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

### Questions

#### List questions

`GET /questions` — protected.

| Query param | Description |
|-------------|-------------|
| `page` | Page number (default `1`) |
| `limit` | Items per page (default `20`, max `100`) |
| `category` | Filter by category |
| `difficulty` | `Easy`, `Medium`, or `Hard` |
| `search` | Search title, category, pattern, tags |

```bash
curl -s 'http://localhost:3303/questions?page=1&limit=10&difficulty=Easy' \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Response:**

```json
{
  "items": [ { "questionId": 1, "title": "Two Sum", "..." : "..." } ],
  "meta": { "page": 1, "limit": 10, "total": 2, "totalPages": 1 }
}
```

#### Question detail

`GET /questions/:questionId` — protected.

Returns the full question plus **sample test cases only** (hidden cases excluded):

```json
{
  "questionId": 1,
  "title": "Two Sum",
  "problemStatement": "...",
  "sampleTestcases": [ "..." ],
  "testcaseCount": 3
}
```

```bash
curl -s http://localhost:3303/questions/1 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### Bulk upload

`POST /questions/bulk` — protected.

Upload questions and test cases to MongoDB in one request.

- Questions are upserted by `questionId`
- If a question with the same **title** already exists, it is updated (existing `questionId` is kept)
- Test cases are appended; payload `questionId` values are mapped to the resolved DB `questionId`

**Response:**

```json
{
  "questions": { "upserted": 2, "modified": 0, "updatedByTitle": 0 },
  "testcases": { "inserted": 3 }
}
```

---

## Shared database schema (`db-schema` submodule)

```
db-schema/
├── postgres/prisma/
│   ├── schema.prisma          # User, Session, RefreshToken
│   └── migrations/
└── mongodb/schemas/
    ├── question.schema.ts
    ├── test-case.schema.ts
    ├── submission.schema.ts
    ├── user-progress.schema.ts
    ├── note.schema.ts
    ├── bookmark.schema.ts
    └── activity-log.schema.ts
```

Schema changes are made in [memohit18/db-schema](https://github.com/memohit18/db-schema):

```bash
npm run submodule:pull
npm run prisma:generate
```

See `db-schema/README.md` for full documentation.

---

## Project structure

```
src/
├── main.ts
├── app.module.ts
├── auth/
│   ├── auth.module.ts              # Global JWT guard + middleware
│   ├── guards/jwt-auth.guard.ts
│   ├── strategies/jwt.strategy.ts  # JWT verify + Prisma user lookup
│   └── middleware/auth.middleware.ts
├── common/
│   ├── decorators/current-user.decorator.ts
│   └── filters/global-exception.filter.ts
├── config/
│   └── configuration.ts
├── health/
├── profile/                        # GET /profile
├── questions/                      # Questions CRUD + bulk upload
├── prisma/                         # PostgreSQL (Prisma)
└── mongodb/                        # MongoDB (Mongoose)
docs/
└── services.postman_collection.json
db-schema/                          # Git submodule
prisma.config.ts
```

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run start:dev` | Start in watch mode |
| `npm run start` | Start (single run) |
| `npm run start:prod` | Run compiled build |
| `npm run build` | Compile (`prisma generate` runs first) |
| `npm run submodule:init` | Initialize `db-schema` submodule |
| `npm run submodule:pull` | Pull latest `db-schema` |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Create/apply migrations (dev) |
| `npm run prisma:migrate:deploy` | Apply migrations (prod) |
| `npm run lint` | Lint source files |
| `npm run format` | Format source files |

---

## Related services

| Service | Port | Purpose |
|---------|------|---------|
| **auth-service** | `3302` | Login, signup, token issuance |
| **services** (this) | `3303` | Questions, profile, coding platform data |

---

## Learn more

- [NestJS documentation](https://docs.nestjs.com/)
- [Prisma documentation](https://www.prisma.io/docs)
- [Mongoose NestJS integration](https://docs.nestjs.com/techniques/mongodb)
