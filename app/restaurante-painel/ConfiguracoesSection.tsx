"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { useSearchParams } from "next/navigation";

import { supabase } from "@/lib/supabase";

type RestaurantSettings = {
  restaurant_id: string;
  restaurant_name: string;
  orders_paused: boolean;
  pickup_paused: boolean;
};

export default function ConfiguracoesSection() {
  const searchParams = useSearchParams();

  const restaurantId =
    searchParams.get("restaurant") ?? "";

  const [settings, setSettings] =
    useState<RestaurantSettings | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [savingDelivery, setSavingDelivery] =
    useState(false);

  const [savingPickup, setSavingPickup] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const loadSettings =
    useCallback(async () => {
      setLoading(true);
      setError("");
      setSuccess("");

      if (!restaurantId) {
        setSettings(null);
        setError(
          "Loja não informada. Volte para Minhas lojas e abra o painel novamente."
        );
        setLoading(false);
        return;
      }

      const {
        data,
        error: rpcError,
      } = await supabase.rpc(
        "get_my_restaurant_operation_settings",
        {
          p_restaurant_id: restaurantId,
        }
      );

      if (rpcError) {
        console.error(
          "Erro configurações:",
          rpcError
        );

        if (
          rpcError.message.includes(
            "RESTAURANT_NOT_FOUND"
          )
        ) {
          setError(
            "Essa loja não foi encontrada ou não pertence à sua conta."
          );
        } else {
          setError(
            "Não foi possível carregar as configurações desta loja."
          );
        }

        setSettings(null);
        setLoading(false);
        return;
      }

      const result =
        Array.isArray(data) &&
        data.length > 0
          ? (data[0] as RestaurantSettings)
          : null;

      if (!result) {
        setError(
          "Restaurante não encontrado."
        );
        setSettings(null);
        setLoading(false);
        return;
      }

      if (
        result.restaurant_id !==
        restaurantId
      ) {
        setError(
          "Os dados recebidos não correspondem à loja aberta."
        );
        setSettings(null);
        setLoading(false);
        return;
      }

      setSettings(result);
      setLoading(false);
    }, [restaurantId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function toggleDelivery() {
    if (
      !settings ||
      savingDelivery ||
      savingPickup
    ) {
      return;
    }

    if (!restaurantId) {
      setError(
        "Loja não informada. Volte para Minhas lojas e abra o painel novamente."
      );
      return;
    }

    const newPausedValue =
      !settings.orders_paused;

    setSavingDelivery(true);
    setError("");
    setSuccess("");

    const {
      data,
      error: rpcError,
    } = await supabase.rpc(
      "set_my_restaurant_orders_paused",
      {
        p_restaurant_id: restaurantId,
        p_paused: newPausedValue,
      }
    );

    if (rpcError) {
      console.error(
        "Erro pausa entregas:",
        rpcError
      );

      setError(
        "Não foi possível alterar o recebimento de entregas desta loja."
      );

      setSavingDelivery(false);
      return;
    }

    setSettings((current) =>
      current
        ? {
            ...current,
            orders_paused: Boolean(data),
          }
        : current
    );

    setSuccess(
      newPausedValue
        ? "Entregas pausadas somente nesta loja."
        : "Esta loja voltou a receber pedidos para entrega."
    );

    setSavingDelivery(false);
  }

  async function togglePickup() {
    if (
      !settings ||
      savingPickup ||
      savingDelivery
    ) {
      return;
    }

    if (!restaurantId) {
      setError(
        "Loja não informada. Volte para Minhas lojas e abra o painel novamente."
      );
      return;
    }

    const newPausedValue =
      !settings.pickup_paused;

    setSavingPickup(true);
    setError("");
    setSuccess("");

    const {
      data,
      error: rpcError,
    } = await supabase.rpc(
      "set_my_restaurant_pickup_paused",
      {
        p_restaurant_id: restaurantId,
        p_paused: newPausedValue,
      }
    );

    if (rpcError) {
      console.error(
        "Erro pausa retirada:",
        rpcError
      );

      setError(
        "Não foi possível alterar o recebimento de retiradas desta loja."
      );

      setSavingPickup(false);
      return;
    }

    setSettings((current) =>
      current
        ? {
            ...current,
            pickup_paused: Boolean(data),
          }
        : current
    );

    setSuccess(
      newPausedValue
        ? "Retiradas pausadas somente nesta loja."
        : "Esta loja voltou a receber pedidos para retirada."
    );

    setSavingPickup(false);
  }

  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
        <p className="font-bold">
          Carregando configurações...
        </p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div>
        <p className="text-sm font-black text-red-600">
          CONFIGURAÇÕES
        </p>

        <h2 className="mt-1 text-3xl font-black">
          Configurações da loja
        </h2>

        <div className="mt-6 rounded-2xl bg-red-50 p-5 font-semibold text-red-700">
          {error ||
            "Não foi possível carregar a loja."}
        </div>
      </div>
    );
  }

  const deliveryActive =
    !settings.orders_paused;

  const pickupActive =
    !settings.pickup_paused;

  const bothActive =
    deliveryActive &&
    pickupActive;

  const bothPaused =
    !deliveryActive &&
    !pickupActive;

  return (
    <div>
      <div>
        <p className="text-sm font-black text-red-600">
          CONFIGURAÇÕES
        </p>

        <h2 className="mt-1 text-3xl font-black">
          Configurações da loja
        </h2>

        <p className="mt-1 text-zinc-500">
          Controle entrega e retirada do{" "}
          <strong>
            {settings.restaurant_name}
          </strong>
          .
        </p>
      </div>

      {error && (
        <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div className="mt-6 rounded-2xl bg-green-50 p-4 text-sm font-bold text-green-700">
          ✅ {success}
        </div>
      )}

      <section className="mt-6 overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="border-b border-zinc-100 p-6">
          <p className="text-xs font-black uppercase tracking-wide text-red-600">
            OPERAÇÃO
          </p>

          <h3 className="mt-1 text-2xl font-black">
            Entrega e retirada
          </h3>

          <p className="mt-2 max-w-3xl text-zinc-500">
            Controle separadamente quais tipos de pedido esta loja deseja receber.
            Os horários de funcionamento continuam valendo normalmente.
          </p>
        </div>

        <div className="p-6">
          <div
            className={`rounded-2xl border p-5 ${
              bothActive
                ? "border-green-200 bg-green-50"
                : bothPaused
                  ? "border-red-200 bg-red-50"
                  : "border-orange-200 bg-orange-50"
            }`}
          >
            <p
              className={`text-sm font-black ${
                bothActive
                  ? "text-green-700"
                  : bothPaused
                    ? "text-red-700"
                    : "text-orange-700"
              }`}
            >
              {bothActive
                ? "🟢 ENTREGA E RETIRADA ATIVAS"
                : bothPaused
                  ? "🔴 ENTREGA E RETIRADA PAUSADAS"
                  : "🟠 OPERAÇÃO PARCIAL"}
            </p>

            <h4 className="mt-2 text-xl font-black">
              {bothActive
                ? "A loja está recebendo entrega e retirada"
                : bothPaused
                  ? "A loja não está recebendo novos pedidos"
                  : deliveryActive
                    ? "Somente entrega está ativa"
                    : "Somente retirada está ativa"}
            </h4>

            <p
              className={`mt-2 text-sm leading-6 ${
                bothActive
                  ? "text-green-700"
                  : bothPaused
                    ? "text-red-700"
                    : "text-orange-700"
              }`}
            >
              Os horários configurados na área “Horários” continuam sendo respeitados.
            </p>
          </div>

          <div
            className={`mt-5 rounded-2xl border p-5 ${
              deliveryActive
                ? "border-green-200 bg-green-50"
                : "border-red-200 bg-red-50"
            }`}
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p
                  className={`text-sm font-black ${
                    deliveryActive
                      ? "text-green-700"
                      : "text-red-700"
                  }`}
                >
                  🛵 ENTREGA
                </p>

                <h4 className="mt-2 text-xl font-black">
                  {deliveryActive
                    ? "Pedidos para entrega estão ativos"
                    : "Pedidos para entrega estão pausados"}
                </h4>

                <p
                  className={`mt-2 text-sm leading-6 ${
                    deliveryActive
                      ? "text-green-700"
                      : "text-red-600"
                  }`}
                >
                  {deliveryActive
                    ? "Os clientes podem escolher entrega enquanto a loja estiver dentro do horário de funcionamento."
                    : "Novos pedidos para entrega ficam temporariamente indisponíveis."}
                </p>
              </div>

              <button
                type="button"
                disabled={
                  savingDelivery ||
                  savingPickup
                }
                onClick={
                  toggleDelivery
                }
                className={`shrink-0 rounded-xl px-6 py-4 font-black text-white transition disabled:bg-zinc-300 ${
                  deliveryActive
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {savingDelivery
                  ? "Salvando..."
                  : deliveryActive
                    ? "⏸ Pausar entregas"
                    : "▶ Ativar entregas"}
              </button>
            </div>
          </div>

          <div
            className={`mt-4 rounded-2xl border p-5 ${
              pickupActive
                ? "border-green-200 bg-green-50"
                : "border-red-200 bg-red-50"
            }`}
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p
                  className={`text-sm font-black ${
                    pickupActive
                      ? "text-green-700"
                      : "text-red-700"
                  }`}
                >
                  🏪 RETIRADA NA LOJA
                </p>

                <h4 className="mt-2 text-xl font-black">
                  {pickupActive
                    ? "Pedidos para retirada estão ativos"
                    : "Pedidos para retirada estão pausados"}
                </h4>

                <p
                  className={`mt-2 text-sm leading-6 ${
                    pickupActive
                      ? "text-green-700"
                      : "text-red-600"
                  }`}
                >
                  {pickupActive
                    ? "Os clientes podem escolher retirada na loja enquanto ela estiver dentro do horário de funcionamento."
                    : "Novos pedidos para retirada ficam temporariamente indisponíveis."}
                </p>
              </div>

              <button
                type="button"
                disabled={
                  savingPickup ||
                  savingDelivery
                }
                onClick={
                  togglePickup
                }
                className={`shrink-0 rounded-xl px-6 py-4 font-black text-white transition disabled:bg-zinc-300 ${
                  pickupActive
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {savingPickup
                  ? "Salvando..."
                  : pickupActive
                    ? "⏸ Pausar retiradas"
                    : "▶ Ativar retiradas"}
              </button>
            </div>
          </div>

          <div className="mt-5 rounded-2xl bg-yellow-50 p-5">
            <p className="font-black text-yellow-800">
              🕐 Os horários continuam valendo
            </p>

            <p className="mt-2 text-sm leading-6 text-yellow-700">
              Pausar entrega ou retirada não altera os horários configurados na área
              “Horários” desta loja.
            </p>

            <p className="mt-2 text-sm leading-6 text-yellow-700">
              Fora do horário de funcionamento, nenhum tipo de pedido deve ser aceito.
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5">
            <p className="font-black">
              📌 Status atual
            </p>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-zinc-500">
                  🛵 Entrega
                </span>

                <span
                  className={`font-black ${
                    deliveryActive
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {deliveryActive
                    ? "Ativa"
                    : "Pausada"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-zinc-500">
                  🏪 Retirada
                </span>

                <span
                  className={`font-black ${
                    pickupActive
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {pickupActive
                    ? "Ativa"
                    : "Pausada"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-zinc-500">
                  🕐 Fora do horário
                </span>

                <span className="font-black text-red-600">
                  Nenhum pedido
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
