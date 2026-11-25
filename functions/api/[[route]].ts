import { handle } from 'hono/cloudflare-pages';
import { app } from '../../server/app';

/** Every /api/* request goes to the Hono app (server/app.ts). */
export const onRequest = handle(app);
