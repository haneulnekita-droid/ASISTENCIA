import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApiApp } from '../server/app.ts';

let appPromise: ReturnType<typeof createApiApp> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!appPromise) {
    appPromise = createApiApp().catch((err) => {
      appPromise = null;
      throw err;
    });
  }
  const app = await appPromise;

  await new Promise<void>((resolve, reject) => {
    const done = () => resolve();
    res.once('finish', done);
    res.once('close', done);
    res.once('error', reject);
    app(req as never, res as never);
  });
}
