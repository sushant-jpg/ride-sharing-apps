import { useEffect, useState, useRef } from "react";
import { MapPin, LocateFixed } from "lucide-react";
import { api } from "./api.js";
import { PLACES } from "../constants/index.js";
export default function LocationInput({
  label,
  value,
  onChange,
  kind = "destination",
  onLocate,
  onFocus,
}) {
  const typing = useRef(false);
  const [query, setQuery] = useState(value?.address || ""),
    [open, setOpen] = useState(false),
    [results, setResults] = useState(PLACES),
    [searching, setSearching] = useState(false);
  useEffect(() => {
    if (value?.address || !typing.current) setQuery(value?.address || "");
  }, [value?.address]);
  useEffect(() => {
    if (query.length < 2) {
      setResults(PLACES);
      return;
    }
    const id = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await api.get("/maps/search", {
          params: { q: query },
        });
        setResults(data);
      } catch {
        setResults(
          PLACES.filter((p) =>
            p.address.toLowerCase().includes(query.toLowerCase()),
          ),
        );
      } finally {
        setSearching(false);
      }
    }, 450);
    return () => clearTimeout(id);
  }, [query]);
  return (
    <div className={`location-field ${kind}`}>
      <span className="location-dot" />
      <div>
        <label>{label}</label>
        <input
          value={query}
          placeholder="Search a place in Nepalgunj"
          onFocus={() => {
            setOpen(true);
            onFocus?.();
          }}
          onBlur={() => {
            typing.current = false;
            setTimeout(() => setOpen(false), 180);
          }}
          onChange={(e) => {
            typing.current = true;
            setQuery(e.target.value);
            onChange(null);
            setOpen(true);
          }}
          aria-label={label}
        />
      </div>
      {onLocate && (
        <button
          className="icon-button"
          title="Use my current location"
          onClick={onLocate}
        >
          <LocateFixed size={18} />
        </button>
      )}
      {open && (
        <div className="autocomplete">
          {searching ? (
            <p>Searching places…</p>
          ) : results.length ? (
            results.map((p) => (
              <button
                key={`${p.latitude}:${p.longitude}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(p);
                  setQuery(p.address);
                  setOpen(false);
                }}
              >
                <MapPin size={16} />
                <span>{p.address}</span>
              </button>
            ))
          ) : (
            <p>No places found. Select a point on the map.</p>
          )}
        </div>
      )}
    </div>
  );
}
