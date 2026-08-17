# ATM Command Center

Production-oriented MERN application for importing official ATM status while preserving internal location, payment and assignment history.

## Run locally

1. Copy `.env.example` to `.env` and replace all secrets.
2. Start MongoDB (a replica set is recommended in production).
3. Run `npm install`, then `npm run dev`. This starts both the API and client.
4. Open `http://localhost:5321` (the API runs on `http://localhost:5322`).

The first start creates the configured admin account. Change its password configuration before deploying.

## Data safety model

- `official` fields are the only fields updated by Excel synchronization.
- `original` is set once when a Terminal ID first appears.
- `current` and `assignmentHistory` are changed only through the assignment workflow.
- Missing IDs are marked `official.sourcePresent=false`; records and history are never deleted.

## Production checklist

Use a managed MongoDB replica set with encrypted backups, terminate TLS at a reverse proxy/load balancer, store secrets in a secret manager, add malware scanning for uploads, centralize logs/alerts, and run multiple stateless API instances. Restrict `CLIENT_ORIGIN`, rotate JWT secrets, and replace the bootstrap password process with your identity-provider/user administration workflow.
