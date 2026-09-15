import Constants from "expo-constants";

const host = Constants.expoConfig?.hostUri?.split(":")[0];
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ||
  (host ? `http://${host}:4000/api` : "http://localhost:4000/api")
).replace(/\/+$/, "");

// Access tokens stay in memory. Reloading the app requires signing in again.
export function createApi(onExpired) {
  let token;
  let role = "passenger";
  let refreshing;
  async function request(path, method = "GET", body, retry = true) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${API_URL}${path}`, {
        method,
        credentials: "include",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "X-App-Role": role,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (response.status === 401 && !path.startsWith("/auth/") && retry) {
        try {
          refreshing ??= request("/auth/refresh", "POST", undefined, false)
            .then((session) => { token = session.accessToken; })
            .finally(() => { refreshing = undefined; });
          await refreshing;
        } catch {
          token = undefined;
          onExpired();
          throw new Error("Your session expired. Please sign in again.");
        }
        return request(path, method, body, false);
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Request failed.");
      return data;
    } catch (error) {
      if (error.name === "AbortError") throw new Error("The request timed out. Check your connection and try again.");
      if (error instanceof TypeError) throw new Error("Cannot reach the server. Keep your phone and computer on the same Wi-Fi and start the ridesharing API.");
      throw error;
    } finally { clearTimeout(timeout); }
  }
  return {
    request,
    setSession(session) { token = session.accessToken; role = session.user.role.toLowerCase(); },
    clear() { token = undefined; },
    setRole(value) { role = value; },
  };
}
