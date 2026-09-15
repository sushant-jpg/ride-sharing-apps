# Ride Nepaljung API

Base URL: `http://localhost:4000/api`. Send JSON. Protected endpoints accept `Authorization: Bearer <accessToken>`. The browser also sends `X-App-Role: passenger|driver|admin`, which selects a separate HttpOnly refresh cookie for each application; it does not grant privileges.

Errors have `{ "success": false, "message": "Readable message", "code": "ERROR_CODE" }`. Validation errors return 400; unauthenticated requests 401; disallowed roles/participants 403; missing records 404; conflicts 409; insufficient wallet funds 402; excessive requests 429. Internal errors do not expose stack traces.

## Authentication

| Method | Path                    | Input / result                                                             |
| ------ | ----------------------- | -------------------------------------------------------------------------- |
| POST   | `/auth/register`        | `name, email, phone, password, role` (PASSENGER or DRIVER only)            |
| POST   | `/auth/login`           | `email, password`; returns access token and safe user; sets refresh cookie |
| POST   | `/auth/refresh`         | Rotates cookie; returns new access token and user                          |
| POST   | `/auth/logout`          | Revokes the cookie’s session                                               |
| POST   | `/auth/logout-all`      | Auth required; revokes all user sessions                                   |
| POST   | `/auth/forgot-password` | `email`; generic response, delivery integration pending                    |
| POST   | `/auth/reset-password`  | `token, password`; consumes hashed one-time reset token                    |

Access tokens expire after 15 minutes. Opaque refresh tokens expire after seven days, are stored hashed, and rotate once. A replay revokes the session family. Registration creates the associated wallet and driver profile transactionally.

## Passenger and shared resources

| Method    | Path                                       | Input / behavior                                                   |
| --------- | ------------------------------------------ | ------------------------------------------------------------------ |
| GET/PATCH | `/users/profile`                           | Safe profile; patch `name, phone, emergencyContact, avatarUrl`     |
| GET/POST  | `/places`                                  | Saved places; create/upsert `label, place`                         |
| DELETE    | `/places/:id`                              | Delete own saved place                                             |
| GET       | `/maps/search?q=...`                       | Local destinations or cached geocoder results                      |
| GET       | `/maps/reverse?latitude=...&longitude=...` | Reverse geocode GPS                                                |
| POST      | `/rides/estimate`                          | Estimate all four categories                                       |
| POST      | `/rides`                                   | Create booking; returns `{ride, pin}` to passenger                 |
| GET       | `/rides/current`                           | Current active/scheduled ride, or null                             |
| GET       | `/rides/history`                           | Latest 100 participant rides                                       |
| GET       | `/rides/:id`                               | Participant/admin-authorized ride details                          |
| POST      | `/rides/:id/cancel`                        | `reason`; records actor, time, and reason                          |
| POST      | `/rides/:id/pin`                           | Passenger regenerates PIN before start                             |
| PATCH     | `/rides/:id/payment-method`                | `paymentMethod`; own uncompleted ride                              |
| POST      | `/rides/:id/rate`                          | `value` 1–5, optional `feedback`; once per participant             |
| GET       | `/rides/:id/receipt`                       | Ride and payment record                                            |
| POST      | `/rides/:id/share`                         | Secure tracking token, expires in two hours                        |
| GET       | `/tracking/:token`                         | Public token bearer: status, destination, latest driver point only |
| POST      | `/rides/:id/sos`                           | `{location: Place}`; records incident and emits admin alert        |
| GET       | `/wallet`                                  | Wallet balance                                                     |
| GET       | `/wallet/transactions`                     | Latest 100 immutable application ledger records                    |
| POST      | `/wallet/mock-credit`                      | `amount` integer 100–5000; development passengers only             |
| GET       | `/payments`                                | Own latest 100 payments                                            |
| GET       | `/notifications`                           | Own latest 100 notifications                                       |
| POST      | `/notifications/read`                      | Mark own notifications read                                        |
| GET/POST  | `/support`                                 | Own tickets; create `category, message, ride?`                     |

`Place` is `{address, latitude, longitude}`. Coordinates must be numbers within valid geographic bounds. Routes must be between 100 m and 150 km by straight-line stop sequence.

Example estimate/request body:

```json
{
  "pickup": {
    "address": "B. P. Chowk, Nepalgunj",
    "latitude": 28.0572,
    "longitude": 81.6194
  },
  "destination": {
    "address": "Dhamboji Chowk",
    "latitude": 28.0663,
    "longitude": 81.6204
  },
  "stops": [],
  "rideCategory": "sathi",
  "paymentMethod": "WALLET",
  "promoCode": "NAMASTE"
}
```

