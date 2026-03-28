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
  type ViewStateChangeEvent,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection, Point } from "geojson";
import type { LayerProps } from "react-map-gl/maplibre";
import {
  fetchHeatGrid,
  fetchAqiGrid,
  fetchFloodGrid,
  getHeatColor,
  getAqiColor,
  getAqiLabel,
} from "@/data/openMeteo";

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

interface ClickPopupInfo {
  lng: number;
  lat: number;
  locationName: string;
  temperature?: number;
  feelsLike?: number;
  humidity?: number;
}

interface HoverInfo {
  lng: number;
  lat: number;
  html: string;
}

const EMPTY_FC: FeatureCollection<Point> = { type: "FeatureCollection", features: [] };

// --- Heatmap layer styles ---

// Heat index: continuous red/orange heatmap weighted by apparent temperature
const heatHeatmapStyle: HeatmapLayerSpecification = {
  id: "heat-heatmap",
  type: "heatmap",
  source: "heat-points",
  paint: {
    "heatmap-weight": [
      "interpolate", ["linear"], ["get", "apparentTemperature"],
      15, 0,
      25, 0.3,
      32, 0.6,
      38, 0.85,
      45, 1,
    ],
    "heatmap-intensity": [
      "interpolate", ["linear"], ["zoom"],
      8, 0.6,
      13, 1.2,
      16, 1.8,
    ],
    "heatmap-radius": [
      "interpolate", ["linear"], ["zoom"],
      8, 15,
      12, 30,
      15, 50,
    ],
    "heatmap-color": [
      "interpolate", ["linear"], ["heatmap-density"],
      0, "rgba(0,0,0,0)",
      0.15, "rgba(163,230,53,0.4)",
      0.35, "rgba(251,191,36,0.55)",
      0.55, "rgba(249,115,22,0.65)",
      0.75, "rgba(239,68,68,0.75)",
      1, "rgba(220,38,38,0.85)",
    ],
    "heatmap-opacity": [
      "interpolate", ["linear"], ["zoom"],
      8, 0.7,
      16, 0.5,
    ],
  },
};

// Invisible circle layer on top for hover interactivity
const heatCircleStyle: CircleLayerSpecification = {
  id: "heat-points",
  type: "circle",
  source: "heat-points",
  paint: {
    "circle-radius": 1,
    "circle-opacity": 0,
  },
};

// Air quality: purple/green heatmap weighted by AQI
const aqiHeatmapStyle: HeatmapLayerSpecification = {
  id: "aqi-heatmap",
  type: "heatmap",
  source: "aqi-points",
  paint: {
    "heatmap-weight": [
      "interpolate", ["linear"], ["get", "usAqi"],
      0, 0.1,
      50, 0.4,
      100, 0.7,
      200, 1,
    ],
    "heatmap-intensity": [
      "interpolate", ["linear"], ["zoom"],
      8, 0.5,
      13, 1,
      16, 1.5,
    ],
    "heatmap-radius": [
      "interpolate", ["linear"], ["zoom"],
      8, 20,
      12, 35,
      15, 55,
    ],
    "heatmap-color": [
      "interpolate", ["linear"], ["heatmap-density"],
      0, "rgba(0,0,0,0)",
      0.2, "rgba(22,163,74,0.35)",
      0.45, "rgba(245,158,11,0.5)",
      0.7, "rgba(249,115,22,0.6)",
      1, "rgba(139,92,246,0.75)",
    ],
    "heatmap-opacity": [
      "interpolate", ["linear"], ["zoom"],
      8, 0.65,
      16, 0.45,
    ],
  },
};

const aqiCircleStyle: CircleLayerSpecification = {
  id: "aqi-points",
  type: "circle",
  source: "aqi-points",
  paint: {
    "circle-radius": 1,
    "circle-opacity": 0,
  },
};

// Flood risk: blue heatmap weighted by river discharge
const floodHeatmapStyle: HeatmapLayerSpecification = {
  id: "flood-heatmap",
  type: "heatmap",
  source: "flood-points",
  paint: {
    "heatmap-weight": [
      "interpolate", ["linear"], ["get", "riverDischarge"],
      0, 0,
      10, 0.2,
      50, 0.5,
      200, 0.8,
      1000, 1,
    ],
    "heatmap-intensity": [
      "interpolate", ["linear"], ["zoom"],
      8, 0.5,
      13, 1,
      16, 1.5,
    ],
    "heatmap-radius": [
      "interpolate", ["linear"], ["zoom"],
      8, 18,
      12, 32,
      15, 50,
    ],
    "heatmap-color": [
      "interpolate", ["linear"], ["heatmap-density"],
      0, "rgba(0,0,0,0)",
      0.2, "rgba(191,219,254,0.4)",
      0.45, "rgba(96,165,250,0.55)",
      0.7, "rgba(59,130,246,0.65)",
      1, "rgba(29,78,216,0.8)",
    ],
    "heatmap-opacity": [
      "interpolate", ["linear"], ["zoom"],
      8, 0.65,
      16, 0.45,
    ],
  },
};

const floodCircleStyle: CircleLayerSpecification = {
  id: "flood-points",
  type: "circle",
  source: "flood-points",
  paint: {
    "circle-radius": 1,
    "circle-opacity": 0,
  },
};

