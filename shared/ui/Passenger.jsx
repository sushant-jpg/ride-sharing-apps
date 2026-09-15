import { useEffect, useState } from "react";
import {
  ArrowRight,
  Home,
  Briefcase,
  MapPin,
  ShieldCheck,
  Clock3,
  Plus,
  X,
  Leaf,
  Navigation,
  Users,
  ArrowUpDown,
  CalendarDays,
} from "lucide-react";
import { api, useSession, money } from "./api.js";
import { useAction, useResource, useActiveRide } from "./hooks.js";
import { CATEGORIES, PLACES } from "../constants/index.js";
import {
  PageTitle,
  Feedback,
  CategoryIcon,
  PrimaryButton,
  FareDetails,
  Loading,
} from "./components.jsx";
import LocationInput from "./LocationInput.jsx";
import RideMap from "./Map.jsx";
import Trip from "./Trip.jsx";
export default function Passenger({ revision }) {
  const user = useSession((s) => s.user);
  const current = useActiveRide("/rides/current"),
    saved = useResource("/places"),
    history = useResource("/rides/history"),
    config = useResource("/config");
  const [pickup, setPickup] = useState(PLACES[0]),
    [destination, setDestination] = useState(null),
    [category, setCategory] = useState("sathi"),
    [estimates, setEstimates] = useState(null),
    [payment, setPayment] = useState("CASH"),
    [schedule, setSchedule] = useState(""),
    [showSchedule, setShowSchedule] = useState(false),
    [stops, setStops] = useState([]),
    [promo, setPromo] = useState(""),
    [pin, setPin] = useState(""),
    [finished, setFinished] = useState(null),
    [mapTarget, setMapTarget] = useState("destination");
  const action = useAction();
  const [locating, setLocating] = useState(false);
  useEffect(() => {
    current.refresh();
  }, [revision]);
  useEffect(() => setEstimates(null), [pickup, destination, stops, promo]);
  async function refreshTrip() {
    const old = current.data;
    if (old) {
      const { data } = await api.get(`/rides/${old._id}`);
      if (["TRIP_COMPLETED", "CANCELLED"].includes(data.status)) {
        setFinished(data);
        current.setData(null);
        return;
      }
    }
    await current.refresh();
  }
  useEffect(() => {
    if (current.data) {
      const id = setInterval(refreshTrip, 5000);
      return () => clearInterval(id);
    }
  }, [current.data?._id]);
  function locate() {
    if (!navigator.geolocation) {
      action.setError(
        "This browser does not support location. Select a pickup on the map.",
      );
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        try {
          const { data } = await api.get("/maps/reverse", {
            params: {
              latitude: p.coords.latitude,
              longitude: p.coords.longitude,
            },
          });
          setPickup(data);
        } catch {
          setPickup({
            address: "My current location",
            latitude: p.coords.latitude,
            longitude: p.coords.longitude,
          });
        }
        setLocating(false);
      },
      () => {
        action.setError(
          "Location permission was unavailable. Select your pickup on the map.",
        );
        setLocating(false);
      },
      { timeout: 10000 },
    );
  }
  const input = () => ({
    pickup,
    destination,
    stops: stops.filter(Boolean),
    rideCategory: category,
    paymentMethod: payment,
    ...(promo ? { promoCode: promo } : {}),
    ...(showSchedule && schedule
      ? { scheduledAt: new Date(schedule).toISOString() }
      : {}),
  });
  async function request() {
    await action.run(async () => {
      if (!estimates) {
        const { data } = await api.post("/rides/estimate", input());
        setEstimates(data);
      } else {
        const { data } = await api.post("/rides", input());
        setPin(data.pin);
        current.setData(data.ride);
      }
    }, undefined);
  }
  const selected = estimates?.find((e) => e.category === category);
  const active = current.data || finished;
  if (active)
    return (
      <Trip
        key={active._id}
        ride={active}
        role="passenger"
        initialPin={pin}
        refresh={refreshTrip}
        onDone={() => {
          setFinished(null);
          current.setData(null);
          setEstimates(null);
          history.refresh();
        }}
      />
    );
  if (current.loading) return <Loading />;
  return (
    <>
      <PageTitle
        eyebrow="A GOOD DAY TO GO SOMEWHERE"
        title={`Namaste, ${user.name.split(" ")[0]}.`}
        description="Where’s your day taking you?"
        action={
          <div className="city-badge">
            <span className="live-dot" />
            Nepalgunj, Nepal <span className="nepali">नेपालगञ्ज</span>
          </div>
        }
      />
      <div className="booking-layout">
        <section className="panel booking-card">
          <div className="card-heading">
            <h2>Let’s get you there.</h2>
            <Navigation size={21} />
          </div>
          <div className="ride-timing">
            <button
              className={!showSchedule ? "selected" : ""}
              onClick={() => setShowSchedule(false)}
            >
              <Clock3 size={15} />
              Ride now
            </button>
            <button
              className={showSchedule ? "selected" : ""}
              onClick={() => setShowSchedule(true)}
            >
              <CalendarDays size={15} />
              Schedule
            </button>
          </div>
          {showSchedule && (
            <label className="schedule-label">
              Pickup date & time
              <input
                type="datetime-local"
                value={schedule}
                min={new Date(
                  Date.now() +
                    10 * 60000 -
                    new Date().getTimezoneOffset() * 60000,
                )
                  .toISOString()
                  .slice(0, 16)}
                onChange={(e) => setSchedule(e.target.value)}
              />
            </label>
          )}
          <div className="location-stack">
            <LocationInput
              label={locating ? "LOCATING…" : "PICKUP LOCATION"}
              value={pickup}
              onChange={setPickup}
              kind="pickup"
              onLocate={locate}
              onFocus={() => setMapTarget("pickup")}
            />
            <button
              className="swap-button"
              title="Swap pickup and destination"
              onClick={() => {
                setPickup(destination);
                setDestination(pickup);
              }}
            >
              <ArrowUpDown size={15} />
            </button>
            {stops.map((stop, i) => (
              <div className="stop-field" key={i}>
                <LocationInput
                  label={`STOP ${i + 1}`}
                  value={stop}
                  onChange={(p) =>
                    setStops(stops.map((s, n) => (n === i ? p : s)))
                  }
                />
                <button
                  className="icon-button"
                  aria-label="Remove stop"
                  onClick={() => setStops(stops.filter((_, n) => n !== i))}
                >
                  <X size={15} />
                </button>
              </div>
            ))}
            <LocationInput
              label="WHERE TO?"
              value={destination}
              onChange={setDestination}
              onFocus={() => setMapTarget("destination")}
            />
          </div>
          <div className="location-options">
            <span>Or select {mapTarget} on the map</span>
            {stops.length < 2 && (
              <button onClick={() => setStops([...stops, null])}>
                <Plus size={14} />
                Add stop
              </button>
            )}
          </div>
          <div className="saved-shortcuts">
            {(saved.data || []).slice(0, 3).map((p) => (
              <button key={p._id} onClick={() => setDestination(p.place)}>
                {p.label === "Home" ? (
                  <Home size={16} />
                ) : p.label === "Work" ? (
                  <Briefcase size={16} />
                ) : (
                  <MapPin size={16} />
                )}{" "}
                {p.label}
              </button>
            ))}
          </div>
          <div className="section-label">
            <h3>Choose your ride</h3>
            <span>FOR EVERY KIND OF DAY</span>
          </div>
          <div className="categories">
            {CATEGORIES.map((c) => {
              const estimate = estimates?.find((e) => e.category === c.id);
              return (
                <button
                  key={c.id}
                  className={`category ${category === c.id ? "selected" : ""}`}
                  onClick={() => setCategory(c.id)}
                >
                  <span className={`vehicle-art ${c.id}`}>
                    <CategoryIcon category={c.id} size={35} />
                  </span>
                  <span className="category-copy">
                    <strong>
                      {c.name}
                      {c.id === "hariyo" && <Leaf size={12} />}
                    </strong>
                    <small>
                      {c.vehicleType === "motorcycle"
                        ? "Quick & easy"
                        : c.id === "sathi"
                          ? "Everyday comfort"
                          : c.id === "parivar"
                            ? "Room for everyone"
                            : "A lighter footprint"}
                      <span>
                        {" "}
                        · <Users size={10} /> {c.capacity}
                      </span>
                    </small>
                  </span>
                  <span className="category-price">
                    {estimate ? (
                      `Rs. ${money(estimate.breakdown.estimatedFare)}`
                    ) : (
                      <span>from Rs. {c.minimumFare}</span>
                    )}
                    <small>
                      {estimate
                        ? `${Math.round(estimate.durationMinutes)} min trip`
                        : ""}
                    </small>
                  </span>
                  <span className="radio-dot" />
                </button>
              );
            })}
          </div>
          <div className="payment-row">
            <label>
              Pay with
              <select
                value={payment}
                onChange={(e) => setPayment(e.target.value)}
              >
                <option value="CASH">Cash</option>
                <option value="WALLET">Wallet</option>
                {config.data?.mockPayments && (
                  <option value="MOCK_CARD">Mock card (test only)</option>
                )}
              </select>
            </label>
            <label>
              Promo code
              <input
                placeholder="Add a code"
                value={promo}
                onChange={(e) => setPromo(e.target.value.toUpperCase())}
                maxLength={20}
              />
            </label>
          </div>
          {selected && (
            <>
              <div className="estimate-line">
                <span>
                  {selected.distanceKm.toFixed(1)} km ·{" "}
                  {Math.round(selected.durationMinutes)} min
                </span>
                <strong>Rs. {money(selected.breakdown.estimatedFare)}</strong>
              </div>
              <FareDetails fare={selected.breakdown} />
              {selected.source === "approximate" && (
                <p className="small muted">
                  Approximate route: road routing is unavailable. Distance and
                  time may vary.
                </p>
              )}
            </>
          )}
          <Feedback
            error={selected?.promoError || action.error || current.error}
            success={action.success}
          />
          <PrimaryButton
            busy={action.busy}
            disabled={
              !!selected?.promoError ||
              !pickup ||
              !destination ||
              stops.some((s) => !s) ||
              (showSchedule && !schedule)
            }
            onClick={request}
          >
            {estimates
              ? showSchedule
                ? "Schedule ride"
                : `Request ${CATEGORIES.find((c) => c.id === category).name}`
              : "See ride estimates"}
          </PrimaryButton>
          <p className="booking-note">
            <ShieldCheck size={13} />
            Clear fares. No surprises. Always local.
          </p>
        </section>
        <div className="map-column">
          <RideMap
            pickup={pickup}
            destination={destination}
            route={selected?.geometry}
            onPick={async (p) => {
              (mapTarget === "pickup" ? setPickup : setDestination)(p);
            }}
          />
          <div className="local-banner">
            <div>
              <span className="eyebrow">SMALL RIDES. BIG CONNECTIONS.</span>
              <h3>
                Made for the places
                <br />
                you call yours.
              </h3>
              <p>
                Around the corner or across the city,
                <br />
                your next chapter is a ride away.
              </p>
            </div>
            <div className="banner-art">
              <div className="sun" />
              <div className="temple">
                <span />
                <span />
                <span />
                <i />
              </div>
              <div className="tree" />
              <span className="banner-road" />
            </div>
            <span className="banner-tag">
              100% local spirit <ArrowRight size={13} />
            </span>
          </div>
        </div>
      </div>
      <div className="bottom-grid">
        <section className="panel destinations">
          <div className="card-heading">
            <h3>Somewhere familiar?</h3>
            <span className="muted small">A little closer, every day</span>
          </div>
          <div className="destination-grid">
            {PLACES.slice(1, 5).map((place, i) => (
              <button
                onClick={() => {
                  setDestination(place);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                key={place.address}
              >
                <span className={`destination-icon tone-${i}`}>
                  <MapPin size={20} />
                </span>
                <span>
                  <strong>{place.address.split(",")[0]}</strong>
                  <small>Nepalgunj</small>
                </span>
                <ArrowRight size={15} />
              </button>
            ))}
          </div>
        </section>
        <section className="safety-card">
          <span className="safety-icon">
            <ShieldCheck size={26} />
          </span>
          <h3>A little peace of mind.</h3>
          <p>
            Verified drivers, a private trip PIN, and a way to share your
            journey.
          </p>
          <span>YOUR SAFETY RIDES WITH YOU</span>
        </section>
      </div>
    </>
  );
}
