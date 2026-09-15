import axios from "axios";
import { create } from "zustand";
export const useSession = create((set) => ({
  user: null,
  token: null,
  ready: false,
  setSession: (data) =>
    set({ user: data.user, token: data.accessToken, ready: true }),
  clear: () => set({ user: null, token: null, ready: true }),
}));
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true,
  timeout: 25000,
});
api.interceptors.request.use((config) => {
  const token = useSession.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
let refreshPromise;
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status === 401 &&
      !original?._retry &&
      !original?.url?.startsWith("/auth/")
    ) {
      original._retry = true;
      try {
        if (!refreshPromise)
          refreshPromise = api
            .post("/auth/refresh")
            .then(({ data }) => {
              useSession.getState().setSession(data);
              return data;
            })
            .finally(() => {
              refreshPromise = null;
            });
        await refreshPromise;
        return api(original);
      } catch {
        useSession.getState().clear();
      }
    }
    return Promise.reject(error);
  },
);
export const message = (error) =>
  error.response?.data?.message ||
  "Unable to connect. Check that the server is running and try again.";
export const money = (value) =>
  new Intl.NumberFormat("en-NP", { maximumFractionDigits: 0 }).format(
    value || 0,
  );
export const date = (value) =>
  value
    ? new Date(value).toLocaleString("en-GB", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

let bootstrapPromise;
export function bootstrapSession(role) {
  api.defaults.headers.common["X-App-Role"] = role;
  if (!bootstrapPromise)
    bootstrapPromise = api
      .post("/auth/refresh")
      .then(({ data }) => useSession.getState().setSession(data))
      .catch(() => useSession.getState().clear());
  return bootstrapPromise;
}
