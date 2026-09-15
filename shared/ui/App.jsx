import { useEffect, useState } from "react";
import {
  NavLink,
  Routes,
  Route,
  useParams,
  useLocation,
} from "react-router-dom";
import { io } from "socket.io-client";
import {
  Home,
  Route as RouteIcon,
  Wallet as WalletIcon,
  Bell,
  User,
  HelpCircle,
  LogOut,
  LayoutDashboard,
  Radio,
  Users,
  Car,
  CreditCard,
  Ticket,
  ShieldCheck,
  BarChart3,
  Settings,
  Menu,
  X,
  ChevronDown,
  ArrowUpRight,
} from "lucide-react";
import { api, useSession, bootstrapSession } from "./api.js";
import { useResource } from "./hooks.js";
import { Brand, Loading, Feedback, Empty } from "./components.jsx";
import Auth from "./Auth.jsx";
import Passenger from "./Passenger.jsx";
import Driver from "./Driver.jsx";
import Admin from "./Admin.jsx";
import {
  History,
  Wallet,
  Notifications,
  Profile,
  Support,
} from "./Account.jsx";
import RideMap from "./Map.jsx";
const passengerNav = [
  ["/", "Book a ride", Home],
  ["/trips", "My trips", RouteIcon],
  ["/wallet", "Wallet", WalletIcon],
  ["/notifications", "Notifications", Bell],
  ["/profile", "My profile", User],
];
const driverNav = [
  ["/", "Overview", Home],
  ["/requests", "Requests", Radio],
  ["/earnings", "Earnings", WalletIcon],
  ["/trips", "My trips", RouteIcon],
  ["/profile", "My profile", User],
];
const adminNav = [
  ["/", "Dashboard", LayoutDashboard],
  ["/live-rides", "Live rides", Radio],
  ["/drivers", "Drivers", Car],
  ["/passengers", "Passengers", Users],
  ["/rides", "Rides", RouteIcon],
  ["/payments", "Payments", CreditCard],
  ["/promos", "Promos", Ticket],
  ["/support", "Support", HelpCircle],
  ["/safety", "Safety", ShieldCheck],
  ["/reports", "Reports", BarChart3],
  ["/settings", "Settings", Settings],
];
function Tracking() {
  const { token } = useParams();
  const resource = useResource(`/tracking/${token}`, 5000);
  return (
    <div className="tracking-page">
      <Brand />
      <h1>A journey worth sharing.</h1>
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <Feedback error={resource.error} />
      ) : (
        resource.data && (
          <>
            <p>{resource.data.status.replaceAll("_", " ")}</p>
            <RideMap
              destination={resource.data.destination}
              driver={resource.data.location?.coordinates}
            />
            <p className="muted">This private link expires automatically.</p>
          </>
        )
      )}
    </div>
  );
}
export default function App({ role }) {
  const session = useSession(),
    location = useLocation();
  const [revision, setRevision] = useState(0),
    [connected, setConnected] = useState(false),
    [menu, setMenu] = useState(false);
  useEffect(() => {
    bootstrapSession(role);
  }, []);
  useEffect(() => {
    if (!session.token) return;
    const socket = io(
      import.meta.env.VITE_SOCKET_URL || window.location.origin,
      { auth: { token: session.token } },
    );
    socket.on("connect", () => {
      setConnected(true);
      setRevision((v) => v + 1);
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("ride:offer", () => setRevision((v) => v + 1));
    socket.on("ride:updated", () => setRevision((v) => v + 1));
    socket.on("driver:location", () => setRevision((v) => v + 1));
    socket.on("notification", () => setRevision((v) => v + 1));
    socket.on("safety:alert", () => setRevision((v) => v + 1));
    const timer = setInterval(() => {
      api
        .post("/auth/refresh")
        .then(({ data }) => session.setSession(data))
        .catch(() => session.clear());
    }, 12 * 60000);
    return () => {
      clearInterval(timer);
      socket.disconnect();
    };
  }, [session.token]);
  useEffect(() => setMenu(false), [location.pathname]);
  if (location.pathname.startsWith("/track/"))
    return (
      <Routes>
        <Route path="/track/:token" element={<Tracking />} />
      </Routes>
    );
  if (!session.ready) return <Loading />;
  const allowed =
    session.user &&
    (role === "admin"
      ? session.user.role.endsWith("ADMIN")
      : session.user.role === role.toUpperCase());
  if (!allowed) return <Auth role={role} />;
  const navigation =
    role === "admin" ? adminNav : role === "driver" ? driverNav : passengerNav;
  return (
    <div className={`app-shell ${role}`}>
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <NavLink to="/" className="brand-link">
          <Brand />
        </NavLink>
        <p className="sidebar-label">
          {role === "passenger"
            ? "YOUR EVERYDAY COMPANION"
            : role === "driver"
              ? "DRIVER PARTNER"
              : "OPERATIONS CONSOLE"}
        </p>
        <nav>
          {navigation.map(([path, label, Icon]) => (
            <NavLink to={path} end={path === "/"} key={path}>
              <Icon size={19} />
              <span>{label}</span>
              {path === "/" && (
                <span className="nav-arrow">
                  <ArrowUpRight size={15} />
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {role !== "admin" && (
            <div className="local-card">
              <span className="local-mark">↗</span>
              <strong>
                Rooted here.
                <br />
                Going places.
              </strong>
              <p>Proudly moving Nepalgunj.</p>
            </div>
          )}
          {role !== "admin" && (
            <NavLink to="/support" className="support-link">
              <HelpCircle size={18} />
              Help & support
            </NavLink>
          )}
          <button
            className="logout"
            onClick={async () => {
              try {
                await api.post("/auth/logout");
                session.clear();
              } catch {
                window.alert(
                  "Could not sign out on the server. Please try again.",
                );
              }
            }}
          >
            <LogOut size={17} />
            Sign out
          </button>
          <span className="sidebar-copyright">
            © {new Date().getFullYear()} Ride Nepaljung
          </span>
        </div>
      </aside>
      {menu && (
        <button
          className="menu-overlay"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            aria-label="Open navigation"
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
          <div className="breadcrumb">
            Your city. Your ride. <span>/</span>{" "}
            <strong>
              {navigation.find(([p]) => p === location.pathname)?.[1] ||
                "Help & support"}
            </strong>
          </div>
          <div className="topbar-right">
            <span className={`connection ${connected ? "" : "disconnected"}`}>
              <span className="live-dot" />
              {connected ? "Live updates" : "Reconnecting"}
            </span>
            <NavLink
              to={role === "admin" ? "/safety" : "/notifications"}
              className="notification-button"
              aria-label="View notifications"
            >
              <Bell size={19} />
            </NavLink>
            <span className="topbar-divider" />
            <NavLink
              to={role === "admin" ? "/settings" : "/profile"}
              className="user-menu"
            >
              <span className="avatar">{session.user.name.slice(0, 1)}</span>
              <span>
                <strong>{session.user.name.split(" ")[0]}</strong>
                <small>
                  {role === "admin"
                    ? "Administrator"
                    : role === "driver"
                      ? "Driver partner"
                      : "Passenger"}
                </small>
              </span>
              <ChevronDown size={15} />
            </NavLink>
          </div>
        </header>
        <main className="main-content">
          <Routes>
            {role === "passenger" ? (
              <>
                <Route path="/" element={<Passenger revision={revision} />} />
                <Route path="/wallet" element={<Wallet />} />
              </>
            ) : role === "driver" ? (
              <>
                <Route path="/" element={<Driver revision={revision} />} />
                <Route
                  path="/requests"
                  element={<Driver revision={revision} view="requests" />}
                />
                <Route path="/earnings" element={<Driver view="earnings" />} />
              </>
            ) : (
              adminNav.map(([path]) => (
                <Route
                  key={path}
                  path={path}
                  element={
                    <Admin
                      key={path}
                      view={path === "/" ? "dashboard" : path.slice(1)}
                    />
                  }
                />
              ))
            )}
            {role !== "admin" && (
              <>
                <Route path="/trips" element={<History role={role} />} />
                <Route
                  path="/notifications"
                  element={<Notifications revision={revision} />}
                />
                <Route path="/profile" element={<Profile role={role} />} />
                <Route path="/support" element={<Support />} />
              </>
            )}
            <Route
              path="*"
              element={
                <Empty
                  title="This road doesn’t go anywhere."
                  text="Choose a page from the navigation."
                />
              }
            />
          </Routes>
          <footer className="main-footer">
            <span>MADE FOR YOUR EVERYDAY.</span>
            <span>
              Nepalgunj, with love. <span className="tiny-leaf">✳</span>
            </span>
          </footer>
        </main>
      </div>
      {role !== "admin" && (
        <nav className="bottom-nav">
          {navigation.map(([path, label, Icon]) => (
            <NavLink to={path} end={path === "/"} key={path}>
              <Icon size={20} />
              <span>
                {label.replace("My ", "").replace("Book a ride", "Home")}
              </span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
