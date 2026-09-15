# Ride Nepaljung

An original MERN ride-sharing platform for Nepalgunj, Nepal: three responsive React applications and a shared Express API backed by MongoDB. The title **Ride Nepaljung** replaces the placeholder name in the supplied brief.

The implemented core connects real passenger and driver accounts: estimate → request → nearby offers → atomic acceptance → arrival → PIN verification → trip tracking → completion → payment record → two-way ratings → history. The interface uses original green, cream, and muted gold styling with Sajilo, Sathi, Parivar, and Hariyo ride categories.

## Quick local preview

Requires Node.js 22.12+ and npm. First installation and the temporary MongoDB download require internet access. Linux also needs the system libraries required by MongoDB 7.

```bash
npm install
npm run demo
```

This starts a **real temporary MongoDB replica set**, seeds development data, and launches all four services. Its data is discarded when stopped. It does not simulate drivers or fabricate ride progress.

| App       | Preview URL           | Development login      |
| --------- | --------------------- | ---------------------- |
| Passenger | http://localhost:5183 | `passenger1@ride.test` |
| Driver    | http://localhost:5184 | `driver2@ride.test`    |
| Admin     | http://localhost:5185 | `admin@ride.test`      |

The temporary preview password is **`LocalRide-2026!`**, exclusively for these fake local accounts. The demo creates random authentication secrets at startup. Never use these accounts in a public deployment.

### Try a complete ride

1. Sign in to the passenger app. Pickup defaults to B. P. Chowk. Select Dhamboji Chowk, choose **Sathi**, and get estimates.
2. Open the driver app in another tab, sign in as `driver2@ride.test`, allow browser location access, and go online. This driver has a Sathi car. Other seeded categories: driver1 = Sajilo, driver3 = Parivar, driver4 = Hariyo.
3. The driver must be within 10 km of the pickup. For local evaluation outside Nepalgunj, use Chrome DevTools → More tools → Sensors to set latitude `28.0572`, longitude `81.6194`. The app does not secretly relocate drivers.
4. Request the ride as the passenger. Accept the real offer as the driver before it expires.
5. Click **I’ve arrived**, obtain the passenger’s private PIN, and start the trip.
6. Complete the ride. Cash is recorded as pending until finance confirms collection; wallet and enabled mock-card payments settle immediately.
7. Both participants can rate once, view the trip in history, and download a plain-text receipt.

Passenger, driver, and admin refresh cookies have different names, so these apps can share a browser without overwriting one another’s sessions.

## Persistent development setup

```bash
npm install
npm run setup                  # Creates an ignored .env; never overwrites it
npm run db                     # Starts MongoDB and initializes replica set rs0
npm run seed                   # Refuses to seed a nonempty database
npm run dev
```

Persistent development ports are 5173 (passenger), 5174 (driver), 5175 (admin), and 4000 (API). The servers use strict ports; close your own conflicting service or set `PASSENGER_PORT`, `DRIVER_PORT`, and `ADMIN_PORT`, and update `CLIENT_URL` accordingly.

Run apps separately:

```bash
npm run dev -w server
npm run dev -w apps/passenger-web
npm run dev -w apps/driver-web
npm run dev -w apps/admin-web
```

Use a MongoDB replica set, including for local development: transactions protect ride assignment, wallets, promo redemption, and ratings. A standalone MongoDB instance is insufficient. Atlas can be used by setting `MONGODB_URI` to your replica-set connection URI.

### Environment variables

`.env.example` contains the configuration template. The backend reads the repository-root `.env` independently of its working directory. Runtime environment variables take precedence.

| Variable                                      | Purpose                                                                            |
| --------------------------------------------- | ---------------------------------------------------------------------------------- |
| `NODE_ENV`                                    | `development`, `test`, or `production`                                             |
| `PORT`                                        | API port, default 4000                                                             |
| `MONGODB_URI`                                 | MongoDB replica-set URI                                                            |
| `JWT_ACCESS_SECRET`                           | At least 32 characters; generated randomly by setup                                |
| `JWT_REFRESH_SECRET`                          | Independent secret used when hashing opaque refresh tokens                         |
| `CLIENT_URL`                                  | Comma-separated exact browser origins for CORS and origin validation               |
| `ENABLE_MOCK_PAYMENTS`                        | Enables mock card and test wallet credits only outside production                  |
| `ROUTING_URL`                                 | OSRM-compatible routing service base URL                                           |
| `GEOCODING_URL`                               | Nominatim-compatible geocoding service base URL                                    |
| `MAP_PROVIDER`, `MAP_API_KEY`                 | Reserved configuration for future providers; current UI uses OpenStreetMap/Leaflet |
| `SEED_PASSWORD`                               | Development-only seed password, at least 10 characters                             |
| `PASSENGER_PORT`, `DRIVER_PORT`, `ADMIN_PORT` | Optional Vite development ports                                                    |
| `API_PROXY_TARGET`                            | Optional Vite API/WebSocket proxy target                                           |
| `VITE_API_URL`, `VITE_SOCKET_URL`             | Optional public frontend endpoint URLs; never place secrets in Vite variables      |
| `CHROMIUM_PATH`                               | Browser-test executable; defaults to `/usr/bin/chromium`                           |