Optional `scheduledAt` is an ISO UTC timestamp between 10 minutes and 30 days ahead. A passenger has one active/scheduled booking slot. Up to two `stops` are accepted. Categories are `sajilo`, `sathi`, `parivar`, `hariyo`. Payment methods are `CASH`, `WALLET`, `MOCK_CARD` (development only). The estimate endpoint also validates promo eligibility; a separate promo-validation endpoint is not needed by the UI.

## Driver

| Method  | Path                          | Input / behavior                                                      |
| ------- | ----------------------------- | --------------------------------------------------------------------- |
| GET/PUT | `/drivers/profile`            | Profile and vehicle; submission resets approval and online status     |
| PATCH   | `/drivers/status`             | `{online, location?}`; approved driver and vehicle required           |
| PATCH   | `/drivers/location`           | `Place`; approved online driver, at least two seconds between updates |
| GET     | `/drivers/offers`             | Own unexpired offers without PIN/passenger contact                    |
| GET     | `/drivers/current-ride`       | Authorized assigned ride or null                                      |
| GET     | `/drivers/earnings`           | Rolling today/week/month totals from latest 1000 completed rides      |
| POST    | `/drivers/rides/:id/accept`   | Atomic assignment, unexpired offer required                           |
| POST    | `/drivers/rides/:id/reject`   | Reject own offer                                                      |
| POST    | `/drivers/rides/:id/arriving` | DRIVER_ASSIGNED → DRIVER_ARRIVING                                     |
| POST    | `/drivers/rides/:id/arrived`  | Assigned/arriving → DRIVER_ARRIVED                                    |
| POST    | `/drivers/rides/:id/start`    | `{pin}`; arrival and correct private PIN required                     |
| POST    | `/drivers/rides/:id/complete` | Final fare, transactional payment, availability release               |

Profile submission fields: `address, licenseNumber, licenseImage, identityDocument, vehicleRegistration, brand, model, year, plateNumber, color, category, seatCapacity, photoUrl`. Document/media inputs are URLs; uploads are not implemented.

## Administration

All endpoints require an admin role, with additional restrictions below. Mutations write audit records. Lists are capped at 100 records; cursor pagination is follow-up work.

| Method    | Path                                                                     | Roles                                                                                    |
| --------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| GET       | `/admin/dashboard`, `/admin/rides`                                       | All admin roles                                                                          |
| GET       | `/admin/drivers`, `/admin/drivers/:userId/vehicle`, `/admin/users?q=...` | Super, operations, support                                                               |
| PATCH     | `/admin/drivers/:userId/status`                                          | Super/operations; `status`: APPROVED, REJECTED, SUSPENDED                                |
| PATCH     | `/admin/users/:id`                                                       | Super/operations; `suspended` boolean                                                    |
| GET       | `/admin/payments`, `/admin/promos`, `/admin/settings`                    | Super/finance                                                                            |
| POST      | `/admin/payments/:id/confirm-cash`                                       | Super/finance; marks pending cash collected                                              |
| POST      | `/admin/promos`                                                          | Super/finance; code, type, value, maxDiscount, minimumAmount, usageLimit, expiresAt      |
| PUT       | `/admin/settings/fares/:category`                                        | Super/finance; baseFare, pricePerKm, pricePerMinute, minimumFare, bookingFee, commission |
| PUT       | `/admin/settings/demand`                                                 | Super/finance; demandEnabled, maxMultiplier (1–2)                                        |
| GET/PATCH | `/admin/support`, `/admin/support/:id`                                   | Super/operations/support; patch status                                                   |
| GET/PATCH | `/admin/safety`, `/admin/safety/:id`                                     | Super/operations/support; patch resolves incident                                        |
| GET       | `/admin/audit`                                                           | Super only                                                                               |

`/health` reports database connectivity. `/config` exposes only public brand/category/mock-payment configuration.

## Operational notes

- Run a single API/dispatch worker until shared presence, queues, and rate limits are installed.
- Set exact allowed browser origins. Production cookies require HTTPS; deploy apps/API under a same-site arrangement or proxy `/api` and `/socket.io`.
- Configure MongoDB authentication, backup/restore, secret rotation, log aggregation, and appropriate media storage before deployment.
- Treat public tracking links as bearer secrets. They stop working after expiration or ride cancellation/completion.
- Maps, email, payment settlement, and emergency dispatch providers need explicit operational integration; the UI does not claim these integrations exist.
