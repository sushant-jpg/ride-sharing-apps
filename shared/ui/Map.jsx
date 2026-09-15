import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CENTER } from "../constants/index.js";
const icon = (kind) =>
  L.divIcon({
    className: "custom-marker",
    html: `<span class="map-pin ${kind}">${kind === "driver" ? "↗" : kind === "pickup" ? "●" : "■"}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
function Events({ onPick, points }) {
  const map = useMap();
  useMapEvents({
    click: (event) =>
      onPick?.({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
        address: "Selected map point",
      }),
  });
  useEffect(() => {
    if (points.length > 1)
      map.fitBounds(points, { padding: [60, 60], maxZoom: 15 });
    else if (points.length === 1) map.setView(points[0], 14);
  }, [map, JSON.stringify(points)]);
  return null;
}
export default function RideMap({
  pickup,
  destination,
  route,
  driver,
  onPick,
  compact = false,
}) {
  const [tileError, setTileError] = useState(false);
  const points = [
    pickup && [pickup.latitude, pickup.longitude],
    destination && [destination.latitude, destination.longitude],
  ].filter(Boolean);
  return (
    <div className={`map-container ${compact ? "compact" : ""}`}>
      <MapContainer
        center={CENTER}
        zoom={14}
        scrollWheelZoom={false}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{
            tileerror: () => setTileError(true),
            tileload: () => setTileError(false),
          }}
        />
        <Events onPick={onPick} points={points} />
        {pickup && (
          <Marker
            position={[pickup.latitude, pickup.longitude]}
            icon={icon("pickup")}
          >
            <Popup>{pickup.address}</Popup>
          </Marker>
        )}
        {destination && (
          <Marker
            position={[destination.latitude, destination.longitude]}
            icon={icon("destination")}
          >
            <Popup>{destination.address}</Popup>
          </Marker>
        )}
        {driver && (
          <Marker position={[driver[1], driver[0]]} icon={icon("driver")}>
            <Popup>Your driver</Popup>
          </Marker>
        )}
        {route?.length > 1 && (
          <Polyline
            positions={route}
            pathOptions={{ color: "#176b54", weight: 5, opacity: 0.8 }}
          />
        )}
      </MapContainer>
      {tileError && (
        <div className="map-error" role="status">
          Map tiles are unavailable. Place search and location markers still
          work.
        </div>
      )}
      <div className="map-label">
        <span className="live-dot" /> NEPALGUNJ, BANKE <span>नेपालगञ्ज</span>
      </div>
    </div>
  );
}
