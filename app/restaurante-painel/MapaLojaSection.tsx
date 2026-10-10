"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { supabase } from "@/lib/supabase";

const MapPicker = dynamic(
  () => import("../seja-parceiro/MapPicker"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[360px] items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50">
        <p className="font-bold text-zinc-500">Carregando mapa...</p>
      </div>
    ),
  }
);

type Props = {
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
};

type LocationRow = {
  latitude: number | null;
  longitude: number | null;
};

function validCoordinatePair(
  latitude: number | null,
  longitude: number | null
) {
  return (
    latitude !== null &&
    longitude !== null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180 &&
    !(latitude === 0 && longitude === 0)
  );
}

export default function MapaLojaSection({
  street,
  number,
  neighborhood,
  city,
  state,
}: Props) {
  const searchParams = useSearchParams();
  const restaurantId = searchParams.get("restaurant") ?? "";

  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [savedLatitude, setSavedLatitude] = useState<number | null>(null);
  const [savedLongitude, setSavedLongitude] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [gettingGps, setGettingGps] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const address = useMemo(
    () =>
      [street, number, neighborhood, city, state, "Brasil"]
        .filter(Boolean)
        .join(", "),
    [street, number, neighborhood, city, state]
  );

  const hasSavedLocation = validCoordinatePair(
    savedLatitude,
    savedLongitude
  );

  const hasSelectedLocation = validCoordinatePair(
    latitude,
    longitude
  );

  const hasUnsavedChange =
    hasSelectedLocation &&
    (!hasSavedLocation ||
      latitude !== savedLatitude ||
      longitude !== savedLongitude);

  useEffect(() => {
    let cancelled = false;

    async function loadLocation() {
      if (!restaurantId) {
        if (!cancelled) setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      const { data, error: rpcError } = await supabase.rpc(
        "get_my_restaurant_pickup_location",
        { p_restaurant_id: restaurantId }
      );

      if (cancelled) return;

      if (rpcError) {
        console.error("Erro localização loja:", rpcError);
        setError("Não foi possível carregar o pino salvo da loja.");
        setLoading(false);
        return;
      }

      const row =
        Array.isArray(data) && data.length > 0
          ? (data[0] as LocationRow)
          : null;

      const loadedLatitude =
        row?.latitude !== null && row?.latitude !== undefined
          ? Number(row.latitude)
          : null;

      const loadedLongitude =
        row?.longitude !== null && row?.longitude !== undefined
          ? Number(row.longitude)
          : null;

      if (validCoordinatePair(loadedLatitude, loadedLongitude)) {
        setLatitude(loadedLatitude);
        setLongitude(loadedLongitude);
        setSavedLatitude(loadedLatitude);
        setSavedLongitude(loadedLongitude);
      } else {
        setLatitude(null);
        setLongitude(null);
        setSavedLatitude(null);
        setSavedLongitude(null);
      }

      setLoading(false);
    }

    loadLocation();

    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  async function locateAddress() {
    if (!address.trim()) {
      setError("Preencha o endereço da loja primeiro.");
      return;
    }

    setSearching(true);
    setError("");
    setSuccess("");

    const fullAddress = [
      street,
      number,
      neighborhood,
      city,
      state,
      "Brasil",
    ]
      .filter(Boolean)
      .join(", ");

    const withoutNumber = [
      street,
      neighborhood,
      city,
      state,
      "Brasil",
    ]
      .filter(Boolean)
      .join(", ");

    const queries = [
      fullAddress,
      withoutNumber,
      `${neighborhood}, ${city}, ${state}, Brasil`,
    ].filter(Boolean);

    try {
      let found: { lat: string; lon: string } | null = null;

      for (const query of queries) {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(
            query
          )}`
        );

        if (!response.ok) continue;

        const data: { lat: string; lon: string }[] =
          await response.json();

        if (data.length > 0) {
          found = data[0];
          break;
        }
      }

      if (!found) {
        setError(
          "Não consegui localizar esse endereço automaticamente. Clique manualmente no mapa no ponto exato da loja."
        );
        return;
      }

      const foundLatitude = Number(found.lat);
      const foundLongitude = Number(found.lon);

      if (!validCoordinatePair(foundLatitude, foundLongitude)) {
        setError("O endereço retornou uma localização inválida.");
        return;
      }

      setLatitude(foundLatitude);
      setLongitude(foundLongitude);
      setSuccess(
        "Endereço localizado. Agora confira o mapa e clique exatamente onde fica a entrada da loja."
      );
    } catch (locationError) {
      console.error("Erro ao localizar endereço:", locationError);
      setError(
        "Não foi possível localizar automaticamente. Clique manualmente no mapa."
      );
    } finally {
      setSearching(false);
    }
  }

  function useCurrentLocation() {
    if (!("geolocation" in navigator)) {
      setError("Este navegador não permite acessar sua localização.");
      return;
    }

    setGettingGps(true);
    setError("");
    setSuccess("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setGettingGps(false);
        setSuccess(
          "Sua posição foi colocada no mapa. Confirme se este é realmente o ponto da loja."
        );
      },
      (gpsError) => {
        console.error("Erro GPS:", gpsError);
        setGettingGps(false);
        setError(
          "Não consegui pegar sua localização. Permita o acesso ou marque o ponto manualmente."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }

  async function saveLocation() {
    setError("");
    setSuccess("");

    if (!restaurantId) {
      setError("Loja não informada.");
      return;
    }

    if (!validCoordinatePair(latitude, longitude)) {
      setError(
        "Clique no mapa para marcar o ponto exato da loja antes de salvar."
      );
      return;
    }

    setSaving(true);

    const { error: rpcError } = await supabase.rpc(
      "update_my_restaurant_pickup_location",
      {
        p_restaurant_id: restaurantId,
        p_latitude: latitude,
        p_longitude: longitude,
      }
    );

    if (rpcError) {
      console.error("Erro ao salvar localização:", rpcError);

      if (rpcError.message.includes("RESTAURANT_NOT_FOUND")) {
        setError(
          "Essa loja não foi encontrada ou não pertence à sua conta."
        );
      } else if (rpcError.message.includes("INVALID_LOCATION")) {
        setError("A localização escolhida é inválida.");
      } else {
        setError("Não foi possível salvar o ponto da loja.");
      }

      setSaving(false);
      return;
    }

    setSavedLatitude(latitude);
    setSavedLongitude(longitude);
    setSuccess(
      "✅ Ponto exato da loja salvo. A rota de retirada passará a usar este local."
    );
    setSaving(false);
  }

  const googleMapsSavedUrl = hasSavedLocation
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${savedLatitude},${savedLongitude}`
      )}`
    : "";

  return (
    <div className="mt-6 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase text-red-600">
            📍 Localização exata da loja
          </p>
          <h3 className="mt-1 text-xl font-black">
            Pino usado na rota de retirada
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
            Clique no mapa exatamente onde fica a entrada da loja. Esse ponto
            será usado como destino quando o cliente abrir a rota.
          </p>
        </div>

        {hasSavedLocation ? (
          <span className="rounded-full bg-green-100 px-3 py-2 text-xs font-black text-green-700">
            ✅ PINO SALVO
          </span>
        ) : (
          <span className="rounded-full bg-yellow-100 px-3 py-2 text-xs font-black text-yellow-800">
            ⚠️ PINO NÃO DEFINIDO
          </span>
        )}
      </div>

      <div className="mt-5 rounded-2xl bg-zinc-50 p-4">
        <p className="text-xs font-black uppercase text-zinc-400">
          Endereço cadastrado
        </p>
        <p className="mt-2 font-bold text-zinc-800">
          {address || "Endereço não informado"}
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={locateAddress}
          disabled={searching || loading}
          className="rounded-xl border border-zinc-300 bg-white px-4 py-3 font-black text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50"
        >
          {searching ? "🔎 Localizando..." : "🔎 Localizar pelo endereço"}
        </button>

        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={gettingGps || loading}
          className="rounded-xl border border-zinc-300 bg-white px-4 py-3 font-black text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50"
        >
          {gettingGps ? "📍 Pegando GPS..." : "🎯 Usar minha localização"}
        </button>
      </div>

      <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <p className="font-black text-blue-800">Como acertar</p>
        <p className="mt-2 text-sm leading-6 text-blue-700">
          Use os botões acima só para aproximar. Depois dê zoom e clique no
          ponto exato da loja. Por fim, salve o ponto.
        </p>
      </div>

      <div className="mt-5">
        {loading ? (
          <div className="flex h-[360px] items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50">
            <p className="font-bold text-zinc-500">
              Carregando localização...
            </p>
          </div>
        ) : (
          <MapPicker
            latitude={latitude}
            longitude={longitude}
            onChange={(newLatitude: number, newLongitude: number) => {
              setLatitude(newLatitude);
              setLongitude(newLongitude);
              setError("");
              setSuccess("");
            }}
          />
        )}
      </div>

      {hasSelectedLocation && (
        <div className="mt-4 rounded-2xl bg-zinc-50 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-black uppercase text-zinc-400">
                Latitude
              </p>
              <p className="mt-1 font-mono text-sm font-bold">
                {latitude?.toFixed(7)}
              </p>
            </div>

            <div>
              <p className="text-xs font-black uppercase text-zinc-400">
                Longitude
              </p>
              <p className="mt-1 font-mono text-sm font-bold">
                {longitude?.toFixed(7)}
              </p>
            </div>
          </div>

          {hasUnsavedChange && (
            <p className="mt-3 text-sm font-bold text-orange-600">
              ⚠️ Você moveu o pino. Salve para a rota usar este novo ponto.
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div className="mt-4 rounded-xl bg-green-50 p-4 text-sm font-bold text-green-700">
          {success}
        </div>
      )}

      <button
        type="button"
        onClick={saveLocation}
        disabled={saving || !hasSelectedLocation}
        className="mt-5 w-full rounded-xl bg-red-600 px-5 py-4 font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
      >
        {saving ? "Salvando ponto..." : "✅ Confirmar e salvar este ponto"}
      </button>

      {googleMapsSavedUrl && (
        <a
          href={googleMapsSavedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block w-full rounded-xl border border-zinc-300 bg-white px-5 py-3 text-center text-sm font-black text-zinc-800 transition hover:bg-zinc-50"
        >
          🗺️ Conferir ponto salvo no Google Maps
        </a>
      )}
    </div>
  );
}
