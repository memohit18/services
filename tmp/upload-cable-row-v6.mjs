import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '../.env') });

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET;
const publicUrl = (process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, '');
const databaseUrl = process.env.DATABASE_URL;
if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl || !databaseUrl) {
  console.error('missing config');
  process.exit(1);
}

const key = 'catalog/workout-gifs/v6/seated-cable-rows.gif';
const body = readFileSync('/tmp/cable-lock/seated-cable-rows-v6.gif');
const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});
await s3.send(new PutObjectCommand({
  Bucket: bucket,
  Key: key,
  Body: body,
  ContentType: 'image/gif',
  CacheControl: 'public, max-age=31536000, immutable',
}));
const url = `${publicUrl}/${key}`;
const db = new pg.Client({ connectionString: databaseUrl });
await db.connect();
const result = await db.query(
  `UPDATE "ExerciseMaster" SET "imageUrl" = $1 WHERE lower(name) = 'seated cable rows'`,
  [url],
);
const check = await db.query(
  `SELECT name, "imageUrl" FROM "ExerciseMaster" WHERE lower(name) = 'seated cable rows'`,
);
await db.end();
console.log(`uploaded ${body.length}`);
console.log(`updated ${result.rowCount}`);
console.log(check.rows.map((row) => `${row.name} ${row.imageUrl}`).join('\n'));
if (result.rowCount !== 1) process.exit(1);
