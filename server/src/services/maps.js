import { env } from "../config/env.js";
import { PLACES } from "../../../shared/constants/index.js";
import { check } from "../utils/errors.js";
export function distance(a, b) {
  const rad = (n) => (n * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude),
    dLon = rad(b.longitude - a.longitude);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(Math.max(0, 1 - x)));
}
export async function routeBetween(points) {
  let straight = 0;
  for (let i = 1; i < points.length; i++)
    straight += distance(points[i - 1], points[i]);
  check(
    straight >= 0.1 && straight <= 150,
    400,
    "Choose a route between 100 metres and 150 kilometres",
  );
  try {
    if (env.NODE_ENV === "test") throw new Error("offline test");
    const coords = points.map((p) => `${p.longitude},${p.latitude}`).join(";");
    const response = await fetch(
      `${env.ROUTING_URL}/route/v1/driving/${coords}?overview=full&geometries=geojson`,
      { signal: AbortSignal.timeout(4500) },
    );
    const body = await response.json();
    const route = body.routes?.[0];
    if (!response.ok || !route) throw new Error("No route");
    return {
      distanceKm: route.distance / 1000,
      durationMinutes: route.duration / 60,
      geometry: route.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
      source: "road",
    };
  } catch {
    return {
      distanceKm: straight * 1.3,
      durationMinutes: ((straight * 1.3) / 22) * 60,
      geometry: points.map((p) => [p.latitude, p.longitude]),
      source: "approximate",
    };
  }
}
let lastGeocode = 0;
const cache = new Map();
export async function searchPlaces(query) {
  const local = PLACES.filter((p) =>
    p.address.toLowerCase().includes(query.toLowerCase()),
  );
  if (local.length) return local;
  if (cache.has(query)) return cache.get(query);
  if (Date.now() - lastGeocode < 1100) return [];
  lastGeocode = Date.now();
  try {
    const response = await fetch(
      `${env.GEOCODING_URL}/search?format=json&limit=5&countrycodes=np&q=${encodeURIComponent(query)}`,
      {
        headers: {
          "User-Agent": "RideNepaljung/1.0 (development ride planning)",
        },
        signal: AbortSignal.timeout(4000),
      },
    );
    if (!response.ok) return [];
    const data = (await response.json()).map((p) => ({
      address: p.display_name,
      latitude: Number(p.lat),
      longitude: Number(p.lon),
    }));
    if (cache.size > 500) cache.clear();
    cache.set(query, data);
    return data;
  } catch {
    return [];
  }
}
export async function reversePlace(latitude, longitude) {
  if (Date.now() - lastGeocode < 1100)
    return {
      address: `Map point (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
      latitude,
      longitude,
    };
  lastGeocode = Date.now();
  try {
    const response = await fetch(
      `${env.GEOCODING_URL}/reverse?format=json&lat=${latitude}&lon=${longitude}`,
      {
        headers: {
          "User-Agent": "RideNepaljung/1.0 (development ride planning)",
        },
        signal: AbortSignal.timeout(4000),
      },
    );
    const data = await response.json();
    return {
      address: data.display_name || "Selected map point",
      latitude,
      longitude,
    };
  } catch {
    return { address: "Selected map point", latitude, longitude };
  }
}
