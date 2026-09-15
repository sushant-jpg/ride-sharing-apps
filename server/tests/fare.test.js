import { describe, it, expect } from "vitest";
import { calculateFare } from "../src/services/fare.js";
import { driverScore } from "../src/services/matching.js";
import { distance } from "../src/services/maps.js";
import { CATEGORIES, TRANSITIONS } from "../../shared/constants/index.js";
describe("transparent pricing", () => {
  it("adds base, distance, time and fee before demand and discount", () => {
    const result = calculateFare(CATEGORIES[1], 5, 15, {
      multiplier: 1.2,
      discount: 30,
    });
    expect(result).toMatchObject({
      baseFare: 70,
      distanceFare: 150,
      timeFare: 45,
      bookingFee: 15,
      subtotal: 336,
      estimatedFare: 306,
      discount: 30,
    });
  });
  it("applies minimum fare and never creates a negative payment", () => {
    expect(calculateFare(CATEGORIES[1], 0, 0).estimatedFare).toBe(130);
    expect(
      calculateFare(CATEGORIES[1], 0, 0, { discount: 500 }).estimatedFare,
    ).toBe(0);
  });
  it("rounds currency to two decimals", () =>
    expect(calculateFare(CATEGORIES[0], 1.333, 2.555).distanceFare).toBe(
      23.99,
    ));
});
describe("matching and ride rules", () => {
  it("prioritizes proximity while giving idle drivers a fair chance", () => {
    expect(driverScore({ distanceKm: 1 })).toBeGreaterThan(
      driverScore({ distanceKm: 5 }),
    );
    expect(driverScore({ distanceKm: 1, idleMinutes: 60 })).toBeGreaterThan(
      driverScore({ distanceKm: 1, idleMinutes: 0 }),
    );
  });
  it("computes distance in kilometres", () => {
    expect(
      distance(
        { latitude: 28, longitude: 81 },
        { latitude: 28.01, longitude: 81 },
      ),
    ).toBeCloseTo(1.112, 2);
  });
  it("forbids starting before arrival and changing completed trips", () => {
    expect(TRANSITIONS.DRIVER_ASSIGNED).not.toContain("TRIP_STARTED");
    expect(TRANSITIONS.TRIP_COMPLETED).toEqual([]);
  });
});
