// Writes db/seed.sql (npm run db:seed:gen; bundled by esbuild, run by node).
import { writeFileSync } from 'node:fs';
import { seedSql } from './seed';

writeFileSync('db/seed.sql', seedSql());
console.log('db/seed.sql written');
