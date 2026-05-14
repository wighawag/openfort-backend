# Openfort Backend

A platform-agnostic backend server for Openfort wallet infrastructure, providing encryption session management. Runs on Cloudflare Workers, Node.js, or any JavaScript runtime.

## Architecture

```
├── packages/
│   └── server/          # Core server logic (platform-agnostic)
│       ├── src/
│       │   ├── index.ts      # Main server entry, exports createServer()
│       │   ├── types.ts      # ServerOptions type definition
│       │   ├── setup.ts      # Middleware for request context
│       │   ├── env.ts        # Environment type (Openfort + Shield vars)
│       │   └── api/          # API route handlers
│       │       └── encryption-session.ts  # Openfort Shield encryption session
│       └── src/schema/sql/   # SQL schema files
│
└── platforms/
    ├── cf-worker/       # Cloudflare Workers platform adapter
    └── nodejs/          # Node.js platform adapter
```

### Key Concept: Dependency Injection

The server achieves platform agnosticism through dependency injection. The core server doesn't know how to access the database or environment - it receives these through callbacks:

```typescript
export type ServerOptions<Env extends Bindings = Bindings> = {
  getDB: (c: Context<{Bindings: Env}>) => RemoteSQL;
  getEnv: (c: Context<{Bindings: Env}>) => Env;
};
```

Each platform provides its own implementation of these functions.

## API Endpoints

### Encryption Session

`POST /api/protected-create-encryption-session`

Creates an encryption session via the Openfort Shield API, required for `RecoveryMethod.AUTOMATIC` wallet recovery flows.

**Response:**
```json
{ "session": "session_id_string" }
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SHIELD_API_KEY` | Yes | Shield API key |
| `SHIELD_SECRET_KEY` | Yes | Shield API secret |
| `SHIELD_ENCRYPTION_SHARE` | Yes | Encryption share for recovery |
| `SHIELD_BASE_PATH` | No | Custom Shield API base URL (default: `https://shield.openfort.io`) |
| `DEV` | No | Enable debug mode (exposes error details) |

## Getting Started

### Prerequisites

- Node.js (v18+)
- pnpm
- (Optional) zellij - for running multiple processes

### Installation

```bash
pnpm install
```

### Development

Run everything (requires zellij):
```bash
pnpm start
```

Or run individual platforms:

**Cloudflare Worker:**
```bash
pnpm cf-worker:dev
```

**Node.js:**
```bash
cd platforms/nodejs && pnpm dev
```

### Running Tests

```bash
pnpm test
```

## Adding API Routes

Create new route files in `packages/server/src/api/`:

```typescript
// packages/server/src/api/my-endpoint.ts
import { Hono } from 'hono';
import { ServerOptions } from '../types.js';
import { setup } from '../setup.js';
import { Env } from '../env.js';

export function getMyAPI<CustomEnv extends Env>(
  options: ServerOptions<CustomEnv>,
) {
  const app = new Hono<{Bindings: CustomEnv}>()
    .use(setup({serverOptions: options}))
    .get('/', async (c) => {
      const config = c.get('config');
      const env = config.env;
      return c.json({ hello: 'world' });
    });

  return app;
}
```

Register it in `packages/server/src/index.ts`:

```typescript
import { getMyAPI } from './api/my-endpoint.js';

// Inside createServer:
const myApi = getMyAPI(options);

return app
  .use('/*', corsSetup)
  .route('/', dummy)
  .route('/api', encryptionSession)
  .route('/my-prefix', myApi)  // Add your route
  // ...
```

## Platform-Specific Notes

### Cloudflare Workers

- Uses D1 database via `remote-sql-d1`
- Environment variables configured in `wrangler.toml`
- Deploy with `pnpm deploy:production`

### Node.js

- Uses LibSQL (SQLite-compatible) via `remote-sql-libsql`
- Environment variables loaded from `.env` file
- Run with `pnpm dev` or build and run `node dist/cli.js`

## Adding a New Platform

Create a new platform directory under `platforms/`:

```typescript
// platforms/bun/src/index.ts
import { createServer, type Env } from 'openfort-backend-app';

type BunEnv = Env & { DB_PATH: string };
const env = process.env as BunEnv;
const db = new YourDBDriver(env.DB_PATH);

const app = createServer<BunEnv>({
  getDB: () => db,
  getEnv: () => env,
});

Bun.serve({ port: 3000, fetch: app.fetch });
```

## Type-Safe Client

The server exports a type-safe client for frontend usage:

```typescript
import { createClient, type Client } from 'openfort-backend-app';

const client: Client = createClient('http://localhost:3000');

// Type-safe API calls
const response = await client.api['protected-create-encryption-session'].$post();
```

## License

MIT