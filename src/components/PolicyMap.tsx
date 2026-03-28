"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Map, {
  Source,
  Layer,
  Marker,
  Popup,
  NavigationControl,
  type MapLayerMouseEvent,
  type MapRef,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  floodZones,
  heatZones,
  aqiStations,
  getAqiColor,
  getAqiLabel,
  getFloodColor,
  getHeatColor,
} from "@/data/mockVulnerabilities";
import type { FillLayerSpecification, CircleLayerSpecification } from "maplibre-gl";

interface PolicyMapProps {
  onLocationSelect: (location: string, lat: number, lng: number) => void;
  flyTo?: { lng: number; lat: number } | null;
}

const LAYERS_CONFIG = [
  { id: "heat", label: "Heat Index", color: "#ef4444" },
  { id: "flood", label: "Flood Risk", color: "#3b82f6" },
  { id: "aqi", label: "Air Quality", color: "#8b5cf6" },
] as const;

type LayerId = (typeof LAYERS_CONFIG)[number]["id"];

interface HoverInfo {
  lng: number;
  lat: number;
  html: string;
}

interface ClickPopupInfo {
  lng: number;
  lat: number;
  locationName: string;
  temperature?: number;
  feelsLike?: number;
  humidity?: number;
}

// Layer style specs
const floodLayerStyle: FillLayerSpecification = {
  id: "flood-zones",
  type: "fill",
  source: "flood-zones",
  paint: {
    "fill-color": [
      "match",
      ["get", "riskLevel"],
      "high", getFloodColor("high"),
      "moderate", getFloodColor("moderate"),
      getFloodColor("low"),
    ],
    "fill-opacity": 0.3,
  },
};

const heatLayerStyle: FillLayerSpecification = {
  id: "heat-zones",
  type: "fill",
  source: "heat-zones",
  paint: {
    "fill-color": [
      "interpolate",
      ["linear"],
      ["get", "heatIndex"],
      35, "#fbbf24",
      39, "#f97316",
      42, "#dc2626",
    ],
    "fill-opacity": 0.35,
  },
};

const aqiLayerStyle: CircleLayerSpecification = {
  id: "aqi-stations",
  type: "circle",
  source: "aqi-stations",
  paint: {
    "circle-radius": 7,
    "circle-color": [
      "interpolate",
      ["linear"],
      ["get", "aqi"],
      0, "#16a34a",
      50, "#16a34a",
      51, "#f59e0b",
      100, "#f59e0b",
      101, "#f97316",
      150, "#ef4444",
    ],
    "circle-stroke-color": "#ffffff",
    "circle-stroke-width": 2,
  },
};

