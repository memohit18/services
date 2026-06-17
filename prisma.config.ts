import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'db-schema/postgres/prisma/schema.prisma',
  migrations: {
    path: 'db-schema/postgres/prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
