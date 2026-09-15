import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import bcrypt from "bcrypt";
import { createApp } from "../src/app.js";
import {
  User,
  DriverProfile,
  Vehicle,
  Ride,
  Wallet,
  WalletTransaction,
  RideOffer,
  Payment,
  DriverLocation,
  Rating,
  RefreshToken,
  Promo,
} from "../src/models/index.js";
import { issueSession } from "../src/services/auth.js";
import { matchRide } from "../src/services/matching.js";
import { PLACES } from "../../shared/constants/index.js";
let db, app, passwordHash;
const password = "Development-only-123!";
async function account(role, email) {
  const user = await User.create({
    name: `Test ${role}`,
    email,
    passwordHash,
    phone: "9800000000",
    role,
  });
  await Wallet.create({ user: user._id, balance: 1000 });
  const session = await issueSession(user, "vitest");
  return { user, token: session.accessToken, refresh: session.refreshToken };
}
async function driver(email) {
  const accountData = await account("DRIVER", email);
  await DriverProfile.create({
    user: accountData.user._id,
    status: "APPROVED",
    online: true,
  });
  await Vehicle.create({
    driver: accountData.user._id,
    brand: "Test",
    model: "Car",
    plateNumber: email,
    category: "sathi",
    verificationStatus: "APPROVED",
  });
  await DriverLocation.create({
    driver: accountData.user._id,
    location: {
      type: "Point",
      coordinates: [PLACES[0].longitude, PLACES[0].latitude],
    },
  });
  return accountData;
}
const payload = {
  pickup: PLACES[0],
  destination: PLACES[3],
  stops: [],
  rideCategory: "sathi",
  paymentMethod: "WALLET",
};
const call = (method, path, token, body) => {
  const client = request(app);
  const req = client[method](`/api${path}`).set(
    "Authorization",
    `Bearer ${token}`,
  );
  return body ? req.send(body) : req;
};
beforeAll(async () => {
  db = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
    binary: { version: "7.0.24" },
  });
  await mongoose.connect(db.getUri());
  app = createApp();
  passwordHash = await bcrypt.hash(password, 4);
  await Promise.all(
    Object.values(mongoose.models).map((model) => model.init()),
  );
});
afterAll(async () => {
  await mongoose.disconnect();
  await db?.stop();
});
beforeEach(async () => {
  await Promise.all(
    Object.values(mongoose.models).map((model) => model.deleteMany({})),
  );
});
describe("authentication and authorization", () => {
  it("registers, rotates refresh tokens, and rejects replay", async () => {
    const agent = request.agent(app);
    const registered = await agent.post("/api/auth/register").send({
      name: "Asha Sharma",
      email: "asha@ride.test",
      phone: "9800000000",
      password,
    });
    expect(registered.status).toBe(200);
    expect(registered.body.user.passwordHash).toBeUndefined();
    const firstCookie = registered.headers["set-cookie"][0].split(";")[0];
    expect((await agent.post("/api/auth/refresh")).status).toBe(200);
    expect(
      (await request(app).post("/api/auth/refresh").set("Cookie", firstCookie))
        .status,
    ).toBe(401);
    expect(
      (await call("get", "/users/profile", registered.body.accessToken)).status,
    ).toBe(401);
  });
  it("enforces admin roles, logout, validation and operator key filtering", async () => {
    const passenger = await account("PASSENGER", "p@ride.test");
    expect(
      (await call("get", "/admin/dashboard", passenger.token)).status,
    ).toBe(403);
    expect(
      (
        await call("post", "/rides", passenger.token, {
          ...payload,
          pickup: { ...PLACES[0], latitude: 91 },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post("/api/auth/login")
          .send({ email: { $ne: null }, password })
      ).status,
    ).toBe(400);
    expect(
      (await call("post", "/auth/logout-all", passenger.token, {})).status,
    ).toBe(200);
    expect((await call("get", "/users/profile", passenger.token)).status).toBe(
      401,
    );
  });
  it("rejects incorrect credentials and duplicate registrations", async () => {
    await account("PASSENGER", "p@ride.test");
    expect(
      (
        await request(app)
          .post("/api/auth/login")
          .send({ email: "p@ride.test", password: "incorrect-password" })
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app).post("/api/auth/register").send({
          email: "p@ride.test",
          password,
          name: "Test User",
          phone: "9800000000",
        })
      ).status,
    ).toBe(409);
  });
});
describe("complete ride workflow", () => {
  it("matches, accepts once, verifies PIN, completes wallet payment, and records two-way ratings", async () => {
    const passenger = await account("PASSENGER", "p@ride.test"),
      d1 = await driver("d1@ride.test"),
      d2 = await driver("d2@ride.test"),
      stranger = await account("PASSENGER", "other@ride.test");
    const estimate = await call(
      "post",
      "/rides/estimate",
      passenger.token,
      payload,
    );
    expect(estimate.status).toBe(200);
    expect(estimate.body).toHaveLength(4);
    const created = await call("post", "/rides", passenger.token, payload);
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const id = created.body.ride._id,
      pin = created.body.pin;
    expect(pin).toMatch(/^\d{4}$/);
    expect(created.body.ride.verificationPinHash).toBeUndefined();
    expect(
      (await call("post", "/rides", passenger.token, payload)).status,
    ).toBe(409);
    expect((await call("get", `/rides/${id}`, stranger.token)).status).toBe(
      403,
    );
    await matchRide(id);
    expect(await RideOffer.countDocuments({ ride: id })).toBe(2);
    const offers = await call("get", "/drivers/offers", d1.token);
    expect(JSON.stringify(offers.body)).not.toContain("verificationPin");
    const accepted = await Promise.all([
      call("post", `/drivers/rides/${id}/accept`, d1.token, {}),
      call("post", `/drivers/rides/${id}/accept`, d2.token, {}),
    ]);
    expect(accepted.map((r) => r.status).sort()).toEqual([200, 409]);
    const assigned = await Ride.findById(id);
    const winner = String(assigned.driver) === String(d1.user._id) ? d1 : d2;
    const loser = winner === d1 ? d2 : d1;
    expect(
      (await DriverProfile.findOne({ user: loser.user._id })).available,
    ).toBe(true);
    expect(
      (await call("post", `/drivers/rides/${id}/arrived`, loser.token, {}))
        .status,
    ).toBe(404);
    expect(
      (await call("post", `/drivers/rides/${id}/start`, winner.token, { pin }))
        .status,
    ).toBe(409);
    expect(
      (await call("post", `/drivers/rides/${id}/arrived`, winner.token, {}))
        .status,
    ).toBe(200);
    expect(
      (
        await call("post", `/drivers/rides/${id}/start`, winner.token, {
          pin: "0000",
        })
      ).status,
    ).toBe(400);
    expect(
      (await call("post", `/drivers/rides/${id}/start`, winner.token, { pin }))
        .status,
    ).toBe(200);
    const completed = await call(
      "post",
      `/drivers/rides/${id}/complete`,
      winner.token,
      {},
    );
    expect(completed.status, JSON.stringify(completed.body)).toBe(200);
    expect(completed.body.status).toBe("TRIP_COMPLETED");
    expect(completed.body.paymentStatus).toBe("PAID");
    expect(await Payment.countDocuments({ rideId: id })).toBe(1);
    expect(await WalletTransaction.countDocuments({ ride: id })).toBe(2);
    expect(
      (await Wallet.findOne({ user: passenger.user._id })).balance,
    ).toBeCloseTo(1000 - completed.body.finalFare, 2);
    expect(
      (await call("post", `/drivers/rides/${id}/complete`, winner.token, {}))
        .status,
    ).toBe(409);
    expect(await Payment.countDocuments({ rideId: id })).toBe(1);
    expect(
      (
        await call("post", `/rides/${id}/rate`, passenger.token, {
          value: 5,
          feedback: "Great ride",
        })
      ).status,
    ).toBe(201);
    expect(
      (await call("post", `/rides/${id}/rate`, winner.token, { value: 4 }))
        .status,
    ).toBe(201);
    expect(
      (await call("post", `/rides/${id}/rate`, passenger.token, { value: 1 }))
        .status,
    ).toBe(409);
    expect(await Rating.countDocuments()).toBe(2);
    expect((await User.findById(passenger.user._id)).activeRide).toBeNull();
    expect(
      (await DriverProfile.findOne({ user: winner.user._id })).available,
    ).toBe(true);
    expect(
      (await call("get", "/rides/history", passenger.token)).body[0].status,
    ).toBe("TRIP_COMPLETED");
  });
  it("rolls back completion on insufficient wallet balance, then permits cash", async () => {
    const p = await account("PASSENGER", "p@ride.test"),
      d = await driver("d@ride.test");
    const { body } = await call("post", "/rides", p.token, payload);
    const id = body.ride._id;
    await matchRide(id);
    await call("post", `/drivers/rides/${id}/accept`, d.token, {});
    await call("post", `/drivers/rides/${id}/arrived`, d.token, {});
    await call("post", `/drivers/rides/${id}/start`, d.token, {
      pin: body.pin,
    });
    await Wallet.updateOne({ user: p.user._id }, { $set: { balance: 0 } });
    expect(
      (await call("post", `/drivers/rides/${id}/complete`, d.token, {})).status,
    ).toBe(402);
    expect((await Ride.findById(id)).status).toBe("TRIP_STARTED");
    expect(await Payment.countDocuments()).toBe(0);
    await call("patch", `/rides/${id}/payment-method`, p.token, {
      paymentMethod: "CASH",
    });
    expect(
      (await call("post", `/drivers/rides/${id}/complete`, d.token, {})).status,
    ).toBe(200);
    expect((await Payment.findOne()).status).toBe("PENDING");
  });
  it("releases passengers after cancellation and expires tracking links", async () => {
    const p = await account("PASSENGER", "p@ride.test");
    const { body } = await call("post", "/rides", p.token, payload);
    const id = body.ride._id;
    const share = await call("post", `/rides/${id}/share`, p.token, {});
    expect(
      (await request(app).get(`/api/tracking/${share.body.token}`)).status,
    ).toBe(200);
    expect(
      (
        await call("post", `/rides/${id}/cancel`, p.token, {
          reason: "Plans changed",
        })
      ).status,
    ).toBe(200);
    expect(
      (await request(app).get(`/api/tracking/${share.body.token}`)).status,
    ).toBe(404);
    expect((await User.findById(p.user._id)).activeRide).toBeNull();
  });
  it("rejects unapproved drivers and reused promos", async () => {
    const d = await driver("d@ride.test");
    await DriverProfile.updateOne(
      { user: d.user._id },
      { $set: { status: "PENDING" } },
    );
    expect(
      (
        await call("patch", "/drivers/status", d.token, {
          online: true,
          location: PLACES[0],
        })
      ).status,
    ).toBe(403);
    const p = await account("PASSENGER", "p@ride.test");
    await Promo.create({
      code: "HELLO",
      type: "FIXED",
      value: 20,
      maxDiscount: 20,
      minimumAmount: 0,
      usageLimit: 10,
      expiresAt: new Date(Date.now() + 86400000),
    });
    const { body } = await call("post", "/rides", p.token, {
      ...payload,
      promoCode: "HELLO",
    });
    await call("post", `/rides/${body.ride._id}/cancel`, p.token, {
      reason: "Plans changed",
    });
    expect(
      (
        await call("post", "/rides", p.token, {
          ...payload,
          promoCode: "HELLO",
        })
      ).status,
    ).toBe(409);
  });
});

it("keeps eligible categories quotable when a cheaper category misses the promo minimum", async () => {
  const passenger = await account("PASSENGER", "promo-category@ride.test");
  await Promo.create({
    code: "CATEGORY",
    type: "FIXED",
    value: 20,
    maxDiscount: 20,
    minimumAmount: 100,
    usageLimit: 10,
    expiresAt: new Date(Date.now() + 86400000),
  });
  const result = await call("post", "/rides/estimate", passenger.token, {
    ...payload,
    promoCode: "CATEGORY",
  });
  expect(result.status).toBe(200);
  expect(
    result.body.find((item) => item.category === "sajilo").promoError,
  ).toBeTruthy();
  expect(
    result.body.find((item) => item.category === "sathi").breakdown.discount,
  ).toBe(20);
  expect(
    result.body.find((item) => item.category === "sathi").promoError,
  ).toBeUndefined();
});