export default function PolicyMap({ onLocationSelect, flyTo }: PolicyMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [activeLayers, setActiveLayers] = useState<Set<LayerId>>(
    new Set(["heat", "flood", "aqi"])
  );
  const [markerPos, setMarkerPos] = useState<{ lng: number; lat: number } | null>(null);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [clickPopup, setClickPopup] = useState<ClickPopupInfo | null>(null);
  const [userLocation, setUserLocation] = useState<{ lng: number; lat: number } | null>(null);

  // Center map on user's location
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { longitude: lng, latitude: lat } = pos.coords;
        setUserLocation({ lng, lat });
        mapRef.current?.flyTo({ center: [lng, lat], zoom: 13, duration: 1500 });
      },
      () => {
        // Permission denied or unavailable — stay on default center
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  // Fly to location when triggered from the form
  useEffect(() => {
    if (!flyTo) return;
    mapRef.current?.flyTo({ center: [flyTo.lng, flyTo.lat], zoom: 14, duration: 1500 });
    setMarkerPos(flyTo);
  }, [flyTo]);

  const toggleLayer = useCallback((id: LayerId) => {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleClick = useCallback(
    async (e: MapLayerMouseEvent) => {
      const { lng, lat } = e.lngLat;

      setMarkerPos({ lng, lat });
      setClickPopup(null);

      // Reverse geocode
      let locationName = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16&addressdetails=1`,
          { headers: { "User-Agent": "SimBayan/0.1" } }
        );
        const geoData = (await geoRes.json()) as {
          address?: Record<string, string>;
          display_name?: string;
        };
        const addr = geoData.address;
        locationName =
          addr?.suburb ||
          addr?.neighbourhood ||
          addr?.village ||
          addr?.city_district ||
          geoData.display_name?.split(",").slice(0, 2).join(",") ||
          locationName;
      } catch {
        // Keep coordinate fallback
      }

      onLocationSelect(locationName, lat, lng);

      // Fetch live weather
      try {
        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,apparent_temperature,relative_humidity_2m`
        );
        const weather = (await weatherRes.json()) as {
          current: {
            temperature_2m: number;
            apparent_temperature: number;
            relative_humidity_2m: number;
          };
        };
        const c = weather.current;
        setClickPopup({
          lng,
          lat,
          locationName,
          temperature: c.temperature_2m,
          feelsLike: c.apparent_temperature,
          humidity: c.relative_humidity_2m,
        });
      } catch {
        setClickPopup({ lng, lat, locationName });
      }
    },
    [onLocationSelect]
  );

  const handleMouseEnter = useCallback((e: MapLayerMouseEvent) => {
    const map = mapRef.current;
    if (map) map.getCanvas().style.cursor = "pointer";

    const f = e.features?.[0];
    if (!f) return;

    const p = f.properties;
    const { lng, lat } = e.lngLat;
    let html = "";

    if (f.layer.id === "flood-zones") {
      html = `<strong>${p.name}</strong><br/>Risk: <span style="color:${getFloodColor(p.riskLevel)};font-weight:600;">${String(p.riskLevel).charAt(0).toUpperCase() + String(p.riskLevel).slice(1)}</span>`;
    } else if (f.layer.id === "heat-zones") {
      const hi = typeof p.heatIndex === "string" ? parseInt(p.heatIndex) : p.heatIndex;
      html = `<strong>${p.name}</strong><br/>Heat Index: <span style="color:${getHeatColor(hi)};font-weight:600;">${p.heatIndex}°C</span>`;
    } else if (f.layer.id === "aqi-stations") {
      const aqi = typeof p.aqi === "string" ? parseInt(p.aqi) : p.aqi;
      html = `<strong>${p.stationName}</strong><br/>AQI: <span style="color:${getAqiColor(aqi)};font-weight:600;">${aqi} (${getAqiLabel(aqi)})</span><br/>Pollutant: ${p.dominantPollutant}`;
    }

    setHoverInfo({ lng, lat, html });
  }, []);

  const handleMouseLeave = useCallback(() => {
    const map = mapRef.current;
    if (map) map.getCanvas().style.cursor = "";
    setHoverInfo(null);
  }, []);

  const interactiveLayerIds = [
    ...(activeLayers.has("flood") ? ["flood-zones"] : []),
    ...(activeLayers.has("heat") ? ["heat-zones"] : []),
    ...(activeLayers.has("aqi") ? ["aqi-stations"] : []),
  ];

  return (
    <div className="relative h-full w-full">
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: 121.0437,
          latitude: 14.676,
          zoom: 12,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle="https://tiles.openfreemap.org/styles/positron"
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        interactiveLayerIds={interactiveLayerIds}
        attributionControl={false}
      >
        <NavigationControl position="bottom-right" showCompass={false} />

        {/* Flood risk zones */}
        {activeLayers.has("flood") && (
          <Source id="flood-zones" type="geojson" data={floodZones}>
            <Layer {...floodLayerStyle} />
          </Source>
        )}

        {/* Heat zones */}
        {activeLayers.has("heat") && (
          <Source id="heat-zones" type="geojson" data={heatZones}>
            <Layer {...heatLayerStyle} />
          </Source>
        )}

        {/* AQI stations */}
        {activeLayers.has("aqi") && (
          <Source id="aqi-stations" type="geojson" data={aqiStations}>
            <Layer {...aqiLayerStyle} />
          </Source>
        )}

        {/* User location dot */}
        {userLocation && (
          <Marker longitude={userLocation.lng} latitude={userLocation.lat} anchor="center">
            <div
              style={{
                width: 12,
                height: 12,
                background: "#3b82f6",
                border: "2px solid white",
                borderRadius: "50%",
                boxShadow: "0 0 0 4px rgba(59,130,246,0.2)",
              }}
            />
          </Marker>
        )}

        {/* Click marker */}
        {markerPos && (
          <Marker longitude={markerPos.lng} latitude={markerPos.lat} anchor="center">
            <div
              style={{
                width: 14,
                height: 14,
                background: "#0f766e",
                border: "2px solid white",
                borderRadius: "50%",
                boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
              }}
            />
          </Marker>
        )}

        {/* Click popup — weather data */}
        {clickPopup && (
          <Popup
            longitude={clickPopup.lng}
            latitude={clickPopup.lat}
            offset={12}
            closeButton={false}
            closeOnClick={false}
            maxWidth="220px"
          >
            <div style={{ fontSize: 12, lineHeight: 1.5, minWidth: 160 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                {clickPopup.locationName}
              </div>
              {clickPopup.temperature !== undefined && (
                <>
                  <div style={{ color: "#78716c" }}>
                    Temperature:{" "}
                    <span style={{ color: "#1c1917", fontWeight: 500 }}>
                      {clickPopup.temperature}°C
                    </span>
                  </div>
                  <div style={{ color: "#78716c" }}>
                    Feels like:{" "}
                    <span
                      style={{
                        color:
                          clickPopup.feelsLike! >= 38
                            ? "#ef4444"
                            : clickPopup.feelsLike! >= 33
                              ? "#f59e0b"
                              : "#1c1917",
                        fontWeight: 500,
                      }}
                    >
                      {clickPopup.feelsLike}°C
                    </span>
                  </div>
                  <div style={{ color: "#78716c" }}>
                    Humidity:{" "}
                    <span style={{ color: "#1c1917", fontWeight: 500 }}>
                      {clickPopup.humidity}%
                    </span>
                  </div>
                </>
              )}
            </div>
          </Popup>
        )}

        {/* Hover popup */}
        {hoverInfo && (
          <Popup
            longitude={hoverInfo.lng}
            latitude={hoverInfo.lat}
            offset={10}
            closeButton={false}
            closeOnClick={false}
            maxWidth="200px"
          >
            <div
              style={{ fontSize: 12, lineHeight: 1.5 }}
              dangerouslySetInnerHTML={{ __html: hoverInfo.html }}
            />
          </Popup>
        )}
      </Map>

      {/* Layer toggle control */}
      <div className="absolute top-3 left-3 z-10 border border-border bg-surface p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-foreground/60">
          Vulnerability Layers
        </p>
        <div className="space-y-1.5">
          {LAYERS_CONFIG.map((layer) => (
            <label
              key={layer.id}
              className="flex cursor-pointer items-center gap-2 text-[13px]"
            >
              <input
                type="checkbox"
                checked={activeLayers.has(layer.id)}
                onChange={() => toggleLayer(layer.id)}
                className="accent-accent"
              />
              <span
                className="inline-block h-2.5 w-2.5"
                style={{ backgroundColor: layer.color }}
              />
              <span>{layer.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
