"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";

import { divIcon } from "leaflet";

import "leaflet/dist/leaflet.css";

type Props = {
  initialLat?: number | null;
  initialLong?: number | null;

  onChange: (
    lat: number,
    long: number
  ) => void;
};

type Position = {
  lat: number;
  long: number;
};

const DEFAULT_LAT = -7.8967;
const DEFAULT_LONG = -35.1797;

// ==========================================
// PINO
// ==========================================

const pinIcon = divIcon({
  className: "",

  html: `
    <div
      style="
        font-size: 42px;
        line-height: 42px;
        transform: translate(-1px, -5px);
        filter: drop-shadow(0 3px 3px rgba(0,0,0,.35));
      "
    >
      📍
    </div>
  `,

  iconSize: [42, 42],

  iconAnchor: [21, 38],
});

// ==========================================
// CENTRALIZAR MAPA
// ==========================================

function RecenterMap({
  lat,
  long,
}: {
  lat: number;
  long: number;
}) {
  const map = useMap();

  useEffect(() => {
    map.setView(
      [lat, long],
      18
    );
  }, [
    lat,
    long,
    map,
  ]);

  return null;
}

// ==========================================
// CLIQUE NO MAPA
// ==========================================

function MapClickHandler({
  onSelect,
}: {
  onSelect: (
    lat: number,
    long: number
  ) => void;
}) {
  useMapEvents({
    click(event) {
      onSelect(
        event.latlng.lat,
        event.latlng.lng
      );
    },
  });

  return null;
}

