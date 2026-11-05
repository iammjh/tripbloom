# Workflow verification

From the repository root:

```sh
npm run test:workflows --prefix backend
npm run test:workflows --prefix frontend
npm run build --prefix frontend
```

The unit suites use Node's built-in test runner and installed application dependencies. No package installation is performed by these commands.

For real MongoDB/HTTP verification, provide an absolute path to a MongoDB Community `mongod` executable:

```sh
MONGOD_BINARY=/absolute/path/to/mongod npm run test:integration --prefix backend
MONGOD_BINARY=/absolute/path/to/mongod npm run test:browser --prefix backend
```

The browser command includes the database/HTTP scenarios. It requires Node >=22 for native WebSocket, plus Chrome (default macOS path `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`; override with `CHROME_BINARY`). Verified runtime: Node 24.22.0, MongoDB 8.0.17 macOS arm64, Chrome 156.0.8078.81.

Each integration run creates a fresh loopback-only single-member replica set, temporary upload directory and synthetic accounts. It never loads `.env`, accepts a database URI, or uses the configured database. The browser run creates a fresh headless Chrome profile, submits synthetic receipt references and verifies administrator decisions. Remote stock images/fonts are blocked; local API/module errors and runtime exceptions fail the checks. A deliberately injected queue HTTP 503 checks visible error/retry behavior. Processes, database files, uploads and browser profile are cleaned up afterward; the supplied executable is left intact.

`app.js` exposes the actual Express middleware/routes without connecting to a database or scheduling jobs. `index.js` remains the normal entry point, requires MONGODB_URI/JWT_SECRET, and starts the existing scheduled job. Normal application booking/payment/lifecycle writes require a MongoDB replica set or supported Atlas deployment; standalone transaction rejection is tested as HTTP 503.

No payment gateway is exercised. Customer submissions are claims; an administrator checks the external receipt before approval. Manual refund recording does not transfer money. Legacy SUCCESS receipts retain their stored meaning and are labeled as recorded receipts rather than independently verified settlement.