The setup command uses a known development seed password and unique random JWT secrets. Replace the seed password if running outside an isolated local machine. `.env`, credentials, database files, dependency folders, and build outputs are ignored by Git.

## Features delivered

### Passenger

- Registration, login, rotating refresh sessions, single-device and all-device logout.
- Profile details, profile image URL, phone, emergency contact, and saved places.
- Interactive OSM map, place search, local destination shortcuts, reverse geocoding for GPS pickup, manual map selection, pickup/destination swap, and up to two intermediate stops.
- Four configurable ride categories with capacity, transparent fare breakdown, fixed/percentage promos, and bounded demand pricing.
- Immediate rides and scheduled dispatch, live assignment/status/location updates, driver/vehicle/contact details, private trip PIN, and cancellation with reasons.
- Cash, transactional wallet payments, explicit development mock cards, immutable application-level wallet ledger, history, downloadable receipts, and two-way ratings.
- In-app notifications, support requests, safety incident recording, and expiring private tracking links.

### Driver

- Separate mobile interface, account and vehicle document URL submission, approval gating, GPS online/offline presence, short-lived geospatial locations, and expiring offers.
- Atomic accept/reject workflow; arrival, PIN start, live location heartbeat, completion, and trip history.
- Earnings over rolling 24-hour, 7-day, and 30-day windows; commission-aware cash and electronic payment accounting.
- External map navigation, ratings, support, and profile management.

### Administration

- Four backend roles: super, operations, support, and finance. Individual actions enforce role permissions; lower-privilege users may see a permission message for a sidebar section they cannot access.
- Dashboard totals, rides by day/category, active pickup areas, average fares, cancellations, gross fares, and commission.
- Driver document/vehicle review and approve/reject/suspend actions; passenger suspension/restoration.
- Ride monitoring, payment records, cash collection confirmation, promo creation, support ticket states, and safety incident resolution.
- Editable category fares, configurable demand multiplier cap and enable switch, and transactional audit records for administrative mutations.

## Architecture

```text
apps/
  passenger-web/       Vite entry, passenger port
  driver-web/          Vite entry, driver port
  admin-web/           Vite entry, admin port
server/
  src/
    config/             Validated environment and database connection
    controllers/        Authentication request handlers
    middleware/         Session authentication and role checks
    models/             Mongoose schemas, unique and geospatial indexes
    routes/             Validated HTTP endpoints
    services/           Fare, maps, matching, lifecycle, payment, auth, events
    sockets/            Authenticated identity-derived Socket.IO rooms
    jobs/               Scheduled dispatch, expanding matching, stale presence
    utils/              Errors and structured redacted logging
    validators/         Zod request schemas
  tests/                Unit and real replica-set integration tests
shared/
  constants/            Brand, categories, state transitions, local places
  types/                Type declarations for shared contracts
  ui/                   Reusable React screens, API client, hooks, maps, styles
scripts/                Local setup, transient preview, nginx proxy
```

Runtime code is JavaScript/JSX with Zod boundary validation; `shared/types` documents contracts. It is not a fully TypeScript codebase.

### Ride and payment invariants

- Passenger `activeRide` is reserved transactionally. In this MVP a scheduled ride also occupies the passenger’s single active booking slot.
- Matching considers approved, online, available drivers, approved category-matching vehicles, fresh GPS, distance, rating, acceptance score, and idle time. Radius grows 2 → 4 → 7 → 10 km in approximately 25-second rounds. Up to three new drivers receive a 22-second offer each round. Unique ride/driver offers prevent duplicates.
- Acceptance claims both the driver and searching ride in one transaction. A losing concurrent acceptance rolls back driver availability.
- State changes are validated server-side against explicit transitions. Drivers cannot cancel after a trip starts; passengers can cancel active trips. Cancellation fees are not charged.
- PINs are generated with cryptographic randomness, hashed with bcrypt, and never included in offer/discovery data. The passenger receives the PIN once and can regenerate it before start. Repeated incorrect attempts temporarily lock verification.
- Completion creates one unique payment and unique ledger entries in the same transaction as the final ride state and availability release. Insufficient wallet balance leaves the trip in progress; passengers can switch to cash.
- Cash is **pending collection**, not automatically declared paid. Finance confirms collection. Cash commission is debited from the driver wallet; cash earnings are physically held by the driver.
- Promo redemption is reserved at request time; cancelled rides do not restore promo eligibility, preventing cancellation/reuse abuse.
- Final fares use accepted pricing, recorded duration, and accumulated GPS distance. If GPS distance is missing or below 100 m, the quoted route distance is used. This is a documented estimate fallback, not a certified taximeter.

