import type { D1Database } from '@cloudflare/workers-types';

/**
 * A fixed-window counter in D1: true while `key` has made at most `limit` requests in the
 * current `windowSec`. One upsert per request; old windows are swept now and then.
 */
export async function allow(
  db: D1Database,
  key: string,
  limit: number,
  windowSec: number,
  now = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  const start = now - (now % windowSec);
  const row = await db
    .prepare(
      'INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1) ' +
        'ON CONFLICT (key, window_start) DO UPDATE SET count = count + 1 RETURNING count',
    )
    .bind(key, start)
    .first<{ count: number }>();
  if (Math.random() < 0.02)
    await db
      .prepare('DELETE FROM rate_limits WHERE window_start < ?')
      .bind(now - 86400)
      .run();
  return (row?.count ?? 0) <= limit;
}
