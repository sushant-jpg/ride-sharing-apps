export const BRAND = "Ride Nepaljung";
export const CENTER = [28.05, 81.6167];
export const CATEGORIES = [
  {
    id: "sajilo",
    name: "Sajilo",
    description: "A little ride. A lot of freedom.",
    vehicleType: "motorcycle",
    capacity: 1,
    baseFare: 35,
    pricePerKm: 18,
    pricePerMinute: 2,
    minimumFare: 65,
    bookingFee: 10,
    commission: 0.12,
  },
  {
    id: "sathi",
    name: "Sathi",
    description: "Your everyday, comfortable ride.",
    vehicleType: "car",
    capacity: 4,
    baseFare: 70,
    pricePerKm: 30,
    pricePerMinute: 3,
    minimumFare: 130,
    bookingFee: 15,
    commission: 0.15,
  },
  {
    id: "parivar",
    name: "Parivar",
    description: "More room for your people.",
    vehicleType: "van",
    capacity: 6,
    baseFare: 110,
    pricePerKm: 42,
    pricePerMinute: 4,
    minimumFare: 200,
    bookingFee: 20,
    commission: 0.15,
  },
  {
    id: "hariyo",
    name: "Hariyo",
    description: "Go electric. Travel lightly.",
    vehicleType: "electric",
    capacity: 4,
    baseFare: 80,
    pricePerKm: 28,
    pricePerMinute: 3,
    minimumFare: 140,
    bookingFee: 15,
    commission: 0.12,
  },
];
export const ACTIVE = [
  "SEARCHING",
  "DRIVER_ASSIGNED",
  "DRIVER_ARRIVING",
  "DRIVER_ARRIVED",
  "TRIP_STARTED",
];
export const STATUSES = [...ACTIVE, "SCHEDULED", "TRIP_COMPLETED", "CANCELLED"];
export const TRANSITIONS = {
  SEARCHING: ["DRIVER_ASSIGNED", "CANCELLED"],
  DRIVER_ASSIGNED: ["DRIVER_ARRIVING", "DRIVER_ARRIVED", "CANCELLED"],
  DRIVER_ARRIVING: ["DRIVER_ARRIVED", "CANCELLED"],
  DRIVER_ARRIVED: ["TRIP_STARTED", "CANCELLED"],
  TRIP_STARTED: ["TRIP_COMPLETED", "CANCELLED"],
  SCHEDULED: ["SEARCHING", "CANCELLED"],
  TRIP_COMPLETED: [],
  CANCELLED: [],
};
export const ADMIN_ROLES = [
  "SUPER_ADMIN",
  "OPERATIONS_ADMIN",
  "SUPPORT_ADMIN",
  "FINANCE_ADMIN",
];
export const PLACES = [
  { address: "B. P. Chowk, Nepalgunj", latitude: 28.0572, longitude: 81.6194 },
  { address: "Nepalgunj Airport", latitude: 28.1036, longitude: 81.667 },
  { address: "Bageshwori Temple", latitude: 28.0587, longitude: 81.6154 },
  { address: "Dhamboji Chowk", latitude: 28.0663, longitude: 81.6204 },
  { address: "Rani Talau", latitude: 28.0493, longitude: 81.6199 },
  {
    address: "Nepalgunj Medical College",
    latitude: 28.0697,
    longitude: 81.616,
  },
  { address: "Tribhuvan Chowk", latitude: 28.0506, longitude: 81.6176 },
  { address: "Kohalpur Chowk", latitude: 28.2078, longitude: 81.6904 },
];
