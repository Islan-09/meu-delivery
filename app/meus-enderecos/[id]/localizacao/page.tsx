"use client";

import dynamic from "next/dynamic";

import Link from "next/link";

import {
  useEffect,
  useState,
} from "react";

import {
  useParams,
  useRouter,
} from "next/navigation";

import { supabase } from "@/lib/supabase";

// Importamos o mapa dessa forma para evitar
// erro do Leaflet durante o carregamento do Next.js.
const AddressMapPicker = dynamic(
  () =>
    import(
      "@/app/components/AddressMapPicker"
    ),
  {
    ssr: false,

    loading: () => (
      <div className="flex h-[430px] items-center justify-center rounded-3xl bg-zinc-100">
        <p className="font-bold">
          Carregando mapa...
        </p>
      </div>
    ),
  }
);

type Address = {
  id: string;

  label: string | null;

  street: string;
  number: string | null;
  complement: string | null;

  neighborhood: string;

  city: string;
  state: string;

  zipcode: string | null;

  lat: number | null;
  long: number | null;
};

export default function LocalizacaoEnderecoPage() {
  const params = useParams();
  const router = useRouter();

  const addressId =
    String(params.id);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [address, setAddress] =
    useState<Address | null>(
      null
    );

  const [lat, setLat] =
    useState<number | null>(
      null
    );

  const [long, setLong] =
    useState<number | null>(
      null
    );

  // ==========================================
  // CARREGAR ENDEREÇO
  // ==========================================

  useEffect(() => {
    async function loadAddress() {
      setLoading(true);
      setError("");

      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      if (!session) {
        sessionStorage.setItem(
          "after-login",
          `/meus-enderecos/${addressId}/localizacao`
        );

        router.replace("/login");

        return;
      }

      const {
  data: addressData,
  error: addressError,
} = await supabase.rpc(
  "get_my_address_for_location",
  {
    p_address_id: addressId,
  }
);

const data =
  Array.isArray(addressData) &&
  addressData.length > 0
    ? addressData[0]
    : null;

      if (addressError) {
        console.error(
          "Erro ao buscar endereço:",
          addressError
        );

        setError(
          "Não foi possível carregar este endereço."
        );

        setLoading(false);

        return;
      }

      if (!data) {
        setError(
          "Endereço não encontrado."
        );

        setLoading(false);

        return;
      }

      const currentAddress =
        data as Address;

      setAddress(
        currentAddress
      );

      if (
        currentAddress.lat !== null &&
        currentAddress.long !== null
      ) {
        setLat(
          Number(
            currentAddress.lat
          )
        );

        setLong(
          Number(
            currentAddress.long
          )
        );
      }

      setLoading(false);
    }

    loadAddress();
  }, [
    addressId,
    router,
  ]);

  // ==========================================
  // RECEBER POSIÇÃO DO MAPA
  // ==========================================

  function handlePositionChange(
    newLat: number,
    newLong: number
  ) {
    setLat(newLat);
    setLong(newLong);

    setError("");
  }

  // ==========================================
  // SALVAR LOCALIZAÇÃO
  // ==========================================

  async function confirmLocation() {
    if (
      lat === null ||
      long === null
    ) {
      setError(
        "Marque sua localização no mapa antes de continuar."
      );

      return;
    }

    setSaving(true);
    setError("");

    const {
      error: saveError,
    } = await supabase.rpc(
      "update_my_address_location",
      {
        p_address_id:
          addressId,

        p_lat:
          lat,

        p_long:
          long,
      }
    );

    if (saveError) {
      console.error(
        "Erro salvar localização:",
        saveError
      );

      setError(
        "Não foi possível salvar sua localização."
      );

      setSaving(false);

      return;
    }

    router.push(
      "/meus-enderecos"
    );
  }

  // ==========================================
  // CARREGANDO
  // ==========================================

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7]">
        <p className="font-bold">
          Carregando localização...
        </p>
      </main>
    );
  }

  // ==========================================
  // ERRO / ENDEREÇO NÃO ENCONTRADO
  // ==========================================

  if (
    error &&
    !address
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7] px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
          <div className="text-5xl">
            ⚠️
          </div>

          <h1 className="mt-4 text-2xl font-black">
            Não foi possível abrir
            o endereço
          </h1>

          <p className="mt-2 text-zinc-500">
            {error}
          </p>

          <Link
            href="/meus-enderecos"
            className="mt-6 block rounded-xl bg-red-600 px-5 py-4 font-black text-white"
          >
            Voltar aos endereços
          </Link>
        </div>
      </main>
    );
  }

  if (!address) {
    return null;
  }

  return (
    <main className="min-h-screen bg-[#f7f7f7] text-zinc-900">
      {/* CABEÇALHO */}

      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link
            href="/meus-enderecos"
            className="font-bold text-red-600"
          >
            ← Voltar
          </Link>

          <p className="font-black text-red-600">
            Entrega Paudalho
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* TÍTULO */}

        <div>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl">
            📍
          </div>

          <h1 className="mt-4 text-3xl font-black">
            Ajustar localização
          </h1>

          <p className="mt-2 text-zinc-500">
            Marque no mapa exatamente onde
            o entregador deve chegar.
          </p>
        </div>

        {/* ENDEREÇO */}

        <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase text-zinc-400">
            {address.label ||
              "Endereço"}
          </p>

          <p className="mt-2 text-lg font-black">
            {address.street}

            {address.number
              ? `, ${address.number}`
              : ""}
          </p>

          {address.complement && (
            <p className="mt-1 text-sm text-zinc-500">
              {
                address.complement
              }
            </p>
          )}

          <p className="mt-1 text-sm text-zinc-500">
            {
              address.neighborhood
            }
            {" • "}
            {address.city} -{" "}
            {address.state}
          </p>

          {address.zipcode && (
            <p className="mt-1 text-xs text-zinc-400">
              CEP{" "}
              {address.zipcode}
            </p>
          )}
        </section>

        {/* MAPA */}

        <section className="mt-5 rounded-3xl bg-white p-5 shadow-sm">
          <AddressMapPicker
            initialLat={lat}
            initialLong={long}
            onChange={
              handlePositionChange
            }
          />

          {error && (
            <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          <button
            type="button"
            disabled={
              saving ||
              lat === null ||
              long === null
            }
            onClick={
              confirmLocation
            }
            className="mt-6 w-full rounded-xl bg-red-600 px-5 py-4 font-black text-white transition hover:bg-red-700 disabled:bg-zinc-300"
          >
            {saving
              ? "Salvando localização..."
              : "✅ Confirmar localização"}
          </button>
        </section>

        <div className="mt-5 rounded-2xl bg-yellow-50 p-4">
          <p className="font-bold text-yellow-800">
            💡 Dica
          </p>

          <p className="mt-1 text-sm text-yellow-700">
            Tente colocar o pino na entrada
            da casa, portão ou local onde o
            entregador realmente deve parar.
          </p>
        </div>
      </div>
    </main>
  );
}