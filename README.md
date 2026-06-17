# Services

A [NestJS](https://nestjs.com/) backend for the coding platform — questions, test cases, examples, hints, and user profile. It shares the platform database schema via the [`db-schema`](https://github.com/memohit18/db-schema) Git submodule (same source of truth as `auth-service`).

**Default base URL:** `http://localhost:3303`

Authentication is handled by **auth-service** (`http://localhost:3302`). This service only validates JWT access tokens and loads users from PostgreSQL.

---

## What this service does

| Feature | Endpoint | Use case |
|---------|----------|----------|
| Health check | `GET /health` | Monitor API + PostgreSQL + MongoDB (load balancers, deploys) |
| User profile | `GET /profile` | Show logged-in user name, email, phone, avatar, role |
| List questions | `GET /questions` | Browse/filter coding problems (category, difficulty, search) |
| Question detail | `GET /questions/:id` | Full problem view with examples, hints, sample test cases |
| Bulk upload | `POST /questions/bulk` | Seed or update questions, examples, hints, follow-ups, and test cases |

---

## Prerequisites

- Node.js v20+
- npm
- PostgreSQL (users via Prisma — shared with auth-service)
- MongoDB database `dsa_tracker` (or your own DB name in `MONGODB_URL`)
- Git SSH access to `git@github.com:memohit18/db-schema.git`
- Running **auth-service** for JWT tokens

---

## Commands to run the project

### First-time setup

```bash
git clone --recurse-submodules git@github.com:memohit18/services.git
cd services
npm install
cp .env.example .env          # fill in values locally — never commit .env
npm run prisma:generate
npm run prisma:migrate
```

If you already cloned without submodules:

```bash
git submodule update --init --recursive
```

### Development (hot reload)

```bash
npm run start:dev
```

Server runs at **http://localhost:3303**.

### Other commands

| Command | When to use |
|---------|-------------|
| `npm run start` | Single run (no watch) |
| `npm run start:debug` | Debug with inspector |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start:prod` | Run production build |
| `npm run prisma:generate` | Regenerate Prisma client after schema changes |
| `npm run prisma:migrate` | Apply DB migrations (development) |
| `npm run prisma:migrate:deploy` | Apply migrations (staging/production) |
| `npm run submodule:pull` | Pull latest `db-schema` from remote |
| `npm run lint` | Lint source files |
| `npm run format` | Format source files |

### Production deploy

```bash
npm install
npm run submodule:init
npm run prisma:migrate:deploy
npm run build
npm run start:prod
```

---

## Environment variables

Copy `.env.example` to `.env` and set values locally.

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | HTTP port (default `3303`) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `MONGODB_URL` | Yes | MongoDB connection string |
| `JWT_ACCESS_SECRET` | Yes | Must match auth-service |
| `JWT_REFRESH_SECRET` | Yes | Must match auth-service |
| `JWT_ACCESS_EXPIRES_IN` | No | Default `15m` |
| `JWT_REFRESH_EXPIRES_IN` | No | Default `30d` |

```env
MONGODB_URL="mongodb://USERNAME:PASSWORD@localhost:27017/dsa_tracker?authSource=admin"
```

---

## MongoDB collections

Data is split across collections in the `dsa_tracker` database:

| Collection | Stores | Used by |
|------------|--------|---------|
| `questions` | Problem metadata (title, difficulty, constraints, tags) | List + detail APIs |
| `examples` | Worked examples (`input`, `output`, `explanation`) per question | List + detail APIs |
| `hints` | Progressive hints per question | List + detail APIs |
| `follow_ups` | Follow-up discussion prompts per question | List + detail APIs |
| `test_cases` | Judge test cases (`input`, `expectedOutput`, `isSample`, `isHidden`) | Bulk upload + detail API |
| `submissions` | User code submissions | Future use |
| `user_progress` | Per-user question progress | Future use |
| `bookmarks` | Saved questions | Future use |
| `notes` | User notes per question | Future use |
| `activity_logs` | Activity audit trail | Future use |

PostgreSQL (via Prisma) stores **users** — shared with auth-service.

---

## Authentication

All routes require `Authorization: Bearer <token>` **except** `GET /health`.

Get a token from auth-service:

```bash
curl -s -X POST http://localhost:3302/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"your_password"}'
```

Use the `accessToken` from the response:

```bash
export TOKEN="paste_access_token_here"
```

---

## API reference

### Health — `GET /health` (public)

Check API, PostgreSQL, and MongoDB status.

```bash
curl -s http://localhost:3303/health
```

---

### Profile — `GET /profile` (protected)

Returns the logged-in user's profile from PostgreSQL.

```bash
curl -s http://localhost:3303/profile \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**

```json
{
  "name": "Mohit Kumar",
  "email": "user@example.com",
  "phone": "+919876543210",
  "avatar": "https://...",
  "role": "user"
}
```

---

### List questions — `GET /questions` (protected)

Browse and filter questions. Joins data from `questions`, `examples`, `hints`, `follow_ups`, and `test_cases`.

> **Note:** If a question shows empty `examples`, `hints`, or `followUps`, it was uploaded without those fields. Re-run `POST /questions/bulk` with the full question payload to populate them.

| Query param | Description |
|-------------|-------------|
| `page` | Page number (default `1`) |
| `limit` | Per page (default `20`, max `100`) |
| `category` | e.g. `Arrays & Hashing` |
| `difficulty` | `Easy`, `Medium`, `Hard` |
| `search` | Matches title, category, pattern, tags |

```bash
curl -s 'http://localhost:3303/questions?page=1&limit=10&difficulty=Easy&category=Arrays%20%26%20Hashing' \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**

```json
{
  "items": [
    {
      "questionId": 3,
      "title": "Valid Anagram",
      "category": "Arrays & Hashing",
      "pattern": "Frequency Count",
      "difficulty": "Easy",
      "problemStatement": "Given two strings s and t...",
      "constraints": ["1 <= s.length <= 50000"],
      "expectedTimeComplexity": "O(n)",
      "expectedSpaceComplexity": "O(1)",
      "tags": ["string", "hashmap"],
      "followUps": ["Can you solve without sorting?"],
      "examples": [
        {
          "input": { "s": "anagram", "t": "nagaram" },
          "output": true,
          "explanation": "Both strings contain the same character frequencies."
        }
      ],
      "hints": ["Count character frequencies.", "Compare both frequency maps."],
      "testcaseCount": 2,
      "sampleTestcaseCount": 1,
      "createdAt": "2026-06-17T...",
      "updatedAt": "2026-06-17T..."
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 8, "totalPages": 1 }
}
```

---

### Question detail — `GET /questions/:questionId` (protected)

Full problem for solving. Fetches and joins all related data in parallel:

| Source collection | Response field |
|-------------------|----------------|
| `questions` | Metadata, constraints, tags, complexity |
| `examples` | `examples` |
| `hints` | `hints` |
| `follow_ups` | `followUps` |
| `test_cases` | `sampleTestcases`, `testcaseCount`, `sampleTestcaseCount`, `hiddenTestcaseCount` |

Hidden test case **inputs/outputs** are not returned — only `hiddenTestcaseCount`. Sample test cases (`isSample: true` or `isHidden: false`) are included in `sampleTestcases`.

```bash
curl -s http://localhost:3303/questions/3 \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**

```json
{
  "questionId": 3,
  "title": "Valid Anagram",
  "category": "Arrays & Hashing",
  "pattern": "Frequency Count",
  "difficulty": "Easy",
  "problemStatement": "...",
  "constraints": ["..."],
  "expectedTimeComplexity": "O(n)",
  "expectedSpaceComplexity": "O(1)",
  "tags": ["string", "hashmap"],
  "followUps": ["..."],
  "examples": [{ "input": {}, "output": true, "explanation": "..." }],
  "hints": ["Count character frequencies."],
  "testcaseCount": 2,
  "sampleTestcaseCount": 1,
  "hiddenTestcaseCount": 1,
  "sampleTestcases": [
    {
      "input": { "s": "anagram", "t": "nagaram" },
      "expectedOutput": true,
      "isSample": true,
      "isHidden": false,
      "weight": 1
    }
  ]
}
```

---

### Bulk upload — `POST /questions/bulk` (protected)

Upload or update questions, examples, hints, follow-ups, and test cases in one request.

#### Upsert rules

| Data | Collection | Behavior |
|------|------------|----------|
| Questions | `questions` | Upsert by `questionId`; if **title** already exists → update that document (keeps existing `questionId`) |
| Examples | `examples` | Replace all examples for each `questionId` in payload |
| Hints | `hints` | Replace all hints for each `questionId` in payload |
| Follow-ups | `follow_ups` | Replace all follow-ups for each `questionId` in payload |
| Test cases | `test_cases` | Replace all test cases for each `questionId` in payload |

Test cases do **not** require the question to exist first — you can upload test cases before question metadata.

`examples`, `hints`, and `followUps` are optional on each question item. If omitted or empty, existing rows in those collections are left unchanged for that question.

#### Request format (recommended)

```bash
curl --location 'http://localhost:3303/questions/bulk' \
  --header 'Content-Type: application/json' \
  --header "Authorization: Bearer $TOKEN" \
  --data '{
  "questions": [
    {
      "questionId": 3,
      "title": "Valid Anagram",
      "category": "Arrays & Hashing",
      "pattern": "Frequency Count",
      "difficulty": "Easy",
      "problemStatement": "Given two strings s and t, return true if t is an anagram of s.",
      "constraints": ["1 <= s.length <= 50000"],
      "expectedTimeComplexity": "O(n)",
      "expectedSpaceComplexity": "O(1)",
      "tags": ["string", "hashmap"],
      "examples": [
        {
          "input": { "s": "anagram", "t": "nagaram" },
          "output": true,
          "explanation": "Both strings contain the same character frequencies."
        }
      ],
      "hints": ["Count character frequencies.", "Compare both frequency maps."],
      "followUps": ["Can you solve without sorting?"]
    }
  ],
  "testcases": [
    {
      "questionId": 3,
      "input": { "s": "anagram", "t": "nagaram" },
      "expectedOutput": true,
      "isSample": true,
      "isHidden": false
    },
    {
      "questionId": 3,
      "input": { "s": "rat", "t": "car" },
      "expectedOutput": false,
      "isSample": false,
      "isHidden": true
    }
  ]
}'
```

#### Testcases-only (bare array also accepted)

```bash
curl --location 'http://localhost:3303/questions/bulk' \
  --header 'Content-Type: application/json' \
  --header "Authorization: Bearer $TOKEN" \
  --data '[
    {
      "questionId": 3,
      "input": { "s": "anagram", "t": "nagaram" },
      "expectedOutput": true,
      "isSample": true,
      "isHidden": false
    }
  ]'
```

Or upload from a file:

```bash
curl --location 'http://localhost:3303/questions/bulk' \
  --header 'Content-Type: application/json' \
  --header "Authorization: Bearer $TOKEN" \
  --data @bulk-upload.json
```

#### Backfill questions missing examples / hints / follow-ups

Older uploads may only have question metadata and test cases. Re-upload with the same `title` to update metadata and populate related collections:

```bash
curl --location 'http://localhost:3303/questions/bulk' \
  --header 'Content-Type: application/json' \
  --header "Authorization: Bearer $TOKEN" \
  --data '{
  "questions": [
    {
      "questionId": 1,
      "title": "Two Sum",
      "category": "Arrays & Hashing",
      "pattern": "HashMap Lookup",
      "difficulty": "Easy",
      "problemStatement": "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
      "constraints": [
        "2 <= nums.length <= 10^4",
        "-10^9 <= nums[i] <= 10^9",
        "Exactly one solution exists"
      ],
      "expectedTimeComplexity": "O(n)",
      "expectedSpaceComplexity": "O(n)",
      "tags": ["array", "hashmap"],
      "examples": [
        {
          "input": { "nums": [2, 7, 11, 15], "target": 9 },
          "output": [0, 1],
          "explanation": "nums[0] + nums[1] == 9."
        }
      ],
      "hints": [
        "Use a hash map to store seen values.",
        "For each num, check if target - num exists in the map."
      ],
      "followUps": [
        "What if the array is sorted?",
        "What if there are multiple valid pairs?"
      ]
    }
  ]
}'
```

Use `https://service.algoarena.co.in` instead of `localhost:3303` for production.

**Response:**

```json
{
  "questions": { "upserted": 1, "modified": 0, "updatedByTitle": 0 },
  "examples": { "inserted": 1 },
  "hints": { "inserted": 2 },
  "followUps": { "inserted": 1 },
  "testcases": { "inserted": 2, "upsertedQuestionIds": 1 }
}
```

#### Question fields reference

| Field | Required | Description |
|-------|----------|-------------|
| `questionId` | Yes | Unique numeric ID |
| `title` | Yes | Used for title-based upsert matching |
| `category` | Yes | e.g. `Arrays & Hashing` |
| `pattern` | Yes | e.g. `HashMap Lookup` |
| `difficulty` | Yes | `Easy`, `Medium`, or `Hard` |
| `problemStatement` | Yes | Full problem text |
| `constraints` | Yes | Array of constraint strings |
| `tags` | Yes | Array of tag strings |
| `expectedTimeComplexity` | No | e.g. `O(n)` |
| `expectedSpaceComplexity` | No | e.g. `O(1)` |
| `examples` | No | `{ input, output, explanation? }[]` → saved to `examples` |
| `hints` | No | `string[]` → saved to `hints` |
| `followUps` | No | `string[]` → saved to `follow_ups` (interview-style extensions, e.g. “Can you solve without sorting?”) |

---

## Postman

Import:

```
docs/services.postman_collection.json
```

Set the `accessToken` collection variable with your JWT from auth-service.

---

## Shared database schema (`db-schema` submodule)

```
db-schema/
├── postgres/prisma/          # User, Session, RefreshToken
└── mongodb/schemas/
    ├── question.schema.ts    → collection: questions
    ├── example.schema.ts     → collection: examples
    ├── hint.schema.ts        → collection: hints
    ├── follow-up.schema.ts   → collection: follow_ups
    ├── test-case.schema.ts   → collection: test_cases
    ├── submission.schema.ts  → collection: submissions
    ├── user-progress.schema.ts
    ├── note.schema.ts
    ├── bookmark.schema.ts
    └── activity-log.schema.ts
```

After pulling schema updates:

```bash
npm run submodule:pull
npm run prisma:generate
```

---

## Project structure

```
src/
├── auth/           # Global JWT guard + middleware
├── common/         # Exception filter, current-user decorator
├── config/         # Environment configuration
├── health/         # GET /health
├── profile/        # GET /profile
├── questions/      # List, detail, bulk upload
├── prisma/         # PostgreSQL client
└── mongodb/        # MongoDB connection + schema registration
db-schema/          # Git submodule (shared schemas)
docs/               # Postman collection
```

---

## Related services

| Service | Port | Purpose |
|---------|------|---------|
| auth-service | `3302` | Login, signup, JWT issuance |
| services (this) | `3303` | Questions, profile, coding platform data (local) |
| services (production) | `443` | `https://service.algoarena.co.in` |

---

## Learn more

- [NestJS documentation](https://docs.nestjs.com/)
- [Prisma documentation](https://www.prisma.io/docs)
- [Mongoose NestJS integration](https://docs.nestjs.com/techniques/mongodb)
