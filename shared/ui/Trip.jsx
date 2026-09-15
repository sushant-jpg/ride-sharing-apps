import { useState } from "react";
import {
  Phone,
  ShieldCheck,
  Share2,
  KeyRound,
  MapPin,
  Star,
} from "lucide-react";
import RideMap from "./Map.jsx";
import { api, money } from "./api.js";
import { useAction } from "./hooks.js";
import { Feedback, PrimaryButton, Status, FareDetails } from "./components.jsx";
const labels = {
  SCHEDULED: [
    "Your ride is scheduled.",
    "Matching starts five minutes before pickup.",
  ],
  SEARCHING: [
    "Finding your local match.",
    "We’re checking nearby available drivers. This can take up to two minutes.",
  ],
  DRIVER_ASSIGNED: [
    "Your driver is on the way.",
    "Meet your driver at your pickup point.",
  ],
  DRIVER_ARRIVING: [
    "Almost at your doorstep.",
    "Your driver is heading to your pickup point.",
  ],
  DRIVER_ARRIVED: [
    "Your driver has arrived.",
    "Share your trip PIN when you’re ready to leave.",
  ],
  TRIP_STARTED: [
    "You’re on your way.",
    "Settle in. Your next stop is getting closer.",
  ],
  TRIP_COMPLETED: [
    "Thanks for riding local.",
    "Your trip is complete. How was the ride?",
  ],
  CANCELLED: [
    "This ride was cancelled.",
    "You can request another ride when you’re ready.",
  ],
};
export default function Trip({ ride, role, refresh, onDone, initialPin }) {
  const [pin, setPin] = useState(initialPin || ""),
    [driverPin, setDriverPin] = useState(""),
    [share, setShare] = useState(""),
    [reason, setReason] = useState(""),
    [cancel, setCancel] = useState(false),
    [rating, setRating] = useState(5),
    [feedback, setFeedback] = useState(""),
    [rated, setRated] = useState(false);
  const action = useAction();
  const passenger = role === "passenger";
  const done = ["TRIP_COMPLETED", "CANCELLED"].includes(ride.status);
  const [title, subtitle] = labels[ride.status] || [];
  const person = passenger ? ride.driver : ride.passenger;
  async function advance(step) {
    await action.run(async () => {
      await api.post(
        `/drivers/rides/${ride._id}/${step}`,
        step === "start" ? { pin: driverPin } : {},
      );
      await refresh();
    });
  }
  async function sos() {
    await action.run(async () => {
      const { data } = await api.post(`/rides/${ride._id}/sos`, {
        location: ride.driverLocation?.location
          ? {
              address: "Current trip location",
              latitude: ride.driverLocation.location.coordinates[1],
              longitude: ride.driverLocation.location.coordinates[0],
            }
          : ride.pickup,
      });
      return data;
    }, "Incident recorded for operations. Emergency services are not automatically contacted.");
  }
  return (
    <div className="active-trip">
      <div className="trip-top">
        <div>
          <Status value={ride.status} />
          <h2>{title}</h2>
          <p className="muted">{subtitle}</p>
        </div>
        {ride.status === "SEARCHING" && (
          <div className="search-pulse">
            <MapPin />
          </div>
        )}
      </div>
      <div className="trip-layout">
        <div className="panel trip-summary">
          {person && (
            <div className="driver-person">
              <div className="avatar large">{person.name?.slice(0, 1)}</div>
              <div>
                <h3>{person.name}</h3>
                <span>
                  <Star size={13} fill="currentColor" />{" "}
                  {person.rating?.toFixed(1) || "5.0"} ·{" "}
                  {passenger ? "Your local driver" : "Passenger"}
                </span>
                {ride.vehicle && (
                  <p>
                    {ride.vehicle.color} {ride.vehicle.brand}{" "}
                    {ride.vehicle.model}
                    <br />
                    <strong>{ride.vehicle.plateNumber}</strong>
                  </p>
                )}
              </div>
              <a
                className="icon-button"
                href={`tel:${person.phone}`}
                aria-label="Call ride participant"
              >
                <Phone size={18} />
              </a>
            </div>
          )}
          <div className="trip-address">
            <span className="location-dot" />
            <div>
              <small>PICKUP</small>
              <p>{ride.pickup.address}</p>
            </div>
          </div>
          {ride.stops?.map((stop, i) => (
            <div className="trip-address" key={i}>
              <span className="location-dot" />
              <div>
                <small>STOP {i + 1}</small>
                <p>{stop.address}</p>
              </div>
            </div>
          ))}
          <div className="trip-address destination">
            <span className="location-dot" />
            <div>
              <small>DESTINATION</small>
              <p>{ride.destination.address}</p>
            </div>
          </div>
          <div className="trip-fare">
            <span>
              {done ? "Final fare" : "Estimated fare"}
              <small>
                {ride.paymentMethod.replace("_", " ")} · {ride.paymentStatus}
              </small>
            </span>
            <strong>Rs. {money(ride.finalFare ?? ride.estimatedFare)}</strong>
          </div>
          <FareDetails fare={ride.fareBreakdown} />
          {passenger && !done && ride.status !== "TRIP_STARTED" && (
            <div className="pin-box">
              <KeyRound size={23} />
              <div>
                <small>YOUR TRIP PIN</small>
                {pin ? (
                  <strong>{pin.split("").join(" ")}</strong>
                ) : (
                  <button
                    onClick={() =>
                      action.run(async () => {
                        const { data } = await api.post(
                          `/rides/${ride._id}/pin`,
                        );
                        setPin(data.pin);
                      })
                    }
                  >
                    Generate a new PIN
                  </button>
                )}
                <p>Only share with your driver at pickup.</p>
              </div>
            </div>
          )}
          {!passenger && !done && (
            <div className="driver-actions">
              {["DRIVER_ASSIGNED", "DRIVER_ARRIVING"].includes(ride.status) && (
                <PrimaryButton
                  busy={action.busy}
                  onClick={() => advance("arrived")}
                >
                  I’ve arrived
                </PrimaryButton>
              )}
              {ride.status === "DRIVER_ARRIVED" && (
                <>
                  <label>
                    Passenger’s 4-digit PIN
                    <input
                      inputMode="numeric"
                      maxLength={4}
                      value={driverPin}
                      onChange={(e) =>
                        setDriverPin(e.target.value.replace(/\D/g, ""))
                      }
                    />
                  </label>
                  <PrimaryButton
                    busy={action.busy}
                    disabled={driverPin.length !== 4}
                    onClick={() => advance("start")}
                  >
                    Start trip
                  </PrimaryButton>
                </>
              )}
              {ride.status === "TRIP_STARTED" && (
                <PrimaryButton
                  busy={action.busy}
                  onClick={() => advance("complete")}
                >
                  Complete ride
                </PrimaryButton>
              )}
              <a
                className="button secondary"
                target="_blank"
                rel="noreferrer"
                href={`https://www.openstreetmap.org/directions?route=;${ride.status === "TRIP_STARTED" ? ride.destination.latitude : ride.pickup.latitude},${ride.status === "TRIP_STARTED" ? ride.destination.longitude : ride.pickup.longitude}`}
              >
                Open navigation
              </a>
            </div>
          )}
          {passenger && !done && (
            <label className="payment-change">
              Payment method
              <select
                value={ride.paymentMethod}
                onChange={(e) =>
                  action.run(async () => {
                    await api.patch(`/rides/${ride._id}/payment-method`, {
                      paymentMethod: e.target.value,
                    });
                    await refresh();
                  })
                }
              >
                <option value="CASH">Cash</option>
                <option value="WALLET">Wallet</option>
                {ride.paymentMethod === "MOCK_CARD" && (
                  <option value="MOCK_CARD">Mock card</option>
                )}
              </select>
            </label>
          )}
          <Feedback {...action} />
          {!done && (
            <>
              <div className="trip-safety">
                <button onClick={sos} disabled={action.busy}>
                  <ShieldCheck size={17} />
                  Safety alert
                </button>
                <button
                  onClick={() =>
                    action.run(async () => {
                      const { data } = await api.post(
                        `/rides/${ride._id}/share`,
                      );
                      const url = `${window.location.origin}/track/${data.token}`;
                      setShare(url);
                    })
                  }
                >
                  <Share2 size={16} />
                  Share trip
                </button>
              </div>
              {share && (
                <label>
                  Tracking link · expires in 2 hours
                  <input
                    readOnly
                    value={share}
                    onFocus={(e) => e.target.select()}
                  />
                </label>
              )}
              {!(role === "driver" && ride.status === "TRIP_STARTED") && (
                <button
                  className="text-button danger"
                  onClick={() => setCancel(!cancel)}
                >
                  Cancel ride
                </button>
              )}
              {cancel && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    action.run(async () => {
                      await api.post(`/rides/${ride._id}/cancel`, { reason });
                      await refresh();
                    });
                  }}
                >
                  <label>
                    Cancellation reason
                    <input
                      required
                      minLength={3}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </label>
                  <button className="button secondary" disabled={action.busy}>
                    Confirm cancellation
                  </button>
                </form>
              )}
            </>
          )}
          {ride.status === "TRIP_COMPLETED" && !rated && (
            <form
              className="rating-form"
              onSubmit={(e) => {
                e.preventDefault();
                action.run(async () => {
                  await api.post(`/rides/${ride._id}/rate`, {
                    value: rating,
                    feedback,
                  });
                  setRated(true);
                }, "Thank you for your feedback.");
              }}
            >
              <h3>How was your ride?</h3>
              <div className="stars">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`Rate ${n} stars`}
                    onClick={() => setRating(n)}
                  >
                    <Star fill={n <= rating ? "currentColor" : "none"} />
                  </button>
                ))}
              </div>
              <input
                placeholder="A little feedback (optional)"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                maxLength={500}
              />
              <PrimaryButton busy={action.busy}>Submit rating</PrimaryButton>
            </form>
          )}
          {done && onDone && (
            <button className="button secondary" onClick={onDone}>
              Back to home
            </button>
          )}
        </div>
        <RideMap
          pickup={ride.pickup}
          destination={ride.destination}
          route={ride.route}
          driver={ride.driverLocation?.location?.coordinates}
        />
      </div>
    </div>
  );
}