### Realtime architecture

Socket connections authenticate using the short-lived access token and join only server-derived `user:<id>` rooms. Admins also join `admins`. Clients cannot select rooms or mutate ride states over sockets; writes use validated REST routes. Events are `ride:offer`, `ride:updated`, `driver:location`, `notification`, and `safety:alert`. Clients refetch authorized resources on updates and reconcile active rides periodically. Socket sessions are revalidated every 15 seconds; tokens refresh every 12 minutes.

Driver GPS is sampled through browser geolocation with a stationary heartbeat. MongoDB stores only the latest point with a five-minute TTL. Matching requires a point from the last minute; stale idle drivers are marked offline. During trips, incremental distance is accumulated without permanent high-frequency location history.

`services/events.js`, `services/matching.js`, and `jobs/index.js` form the replacement boundaries for a Redis Socket.IO adapter, shared presence, distributed rate limits, durable queue workers, and dispatch locks. **Run one API/worker instance until those are implemented.** Database transactions still protect concurrent HTTP acceptance.

## Verification

```bash
npm run lint
npm test
npm run build
npm audit

# With npm run demo running in another terminal:
npm run test:e2e
```

Backend tests start an isolated MongoDB replica set and exercise authentication, refresh replay, role checks, validation, fare math, matching, concurrent acceptance, state changes, PIN privacy, payments, rollback, duplicate ratings, cancellation, secure tracking, and promo reuse. Browser tests drive the passenger and driver through an actual trip and check mobile navigation and admin rendering. Test screenshots/traces are written under ignored `test-results/`.

## Docker

```bash
npm run setup
docker compose up --build -d
# Seed once after the empty database is ready:
docker compose exec backend node server/src/seed.js
```

The supplied Compose configuration is for **local development**, with database and web/API ports bound to loopback. It includes MongoDB, a replica-set initializer, backend, and three nginx-served production frontend builds. Data persists in the named `mongo-data` volume. It is not a hardened public deployment configuration.

## Remaining integrations and operating limits

The core workflow is implemented; this repository is **not ready for an unattended public launch**. These parts of the original brief remain explicit follow-up work:

- Real payment provider integrations, real wallet top-ups, refunds, withdrawals, bonuses, and payment-provider webhook reconciliation. Never store raw card data.
- Email/SMS delivery, OTP verification, and end-user password recovery delivery. Reset-token validation and hashed one-time token fields exist, but the UI states recovery is coming soon and the API never exposes delivery tokens.
- Private binary document uploads, malware scanning, signed media URLs, and external driver identity verification. Current document review uses supplied URLs.
- Emergency dispatch integrations: SOS records an incident and notifies the admin console; it does **not** call police, an ambulance, or a user’s emergency contact.
- Push notifications, durable notification outbox/retries, Redis presence/socket scaling, distributed request limits, and production dispatch jobs.
- Advanced fraud detection, cancellation/payment-failure risk scoring, continuously learned acceptance rates, and region-specific demand windows. Current demand settings apply to the deployment as a whole.
- Production routing/geocoding/tile provider contracts, route-aware remaining ETA, accurate missed-GPS reconciliation, road navigation instructions, refund/cancellation charge policy, and load/penetration/accessibility audits.
- Driver withdrawals and bonuses are visibly marked coming soon. Public launch also requires backups, monitoring, database authentication, HTTPS, and operational staffing.

OpenStreetMap tiles and public routing/geocoding services require network access and are development defaults. Geocoding is cached and throttled in-process. If routing is unavailable, an explicitly labeled approximate route uses straight-line distance × 1.3 at an assumed 22 km/h. Set a suitable provider for sustained traffic. Only Leaflet/OpenStreetMap is currently wired; reserved provider environment fields do not automatically enable Google Maps or Mapbox.

See [API documentation](docs/API.md) and [implementation and verification notes](docs/IMPLEMENTATION.md).