export default function PolicyMap({ onLocationSelect, flyTo }: PolicyMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [activeLayers, setActiveLayers] = useState<Set<LayerId>>(
    new Set(["heat", "flood", "aqi"])
  );
  const [markerPos, setMarkerPos] = useState<{ lng: number; lat: number } | null>(null);
  const [clickPopup, setClickPopup] = useState<ClickPopupInfo | null>(null);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [userLocation, setUserLocation] = useState<{ lng: number; lat: number } | null>(null);

  // Live data states
  const [heatData, setHeatData] = useState<FeatureCollection<Point>>(EMPTY_FC);
  const [aqiData, setAqiData] = useState<FeatureCollection<Point>>(EMPTY_FC);
  const [floodData, setFloodData] = useState<FeatureCollection<Point>>(EMPTY_FC);
  const [isLoading, setIsLoading] = useState(false);

  // Debounced fetch timer
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch live vulnerability data for current map bounds
  const fetchLayers = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;

    const bounds = map.getBounds();
    const boundsObj = {
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    };

    setIsLoading(true);

    try {
      const [heat, aqi, flood] = await Promise.all([
        fetchHeatGrid(boundsObj).catch(() => EMPTY_FC),
        fetchAqiGrid(boundsObj).catch(() => EMPTY_FC),
        fetchFloodGrid(boundsObj).catch(() => EMPTY_FC),
      ]);
      setHeatData(heat);
      setAqiData(aqi);
      setFloodData(flood);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced version for map move events
  const debouncedFetch = useCallback(() => {
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
    fetchTimerRef.current = setTimeout(fetchLayers, 800);
  }, [fetchLayers]);

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

  const handleMapLoad = useCallback(() => {
    fetchLayers();
  }, [fetchLayers]);

  const handleMoveEnd = useCallback(
    (_e: ViewStateChangeEvent) => {
      debouncedFetch();
    },
    [debouncedFetch]
  );

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
          { headers: { "User-Agent": "SimUla/0.1" } }
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

      // Fetch live weather for popup
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

    if (f.layer.id === "heat-points") {
      const temp = typeof p.apparentTemperature === "string" ? parseFloat(p.apparentTemperature) : p.apparentTemperature;
      html = `<strong>Heat Index</strong><br/>Feels like: <span style="color:${getHeatColor(temp)};font-weight:600;">${temp}°C</span><br/>Actual: ${p.temperature}°C<br/>Humidity: ${p.humidity}%`;
    } else if (f.layer.id === "aqi-points") {
      const aqi = typeof p.usAqi === "string" ? parseInt(p.usAqi) : p.usAqi;
      html = `<strong>Air Quality</strong><br/>AQI: <span style="color:${getAqiColor(aqi)};font-weight:600;">${aqi} (${getAqiLabel(aqi)})</span><br/>PM2.5: ${p.pm25} · PM10: ${p.pm10}`;
    } else if (f.layer.id === "flood-points") {
      const discharge = typeof p.riverDischarge === "string" ? parseFloat(p.riverDischarge) : p.riverDischarge;
      html = `<strong>River Discharge</strong><br/>Flow: <span style="color:#3b82f6;font-weight:600;">${discharge.toFixed(1)} m³/s</span>`;
    }

    if (html) setHoverInfo({ lng, lat, html });
  }, []);

  const handleMouseLeave = useCallback(() => {
    const map = mapRef.current;
    if (map) map.getCanvas().style.cursor = "";
    setHoverInfo(null);
  }, []);

  // Invisible circle layers are interactive for hover tooltips
  const interactiveLayerIds = [
    ...(activeLayers.has("heat") ? ["heat-points"] : []),
    ...(activeLayers.has("aqi") ? ["aqi-points"] : []),
    ...(activeLayers.has("flood") ? ["flood-points"] : []),
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
        onLoad={handleMapLoad}
        onMoveEnd={handleMoveEnd}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        interactiveLayerIds={interactiveLayerIds}
        attributionControl={false}
      >
        <NavigationControl position="bottom-right" showCompass={false} />

        {/* Heat index — continuous heatmap */}
        {activeLayers.has("heat") && (
          <Source id="heat-points" type="geojson" data={heatData}>
            <Layer {...(heatHeatmapStyle as Record<string, unknown>)} />
            <Layer {...(heatCircleStyle as Record<string, unknown>)} />
          </Source>
        )}

        {/* Air quality — continuous heatmap */}
        {activeLayers.has("aqi") && (
          <Source id="aqi-points" type="geojson" data={aqiData}>
            <Layer {...(aqiHeatmapStyle as Record<string, unknown>)} />
            <Layer {...(aqiCircleStyle as Record<string, unknown>)} />
          </Source>
        )}

        {/* Flood risk — continuous heatmap */}
        {activeLayers.has("flood") && (
          <Source id="flood-points" type="geojson" data={floodData}>
            <Layer {...(floodHeatmapStyle as Record<string, unknown>)} />
            <Layer {...(floodCircleStyle as Record<string, unknown>)} />
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
            maxWidth="220px"
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
        {isLoading && (
          <p className="mt-2 text-[10px] text-muted-light">Loading data...</p>
        )}
      </div>
    </div>
  );
}
