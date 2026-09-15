import {
  ArrowUpRight,
  ArrowRight,
  MapPin,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  Bike,
  Car,
  Bus,
  Leaf,
  ChevronRight,
} from "lucide-react";
import { money } from "./api.js";
export function Brand() {
  return (
    <div className="brand">
      <span className="brand-symbol">
        <ArrowUpRight size={27} />
      </span>
      <span>
        ride<span className="brand-light">nepaljung</span>
        <small>GO LOCAL. GO TOGETHER.</small>
      </span>
    </div>
  );
}
export function Feedback({ error, success }) {
  return (
    <>
      {error && (
        <div className="feedback error" role="alert">
          <AlertCircle size={18} />
          {error}
        </div>
      )}
      {success && (
        <div className="feedback success" role="status">
          <CheckCircle2 size={18} />
          {success}
        </div>
      )}
    </>
  );
}
export function Loading() {
  return (
    <div className="empty">
      <LoaderCircle className="spin" />
      Getting everything ready…
    </div>
  );
}
export function Empty({
  title = "Nothing here yet",
  text = "Your updates will appear here.",
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <MapPin />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
export function PageTitle({
  eyebrow = "YOUR EVERYDAY, SIMPLIFIED",
  title,
  description,
  action,
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function CategoryIcon({ category, size = 30 }) {
  const Icon =
    { sajilo: Bike, sathi: Car, parivar: Bus, hariyo: Leaf }[category] || Car;
  return <Icon size={size} strokeWidth={1.6} />;
}
export function Status({ value }) {
  return (
    <span
      className={`status ${["CANCELLED", "REJECTED", "SUSPENDED", "FAILED"].includes(value) ? "negative" : ""}`}
    >
      {value?.replaceAll("_", " ").toLowerCase()}
    </span>
  );
}
export function Stat({ label, value, icon: Icon, detail }) {
  return (
    <div className="stat">
      <span className="stat-label">
        {label}
        {Icon && <Icon size={19} />}
      </span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}
export function FareDetails({ fare }) {
  if (!fare) return null;
  return (
    <details className="fare-details">
      <summary>
        Transparent fare breakdown <ChevronRight size={16} />
      </summary>
      <dl>
        {[
          ["Base fare", fare.baseFare],
          ["Distance", fare.distanceFare],
          ["Time", fare.timeFare],
          ["Booking fee", fare.bookingFee],
          ["Discount", -fare.discount],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>Rs. {money(value)}</dd>
          </div>
        ))}
        <div>
          <dt>Demand multiplier</dt>
          <dd>{fare.demandMultiplier}×</dd>
        </div>
        <div className="total">
          <dt>Estimated total</dt>
          <dd>Rs. {money(fare.estimatedFare)}</dd>
        </div>
      </dl>
      <p>
        Minimum fare applies before discounts. Final fare uses trip time and
        available GPS distance.
      </p>
    </details>
  );
}
export function PrimaryButton({ children, busy, ...props }) {
  return (
    <button
      className="button primary"
      disabled={busy || props.disabled}
      {...props}
    >
      {busy ? <LoaderCircle className="spin" size={18} /> : null}
      {children}
      {!busy && <ArrowRight size={18} />}
    </button>
  );
}
