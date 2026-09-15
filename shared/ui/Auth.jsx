import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowUpRight, ShieldCheck, MapPin, MoveUpRight } from "lucide-react";
import { api, useSession } from "./api.js";
import { useAction } from "./hooks.js";
import { Brand, Feedback, PrimaryButton } from "./components.jsx";
const schema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(10, "Use at least 10 characters"),
});
export default function Auth({ role }) {
  const [mode, setMode] = useState("login"),
    action = useAction();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) });
  const [name, setName] = useState(""),
    [phone, setPhone] = useState("");
  const setSession = useSession((s) => s.setSession);
  async function submit(values) {
    await action.run(async () => {
      if (mode === "forgot") {
        const { data } = await api.post("/auth/forgot-password", {
          email: values.email,
        });
        return data;
      }
      const { data } = await api.post(
        `/auth/${mode === "register" ? "register" : "login"}`,
        {
          ...values,
          ...(mode === "register"
            ? { name, phone, role: role.toUpperCase() }
            : {}),
        },
      );
      const allowed =
        role === "admin"
          ? data.user.role.endsWith("ADMIN")
          : data.user.role === role.toUpperCase();
      if (!allowed) {
        await api.post("/auth/logout");
        throw {
          response: {
            data: { message: `Use your ${role} account to sign in here.` },
          },
        };
      }
      setSession(data);
    });
  }
  return (
    <div className="auth-page">
      <div className="auth-story">
        <Brand />
        <div className="auth-copy">
          <div className="pill light">
            <span className="live-dot" /> MADE FOR NEPALGUNJ
          </div>
          <h1>
            Your city.
            <br />A little <em>closer.</em>
          </h1>
          <p>
            From your first morning errand to your last ride home. Go with
            someone who knows the way.
          </p>
          <div className="auth-map-art">
            <div className="art-road one" />
            <div className="art-road two" />
            <div className="art-road three" />
            <div className="art-location a">
              <MapPin />
              Bageshwori Temple
            </div>
            <div className="art-location b">
              <span className="brand-symbol">
                <MoveUpRight />
              </span>
              Your next stop
            </div>
            <span className="art-circle" />
          </div>
        </div>
        <div className="auth-footer">
          <ShieldCheck size={18} /> Local drivers. Clear fares. A better way
          home.
        </div>
      </div>
      <main className="auth-form-wrap">
        <div className="auth-top">
          <span>
            {role === "admin"
              ? "OPERATIONS CONSOLE"
              : role === "driver"
                ? "DRIVER PARTNER"
                : "PASSENGER APP"}
          </span>
          <span>
            नेपालगञ्ज <ArrowUpRight size={14} />
          </span>
        </div>
        <div className="auth-form">
          <p className="eyebrow">NAMASTE, NEPALGUNJ</p>
          <h2>
            {mode === "register" ? "Let’s get you moving." : "Good to see you."}
          </h2>
          <p className="muted">
            {mode === "register"
              ? "Create your Ride Nepaljung account."
              : `Sign in to your ${role === "admin" ? "operations" : role} account.`}
          </p>
          <form onSubmit={handleSubmit(submit)}>
            {mode === "register" && (
              <>
                <label>
                  Full name
                  <input
                    required
                    minLength={2}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                    autoComplete="name"
                  />
                </label>
                <label>
                  Phone number
                  <input
                    required
                    minLength={7}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="98XXXXXXXX"
                    autoComplete="tel"
                  />
                </label>
              </>
            )}
            <label>
              Email address
              <input
                {...register("email")}
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
              />
              {errors.email && (
                <small className="field-error">{errors.email.message}</small>
              )}
            </label>
            <label>
              Password
              <input
                {...register("password")}
                type="password"
                placeholder="At least 10 characters"
                autoComplete={
                  mode === "register" ? "new-password" : "current-password"
                }
              />
              {errors.password && (
                <small className="field-error">{errors.password.message}</small>
              )}
            </label>
            <Feedback {...action} />
            <PrimaryButton busy={action.busy}>
              {mode === "register" ? "Create account" : "Sign in"}
            </PrimaryButton>
          </form>
          {role !== "admin" && (
            <p className="auth-switch">
              {mode === "login"
                ? "New around here?"
                : "Already have an account?"}{" "}
              <button
                onClick={() => setMode(mode === "login" ? "register" : "login")}
              >
                {mode === "login" ? "Join the ride" : "Sign in"}
              </button>
            </p>
          )}
          <details className="dev-note">
            <summary>Development accounts</summary>
            <p>
              After running the seed, use{" "}
              <strong>
                {role === "admin" ? "admin@ride.test" : `${role}1@ride.test`}
              </strong>{" "}
              and the password configured in SEED_PASSWORD.
            </p>
          </details>
          <p className="small muted">
            Password recovery & email verification: coming soon. Contact your
            platform operator for account help.
          </p>
        </div>
        <footer>
          Ride Nepaljung <span>Built around your everyday.</span>
        </footer>
      </main>
    </div>
  );
}
