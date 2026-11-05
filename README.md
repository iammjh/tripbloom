# TripBloom

"Where Every Journey Blossoms."

TripBloom is a tour management and booking platform. Travellers browse and book personal tours and group departures, tour operators run the departures they are assigned to, and administrators manage packages, bookings, payments, users and content. A customer assistant answers travel questions from the live catalogue.

## Features

**Customers**
- Browse and search tour packages, then book a personal tour or a seat on a group departure
- Choose seats on the bus seat map and see live availability
- Booking codes (for example `#RL001`) shown the same way on bookings, refunds and date changes
- Record payments against a booking; an administrator verifies each one
- Request a date change, cancel a booking, check in, save packages and write reviews
- Chat with the tour operator on a booking
- Ask the TripBloom assistant about destinations, packages and the team

**Tour operators**
- Dashboard with today's departures, the next seven days and alerts
- My Departures: passengers, seat map, safety checks, incident log, start and close the tour
- My Bookings with operator notes, Itinerary editor for upcoming departures
- Messages with travellers and administrators, and announcements to a departure
- Profile, availability and identity verification

**Administrators**
- Packages, departures, operator assignments and departure edits
- Bookings, payment verification, refunds, date-change decisions and completion
- Users: roles, suspension and signup bonuses
- Reviews moderation, announcements, contact inbox, KYC review, activity logs and system settings
- Platform metrics

## Technology

- **Frontend:** React 18, Vite, React Router, Tailwind CSS, react-icons
- **Backend:** Node.js (20 or later), Express 4, Mongoose 8 with MongoDB, JWT sign-in, bcrypt, node-cron, multer, express-rate-limit, helmet
- **Assistant:** Groq (default when its key is set) or Anthropic, or any OpenAI-compatible endpoint

## Repository layout

```
backend/    Express API (app.js, controllers, services, models, tests, scripts)
frontend/   React application (src/, tests/, vercel.json)
specs/      Feature specifications, plans, tasks and verification records
Documentation/  Requirements and class diagram
DEPLOYMENT.md   Step-by-step hosting guide (Render backend, Vercel frontend)
```

## Getting started

Requirements: Node.js 20 or later, npm 10 or later, and a MongoDB database (local or Atlas).

```bash
# 1. Install dependencies
npm run install-all

# 2. Configure the API (see "Configuration" below)
cp .env.example .env            # or copy into backend/.env

# 3. Start the API and the frontend together
npm run dev
```

- The frontend runs on http://localhost:5173 and calls the API through the Vite proxy.
- The API runs on the `PORT` you set (default 5001).

Build the frontend for production from the repository root:

```bash
npm run build --prefix frontend
```

## Configuration

Create `.env` in the repository root (or `backend/.env`). The backend loads `backend/.env` first, then the root `.env`.

| Variable | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | yes | MongoDB connection string |
| `JWT_SECRET` | yes | Secret for signing sign-in tokens. Use a long random value |
| `PORT` | no | API port (default 5001) |
| `NODE_ENV` | recommended | Set to `production` on the host. This stops localhost origins being accepted by CORS |
| `FRONTEND_URL`, `CORS_ORIGIN` | for hosted frontends | Extra origins allowed by CORS |
| `KYC_UPLOAD_DIR` | no | Where identity documents are stored (default `backend/uploads/kyc`) |
| `HOME_COUNTRY` | no | Used by the platform settings |
| `ASSISTANT_PROVIDER` | no | `groq`, `anthropic` or `openai-compatible`. Chosen automatically when left empty |
| `GROQ_API_KEY` | for the assistant | Groq key (server-side only) |
| `ANTHROPIC_API_KEY` | for the assistant | Anthropic key (server-side only) |
| `ASSISTANT_BASE_URL`, `ASSISTANT_API_KEY`, `ASSISTANT_MODEL` | for `openai-compatible` | Endpoint, key and model |
| `ASSISTANT_MODEL` | no | Model name for Groq or Anthropic |
| `ASSISTANT_DAILY_LIMIT` | no | Assistant questions allowed per day across all visitors (default 300) |
| `LOGIN_RATE_LIMIT` | no | Failed sign-ins per address per 15 minutes (default 20) |
| `SIGNUP_RATE_LIMIT` | no | Sign-ups per address per hour (default 10) |
| `CONTACT_RATE_LIMIT`, `NEWSLETTER_RATE_LIMIT` | no | Submissions per address per hour (default 10 each) |

The frontend reads `VITE_API_URL` (see `frontend/.env.example`). Keep it as `/api` in production; `frontend/vercel.json` forwards `/api` and `/uploads` to the backend.

Never commit `.env` files. The examples in the repository contain placeholders only.

## Scripts

| Command | Where | What it does |
|---|---|---|
| `npm run dev` | root | API and frontend together |
| `npm run build --prefix frontend` | root | Production build of the frontend |
| `npm start` | `backend/` | Start the API |
| `npm run backfill:booking-codes` | `backend/` | Give existing bookings a booking code (run once) |
| `npm run report:legacy-passwords` | `backend/` | Count accounts whose password is still stored without bcrypt (read-only) |
| `npm run test:workflows` | `backend/` | Unit tests for services, controllers and helpers |
| `npm run test:integration` | `backend/` | Scenarios against a real MongoDB (set `MONGOD_BINARY`) |
| `npm run test:browser` | `backend/` | Browser checks in Chrome (set `MONGOD_BINARY`; `CHROME_BINARY` if Chrome is elsewhere) |
| `npm run test:workflows` | `frontend/` | Unit tests for the frontend helpers |

Browser checks save screenshots when `SCREENSHOT_DIR` is set.

## Security

- Sign-in tokens are checked against the account on every request, so suspension or a role change takes effect at once. Changing a password ends every other session. Tokens last 24 hours.
- Access is checked for each booking, departure, message, review and KYC document. Operators see only their own departures and bookings. Contact details of other operators are hidden from customers and from other operators.
- Rate limits apply to sign-in, sign-up, contact, newsletter and the assistant.
- Passwords must be 8 to 72 bytes. Passwords are stored with bcrypt; older plaintext passwords are upgraded when their owner next signs in.
- Uploaded identity documents must match their file type, are served only to their owner or an administrator, and are never public.
- Security headers come from helmet on the API and from `frontend/vercel.json`. The content security policy is in report-only mode while it is checked.
- Dependencies: run `npm audit --omit=dev` in `backend/` and `frontend/` before each release.

## Deployment

`DEPLOYMENT.md` describes the free setup used so far: the backend on Render and the frontend on Vercel, with `frontend/vercel.json` forwarding `/api` and `/uploads` to Render. Set `NODE_ENV=production` on Render, and set the variables in the table above.

## Documentation

- `specs/` holds one folder per feature with its specification, plan, tasks and verification record. The most recent are `005-customer-ai-assistant`, `006-operator-dashboard-redesign` and `007-operator-workspace`.
- `Documentation/` holds the functional and non-functional requirements and the class diagram.

## Roadmap

- Mobile apps (iOS and Android)
- Multi-currency and multi-language support
- Dynamic pricing and discounts
- Third-party integrations (hotels, flights, local experiences)
- Loyalty programmes for repeat travellers

## Contact

Project: TripBloom, "Where Every Journey Blossoms"

Maintainer: MD. JAHIDUL HASAN (md.jahidul.hasan.bucc@gmail.com)
[iammjh](https://iammjh.github.io) · [GitHub](https://github.com/iammjh) · [LinkedIn](https://linkedin.com/in/iammjh)

## Licence

See [LICENSE](LICENSE).
