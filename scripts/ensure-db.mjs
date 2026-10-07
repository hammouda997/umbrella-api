import { readFileSync } from 'node:fs';
import { Client } from 'pg';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const match = env.match(/^DATABASE_URL="?([^\r\n"]+)/m);
if (!match) throw new Error('DATABASE_URL missing');

const url = new URL(match[1]);
const dbName = url.pathname.replace(/^\//, '');
const adminUrl = new URL(match[1]);
adminUrl.pathname = '/postgres';

const client = new Client({ connectionString: adminUrl.toString() });
await client.connect();
const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
if (existing.rowCount === 0) {
  await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '')}"`);
  console.log(`created ${dbName}`);
} else {
  console.log(`exists ${dbName}`);
}
await client.end();
