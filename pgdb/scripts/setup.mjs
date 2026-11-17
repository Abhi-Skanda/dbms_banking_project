// Usage: node --env-file=.env.local db/scripts/setup.mjs [--reset]
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const reset = process.argv.includes('--reset');
const sqlDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'sql');

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  const files = (await readdir(sqlDir)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    if (file.startsWith('00_') && !reset) continue;   // reset script only with --reset
    process.stdout.write(`Running ${file} ... `);
    await client.query(await readFile(path.join(sqlDir, file), 'utf8'));
    console.log('ok');
  }
  console.log('\nDatabase ready.');
} catch (err) {
  console.error('\nFailed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}