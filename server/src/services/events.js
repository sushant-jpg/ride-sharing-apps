import { Notification } from "../models/index.js";
import { logger } from "../utils/logger.js";
let io;
export function setIO(instance) {
  io = instance;
}
export function emitUser(user, event, payload) {
  io?.to(`user:${user}`).emit(event, payload);
}
export function emitAdmin(event, payload) {
  io?.to("admins").emit(event, payload);
}
export async function notify(user, title, message, ride) {
  try {
    const notification = await Notification.create({
      user,
      title,
      message,
      ride,
    });
    emitUser(user, "notification", notification);
  } catch (err) {
    logger.error({ error: err.message }, "Notification delivery failed");
  }
}
export function rideChanged(ride) {
  const event = { rideId: String(ride._id), status: ride.status };
  emitUser(ride.passenger, "ride:updated", event);
  if (ride.driver) emitUser(ride.driver, "ride:updated", event);
  emitAdmin("ride:updated", event);
}
