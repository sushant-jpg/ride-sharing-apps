import { useEffect, useState } from "react";
import { Radio, Wallet, Route, Star, Clock3, MapPin } from "lucide-react";
import { api, money } from "./api.js";
import { useResource, useAction, useActiveRide } from "./hooks.js";
import {
  PageTitle,
  Stat,
  Feedback,
  PrimaryButton,
  Empty,
  Status,
  Loading,
} from "./components.jsx";
import RideMap from "./Map.jsx";
import Trip from "./Trip.jsx";
export default function Driver({ revision, view = "home" }) {
  const profile = useResource("/drivers/profile"),
    earnings = useResource("/drivers/earnings"),
    offers = useResource("/drivers/offers", 5000),
    current = useActiveRide("/drivers/current-ride");
  const [location, setLocation] = useState(null),
    [finished, setFinished] = useState(null),
    [now, setNow] = useState(Date.now());
  const action = useAction();
  useEffect(() => {
    profile.refresh();
    offers.refresh();
    current.refresh();
  }, [revision]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!profile.data?.profile?.online) return;
    let watch;
    let last = 0;
    let latest;
    const heartbeat = setInterval(() => {
      if (latest && Date.now() - last >= 5000) {
        last = Date.now();
        api.patch("/drivers/location", latest).catch(() => {});
      }
    }, 10000);
    if (navigator.geolocation)
      watch = navigator.geolocation.watchPosition(
        (p) => {
          const next = {
            address: "Driver current location",
            latitude: p.coords.latitude,
            longitude: p.coords.longitude,
          };
          setLocation(next);
          latest = next;
          if (Date.now() - last >= 5000) {
            last = Date.now();
            api.patch("/drivers/location", next).catch(() => {});
          }
        },
        () =>
          action.setError(
            "GPS is unavailable. Location sharing requires browser permission.",
          ),
        { enableHighAccuracy: true, maximumAge: 5000 },
      );
    return () => {
      clearInterval(heartbeat);
      if (watch !== undefined) navigator.geolocation.clearWatch(watch);
    };
  }, [profile.data?.profile?.online]);
  async function refreshRide() {
    const old = current.data;
    if (old) {
      const { data } = await api.get(`/rides/${old._id}`);
      if (["TRIP_COMPLETED", "CANCELLED"].includes(data.status)) {
        setFinished(data);
        current.setData(null);
        earnings.refresh();
        profile.refresh();
        return;
      }
      current.setData(data);
    } else await current.refresh();
  }
  useEffect(() => {
    if (current.data) {
      const id = setInterval(refreshRide, 5000);
      return () => clearInterval(id);
    }
  }, [current.data?._id]);
  async function toggle() {
    if (profile.data?.profile?.online) {
      await action.run(async () => {
        await api.patch("/drivers/status", { online: false });
        await profile.refresh();
      });
      return;
    }
    if (!navigator.geolocation) {
      action.setError("Your browser does not support location sharing.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const next = {
          address: "Driver current location",
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
        };
        setLocation(next);
        action.run(async () => {
          await api.patch("/drivers/status", { online: true, location: next });
          await profile.refresh();
        });
      },
      () => action.setError("Allow location access to go online."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }
  if (current.data || finished)
    return (
      <Trip
        key={(current.data || finished)._id}
        ride={current.data || finished}
        role="driver"
        refresh={refreshRide}
        onDone={() => {
          setFinished(null);
          current.setData(null);
        }}
      />
    );
  if (profile.loading) return <Loading />;
  const online = profile.data?.profile?.online;
  if (view === "earnings")
    return (
      <>
        <PageTitle
          title="Every kilometre counts."
          description="Your earnings after platform commission."
        />
        <div className="stats-grid">
          {["today", "week", "month"].map((period) => (
            <Stat
              key={period}
              label={period === "today" ? "Last 24 hours" : `This ${period}`}
              value={`Rs. ${money(earnings.data?.[period]?.net)}`}
              icon={Wallet}
              detail={`${earnings.data?.[period]?.rides || 0} completed rides`}
            />
          ))}
        </div>
        <section className="panel">
          <h3>Earnings breakdown</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Gross fares</th>
                  <th>Platform fees</th>
                  <th>Net earnings</th>
                </tr>
              </thead>
              <tbody>
                {["today", "week", "month"].map((p) => (
                  <tr key={p}>
                    <td>{p}</td>
                    <td>Rs. {money(earnings.data?.[p]?.gross)}</td>
                    <td>Rs. {money(earnings.data?.[p]?.commission)}</td>
                    <td>Rs. {money(earnings.data?.[p]?.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">
            Cash fares are collected directly by you. Your wallet records
            platform fees separately. Withdrawals and bonuses: coming soon.
          </p>
        </section>
      </>
    );
  return (
    <>
      <PageTitle
        eyebrow="YOUR CITY. YOUR OWN PACE."
        title="Ready when you are."
        description="Good rides start with you."
        action={
          <button
            className={`online-toggle ${online ? "on" : ""}`}
            disabled={
              action.busy || profile.data?.profile?.status !== "APPROVED"
            }
            onClick={toggle}
          >
            <span />
            {online ? "You’re online" : "Go online"}
            <Radio size={17} />
          </button>
        }
      />
      <Feedback
        error={action.error || profile.error}
        success={action.success}
      />
      {profile.data?.profile?.status !== "APPROVED" && (
        <div className="feedback">
          Your driver account is {profile.data?.profile?.status?.toLowerCase()}.
          Submit your documents in Profile for approval.
        </div>
      )}
      <div className="stats-grid">
        <Stat
          label="Today’s net earnings"
          value={`Rs. ${money(earnings.data?.today?.net)}`}
          icon={Wallet}
          detail="After platform fees"
        />
        <Stat
          label="Completed rides"
          value={earnings.data?.today?.rides || 0}
          icon={Route}
          detail="Over the last 24 hours"
        />
        <Stat
          label="Availability"
          value={online ? "Online" : "Offline"}
          icon={Radio}
          detail={
            online
              ? "Sharing your live location"
              : "Go online to receive requests"
          }
        />
      </div>
      <div className="driver-grid">
        <section className="panel">
          <div className="card-heading">
            <h2>Nearby requests</h2>
            <span className="pill">
              <span className="live-dot" />
              {online ? "LIVE" : "OFFLINE"}
            </span>
          </div>
          {offers.data?.filter((o) => o.ride?.status === "SEARCHING").length ? (
            offers.data
              .filter((o) => o.ride?.status === "SEARCHING")
              .map((offer) => (
                <div className="offer" key={offer._id}>
                  <div className="card-heading">
                    <Status value={offer.ride.rideCategory} />
                    <span className="small">
                      <Clock3 size={13} />
                      {Math.max(
                        0,
                        Math.ceil((new Date(offer.expiresAt) - now) / 1000),
                      )}
                      s to respond
                    </span>
                  </div>
                  <h3>{offer.ride.pickup.address}</h3>
                  <p className="muted">
                    <MapPin size={14} /> {offer.ride.destination.address}
                  </p>
                  <div className="trip-fare">
                    <span>
                      {offer.ride.estimatedDistance.toFixed(1)} km ·{" "}
                      {Math.round(offer.ride.estimatedDuration)} min
                    </span>
                    <strong>Rs. {money(offer.ride.estimatedFare)}</strong>
                  </div>
                  <p className="small muted">
                    Estimated gross fare; platform commission applies.
                  </p>
                  <div className="inline-actions">
                    <button
                      className="button secondary"
                      disabled={action.busy}
                      onClick={() =>
                        action.run(async () => {
                          await api.post(
                            `/drivers/rides/${offer.ride._id}/reject`,
                          );
                          offers.refresh();
                        })
                      }
                    >
                      Decline
                    </button>
                    <PrimaryButton
                      busy={action.busy}
                      onClick={() =>
                        action.run(async () => {
                          const { data } = await api.post(
                            `/drivers/rides/${offer.ride._id}/accept`,
                          );
                          current.setData(data);
                          offers.refresh();
                        })
                      }
                    >
                      Accept ride
                    </PrimaryButton>
                  </div>
                </div>
              ))
          ) : (
            <Empty
              title={
                online
                  ? "A good ride is around the corner."
                  : "Take the city with you."
              }
              text={
                online
                  ? "New ride requests appear here automatically."
                  : "Go online to connect with nearby passengers."
              }
            />
          )}
        </section>
        <RideMap pickup={location} compact />
      </div>
      <div className="driver-tip">
        <Star size={22} />
        <div>
          <h3>Little things make a great ride.</h3>
          <p>
            Greet your passenger, confirm the trip PIN, and help them get there
            comfortably.
          </p>
        </div>
      </div>
    </>
  );
}
