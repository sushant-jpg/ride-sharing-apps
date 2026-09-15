import { useCallback, useEffect, useState, useRef } from "react";
import { api, message } from "./api.js";
export function useResource(path, interval = 0) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    if (!path) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get(path);
      setData(res.data);
      setError("");
    } catch (err) {
      setError(message(err));
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    setData(null);
    setLoading(true);
    refresh();
    if (interval) {
      const id = setInterval(refresh, interval);
      return () => clearInterval(id);
    }
  }, [refresh, interval]);
  return { data, error, loading, refresh, setData };
}
export function useAction() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  async function run(action, text) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result = await action();
      if (text) setSuccess(text);
      return result ?? true;
    } catch (err) {
      setError(message(err));
      return null;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, success, run, setError };
}

export function useActiveRide(path) {
  const [data, setValue] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const current = useRef(null);
  const generation = useRef(0);
  const setData = useCallback((value) => {
    generation.current++;
    current.current = value;
    setValue(value);
  }, []);
  const refresh = useCallback(async () => {
    const requestGeneration = generation.current;
    try {
      const { data } = await api.get(
        current.current ? `/rides/${current.current._id}` : path,
      );
      if (generation.current !== requestGeneration) return;
      setData(data);
      setError("");
    } catch (err) {
      setError(message(err));
    } finally {
      setLoading(false);
    }
  }, [path, setData]);
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, [refresh]);
  return { data, setData, refresh, loading, error };
}
