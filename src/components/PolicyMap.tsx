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
import type { LayerProps } from "react-map-gl/maplibre";
import type { FillLayerSpecification } from "maplibre-gl";
import {
  fetchHeatGrid,
  fetchAqiGrid,
  fetchFloodGrid,
  getHeatColor,
  getAqiColor,
  getAqiLabel,
  type GridData,
} from "@/data/openMeteo";

// ── Perlin noise (classic 2D, single-octave) ──

const PERM = (() => {
  const p = [
    151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,
    69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,
    252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,
    171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,
    122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,
    63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,
    188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,
    38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,
    42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,
    43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,
    218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,
    145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,
    115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,
    141,128,195,78,66,215,61,156,180,
  ];
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  return perm;
})();

function fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a: number, b: number, t: number) { return a + t * (b - a); }
function grad(hash: number, x: number, y: number) {
  const h = hash & 3;
  const u = h < 2 ? x : y;
  const v = h < 2 ? y : x;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}
function perlin2(x: number, y: number) {
  const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255;
  const xf = x - Math.floor(x), yf = y - Math.floor(y);
  const u = fade(xf), v = fade(yf);
  const aa = PERM[PERM[xi] + yi], ab = PERM[PERM[xi] + yi + 1];
  const ba = PERM[PERM[xi + 1] + yi], bb = PERM[PERM[xi + 1] + yi + 1];
  return lerp(
    lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u),
    lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u),
    v,
  );
}

