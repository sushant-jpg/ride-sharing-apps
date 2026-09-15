import { useState } from "react";
import {
  Users,
  Car,
  Route,
  Wallet,
  ArrowUpRight,
  Activity,
} from "lucide-react";
import { api, money, date } from "./api.js";
import { useAction, useResource } from "./hooks.js";
import {
  PageTitle,
  Stat,
  Status,
  Feedback,
  Loading,
  Empty,
  PrimaryButton,
} from "./components.jsx";
import RideMap from "./Map.jsx";
export default function Admin({ view = "dashboard" }) {
  const endpoint =
    {
      dashboard: "dashboard",
      reports: "dashboard",
      "live-rides": "rides",
      drivers: "drivers",
      passengers: "users",
      rides: "rides",
      payments: "payments",
      promos: "promos",
      support: "support",
      safety: "safety",
      settings: "settings",
    }[view] || "dashboard";
  const resource = useResource(
      `/admin/${endpoint}`,
      view === "live-rides" ? 10000 : 0,
    ),
    action = useAction();
  const [selected, setSelected] = useState(null),
    [vehicle, setVehicle] = useState(null);
  async function change(path, body, text) {
    await action.run(async () => {
      await api[path.endsWith("confirm-cash") ? "post" : "patch"](
        `/admin/${path}`,
        body,
      );
      resource.refresh();
    }, text || "Updated.");
  }
  const title = {
    dashboard: "A city in motion.",
    reports: "The bigger picture.",
    "live-rides": "Every ride, in view.",
    drivers: "The people behind the wheel.",
    passengers: "Your local community.",
    rides: "Every journey has a story.",
    payments: "Keep the numbers clear.",
    promos: "A little reason to ride.",
    support: "Good service starts here.",
    safety: "Look out for your city.",
    settings: "Set the pace.",
  }[view];
  const data = resource.data;
  return (
    <>
      <PageTitle
        eyebrow="RIDE NEPALJUNG · OPERATIONS"
        title={title}
        description="A little attention makes a better everyday."
        action={
          <button className="button secondary" onClick={resource.refresh}>
            <Activity size={16} />
            Refresh
          </button>
        }
      />
      <Feedback
        error={action.error || resource.error}
        success={action.success}
      />
      {resource.loading ? (
        <Loading />
      ) : (
        data && (
          <>
            {["dashboard", "reports"].includes(view) ? (
              <>
                <div className="stats-grid four">
                  <Stat
                    label="Passengers"
                    value={data.users}
                    icon={Users}
                    detail="Registered accounts"
                  />
                  <Stat
                    label="Online drivers"
                    value={data.activeDrivers}
                    icon={Car}
                    detail={`${data.drivers} total drivers`}
                  />
                  <Stat
                    label="Active rides"
                    value={data.activeRides}
                    icon={Route}
                    detail={`${data.completed} completed rides`}
                  />
                  <Stat
                    label="Gross trip fares"
                    value={`Rs. ${money(data.revenue)}`}
                    icon={Wallet}
                    detail={`Rs. ${money(data.commission)} platform commission`}
                  />
                </div>
                <div className="admin-chart-grid">
                  <section className="panel">
                    <div className="card-heading">
                      <h3>Rides over the last 30 days</h3>
                      <span className="pill">COMPLETED RIDES</span>
                    </div>
                    {data.daily.length ? (
                      <div className="bar-chart">
                        {data.daily.map((d) => (
                          <div
                            className="chart-column"
                            key={d._id}
                            title={`${d._id}: ${d.rides} rides, Rs. ${money(d.revenue)}`}
                          >
                            <span>{d.rides}</span>
                            <div
                              style={{
                                height: `${Math.max(8, (d.rides / Math.max(...data.daily.map((x) => x.rides))) * 150)}px`,
                              }}
                            />
                            <small>{d._id.slice(5)}</small>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Empty
                        title="Your chart starts with a ride."
                        text="Completed trips will appear here."
                      />
                    )}
                  </section>
                  <section className="panel">
                    <h3>At a glance</h3>
                    <div className="metric-line">
                      <span>Cancellation rate</span>
                      <strong>{data.cancellationRate.toFixed(1)}%</strong>
                    </div>
                    <div className="metric-line">
                      <span>Average trip fare</span>
                      <strong>Rs. {money(data.averageFare)}</strong>
                    </div>
                    <div className="metric-line">
                      <span>Cancelled rides</span>
                      <strong>{data.cancelled}</strong>
                    </div>
                    <div className="metric-line">
                      <span>Platform commission</span>
                      <strong>Rs. {money(data.commission)}</strong>
                    </div>
                  </section>
                </div>
                <div className="profile-grid">
                  <section className="panel">
                    <h3>Rides by category</h3>
                    {data.categories.map((c) => (
                      <div className="metric-line" key={c._id}>
                        <span>{c._id}</span>
                        <strong>{c.count}</strong>
                      </div>
                    ))}
                  </section>
                  <section className="panel">
                    <h3>Most active pickup areas</h3>
                    {data.zones.map((c) => (
                      <div className="metric-line" key={c._id}>
                        <span>{c._id}</span>
                        <strong>{c.count}</strong>
                      </div>
                    ))}
                  </section>
                </div>
              </>
            ) : view === "settings" ? (
              <Settings data={data} refresh={resource.refresh} />
            ) : (
              <>
                {view === "promos" && <PromoForm refresh={resource.refresh} />}
                <section className="panel">
                  <div className="table-wrap">
                    {data.length ? (
                      <table>
                        <thead>
                          <tr>
                            {(
                              {
                                drivers: [
                                  "Driver",
                                  "Contact",
                                  "Status",
                                  "Actions",
                                ],
                                passengers: [
                                  "Passenger",
                                  "Email",
                                  "Status",
                                  "Actions",
                                ],
                                rides: [
                                  "Route",
                                  "Passenger",
                                  "Driver",
                                  "Fare",
                                  "Status",
                                ],
                                "live-rides": [
                                  "Route",
                                  "Passenger",
                                  "Driver",
                                  "Fare",
                                  "Status",
                                ],
                                payments: [
                                  "Reference",
                                  "Method",
                                  "Amount",
                                  "Status",
                                  "Action",
                                ],
                                promos: [
                                  "Code",
                                  "Discount",
                                  "Uses",
                                  "Expires",
                                  "Minimum",
                                ],
                                support: [
                                  "User",
                                  "Message",
                                  "Category",
                                  "Status",
                                  "Action",
                                ],
                                safety: [
                                  "User",
                                  "Location",
                                  "Created",
                                  "Status",
                                  "Action",
                                ],
                              }[view] || []
                            ).map((h) => (
                              <th key={h}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {data
                            .filter(
                              (row) =>
                                view !== "live-rides" ||
                                ![
                                  "TRIP_COMPLETED",
                                  "CANCELLED",
                                  "SCHEDULED",
                                ].includes(row.status),
                            )
                            .map((row) => (
                              <tr key={row._id}>
                                {view === "drivers" ? (
                                  <>
                                    <td>
                                      <strong>{row.user?.name}</strong>
                                      <small>{row.licenseNumber}</small>
                                    </td>
                                    <td>
                                      {row.user?.email}
                                      <small>{row.user?.phone}</small>
                                    </td>
                                    <td>
                                      <Status value={row.status} />
                                    </td>
                                    <td>
                                      <div className="table-actions">
                                        <button
                                          onClick={() =>
                                            action.run(async () => {
                                              const { data: v } = await api.get(
                                                `/admin/drivers/${row.user._id}/vehicle`,
                                              );
                                              setVehicle(v);
                                              setSelected(row);
                                            })
                                          }
                                        >
                                          Review
                                        </button>
                                        {row.status === "APPROVED" && (
                                          <button
                                            onClick={() =>
                                              change(
                                                `drivers/${row.user._id}/status`,
                                                { status: "SUSPENDED" },
                                              )
                                            }
                                          >
                                            Suspend
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </>
                                ) : view === "passengers" ? (
                                  <>
                                    <td>{row.name}</td>
                                    <td>{row.email}</td>
                                    <td>
                                      <Status
                                        value={
                                          row.suspended ? "SUSPENDED" : "ACTIVE"
                                        }
                                      />
                                    </td>
                                    <td>
                                      <button
                                        className="text-button"
                                        disabled={action.busy}
                                        onClick={() =>
                                          change(`users/${row._id}`, {
                                            suspended: !row.suspended,
                                          })
                                        }
                                      >
                                        {row.suspended ? "Restore" : "Suspend"}
                                      </button>
                                    </td>
                                  </>
                                ) : ["rides", "live-rides"].includes(view) ? (
                                  <>
                                    <td>
                                      <button
                                        className="table-link"
                                        onClick={() => setSelected(row)}
                                      >
                                        {row.destination.address}
                                      </button>
                                      <small>From {row.pickup.address}</small>
                                    </td>
                                    <td>{row.passenger?.name}</td>
                                    <td>{row.driver?.name || "Searching"}</td>
                                    <td>
                                      Rs.{" "}
                                      {money(
                                        row.finalFare ?? row.estimatedFare,
                                      )}
                                    </td>
                                    <td>
                                      <Status value={row.status} />
                                    </td>
                                  </>
                                ) : view === "payments" ? (
                                  <>
                                    <td className="mono">
                                      {row.transactionReference?.slice(0, 16)}
                                    </td>
                                    <td>{row.paymentMethod}</td>
                                    <td>Rs. {money(row.amount)}</td>
                                    <td>
                                      <Status value={row.status} />
                                    </td>
                                    <td>
                                      {row.paymentMethod === "CASH" &&
                                        row.status === "PENDING" && (
                                          <button
                                            className="text-button"
                                            disabled={action.busy}
                                            onClick={() =>
                                              change(
                                                `payments/${row._id}/confirm-cash`,
                                                {},
                                              )
                                            }
                                          >
                                            Confirm collected
                                          </button>
                                        )}
                                    </td>
                                  </>
                                ) : view === "promos" ? (
                                  <>
                                    <td>
                                      <strong>{row.code}</strong>
                                    </td>
                                    <td>
                                      {row.type === "PERCENT"
                                        ? `${row.value}%`
                                        : `Rs. ${row.value}`}
                                    </td>
                                    <td>
                                      {row.used} / {row.usageLimit}
                                    </td>
                                    <td>{date(row.expiresAt)}</td>
                                    <td>Rs. {row.minimumAmount}</td>
                                  </>
                                ) : view === "support" ? (
                                  <>
                                    <td>{row.user?.name}</td>
                                    <td>{row.message}</td>
                                    <td>{row.category}</td>
                                    <td>
                                      <Status value={row.status} />
                                    </td>
                                    <td>
                                      <select
                                        aria-label="Ticket status"
                                        value={row.status}
                                        disabled={action.busy}
                                        onChange={(e) =>
                                          change(`support/${row._id}`, {
                                            status: e.target.value,
                                          })
                                        }
                                      >
                                        {[
                                          "OPEN",
                                          "IN_PROGRESS",
                                          "RESOLVED",
                                          "CLOSED",
                                        ].map((s) => (
                                          <option key={s}>{s}</option>
                                        ))}
                                      </select>
                                    </td>
                                  </>
                                ) : view === "safety" ? (
                                  <>
                                    <td>
                                      {row.user?.name}
                                      <small>{row.user?.phone}</small>
                                    </td>
                                    <td>
                                      {row.location.address}
                                      <small>
                                        {row.location.latitude.toFixed(4)},{" "}
                                        {row.location.longitude.toFixed(4)}
                                      </small>
                                    </td>
                                    <td>{date(row.createdAt)}</td>
                                    <td>
                                      <Status value={row.status} />
                                    </td>
                                    <td>
                                      {row.status === "OPEN" && (
                                        <button
                                          className="text-button"
                                          disabled={action.busy}
                                          onClick={() =>
                                            change(`safety/${row._id}`, {})
                                          }
                                        >
                                          Mark resolved
                                        </button>
                                      )}
                                    </td>
                                  </>
                                ) : null}
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    ) : (
                      <Empty
                        title="Nothing to review right now."
                        text="New records will appear here."
                      />
                    )}
                  </div>
                </section>
                {selected && (
                  <section className="panel">
                    <div className="card-heading">
                      <h3>
                        {view === "drivers"
                          ? `Review ${selected.user.name}`
                          : "Ride detail"}
                      </h3>
                      <button
                        className="text-button"
                        onClick={() => setSelected(null)}
                      >
                        Close
                      </button>
                    </div>
                    {view === "drivers" ? (
                      <>
                        <p>
                          {selected.address} · License {selected.licenseNumber}
                        </p>
                        <div className="inline-actions">
                          {[
                            ["License", selected.licenseImage],
                            ["Identity", selected.identityDocument],
                            ["Registration", selected.vehicleRegistration],
                          ].map(
                            ([label, url]) =>
                              url && (
                                <a
                                  className="button secondary"
                                  href={/^https?:\/\//.test(url) ? url : "#"}
                                  key={label}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {label}
                                  <ArrowUpRight size={14} />
                                </a>
                              ),
                          )}
                        </div>
                        <p>
                          {vehicle?.brand} {vehicle?.model} ·{" "}
                          {vehicle?.plateNumber} · {vehicle?.category}
                        </p>
                        <div className="inline-actions">
                          <button
                            className="button primary"
                            disabled={action.busy}
                            onClick={() =>
                              change(`drivers/${selected.user._id}/status`, {
                                status: "APPROVED",
                              })
                            }
                          >
                            Approve driver
                          </button>
                          <button
                            className="button secondary"
                            disabled={action.busy}
                            onClick={() =>
                              change(`drivers/${selected.user._id}/status`, {
                                status: "REJECTED",
                              })
                            }
                          >
                            Reject
                          </button>
                        </div>
                      </>
                    ) : (
                      <RideMap
                        compact
                        pickup={selected.pickup}
                        destination={selected.destination}
                        route={selected.route}
                      />
                    )}
                  </section>
                )}
              </>
            )}
          </>
        )
      )}
    </>
  );
}
function PromoForm({ refresh }) {
  const action = useAction();
  return (
    <details className="panel">
      <summary>Create a promo code</summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = Object.fromEntries(new FormData(e.target));
          for (const k of [
            "value",
            "maxDiscount",
            "minimumAmount",
            "usageLimit",
          ])
            data[k] = Number(data[k]);
          data.expiresAt = new Date(data.expiresAt).toISOString();
          action.run(async () => {
            await api.post("/admin/promos", data);
            refresh();
          }, "Promo created.");
        }}
      >
        <div className="form-grid">
          <label>
            Code
            <input
              name="code"
              required
              pattern="[A-Z0-9]{3,20}"
              placeholder="NAMASTE"
            />
          </label>
          <label>
            Type
            <select name="type">
              <option value="PERCENT">Percentage</option>
              <option value="FIXED">Fixed amount</option>
            </select>
          </label>
          {["value", "maxDiscount", "minimumAmount", "usageLimit"].map((k) => (
            <label key={k}>
              {k.replace(/([A-Z])/g, " $1")}
              <input
                name={k}
                type="number"
                required
                min={k === "minimumAmount" ? 0 : 1}
              />
            </label>
          ))}
          <label>
            Expiry
            <input name="expiresAt" type="datetime-local" required />
          </label>
        </div>
        <Feedback {...action} />
        <PrimaryButton busy={action.busy}>Create promo</PrimaryButton>
      </form>
    </details>
  );
}
function Settings({ data, refresh }) {
  const action = useAction();
  return (
    <>
      <Feedback {...action} />
      <section className="panel">
        <h3>Controlled demand pricing</h3>
        <form
          className="inline-actions"
          onSubmit={(e) => {
            e.preventDefault();
            const values = new FormData(e.target);
            action.run(async () => {
              await api.put("/admin/settings/demand", {
                demandEnabled: values.get("enabled") === "on",
                maxMultiplier: Number(values.get("max")),
              });
              refresh();
            }, "Demand settings updated.");
          }}
        >
          <label className="checkbox">
            <input
              name="enabled"
              type="checkbox"
              defaultChecked={data.demand?.demandEnabled}
            />
            Enable demand pricing
          </label>
          <label>
            Maximum multiplier
            <input
              name="max"
              type="number"
              min="1"
              max="2"
              step="0.1"
              defaultValue={data.demand?.maxMultiplier || 1.4}
            />
          </label>
          <button className="button primary" disabled={action.busy}>
            Save settings
          </button>
        </form>
      </section>
      <div className="profile-grid">
        {data.fares.map((c) => {
          const pricing = {
            ...c,
            ...data.overrides.find((o) => o.category === c.id),
          };
          return (
            <form
              className="panel"
              key={c.id}
              onSubmit={(e) => {
                e.preventDefault();
                const values = Object.fromEntries(
                  [...new FormData(e.target)].map(([k, v]) => [k, Number(v)]),
                );
                action.run(async () => {
                  await api.put(`/admin/settings/fares/${c.id}`, values);
                  refresh();
                }, `${c.name} pricing updated.`);
              }}
            >
              <h3>{c.name}</h3>
              <div className="form-grid">
                {[
                  "baseFare",
                  "pricePerKm",
                  "pricePerMinute",
                  "minimumFare",
                  "bookingFee",
                  "commission",
                ].map((key) => (
                  <label key={key}>
                    {key.replace(/([A-Z])/g, " $1")}
                    <input
                      name={key}
                      type="number"
                      min="0"
                      max={key === "commission" ? 0.5 : 10000}
                      step="0.01"
                      defaultValue={pricing[key]}
                      required
                    />
                  </label>
                ))}
              </div>
              <button className="button secondary" disabled={action.busy}>
                Save fare
              </button>
            </form>
          );
        })}
      </div>
    </>
  );
}
