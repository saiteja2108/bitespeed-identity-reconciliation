# Bitespeed Identity Reconciliation Service

A backend service that reconciles identities (contacts) following Bitespeed business rules.

Overview
- POST /identify: identify/merge contacts by `email` and/or `phoneNumber`.
- Contacts link when they share email or phone.
- The oldest contact by `createdAt` is the primary.
- When primaries conflict, newer primaries become secondaries and are linked to the oldest.
- New information creates a secondary linked to the primary.

Tech stack
- Node.js + TypeScript
- Express
- Prisma ORM
- PostgreSQL

Quick start

1. Install deps

```bash
npm install
```

2. Create `.env` file from `.env.example` and set `DATABASE_URL` to your Postgres instance.

3. Generate Prisma client and run migrations

```bash
npm run prepare
npx prisma migrate dev --name init
```

4. Run in development

```bash
npm run dev
```

API

POST /identify

Request body (JSON):

```json
{
	"email": "user@example.com",
	"phoneNumber": "+15551234567"
}
```

Response:

```json
{
	"contact": {
		"primaryContactId": 1,
		"emails": ["primary@example.com", "other@example.com"],
		"phoneNumbers": ["+15551234567"],
		"secondaryContactIds": [2, 3]
	}
}
```

Notes & business rules
- `deletedAt` is present in the model but not used by reconciliation logic.
- Responses contain deduplicated emails/phoneNumbers and list primary contact's email/phone first if present.

Deploying to Render (high-level)

1. Create a new Web Service on Render and connect your GitHub repo.
2. Set the build command and start command. Use the following so dev dependencies
   (like TypeScript types) are available during compilation:

   ```bash
   npm install --include=dev && npm run build && npm run prepare && npx prisma migrate deploy
   ```

   and set the start command to:

   ```bash
   npm start
   ```
3. Configure environment variables on Render:
	 - `DATABASE_URL` -> your Postgres connection string
	 - `PORT` (optional)
4. Add a Render Post-deploy hook to run migrations if needed, or configure a deployment script to run:

```bash
npx prisma migrate deploy
```

Database
- Prisma schema is under `prisma/schema.prisma`.
- Use `prisma generate` to create the client.

Repository
- Main server entry: `src/index.ts`
- Route: `src/routes/identify.ts`
- Service logic: `src/services/contactService.ts`

Examples & testing
- Use `curl` or Postman to POST to `/identify` with JSON body.

## Live Deployment

The service is deployed and live on Render:

**Base URL:** `https://bitespeed-identity-reconciliation-6zxf.onrender.com`

### Example Request

```bash
curl -X POST https://bitespeed-identity-reconciliation-6zxf.onrender.com/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","phoneNumber":"1234567890"}'
```

### Example Response

```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["user@example.com"],
    "phoneNumbers": ["1234567890"],
    "secondaryContactIds": []
  }
}
```

Contributing
- Follow conventional commits for meaningful commit messages.

License
- MIT