// Generate a Perlin noise image data URL (runs once at module load)
function generateNoiseDataUrl(): string {
  const canvas = document.createElement("canvas");
  const w = 512, h = 512;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  const scale = 0.012;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = (perlin2(x * scale, y * scale) + 1) * 0.5; // 0..1
      // Foreground-toned (#1C1917) pixels with varying alpha
      const alpha = Math.floor((1 - v) * 255);
      const i = (y * w + x) * 4;
      img.data[i] = 28;      // #1C
      img.data[i + 1] = 25;  // #19
      img.data[i + 2] = 23;  // #17
      img.data[i + 3] = alpha;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

let noiseDataUrl: string | null = null;
function getNoiseDataUrl() {
  if (!noiseDataUrl) noiseDataUrl = generateNoiseDataUrl();
  return noiseDataUrl;
}

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

const EMPTY_GRID: GridData = {
  points: { type: "FeatureCollection", features: [] },
  cells: { type: "FeatureCollection", features: [] },
};

// --- Fill layer styles (square cells) ---

// Heat index: colored squares by apparent temperature
const heatFillStyle: FillLayerSpecification = {
  id: "heat-fill",
  type: "fill",
  source: "heat-cells",
  paint: {
    "fill-color": [
      "interpolate", ["linear"], ["get", "apparentTemperature"],
      15, "rgba(163,230,53,0.5)",
      25, "rgba(163,230,53,0.55)",
      32, "rgba(251,191,36,0.6)",
      35, "rgba(249,115,22,0.65)",
      38, "rgba(239,68,68,0.7)",
      45, "rgba(220,38,38,0.8)",
    ],
    "fill-opacity": 0.7,
  },
};

// Air quality: colored squares by AQI
const aqiFillStyle: FillLayerSpecification = {
  id: "aqi-fill",
  type: "fill",
  source: "aqi-cells",
  paint: {
    "fill-color": [
      "interpolate", ["linear"], ["get", "usAqi"],
      0, "rgba(22,163,74,0.45)",
      50, "rgba(22,163,74,0.5)",
      100, "rgba(245,158,11,0.55)",
      150, "rgba(249,115,22,0.6)",
      200, "rgba(139,92,246,0.7)",
    ],
    "fill-opacity": 0.65,
  },
};

// Flood risk: colored squares by river discharge
const floodFillStyle: FillLayerSpecification = {
  id: "flood-fill",
  type: "fill",
  source: "flood-cells",
  paint: {
    "fill-color": [
      "interpolate", ["linear"], ["get", "riverDischarge"],
      0, "rgba(191,219,254,0.45)",
      10, "rgba(191,219,254,0.5)",
      50, "rgba(96,165,250,0.55)",
      200, "rgba(59,130,246,0.65)",
      1000, "rgba(29,78,216,0.8)",
    ],
    "fill-opacity": 0.65,
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

  // Live data states — each has point data (for hover) and cell polygons (for rendering)
  const [heatData, setHeatData] = useState<GridData>(EMPTY_GRID);
  const [aqiData, setAqiData] = useState<GridData>(EMPTY_GRID);
  const [floodData, setFloodData] = useState<GridData>(EMPTY_GRID);
  const [isLoading, setIsLoading] = useState(false);

  // Debounced fetch timer
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cache last fetched bounds to skip refetches on small pans
  const lastBoundsRef = useRef<{ north: number; south: number; east: number; west: number } | null>(null);

  // Fetch live vulnerability data for current map bounds (only enabled layers)
  const fetchLayers = useCallback(async (force = false) => {
    const map = mapRef.current;
    if (!map) return;

    const bounds = map.getBounds();
    const boundsObj = {
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    };

    // Skip refetch if new bounds are mostly within the last fetched bounds
    const prev = lastBoundsRef.current;
    if (!force && prev) {
      const margin = 0.005; // ~500m tolerance
      if (
        boundsObj.north <= prev.north + margin &&
        boundsObj.south >= prev.south - margin &&
        boundsObj.east <= prev.east + margin &&
        boundsObj.west >= prev.west - margin
      ) {
        return;
      }
    }

    lastBoundsRef.current = boundsObj;
    setIsLoading(true);

    try {
      const promises: Promise<void>[] = [];

      if (activeLayers.has("heat")) {
        promises.push(fetchHeatGrid(boundsObj).catch(() => EMPTY_GRID).then(setHeatData));
      }
      if (activeLayers.has("aqi")) {
        promises.push(fetchAqiGrid(boundsObj).catch(() => EMPTY_GRID).then(setAqiData));
      }
      if (activeLayers.has("flood")) {
        promises.push(fetchFloodGrid(boundsObj).catch(() => EMPTY_GRID).then(setFloodData));
      }

      await Promise.all(promises);
    } finally {
      setIsLoading(false);
    }
  }, [activeLayers]);

  // Debounced version for map move events
  const debouncedFetch = useCallback(() => {
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
    fetchTimerRef.current = setTimeout(fetchLayers, 1500);
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
    const map = mapRef.current?.getMap();
    if (map) {
      // Pin Perlin noise image to the map bounds so it pans/zooms with tiles
      map.addSource("perlin-noise", {
        type: "image",
        url: getNoiseDataUrl(),
        coordinates: [
          [120.96, 14.78], // top-left
          [121.13, 14.78], // top-right
          [121.13, 14.58], // bottom-right
          [120.96, 14.58], // bottom-left
        ],
      });
      map.addLayer({
        id: "perlin-noise-layer",
        type: "raster",
        source: "perlin-noise",
        paint: {
          "raster-opacity": 0.5,
        },
      });
    }
    fetchLayers(true);
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

      // On touch/mobile, show layer data tooltip (since hover doesn't work)
      if (e.features && e.features.length > 0) {
        const parts: string[] = [];
        for (const f of e.features) {
          const p = f.properties;
          if (!p) continue;
          if (f.layer.id === "heat-fill" && p.apparentTemperature != null) {
            const temp = typeof p.apparentTemperature === "string" ? parseFloat(p.apparentTemperature) : p.apparentTemperature;
            parts.push(`<strong>Heat Index</strong><br/>Feels like: <span style="color:${getHeatColor(temp)};font-weight:600;">${temp}°C</span>`);
          } else if (f.layer.id === "aqi-fill" && p.usAqi != null) {
            const aqi = typeof p.usAqi === "string" ? parseInt(p.usAqi) : p.usAqi;
            parts.push(`<strong>Air Quality</strong><br/>AQI: <span style="color:${getAqiColor(aqi)};font-weight:600;">${aqi} (${getAqiLabel(aqi)})</span>`);
          } else if (f.layer.id === "flood-fill" && p.riverDischarge != null) {
            const discharge = typeof p.riverDischarge === "string" ? parseFloat(p.riverDischarge) : p.riverDischarge;
            parts.push(`<strong>Flood</strong><br/>Flow: <span style="color:#3b82f6;font-weight:600;">${discharge.toFixed(1)} m³/s</span>`);
          }
        }
        if (parts.length) {
          setHoverInfo({ lng, lat, html: parts.join('<hr style="margin:5px 0;border:0;border-top:1px solid #E7E5E4"/>') });
        }
      }

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

      // Fetch live weather for popup (routes through /api/weather for D1/KV caching)
      try {
        const weatherRes = await fetch(`/api/weather?lat=${lat}&lng=${lng}&type=heat`);
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

  const handleMouseMove = useCallback((e: MapLayerMouseEvent) => {
    const map = mapRef.current;
    if (!map) return;

    // Query all interactive layers at the cursor point
    const features = map.queryRenderedFeatures(e.point, {
      layers: [
        ...(activeLayers.has("heat") ? ["heat-fill"] : []),
        ...(activeLayers.has("aqi") ? ["aqi-fill"] : []),
        ...(activeLayers.has("flood") ? ["flood-fill"] : []),
      ].filter((id) => {
        try { return !!map.getLayer(id); } catch { return false; }
      }),
    });

    if (!features.length) {
      map.getCanvas().style.cursor = "";
      setHoverInfo(null);
      return;
    }

    map.getCanvas().style.cursor = "pointer";

    // Aggregate data from all layers at this point into one tooltip
    const parts: string[] = [];

    for (const f of features) {
      const p = f.properties;
      if (!p) continue;

      if (f.layer.id === "heat-fill" && p.apparentTemperature != null) {
        const temp = typeof p.apparentTemperature === "string" ? parseFloat(p.apparentTemperature) : p.apparentTemperature;
        parts.push(
          `<strong>Heat Index</strong><br/>Feels like: <span style="color:${getHeatColor(temp)};font-weight:600;">${temp}°C</span><br/>Actual: ${p.temperature}°C · Humidity: ${p.humidity}%`
        );
      } else if (f.layer.id === "aqi-fill" && p.usAqi != null) {
        const aqi = typeof p.usAqi === "string" ? parseInt(p.usAqi) : p.usAqi;
        parts.push(
          `<strong>Air Quality</strong><br/>AQI: <span style="color:${getAqiColor(aqi)};font-weight:600;">${aqi} (${getAqiLabel(aqi)})</span><br/>PM2.5: ${p.pm25} · PM10: ${p.pm10}`
        );
      } else if (f.layer.id === "flood-fill" && p.riverDischarge != null) {
        const discharge = typeof p.riverDischarge === "string" ? parseFloat(p.riverDischarge) : p.riverDischarge;
        parts.push(
          `<strong>River Discharge</strong><br/>Flow: <span style="color:#3b82f6;font-weight:600;">${discharge.toFixed(1)} m³/s</span>`
        );
      }
    }

    if (parts.length) {
      const { lng, lat } = e.lngLat;
      setHoverInfo({ lng, lat, html: parts.join('<hr style="margin:5px 0;border:0;border-top:1px solid #E7E5E4"/>') });
    } else {
      setHoverInfo(null);
    }
  }, [activeLayers]);

  const handleMouseLeave = useCallback(() => {
    const map = mapRef.current;
    if (map) map.getCanvas().style.cursor = "";
    setHoverInfo(null);
  }, []);

  // Fill layers are interactive for hover tooltips
  const interactiveLayerIds = [
    ...(activeLayers.has("heat") ? ["heat-fill"] : []),
    ...(activeLayers.has("aqi") ? ["aqi-fill"] : []),
    ...(activeLayers.has("flood") ? ["flood-fill"] : []),
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
        maxBounds={[
          [120.96, 14.58], // SW corner of Quezon City
          [121.13, 14.78], // NE corner of Quezon City
        ]}
        style={{ width: "100%", height: "100%" }}
        mapStyle="https://tiles.openfreemap.org/styles/positron"
        onLoad={handleMapLoad}
        onMoveEnd={handleMoveEnd}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        interactiveLayerIds={interactiveLayerIds}
        attributionControl={false}
      >
        <NavigationControl position="bottom-right" showCompass={false} />

        {/* Heat index — square cell fill */}
        {activeLayers.has("heat") && (
          <Source id="heat-cells" type="geojson" data={heatData.cells}>
            <Layer {...(heatFillStyle as unknown as LayerProps)} />
          </Source>
        )}

        {/* Air quality — square cell fill */}
        {activeLayers.has("aqi") && (
          <Source id="aqi-cells" type="geojson" data={aqiData.cells}>
            <Layer {...(aqiFillStyle as unknown as LayerProps)} />
          </Source>
        )}

        {/* Flood risk — square cell fill */}
        {activeLayers.has("flood") && (
          <Source id="flood-cells" type="geojson" data={floodData.cells}>
            <Layer {...(floodFillStyle as unknown as LayerProps)} />
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

      </Map>

      {/* Left-side control stack */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5" style={{ width: 168 }}>

        {/* Layer toggles */}
        <div className="border border-border bg-surface px-3 py-2.5">
          <p className="mb-2 text-[9px] font-black uppercase tracking-[0.18em] text-foreground/50">
            Layers
          </p>
          <div className="space-y-1.5">
            {LAYERS_CONFIG.map((layer) => (
              <label
                key={layer.id}
                className="flex cursor-pointer items-center gap-2 text-[12px] text-foreground/80 hover:text-foreground transition-colors"
              >
                <input
                  type="checkbox"
                  checked={activeLayers.has(layer.id)}
                  onChange={() => toggleLayer(layer.id)}
                  className="accent-accent h-3 w-3 shrink-0"
                />
                <span
                  className="inline-block h-2 w-2 shrink-0"
                  style={{ backgroundColor: layer.color }}
                />
                {layer.label}
              </label>
            ))}
          </div>
          {isLoading && (
            <div className="mt-2 flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full bg-accent shrink-0"
                style={{ animation: "pulse-dot 1.2s ease-in-out infinite" }}
              />
              <p className="text-[9px] text-muted-light">Fetching…</p>
            </div>
          )}
        </div>

        {/* Hover data panel — fixed position, updates with cursor */}
        <div
          className="border border-border bg-surface px-3 py-2.5 transition-opacity duration-150"
          style={{ opacity: hoverInfo ? 1 : 0.6, minHeight: 64 }}
        >
          <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-foreground/50">
            Cursor Data
          </p>
          {hoverInfo ? (
            <div
              className="text-[11px] leading-snug text-foreground"
              style={{ fontFamily: "inherit" }}
              dangerouslySetInnerHTML={{ __html: hoverInfo.html }}
            />
          ) : (
            <p className="text-[11px] italic text-muted-light">
              Hover the map to inspect
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
