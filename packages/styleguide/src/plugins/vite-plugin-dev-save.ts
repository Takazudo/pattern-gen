/**
 * Vite plugin: dev-only file-save endpoint for live HMR.
 *
 * Adds a POST /api/save-source middleware to the Vite dev server.
 * When the code panel edits a component source file, it POSTs here,
 * the plugin writes the file to disk, and Vite's native HMR picks up
 * the change automatically.
 *
 * This middleware only exists in dev mode (configureServer is not
 * called during production builds), so no adapter is needed.
 */

import type { Plugin } from 'vite';
import { writeFile } from 'node:fs/promises';
import { resolve, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Directory where story globs originate — relative paths in
 * RelatedSource.relativePath are resolved against this.
 */
const DATA_DIR = fileURLToPath(new URL('../data/', import.meta.url));

/** Only allow writes inside the viewer's src/ directory (where components and stories live). */
const COMPONENTS_DIR = normalize(resolve(DATA_DIR, '../../../pattern-gen-viewer/src'));

function jsonResponse(
  res: import('http').ServerResponse,
  status: number,
  body: Record<string, unknown>,
): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export function devSavePlugin(): Plugin {
  return {
    name: 'sg-dev-save',
    configureServer(server) {
      server.middlewares.use('/api/save-source', async (req, res) => {
        if (req.method !== 'POST') {
          jsonResponse(res, 405, { error: 'Method not allowed' });
          return;
        }

        const MAX_BODY = 2 * 1024 * 1024; // 2 MB
        let body = '';
        for await (const chunk of req) {
          body += chunk;
          if (body.length > MAX_BODY) {
            jsonResponse(res, 413, { error: 'Payload too large' });
            return;
          }
        }

        let parsed: { relativePath?: string; content?: string };
        try {
          parsed = JSON.parse(body);
        } catch {
          jsonResponse(res, 400, { error: 'Invalid JSON' });
          return;
        }

        const { relativePath, content } = parsed;

        if (typeof relativePath !== 'string' || typeof content !== 'string') {
          jsonResponse(res, 400, { error: 'Missing relativePath or content' });
          return;
        }

        // Resolve the glob-relative path against the data directory
        const absPath = normalize(resolve(DATA_DIR, relativePath));

        // Security: path must be inside components/
        if (!absPath.startsWith(COMPONENTS_DIR + sep)) {
          jsonResponse(res, 403, { error: 'Path outside components directory' });
          return;
        }

        try {
          await writeFile(absPath, content, 'utf-8');
          jsonResponse(res, 200, { ok: true });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          console.error(`[sg-dev-save] Write failed: ${message}`);
          jsonResponse(res, 500, { error: 'Write failed' });
        }
      });
    },
  };
}
