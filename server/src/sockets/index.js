import { Server } from "socket.io";
import { authenticateToken } from "../middleware/auth.js";
import { origins } from "../config/env.js";
import { ADMIN_ROLES } from "../../../shared/constants/index.js";
import { setIO } from "../services/events.js";
export function configureSockets(http) {
  const io = new Server(http, {
    cors: { origin: origins, credentials: true },
    maxHttpBufferSize: 10000,
  });
  io.use(async (socket, next) => {
    try {
      socket.data.user = await authenticateToken(socket.handshake.auth.token);
      next();
    } catch {
      next(new Error("Authentication required"));
    }
  });
  io.on("connection", (socket) => {
    const user = socket.data.user;
    socket.join(`user:${user._id}`);
    if (ADMIN_ROLES.includes(user.role)) socket.join("admins");
    // Clients cannot choose rooms or write ride states. Revalidate periodically and at token expiry.
    const timer = setInterval(async () => {
      try {
        await authenticateToken(socket.handshake.auth.token);
      } catch {
        socket.disconnect(true);
      }
    }, 15000);
    timer.unref();
    socket.on("disconnect", () => clearInterval(timer));
  });
  setIO(io);
  return io;
}
