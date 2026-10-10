"use client";

import {
  useEffect,
  useMemo,
} from "react";

import L from "leaflet";

import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";

type MapPickerProps = {
  latitude:
    number | null;

  longitude:
    number | null;

  onChange:
    (
      latitude: number,
      longitude: number
    ) => void;
};

// ==========================================
// CENTRO INICIAL
// PAUDALHO - PE
// ==========================================

const DEFAULT_LAT =
  -7.897;

const DEFAULT_LNG =
  -35.179;

// ==========================================
// ÍCONE DO PINO
// ==========================================

const markerIcon =
  L.divIcon({
    className: "",

    html: `
      <div
        style="
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 34px;
          filter: drop-shadow(0 3px 3px rgba(0,0,0,.25));
          transform: translate(-4px, -20px);
        "
      >
        📍
      </div>
    `,

    iconSize: [
      42,
      42,
    ],

    iconAnchor: [
      17,
      34,
    ],
  });

// ==========================================
// CLIQUE NO MAPA
// ==========================================

function MapClickHandler({
  onChange,
}: {
  onChange:
    (
      latitude: number,
      longitude: number
    ) => void;
}) {
  useMapEvents({
    click(
      event
    ) {
      onChange(
        event.latlng.lat,
        event.latlng.lng
      );
    },
  });

  return null;
}

// ==========================================
// RECENTRALIZAR MAPA
// ==========================================

function MapCenter({
  latitude,
  longitude,
}: {
  latitude:
    number | null;

  longitude:
    number | null;
}) {
  const map =
    useMap();

  useEffect(() => {
    if (
      latitude ===
        null ||
      longitude ===
        null
    ) {
      return;
    }

    map.flyTo(
      [
        latitude,
        longitude,
      ],
      17,
      {
        duration:
          0.7,
      }
    );
  }, [
    latitude,
    longitude,
    map,
  ]);

  return null;
}

// ==========================================
// MAPA
// ==========================================

export default function MapPicker({
  latitude,
  longitude,
  onChange,
}: MapPickerProps) {
  const center =
    useMemo<
      [
        number,
        number,
      ]
    >(
      () => [
        latitude ??
          DEFAULT_LAT,

        longitude ??
          DEFAULT_LNG,
      ],
      [
        latitude,
        longitude,
      ]
    );

  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-zinc-200">
        <MapContainer
          center={
            center
          }
          zoom={
            latitude !==
              null &&
            longitude !==
              null
              ? 17
              : 14
          }
          scrollWheelZoom={
            true
          }
          className="h-[360px] w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapClickHandler
            onChange={
              onChange
            }
          />

          <MapCenter
            latitude={
              latitude
            }
            longitude={
              longitude
            }
          />

          {latitude !==
            null &&
            longitude !==
              null && (
              <Marker
                position={[
                  latitude,
                  longitude,
                ]}
                icon={
                  markerIcon
                }
                draggable={
                  true
                }
                eventHandlers={{
                  dragend:
                    (
                      event
                    ) => {
                      const marker =
                        event.target as L.Marker;

                      const position =
                        marker.getLatLng();

                      onChange(
                        position.lat,
                        position.lng
                      );
                    },
                }}
              />
            )}
        </MapContainer>
      </div>

      <div className="mt-4 rounded-2xl bg-zinc-50 p-4">
        {latitude !==
          null &&
        longitude !==
          null ? (
          <>
            <p className="font-black text-green-700">
              📍 Ponto da loja selecionado
            </p>

            <p className="mt-2 text-sm text-zinc-500">
              Se estiver errado, clique em outro
              ponto do mapa ou arraste o pino.
            </p>

            <div className="mt-3 grid gap-2 text-xs text-zinc-400 sm:grid-cols-2">
              <p>
                Latitude:{" "}
                {latitude.toFixed(
                  6
                )}
              </p>

              <p>
                Longitude:{" "}
                {longitude.toFixed(
                  6
                )}
              </p>
            </div>
          </>
        ) : (
          <>
            <p className="font-black">
              👆 Marque sua loja
            </p>

            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Clique no ponto exato do mapa onde
              fica a entrada do estabelecimento.
            </p>
          </>
        )}
      </div>
    </div>
  );
}