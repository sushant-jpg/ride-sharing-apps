import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Wallet as WalletIcon,
  ArrowUpRight,
  ArrowDownLeft,
  Bell,
  ShieldCheck,
  Download,
  MapPin,
} from "lucide-react";
import { api, money, date, useSession } from "./api.js";
import { useAction, useResource } from "./hooks.js";
import {
  PageTitle,
  Feedback,
  PrimaryButton,
  Empty,
  Loading,
  Status,
  CategoryIcon,
} from "./components.jsx";
import Trip from "./Trip.jsx";
import LocationInput from "./LocationInput.jsx";
export function History({ role }) {
  const list = useResource("/rides/history");
  const [selected, setSelected] = useState(null);
  const action = useAction();
  const navigate = useNavigate();
  if (selected)
    return (
      <>
        <button className="text-button" onClick={() => setSelected(null)}>
          ← All trips
        </button>
        <Trip
          key={selected._id}
          ride={selected}
          role={role}
          refresh={async () => {
            const { data } = await api.get(`/rides/${selected._id}`);
            setSelected(data);
          }}
          onDone={() => setSelected(null)}
        />
      </>
    );
  return (
    <>
      <PageTitle
        title="The places you’ve been."
        description="Your journeys, all in one place."
      />
      <Feedback {...action} />
      <section className="panel">
        {list.loading ? (
          <Loading />
        ) : list.error ? (
          <Feedback error={list.error} />
        ) : !list.data?.length ? (
          <Empty
            title="Your first journey is waiting."
            text="Request a ride to start exploring."
          />
        ) : (
          <div className="trip-list">
            {list.data.map((ride) => (
              <div className="history-row" key={ride._id}>
                <span className="vehicle-art">
                  <CategoryIcon category={ride.rideCategory} />
                </span>
                <button
                  className="history-main"
                  onClick={() =>
                    action.run(async () => {
                      if (
                        !["TRIP_COMPLETED", "CANCELLED"].includes(ride.status)
                      ) {
                        navigate("/");
                        return;
                      }
                      const { data } = await api.get(`/rides/${ride._id}`);
                      setSelected(data);
                    })
                  }
                >
                  <strong>{ride.destination.address}</strong>
                  <span>{ride.pickup.address}</span>
                  <small>{date(ride.createdAt)}</small>
                </button>
                <div>
                  <strong>
                    Rs. {money(ride.finalFare ?? ride.estimatedFare)}
                  </strong>
                  <Status value={ride.status} />
                </div>
                {ride.status === "TRIP_COMPLETED" && (
                  <button
                    className="icon-button"
                    title="Download receipt"
                    onClick={() =>
                      action.run(async () => {
                        const { data } = await api.get(
                          `/rides/${ride._id}/receipt`,
                        );
                        const text = `Ride Nepaljung receipt\nRide: ${ride._id}\nDate: ${date(ride.completedAt)}\nFrom: ${ride.pickup.address}\nTo: ${ride.destination.address}\nFare: NPR ${ride.finalFare}\nPayment: ${data.payment?.paymentMethod} (${data.payment?.status})\n`;
                        const url = URL.createObjectURL(
                          new Blob([text], { type: "text/plain" }),
                        );
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `ride-nepaljung-${ride._id}.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                      })
                    }
                  >
                    <Download size={18} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
export function Wallet() {
  const wallet = useResource("/wallet"),
    transactions = useResource("/wallet/transactions"),
    config = useResource("/config");
  const action = useAction();
  return (
    <>
      <PageTitle
        title="A little ready-to-go."
        description="Your wallet, credits, and transactions."
      />
      <div className="wallet-grid">
        <div className="wallet-card">
          <div className="card-heading">
            <span>RIDE NEPALJUNG WALLET</span>
            <WalletIcon />
          </div>
          <p>Available balance</p>
          <strong>
            <small>NPR</small> {money(wallet.data?.balance)}
          </strong>
          <div className="card-heading">
            <span>Cashless, effortless.</span>
            <ArrowUpRight />
          </div>
        </div>
        <section className="panel">
          <h3>Keep your next ride covered.</h3>
          <p className="muted">
            Use your balance to pay for rides. Every credit and debit stays in
            your transaction history.
          </p>
          {config.data?.mockPayments ? (
            <>
              <PrimaryButton
                busy={action.busy}
                onClick={() =>
                  action.run(async () => {
                    await api.post("/wallet/mock-credit", { amount: 500 });
                    wallet.refresh();
                    transactions.refresh();
                  }, "Rs. 500 in development credits added. No real money was charged.")
                }
              >
                Add Rs. 500 test credits
              </PrimaryButton>
              <p className="small muted">
                Development mode · no real payment is collected.
              </p>
            </>
          ) : (
            <p className="pill">Online top-ups: coming soon</p>
          )}
          <Feedback
            error={action.error || wallet.error}
            success={action.success}
          />
        </section>
      </div>
      <section className="panel">
        <h3>Recent transactions</h3>
        {transactions.loading ? (
          <Loading />
        ) : transactions.data?.length ? (
          transactions.data.map((t) => (
            <div className="transaction" key={t._id}>
              <span className="transaction-icon">
                {t.amount > 0 ? <ArrowDownLeft /> : <ArrowUpRight />}
              </span>
              <div>
                <strong>{t.description}</strong>
                <small>{date(t.createdAt)}</small>
              </div>
              <strong className={t.amount > 0 ? "green" : ""}>
                {t.amount > 0 ? "+" : "−"} Rs. {money(Math.abs(t.amount))}
              </strong>
            </div>
          ))
        ) : (
          <Empty
            title="A fresh start."
            text="Your wallet activity will appear here."
          />
        )}
      </section>
    </>
  );
}
export function Notifications({ revision }) {
  const notes = useResource("/notifications", 15000);
  const action = useAction();
  return (
    <>
      <PageTitle
        title="You’re in the loop."
        description="Ride updates and a few good things to know."
        action={
          <button
            className="button secondary"
            disabled={action.busy}
            onClick={() =>
              action.run(async () => {
                await api.post("/notifications/read");
                notes.refresh();
              })
            }
          >
            Mark all as read
          </button>
        }
      />
      <Feedback error={action.error || notes.error} />
      <section className="panel" data-revision={revision}>
        {notes.loading ? (
          <Loading />
        ) : notes.data?.length ? (
          notes.data.map((n) => (
            <div
              className={`notification ${!n.read ? "unread" : ""}`}
              key={n._id}
            >
              <span className="transaction-icon">
                <Bell size={20} />
              </span>
              <div>
                <strong>{n.title}</strong>
                <p>{n.message}</p>
                <small>{date(n.createdAt)}</small>
              </div>
              {!n.read && <span className="live-dot" />}
            </div>
          ))
        ) : (
          <Empty
            title="All quiet for now."
            text="We’ll keep you posted on your rides."
          />
        )}
      </section>
    </>
  );
}
export function Profile({ role }) {
  const session = useSession();
  const action = useAction(),
    saved = useResource("/places");
  const [name, setName] = useState(session.user.name),
    [phone, setPhone] = useState(session.user.phone || ""),
    [emergency, setEmergency] = useState(session.user.emergencyContact || ""),
    [avatar, setAvatar] = useState(session.user.avatarUrl || ""),
    [label, setLabel] = useState("Home"),
    [place, setPlace] = useState(null);
  return (
    <>
      <PageTitle
        title="Make yourself at home."
        description="Your details, saved places, and a little peace of mind."
      />
      <div className="profile-grid">
        <form
          className="panel"
          onSubmit={(e) => {
            e.preventDefault();
            action.run(async () => {
              const { data } = await api.patch("/users/profile", {
                name,
                phone,
                emergencyContact: emergency,
                avatarUrl: avatar,
              });
              useSession.setState({ user: data });
            }, "Profile updated.");
          }}
        >
          <h3>Personal details</h3>
          <label>
            Full name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
            />
          </label>
          <label>
            Email address
            <input value={session.user.email} disabled />
          </label>
          <label>
            Phone number
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              minLength={7}
            />
          </label>
          <label>
            Profile image URL
            <input
              type="url"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder="https://…"
            />
          </label>
          <label>
            Emergency contact
            <input
              value={emergency}
              onChange={(e) => setEmergency(e.target.value)}
              placeholder="Name and phone number"
            />
          </label>
          <Feedback {...action} />
          <PrimaryButton busy={action.busy}>Save details</PrimaryButton>
        </form>
        <div>
          <section className="panel">
            <h3>
              <ShieldCheck size={19} /> Account security
            </h3>
            <p className="muted">
              End all active sessions if you’ve signed in on a shared device.
            </p>
            <button
              className="button secondary"
              onClick={() =>
                action.run(async () => {
                  await api.post("/auth/logout-all");
                  session.clear();
                })
              }
            >
              Sign out on all devices
            </button>
          </section>
          {role === "passenger" && (
            <section className="panel">
              <h3>Your saved places</h3>
              {saved.data?.map((p) => (
                <div className="saved-row" key={p._id}>
                  <MapPin size={16} />
                  <div>
                    <strong>{p.label}</strong>
                    <small>{p.place.address}</small>
                  </div>
                  <button
                    className="text-button"
                    onClick={() =>
                      action.run(async () => {
                        await api.delete(`/places/${p._id}`);
                        saved.refresh();
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
              <label>
                Place label
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  maxLength={40}
                />
              </label>
              <LocationInput
                label="ADDRESS"
                value={place}
                onChange={setPlace}
              />
              <button
                className="button secondary"
                disabled={!place || !label || action.busy}
                onClick={() =>
                  action.run(async () => {
                    await api.post("/places", { label, place });
                    saved.refresh();
                  }, "Place saved.")
                }
              >
                Save place
              </button>
            </section>
          )}
        </div>
      </div>
      {role === "driver" && <DriverRegistration />}
    </>
  );
}
function DriverRegistration() {
  const action = useAction();
  const profile = useResource("/drivers/profile");
  const fields = [
    "address",
    "licenseNumber",
    "licenseImage",
    "identityDocument",
    "vehicleRegistration",
    "brand",
    "model",
    "year",
    "plateNumber",
    "color",
    "seatCapacity",
    "photoUrl",
  ];
  return (
    <form
      className="panel"
      onSubmit={(e) => {
        e.preventDefault();
        const form = Object.fromEntries(new FormData(e.target));
        form.year = Number(form.year);
        form.seatCapacity = Number(form.seatCapacity);
        action.run(async () => {
          await api.put("/drivers/profile", form);
          profile.refresh();
        }, "Submitted for review. Your account will be offline until approved.");
      }}
    >
      <div className="card-heading">
        <h3>Driver & vehicle verification</h3>
        <Status value={profile.data?.profile?.status} />
      </div>
      <p className="muted">
        Use secure, access-controlled document URLs for operator review. Direct
        document uploads: coming soon. Resubmitting requires a new approval.
      </p>
      <div className="form-grid">
        {fields.map((field) => (
          <label key={field}>
            {field.replace(/([A-Z])/g, " $1")}
            <input
              name={field}
              type={
                ["year", "seatCapacity"].includes(field)
                  ? "number"
                  : /(Image|Document|Registration|Url)$/.test(field)
                    ? "url"
                    : "text"
              }
              required
              defaultValue={
                profile.data?.profile?.[field] ||
                profile.data?.vehicle?.[field] ||
                ""
              }
            />
          </label>
        ))}
        <label>
          Ride category
          <select name="category">
            <option value="sajilo">Sajilo · motorcycle</option>
            <option value="sathi">Sathi · car</option>
            <option value="parivar">Parivar · van</option>
            <option value="hariyo">Hariyo · electric</option>
          </select>
        </label>
      </div>
      <Feedback {...action} />
      <PrimaryButton busy={action.busy}>Submit for verification</PrimaryButton>
    </form>
  );
}
export function Support() {
  const tickets = useResource("/support"),
    action = useAction();
  const [category, setCategory] = useState("TECHNICAL"),
    [text, setText] = useState("");
  return (
    <>
      <PageTitle
        title="We’re here to listen."
        description="Tell the operations team what happened."
      />
      <div className="profile-grid">
        <form
          className="panel"
          onSubmit={(e) => {
            e.preventDefault();
            action.run(async () => {
              await api.post("/support", { category, message: text });
              setText("");
              tickets.refresh();
            }, "Support request submitted.");
          }}
        >
          <label>
            What can we help with?
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {[
                "PAYMENT",
                "DRIVER",
                "PASSENGER",
                "LOST_ITEM",
                "SAFETY",
                "TECHNICAL",
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Your message
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              required
              minLength={10}
              maxLength={2000}
              rows={6}
            />
          </label>
          <Feedback {...action} />
          <PrimaryButton busy={action.busy}>Send request</PrimaryButton>
        </form>
        <section className="panel">
          <h3>Your support requests</h3>
          {tickets.data?.length ? (
            tickets.data.map((t) => (
              <div className="ticket" key={t._id}>
                <Status value={t.status} />
                <p>{t.message}</p>
                <small>{date(t.createdAt)}</small>
              </div>
            ))
          ) : (
            <Empty
              title="No open conversations."
              text="Your support requests will appear here."
            />
          )}
        </section>
      </div>
    </>
  );
}