export default function AddressMapPicker({
  initialLat,
  initialLong,
  onChange,
}: Props) {
  const [
    position,
    setPosition,
  ] = useState<Position>({
    lat:
      initialLat ??
      DEFAULT_LAT,

    long:
      initialLong ??
      DEFAULT_LONG,
  });

  const [
    locating,
    setLocating,
  ] = useState(false);

  const [
    locationError,
    setLocationError,
  ] = useState("");

  const [
    accuracy,
    setAccuracy,
  ] = useState<number | null>(
    null
  );

  const [
    locationWarning,
    setLocationWarning,
  ] = useState("");

  const watchIdRef =
    useRef<number | null>(
      null
    );

  const bestAccuracyRef =
    useRef<number>(
      Infinity
    );

  const bestPositionRef =
    useRef<{
      lat: number;
      long: number;
      accuracy: number;
    } | null>(null);

  const center =
    useMemo(
      () =>
        [
          position.lat,
          position.long,
        ] as [
          number,
          number,
        ],
      [
        position.lat,
        position.long,
      ]
    );

  // ==========================================
  // ALTERAR PINO
  // ==========================================

  function changePosition(
    lat: number,
    long: number
  ) {
    setPosition({
      lat,
      long,
    });

    onChange(
      lat,
      long
    );
  }

  // ==========================================
  // LOCALIZAÇÃO ATUAL
  // ==========================================

  function useCurrentLocation() {
    setLocationError("");
    setLocationWarning("");
    setAccuracy(null);

    if (
      !navigator.geolocation
    ) {
      setLocationError(
        "Este aparelho não permite acessar a localização."
      );

      return;
    }

    setLocating(true);

    bestAccuracyRef.current =
      Infinity;

    bestPositionRef.current =
      null;

    // Vamos observar várias leituras
    // e escolher a mais precisa.

    const watchId =
      navigator.geolocation.watchPosition(
        (result) => {
          const newAccuracy =
            result.coords.accuracy;

          const newLat =
            result.coords.latitude;

          const newLong =
            result.coords.longitude;

          if (
            newAccuracy <
            bestAccuracyRef.current
          ) {
            bestAccuracyRef.current =
              newAccuracy;

            bestPositionRef.current = {
              lat: newLat,
              long: newLong,
              accuracy:
                newAccuracy,
            };

            changePosition(
              newLat,
              newLong
            );

            setAccuracy(
              newAccuracy
            );
          }

          // Se conseguiu uma leitura
          // muito boa, não precisa esperar.
          if (
            newAccuracy <= 20
          ) {
            navigator.geolocation.clearWatch(
              watchId
            );

            watchIdRef.current =
              null;

            setLocating(false);

            setLocationWarning("");
          }
        },

        (error) => {
          console.error(
            "Erro localização:",
            error
          );

          if (
            error.code ===
            error.PERMISSION_DENIED
          ) {
            setLocationError(
              "A localização está bloqueada. Permita o acesso à localização no navegador."
            );
          } else {
            setLocationError(
              "Não foi possível identificar sua localização."
            );
          }

          setLocating(false);
        },

        {
          enableHighAccuracy:
            true,

          timeout:
            15000,

          maximumAge:
            0,
        }
      );

    watchIdRef.current =
      watchId;

    // Espera alguns segundos para tentar
    // conseguir uma leitura melhor.
    window.setTimeout(() => {
      if (
        watchIdRef.current !==
        null
      ) {
        navigator.geolocation.clearWatch(
          watchIdRef.current
        );

        watchIdRef.current =
          null;
      }

      const best =
        bestPositionRef.current;

      if (best) {
        changePosition(
          best.lat,
          best.long
        );

        setAccuracy(
          best.accuracy
        );

        if (
          best.accuracy > 100
        ) {
          setLocationWarning(
            "Seu computador informou uma localização aproximada. Arraste o pino até a entrada exata da sua casa."
          );
        } else if (
          best.accuracy > 40
        ) {
          setLocationWarning(
            "A localização pode ter alguns metros de diferença. Confira o pino antes de confirmar."
          );
        } else {
          setLocationWarning("");
        }
      } else {
        setLocationError(
          "Não conseguimos obter sua localização. Marque sua casa manualmente no mapa."
        );
      }

      setLocating(false);
    }, 8000);
  }

  // LIMPEZA

  useEffect(() => {
    return () => {
      if (
        watchIdRef.current !==
        null
      ) {
        navigator.geolocation.clearWatch(
          watchIdRef.current
        );
      }
    };
  }, []);

  return (
    <div>
      {/* INSTRUÇÃO */}

      <div className="mb-4 rounded-2xl bg-blue-50 p-4">
        <p className="font-black text-blue-800">
          📍 Marque a entrada da sua casa
        </p>

        <p className="mt-1 text-sm text-blue-700">
          Arraste o pino ou toque no mapa
          exatamente onde o entregador deve
          chegar.
        </p>
      </div>

      {/* MAPA */}

      <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-100">
        <MapContainer
          center={center}
          zoom={17}
          scrollWheelZoom
          className="h-[430px] w-full"
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <Marker
            position={[
              position.lat,
              position.long,
            ]}
            draggable
            icon={pinIcon}
            eventHandlers={{
              dragend(event) {
                const marker =
                  event.target;

                const newPosition =
                  marker.getLatLng();

                changePosition(
                  newPosition.lat,
                  newPosition.lng
                );

                // Se o usuário moveu manualmente,
                // consideramos que ele conferiu
                // o ponto exato.
                setLocationWarning("");
              },
            }}
          />

          <MapClickHandler
            onSelect={(
              lat,
              long
            ) => {
              changePosition(
                lat,
                long
              );

              setLocationWarning("");
            }}
          />

          <RecenterMap
            lat={
              position.lat
            }
            long={
              position.long
            }
          />
        </MapContainer>
      </div>

      {/* GPS */}

      <button
        type="button"
        disabled={locating}
        onClick={
          useCurrentLocation
        }
        className="mt-4 w-full rounded-xl border-2 border-red-600 px-5 py-4 font-black text-red-600 transition hover:bg-red-50 disabled:border-zinc-300 disabled:text-zinc-400"
      >
        {locating
          ? "📡 Procurando uma localização mais precisa..."
          : "🎯 Usar minha localização atual"}
      </button>

      {/* PRECISÃO */}

      {accuracy !== null && (
        <div className="mt-3 rounded-xl bg-zinc-100 p-4">
          <p className="text-sm font-bold">
            Precisão informada pelo aparelho:
          </p>

          <p
            className={`mt-1 font-black ${
              accuracy <= 40
                ? "text-green-600"
                : accuracy <= 100
                  ? "text-orange-600"
                  : "text-red-600"
            }`}
          >
            aproximadamente{" "}
            {Math.round(
              accuracy
            )}{" "}
            metros
          </p>
        </div>
      )}

      {/* AVISO */}

      {locationWarning && (
        <div className="mt-3 rounded-xl bg-yellow-50 p-4">
          <p className="font-bold text-yellow-800">
            ⚠️ Localização aproximada
          </p>

          <p className="mt-1 text-sm text-yellow-700">
            {locationWarning}
          </p>
        </div>
      )}

      {/* ERRO */}

      {locationError && (
        <div className="mt-3 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">
          {locationError}
        </div>
      )}

      {/* COORDENADAS */}

      <div className="mt-4 rounded-xl bg-zinc-100 p-4">
        <p className="text-xs font-black text-zinc-400">
          PONTO MARCADO
        </p>

        <p className="mt-1 text-sm font-semibold text-zinc-600">
          Latitude:{" "}
          {position.lat.toFixed(
            6
          )}
        </p>

        <p className="text-sm font-semibold text-zinc-600">
          Longitude:{" "}
          {position.long.toFixed(
            6
          )}
        </p>
      </div>

      <div className="mt-4 rounded-2xl bg-green-50 p-4">
        <p className="font-bold text-green-800">
          🏠 O pino é o que vale para a entrega
        </p>

        <p className="mt-1 text-sm text-green-700">
          Se a localização automática cair
          no lugar errado, arraste o 📍 até
          sua casa. O entregador receberá
          exatamente o ponto que você
          confirmar aqui.
        </p>
      </div>
    </div>
  );
}