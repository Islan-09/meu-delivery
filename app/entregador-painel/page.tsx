"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

type PanelTab =
  | "inicio"
  | "entregas"
  | "ganhos"
  | "conta";

type DriverProfile = {
  user_id: string;
  active: boolean;
  online: boolean;
  vehicle_type: string;
  plate: string | null;
};

type DeliveryOffer = {
  offer_id: string;
  order_id: string;

  restaurant_name: string;
  restaurant_street: string;
  restaurant_number: string | null;
  restaurant_neighborhood: string;

  customer_neighborhood: string;

  delivery_fee: number | string;
  total: number | string;

  offered_at: string;
  expires_at: string;

  seconds_remaining: number;
};

type OrderItem = {
  name: string;
  quantity: number;
};

type CurrentOrder = {
  order_id: string;
  order_status: string;

  restaurant_name: string;
  restaurant_phone: string | null;

  restaurant_street: string;
  restaurant_number: string | null;
  restaurant_neighborhood: string;

  customer_name: string | null;
  customer_phone: string | null;

  customer_street: string;
  customer_number: string | null;
  customer_complement: string | null;
  customer_neighborhood: string;
  customer_city: string;
  customer_state: string;

  delivery_fee: number | string;
  total: number | string;

  items: OrderItem[];
};

type Earnings = {
  today_earnings: number | string;
  week_earnings: number | string;
  today_deliveries: number;
  week_deliveries: number;
};

function money(
  value:
    | number
    | string
    | null
) {
  return Number(
    value ?? 0
  ).toLocaleString(
    "pt-BR",
    {
      style:
        "currency",

      currency:
        "BRL",
    }
  );
}

function shortOrderId(
  orderId: string
) {
  return orderId
    .slice(
      0,
      8
    )
    .toUpperCase();
}

export default function EntregadorPainelPage() {
  const router =
    useRouter();

  const [
    activeTab,
    setActiveTab,
  ] =
    useState<PanelTab>(
      "inicio"
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    processing,
    setProcessing,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    online,
    setOnline,
  ] =
    useState(false);

  const [
    driverFound,
    setDriverFound,
  ] =
    useState(false);

  // ==========================================
  // PERFIL
  // ==========================================

  const [
    driverName,
    setDriverName,
  ] =
    useState(
      "Entregador"
    );

  const [
    driverPhone,
    setDriverPhone,
  ] =
    useState("");

  const [
    driverVehicle,
    setDriverVehicle,
  ] =
    useState("");

  const [
    driverPlate,
    setDriverPlate,
  ] =
    useState("");

  // ==========================================
  // OFERTA
  // ==========================================

  const [
    deliveryOffer,
    setDeliveryOffer,
  ] =
    useState<
      DeliveryOffer | null
    >(null);

  const [
    offerSeconds,
    setOfferSeconds,
  ] =
    useState(0);

  // ==========================================
  // ENTREGA ATUAL
  // ==========================================

  const [
    currentOrder,
    setCurrentOrder,
  ] =
    useState<
      CurrentOrder | null
    >(null);

  const [
    pickupCode,
    setPickupCode,
  ] =
    useState("");

  const [
    deliveryCodeInput,
    setDeliveryCodeInput,
  ] =
    useState("");

  // ==========================================
  // GANHOS
  // ==========================================

  const [
    earnings,
    setEarnings,
  ] =
    useState<Earnings>({
      today_earnings:
        0,

      week_earnings:
        0,

      today_deliveries:
        0,

      week_deliveries:
        0,
    });

  // ==========================================
  // CARREGAR PAINEL
  // ==========================================

  const loadPanel =
    useCallback(
      async (
        firstLoad =
          false
      ) => {
        if (
          firstLoad
        ) {
          setLoading(
            true
          );

          setError("");
        } else {
          setRefreshing(
            true
          );
        }

        const {
          data: {
            session,
          },
        } =
          await supabase.auth
            .getSession();

        // ======================================
        // NÃO ESTÁ LOGADO
        // ======================================

        if (
          !session
        ) {
          router.replace(
            "/entregador"
          );

          setLoading(
            false
          );

          setRefreshing(
            false
          );

          return;
        }

        // ======================================
        // PERFIL DO USUÁRIO
        // ======================================

        const {
          data:
            profileData,
          error:
            profileError,
        } =
          await supabase
            .from(
              "profiles"
            )
            .select(`
              full_name,
              phone
            `)
            .eq(
              "id",
              session.user.id
            )
            .maybeSingle();

        if (
          profileError
        ) {
          console.error(
            "Erro perfil:",
            profileError
          );
        }

        if (
          profileData
        ) {
          setDriverName(
            profileData.full_name ||
              "Entregador"
          );

          setDriverPhone(
            profileData.phone ||
              ""
          );
        }

        // ======================================
        // PERFIL DO ENTREGADOR
        // ======================================

        const {
          data:
            driverData,
          error:
            driverError,
        } =
          await supabase.rpc(
            "get_my_driver_profile"
          );

        if (
          driverError
        ) {
          console.error(
            "Erro entregador:",
            driverError
          );

          setError(
            "Não foi possível verificar seu cadastro de entregador."
          );

          setDriverFound(
            false
          );

          setLoading(
            false
          );

          setRefreshing(
            false
          );

          return;
        }

        const driver:
          | DriverProfile
          | null =
          Array.isArray(
            driverData
          ) &&
          driverData.length >
            0
            ? (
                driverData[0] as DriverProfile
              )
            : null;

        if (
          !driver ||
          !driver.active
        ) {
          setDriverFound(
            false
          );

          setLoading(
            false
          );

          setRefreshing(
            false
          );

          return;
        }

        setDriverFound(
          true
        );

        setOnline(
          Boolean(
            driver.online
          )
        );

        setDriverVehicle(
          driver.vehicle_type ||
            ""
        );

        setDriverPlate(
          driver.plate ||
            ""
        );

        // ======================================
        // ENTREGA ATUAL
        // ======================================

        const {
          data:
            currentData,
          error:
            currentError,
        } =
          await supabase.rpc(
            "get_driver_current_order"
          );

        if (
          currentError
        ) {
          console.error(
            "Erro pedido atual:",
            currentError
          );
        }

        const current =
          Array.isArray(
            currentData
          ) &&
          currentData.length >
            0
            ? (
                currentData[0] as CurrentOrder
              )
            : null;

        setCurrentOrder(
          current
        );

        // ======================================
        // CÓDIGO DE COLETA
        // ======================================

        if (
          current &&
          current.order_status ===
            "driver_assigned"
        ) {
          const {
            data:
              codeData,
            error:
              codeError,
          } =
            await supabase.rpc(
              "get_driver_pickup_code",
              {
                p_order_id:
                  current.order_id,
              }
            );

          if (
            codeError
          ) {
            console.error(
              "Erro código coleta:",
              codeError
            );

            setPickupCode(
              ""
            );
          } else {
            setPickupCode(
              String(
                codeData ??
                  ""
              )
            );
          }
        } else {
          setPickupCode(
            ""
          );
        }

        // ======================================
        // OFERTA
        // ======================================

        if (
          driver.online &&
          !current
        ) {
          const {
            data:
              offerData,
            error:
              offerError,
          } =
            await supabase.rpc(
              "get_my_delivery_offer"
            );

          if (
            offerError
          ) {
            console.error(
              "Erro oferta:",
              offerError
            );

            setDeliveryOffer(
              null
            );
          } else {
            const offer =
              Array.isArray(
                offerData
              ) &&
              offerData.length >
                0
                ? (
                    offerData[0] as DeliveryOffer
                  )
                : null;

            setDeliveryOffer(
              offer
            );

            if (
              offer
            ) {
              setOfferSeconds(
                Number(
                  offer.seconds_remaining ??
                    0
                )
              );
            } else {
              setOfferSeconds(
                0
              );
            }
          }
        } else {
          setDeliveryOffer(
            null
          );

          setOfferSeconds(
            0
          );
        }

        // ======================================
        // GANHOS
        // ======================================

        const {
          data:
            earningsData,
          error:
            earningsError,
        } =
          await supabase.rpc(
            "get_driver_earnings"
          );

        if (
          earningsError
        ) {
          console.error(
            "Erro ganhos:",
            earningsError
          );
        } else if (
          Array.isArray(
            earningsData
          ) &&
          earningsData.length >
            0
        ) {
          setEarnings(
            earningsData[0] as Earnings
          );
        }

        setLoading(
          false
        );

        setRefreshing(
          false
        );
      },
      [
        router,
      ]
    );

  // ==========================================
  // PRIMEIRO CARREGAMENTO
  // ==========================================

  useEffect(() => {
    loadPanel(
      true
    );
  }, [
    loadPanel,
  ]);

  // ==========================================
  // ATUALIZAÇÃO AUTOMÁTICA
  // ==========================================

  useEffect(() => {
    if (
      !driverFound
    ) {
      return;
    }

    const interval =
      window.setInterval(
        () => {
          loadPanel(
            false
          );
        },
        3000
      );

    return () => {
      window.clearInterval(
        interval
      );
    };
  }, [
    driverFound,
    loadPanel,
  ]);

  // ==========================================
  // CRONÔMETRO DA OFERTA
  // ==========================================

  useEffect(() => {
    if (
      !deliveryOffer
    ) {
      setOfferSeconds(
        0
      );

      return;
    }

    function updateCountdown() {
      const expires =
        new Date(
          deliveryOffer!
            .expires_at
        ).getTime();

      const remaining =
        Math.max(
          0,
          Math.ceil(
            (
              expires -
              Date.now()
            ) /
              1000
          )
        );

      setOfferSeconds(
        remaining
      );

      if (
        remaining <=
        0
      ) {
        setDeliveryOffer(
          null
        );

        loadPanel(
          false
        );
      }
    }

    updateCountdown();

    const interval =
      window.setInterval(
        updateCountdown,
        1000
      );

    return () => {
      window.clearInterval(
        interval
      );
    };
  }, [
    deliveryOffer,
    loadPanel,
  ]);

  // ==========================================
  // ONLINE / OFFLINE
  // ==========================================

  async function toggleOnline() {
    setProcessing(
      true
    );

    setError("");

    const newStatus =
      !online;

    const {
      error:
        rpcError,
    } =
      await supabase.rpc(
        "driver_set_online",
        {
          p_online:
            newStatus,
        }
      );

    if (
      rpcError
    ) {
      console.error(
        "Erro status:",
        rpcError
      );

      if (
        rpcError.message.includes(
          "ACTIVE_DELIVERY"
        )
      ) {
        setError(
          "Você não pode ficar offline enquanto estiver fazendo uma entrega."
        );
      } else {
        setError(
          "Não foi possível alterar seu status."
        );
      }

      setProcessing(
        false
      );

      return;
    }

    setOnline(
      newStatus
    );

    if (
      !newStatus
    ) {
      setDeliveryOffer(
        null
      );

      setOfferSeconds(
        0
      );
    }

    await loadPanel(
      false
    );

    setProcessing(
      false
    );
  }

  // ==========================================
  // ACEITAR OFERTA
  // ==========================================

  async function acceptOffer() {
    if (
      !deliveryOffer
    ) {
      return;
    }

    setProcessing(
      true
    );

    setError("");

    const {
      error:
        rpcError,
    } =
      await supabase.rpc(
        "driver_accept_delivery_offer",
        {
          p_offer_id:
            deliveryOffer.offer_id,
        }
      );

    if (
      rpcError
    ) {
      console.error(
        "Erro aceitar oferta:",
        rpcError
      );

      if (
        rpcError.message.includes(
          "OFFER_EXPIRED"
        )
      ) {
        setError(
          "O tempo desta oferta acabou. Ela foi enviada para outro entregador."
        );
      } else if (
        rpcError.message.includes(
          "OFFER_NOT_AVAILABLE"
        )
      ) {
        setError(
          "Esta oferta não está mais disponível."
        );
      } else if (
        rpcError.message.includes(
          "ORDER_NOT_AVAILABLE"
        )
      ) {
        setError(
          "Esta entrega não está mais disponível."
        );
      } else {
        setError(
          "Não foi possível aceitar a entrega."
        );
      }

      setDeliveryOffer(
        null
      );

      await loadPanel(
        false
      );

      setProcessing(
        false
      );

      return;
    }

    setDeliveryOffer(
      null
    );

    setOfferSeconds(
      0
    );

    setActiveTab(
      "entregas"
    );

    await loadPanel(
      false
    );

    setProcessing(
      false
    );
  }

  // ==========================================
  // RECUSAR OFERTA
  // ==========================================

  async function declineOffer() {
    if (
      !deliveryOffer
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "Deseja recusar esta entrega? Ela será enviada para o próximo entregador."
      );

    if (
      !confirmed
    ) {
      return;
    }

    setProcessing(
      true
    );

    setError("");

    const {
      error:
        rpcError,
    } =
      await supabase.rpc(
        "driver_decline_delivery_offer",
        {
          p_offer_id:
            deliveryOffer.offer_id,
        }
      );

    if (
      rpcError
    ) {
      console.error(
        "Erro recusar oferta:",
        rpcError
      );

      setError(
        "Não foi possível recusar a oferta."
      );

      setProcessing(
        false
      );

      return;
    }

    setDeliveryOffer(
      null
    );

    setOfferSeconds(
      0
    );

    await loadPanel(
      false
    );

    setProcessing(
      false
    );
  }

  // ==========================================
  // CANCELAR ENTREGA ACEITA
  // ==========================================

  async function cancelAssignedOrder() {
    if (
      !currentOrder
    ) {
      return;
    }

    if (
      currentOrder.order_status !==
      "driver_assigned"
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "Você não consegue mais realizar esta entrega? O pedido será enviado para outro entregador."
      );

    if (
      !confirmed
    ) {
      return;
    }

    const reason =
      window.prompt(
        "Informe o motivo do cancelamento."
      );

    if (
      reason ===
      null
    ) {
      return;
    }

    if (
      reason.trim()
        .length <
      3
    ) {
      setError(
        "Informe o motivo do cancelamento."
      );

      return;
    }

    setProcessing(
      true
    );

    setError("");

    const {
      error:
        rpcError,
    } =
      await supabase.rpc(
        "driver_cancel_assigned_order",
        {
          p_order_id:
            currentOrder.order_id,

          p_reason:
            reason.trim(),
        }
      );

    if (
      rpcError
    ) {
      console.error(
        "Erro cancelar entrega:",
        rpcError
      );

      if (
        rpcError.message.includes(
          "CANNOT_CANCEL_ORDER"
        )
      ) {
        setError(
          "Esta entrega não pode mais ser cancelada pelo aplicativo."
        );
      } else {
        setError(
          "Não foi possível cancelar esta entrega."
        );
      }

      setProcessing(
        false
      );

      return;
    }

    setCurrentOrder(
      null
    );

    setPickupCode(
      ""
    );

    await loadPanel(
      false
    );

    setProcessing(
      false
    );
  }

  // ==========================================
  // SAIR PARA ENTREGA
  // ==========================================

  async function startDelivery() {
    if (
      !currentOrder
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "Confirmar que você saiu para realizar a entrega?"
      );

    if (
      !confirmed
    ) {
      return;
    }

    setProcessing(
      true
    );

    setError("");

    const {
      error:
        rpcError,
    } =
      await supabase.rpc(
        "driver_update_order_status",
        {
          p_order_id:
            currentOrder.order_id,

          p_status:
            "delivering",
        }
      );

    if (
      rpcError
    ) {
      console.error(
        "Erro saída:",
        rpcError
      );

      setError(
        "Não foi possível iniciar a entrega."
      );

      setProcessing(
        false
      );

      return;
    }

    await loadPanel(
      false
    );

    setProcessing(
      false
    );
  }

  // ==========================================
  // CONFIRMAR ENTREGA
  // ==========================================

  async function confirmDelivery() {
    if (
      !currentOrder
    ) {
      return;
    }

    const code =
      deliveryCodeInput
        .trim();

    if (
      code.length !==
      4
    ) {
      setError(
        "Digite os 4 números informados pelo cliente."
      );

      return;
    }

    setProcessing(
      true
    );

    setError("");

    const {
      error:
        rpcError,
    } =
      await supabase.rpc(
        "driver_confirm_delivery_code",
        {
          p_order_id:
            currentOrder.order_id,

          p_code:
            code,
        }
      );

    if (
      rpcError
    ) {
      console.error(
        "Erro código entrega:",
        rpcError
      );

      if (
        rpcError.message.includes(
          "INVALID_DELIVERY_CODE"
        )
      ) {
        setError(
          "Código incorreto. Confira com o cliente."
        );
      } else if (
        rpcError.message.includes(
          "TOO_MANY_ATTEMPTS"
        )
      ) {
        setError(
          "Muitas tentativas incorretas. Entre em contato com o suporte."
        );
      } else {
        setError(
          "Não foi possível confirmar a entrega."
        );
      }

      setProcessing(
        false
      );

      return;
    }

    setDeliveryCodeInput(
      ""
    );

    await loadPanel(
      false
    );

    setProcessing(
      false
    );

    setActiveTab(
      "inicio"
    );
  }

  // ==========================================
  // LOGOUT
  // ==========================================

  async function logout() {
    const confirmed =
      window.confirm(
        "Deseja sair da sua conta?"
      );

    if (
      !confirmed
    ) {
      return;
    }

    await supabase.auth
      .signOut();

    router.replace(
      "/entregador"
    );

    router.refresh();
  }

  // ==========================================
  // CARREGANDO
  // ==========================================

  if (
    loading
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7]">
        <p className="font-bold">
          Carregando painel do entregador...
        </p>
      </main>
    );
  }

  // ==========================================
  // NÃO APROVADO
  // ==========================================

  if (
    !driverFound
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7] px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
          <div className="text-6xl">
            🛵
          </div>

          <p className="mt-5 text-xs font-black uppercase tracking-wide text-red-600">
            Entrega Paudalho
          </p>

          <h1 className="mt-2 text-2xl font-black">
            Cadastro de entregador
          </h1>

          <p className="mt-3 text-zinc-500">
            Sua conta ainda não possui
            um cadastro de entregador
            aprovado.
          </p>

          {error && (
            <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
              ⚠️{" "}
              {
                error
              }
            </div>
          )}

          <button
            type="button"
            onClick={() =>
              router.replace(
                "/seja-entregador"
              )
            }
            className="mt-6 w-full rounded-xl bg-red-600 px-5 py-4 font-black text-white"
          >
            Ver meu cadastro
          </button>

          <button
            type="button"
            onClick={
              logout
            }
            className="mt-3 w-full rounded-xl border border-zinc-200 px-5 py-4 font-black text-zinc-600"
          >
            Sair da conta
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f7f7] text-zinc-900">
      {/* ======================================
          CABEÇALHO
      ====================================== */}

      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <p className="font-black text-red-600">
              🛵 Entrega Paudalho
            </p>

            <p className="text-xs text-zinc-500">
              Painel do entregador
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`hidden rounded-full px-3 py-2 text-xs font-black sm:block ${
                online
                  ? "bg-green-100 text-green-700"
                  : "bg-zinc-100 text-zinc-500"
              }`}
            >
              {online
                ? "● Online"
                : "● Offline"}
            </div>

            <button
              type="button"
              onClick={() =>
                setActiveTab(
                  "conta"
                )
              }
              className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-xl transition hover:bg-zinc-200"
            >
              👤
            </button>
          </div>
        </div>

        {/* ======================================
            MENU
        ====================================== */}

        <div className="mx-auto max-w-6xl overflow-x-auto px-4">
          <nav className="flex min-w-max gap-2 pb-3">
            <button
              type="button"
              onClick={() =>
                setActiveTab(
                  "inicio"
                )
              }
              className={`rounded-xl px-5 py-3 text-sm font-black transition ${
                activeTab ===
                "inicio"
                  ? "bg-red-600 text-white"
                  : "text-zinc-500 hover:bg-zinc-100"
              }`}
            >
              🏠 Início
            </button>

            <button
              type="button"
              onClick={() =>
                setActiveTab(
                  "entregas"
                )
              }
              className={`relative rounded-xl px-5 py-3 text-sm font-black transition ${
                activeTab ===
                "entregas"
                  ? "bg-red-600 text-white"
                  : "text-zinc-500 hover:bg-zinc-100"
              }`}
            >
              📦 Entregas

              {(deliveryOffer ||
                currentOrder) && (
                <span className="absolute -right-1 -top-1 flex h-3 w-3 rounded-full bg-green-500 ring-2 ring-white" />
              )}
            </button>

            <button
              type="button"
              onClick={() =>
                setActiveTab(
                  "ganhos"
                )
              }
              className={`rounded-xl px-5 py-3 text-sm font-black transition ${
                activeTab ===
                "ganhos"
                  ? "bg-red-600 text-white"
                  : "text-zinc-500 hover:bg-zinc-100"
              }`}
            >
              💰 Ganhos
            </button>

            <button
              type="button"
              onClick={() =>
                setActiveTab(
                  "conta"
                )
              }
              className={`rounded-xl px-5 py-3 text-sm font-black transition ${
                activeTab ===
                "conta"
                  ? "bg-red-600 text-white"
                  : "text-zinc-500 hover:bg-zinc-100"
              }`}
            >
              👤 Minha conta
            </button>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* ======================================
            ERRO GLOBAL
        ====================================== */}

        {error && (
          <div className="mb-5 rounded-2xl bg-red-50 p-4 font-semibold text-red-700">
            ⚠️{" "}
            {
              error
            }
          </div>
        )}

        {/* ======================================
            INÍCIO
        ====================================== */}

        {activeTab ===
          "inicio" && (
          <>
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-red-600">
                Visão geral
              </p>

              <h1 className="mt-1 text-3xl font-black">
                Olá,{" "}
                {
                  driverName
                }
              </h1>

              <p className="mt-2 text-zinc-500">
                Controle seu status e
                acompanhe suas entregas.
              </p>
            </div>

            {/* STATUS */}

            <section
              className={`mt-6 rounded-3xl p-6 shadow-sm ${
                online
                  ? "border border-green-200 bg-green-50"
                  : "bg-white"
              }`}
            >
              <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
                <div>
                  <p className="text-sm font-bold text-zinc-500">
                    SEU STATUS
                  </p>

                  <h2 className="mt-1 text-3xl font-black">
                    {online
                      ? "🟢 Online"
                      : "🔴 Offline"}
                  </h2>

                  <p className="mt-2 text-sm text-zinc-500">
                    {online
                      ? "Você está disponível para receber entregas."
                      : "Fique online para começar a receber entregas."}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={
                    processing
                  }
                  onClick={
                    toggleOnline
                  }
                  className={`rounded-xl px-6 py-4 font-black text-white disabled:bg-zinc-300 ${
                    online
                      ? "bg-zinc-900"
                      : "bg-green-600"
                  }`}
                >
                  {processing
                    ? "Aguarde..."
                    : online
                      ? "Ficar offline"
                      : "Ficar online"}
                </button>
              </div>
            </section>

            {/* ENTREGA ATUAL */}

            {currentOrder && (
              <section className="mt-6 overflow-hidden rounded-3xl border border-red-200 bg-white shadow-sm">
                <div className="bg-red-600 p-5 text-white">
                  <p className="text-xs font-black uppercase">
                    Entrega em andamento
                  </p>

                  <h2 className="mt-1 text-xl font-black">
                    {
                      currentOrder.restaurant_name
                    }
                  </h2>
                </div>

                <div className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-black text-zinc-400">
                        PEDIDO
                      </p>

                      <p className="mt-1 font-black">
                        #
                        {shortOrderId(
                          currentOrder.order_id
                        )}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-black text-zinc-400">
                        SUA ENTREGA
                      </p>

                      <p className="mt-1 text-xl font-black text-green-600">
                        {money(
                          currentOrder.delivery_fee
                        )}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setActiveTab(
                        "entregas"
                      )
                    }
                    className="mt-5 w-full rounded-xl bg-red-600 px-5 py-4 font-black text-white"
                  >
                    Abrir entrega →
                  </button>
                </div>
              </section>
            )}

            {/* NOVA OFERTA */}

            {!currentOrder &&
              deliveryOffer && (
                <section className="mt-6 overflow-hidden rounded-3xl border-2 border-red-500 bg-white shadow-lg">
                  <div className="flex flex-wrap items-center justify-between gap-4 bg-red-600 p-5 text-white">
                    <div>
                      <p className="font-black">
                        🔔 Nova entrega disponível
                      </p>

                      <p className="mt-1 text-sm text-red-100">
                        Responda antes do tempo acabar.
                      </p>
                    </div>

                    <div className="rounded-xl bg-white px-4 py-2 font-black text-red-600">
                      00:
                      {String(
                        offerSeconds
                      ).padStart(
                        2,
                        "0"
                      )}
                    </div>
                  </div>

                  <div className="p-5">
                    <p className="font-black">
                      {
                        deliveryOffer.restaurant_name
                      }
                    </p>

                    <p className="mt-1 text-sm text-zinc-500">
                      Destino:{" "}
                      {
                        deliveryOffer.customer_neighborhood
                      }
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        setActiveTab(
                          "entregas"
                        )
                      }
                      className="mt-4 w-full rounded-xl bg-red-600 px-5 py-4 font-black text-white"
                    >
                      Ver oferta agora
                    </button>
                  </div>
                </section>
              )}

            {/* RESUMO GANHOS */}

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() =>
                  setActiveTab(
                    "ganhos"
                  )
                }
                className="rounded-3xl bg-white p-6 text-left shadow-sm transition hover:shadow-md"
              >
                <p className="text-sm font-bold text-zinc-500">
                  💰 Ganhos hoje
                </p>

                <p className="mt-2 text-3xl font-black">
                  {money(
                    earnings.today_earnings
                  )}
                </p>

                <p className="mt-1 text-sm text-zinc-500">
                  {
                    earnings.today_deliveries
                  }{" "}
                  entrega(s)
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  setActiveTab(
                    "ganhos"
                  )
                }
                className="rounded-3xl bg-white p-6 text-left shadow-sm transition hover:shadow-md"
              >
                <p className="text-sm font-bold text-zinc-500">
                  📅 Ganhos na semana
                </p>

                <p className="mt-2 text-3xl font-black">
                  {money(
                    earnings.week_earnings
                  )}
                </p>

                <p className="mt-1 text-sm text-zinc-500">
                  {
                    earnings.week_deliveries
                  }{" "}
                  entrega(s)
                </p>
              </button>
            </div>

            {!currentOrder &&
              !deliveryOffer && (
                <section className="mt-6 rounded-3xl bg-white p-8 text-center shadow-sm">
                  <div className="text-5xl">
                    {online
                      ? "🛵"
                      : "🔴"}
                  </div>

                  <h2 className="mt-4 text-xl font-black">
                    {online
                      ? "Aguardando entregas"
                      : "Você está offline"}
                  </h2>

                  <p className="mt-2 text-zinc-500">
                    {online
                      ? "Quando chegar uma oferta para você, ela aparecerá automaticamente."
                      : "Fique online para começar a receber ofertas."}
                  </p>

                  {refreshing &&
                    online && (
                    <p className="mt-4 text-xs font-bold text-green-600">
                      Verificando novas ofertas...
                    </p>
                  )}
                </section>
              )}
          </>
        )}

        {/* ======================================
            ENTREGAS
        ====================================== */}

        {activeTab ===
          "entregas" && (
          <>
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-red-600">
                Operação
              </p>

              <h1 className="mt-1 text-3xl font-black">
                Entregas
              </h1>

              <p className="mt-2 text-zinc-500">
                Veja ofertas e acompanhe
                sua entrega atual.
              </p>
            </div>

            {/* NOVA OFERTA */}

            {!currentOrder &&
              deliveryOffer && (
                <section className="mt-6 overflow-hidden rounded-3xl border-2 border-red-500 bg-white shadow-lg">
                  <div className="bg-red-600 p-5 text-white">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-black">
                          🔔 NOVA ENTREGA
                        </p>

                        <p className="mt-1 text-sm text-red-100">
                          Responda antes do tempo acabar
                        </p>
                      </div>

                      <div className="rounded-2xl bg-white px-4 py-3 text-center text-red-600">
                        <p className="text-xs font-black">
                          TEMPO
                        </p>

                        <p className="text-2xl font-black">
                          00:
                          {String(
                            offerSeconds
                          ).padStart(
                            2,
                            "0"
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6">
                    <h2 className="text-2xl font-black">
                      {
                        deliveryOffer.restaurant_name
                      }
                    </h2>

                    <div className="mt-5 rounded-2xl bg-zinc-50 p-5">
                      <p className="text-xs font-black text-zinc-400">
                        📍 RETIRADA
                      </p>

                      <p className="mt-2 font-bold">
                        {
                          deliveryOffer.restaurant_street
                        }

                        {deliveryOffer.restaurant_number
                          ? `, ${deliveryOffer.restaurant_number}`
                          : ""}
                      </p>

                      <p className="text-sm text-zinc-500">
                        {
                          deliveryOffer.restaurant_neighborhood
                        }
                      </p>
                    </div>

                    <div className="mt-3 rounded-2xl bg-zinc-50 p-5">
                      <p className="text-xs font-black text-zinc-400">
                        🏠 DESTINO
                      </p>

                      <p className="mt-2 font-bold">
                        Bairro{" "}
                        {
                          deliveryOffer.customer_neighborhood
                        }
                      </p>

                      <p className="mt-1 text-xs text-zinc-500">
                        O endereço completo aparece depois que você aceitar.
                      </p>
                    </div>

                    <div className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-5">
                      <span className="font-bold">
                        Valor da entrega
                      </span>

                      <span className="text-2xl font-black text-green-600">
                        {money(
                          deliveryOffer.delivery_fee
                        )}
                      </span>
                    </div>

                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        disabled={
                          processing ||
                          offerSeconds <=
                            0
                        }
                        onClick={
                          acceptOffer
                        }
                        className="rounded-xl bg-green-600 px-6 py-4 font-black text-white disabled:bg-zinc-300"
                      >
                        ✅ Aceitar entrega
                      </button>

                      <button
                        type="button"
                        disabled={
                          processing
                        }
                        onClick={
                          declineOffer
                        }
                        className="rounded-xl border-2 border-red-600 px-6 py-4 font-black text-red-600 disabled:border-zinc-300 disabled:text-zinc-300"
                      >
                        ✕ Recusar
                      </button>
                    </div>
                  </div>
                </section>
              )}

            {/* SEM ENTREGA */}

            {!currentOrder &&
              !deliveryOffer && (
                <section className="mt-6 rounded-3xl bg-white p-10 text-center shadow-sm">
                  <div className="text-6xl">
                    {online
                      ? "🛵"
                      : "🔴"}
                  </div>

                  <h2 className="mt-4 text-2xl font-black">
                    {online
                      ? "Nenhuma oferta agora"
                      : "Você está offline"}
                  </h2>

                  <p className="mt-2 text-zinc-500">
                    {online
                      ? "Você está na fila. Uma nova oferta aparecerá automaticamente."
                      : "Volte para o início e fique online para receber entregas."}
                  </p>
                </section>
              )}

            {/* ENTREGA ATUAL */}

            {currentOrder && (
              <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-red-600">
                      ENTREGA ATUAL
                    </p>

                    <h2 className="mt-1 text-2xl font-black">
                      {
                        currentOrder.restaurant_name
                      }
                    </h2>

                    <p className="mt-1 text-xs font-bold text-zinc-400">
                      Pedido #
                      {shortOrderId(
                        currentOrder.order_id
                      )}
                    </p>
                  </div>

                  <span className="rounded-full bg-yellow-100 px-4 py-2 text-sm font-bold text-yellow-800">
                    {currentOrder.order_status ===
                      "driver_assigned" &&
                      "Ir ao restaurante"}

                    {currentOrder.order_status ===
                      "picked_up" &&
                      "Coleta confirmada"}

                    {currentOrder.order_status ===
                      "delivering" &&
                      "🛵 A caminho"}
                  </span>
                </div>

                {/* RETIRADA */}

                <div className="mt-6 rounded-2xl bg-zinc-50 p-5">
                  <p className="text-xs font-black text-zinc-400">
                    📍 RETIRADA
                  </p>

                  <p className="mt-2 font-black">
                    {
                      currentOrder.restaurant_name
                    }
                  </p>

                  <p className="text-sm text-zinc-600">
                    {
                      currentOrder.restaurant_street
                    }

                    {currentOrder.restaurant_number
                      ? `, ${currentOrder.restaurant_number}`
                      : ""}
                  </p>

                  <p className="text-sm text-zinc-600">
                    {
                      currentOrder.restaurant_neighborhood
                    }
                  </p>

                  {currentOrder.restaurant_phone && (
                    <p className="mt-2 font-semibold">
                      ☎️{" "}
                      {
                        currentOrder.restaurant_phone
                      }
                    </p>
                  )}
                </div>

                {/* CÓDIGO DE COLETA */}

                {currentOrder.order_status ===
                  "driver_assigned" && (
                  <>
                    <div className="mt-4 rounded-3xl border-2 border-dashed border-red-200 bg-red-50 p-6 text-center">
                      <p className="text-xs font-black text-red-500">
                        CÓDIGO DE COLETA
                      </p>

                      <p className="mt-3 text-5xl font-black tracking-[0.18em] text-red-600">
                        {pickupCode ||
                          "----"}
                      </p>

                      <p className="mt-4 font-bold">
                        Informe este código
                        ao restaurante.
                      </p>

                      <p className="mt-2 text-sm text-zinc-500">
                        A loja precisa confirmar
                        antes de liberar o pedido.
                      </p>

                      <div className="mt-4 rounded-xl bg-white p-3 text-sm font-semibold text-yellow-700">
                        ⏳ Aguardando confirmação
                        da loja...
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={
                        processing
                      }
                      onClick={
                        cancelAssignedOrder
                      }
                      className="mt-4 w-full rounded-xl border-2 border-red-200 px-5 py-4 font-bold text-red-600 disabled:text-zinc-300"
                    >
                      Não consigo fazer esta entrega
                    </button>

                    <p className="mt-2 text-center text-xs text-zinc-400">
                      Disponível somente antes
                      da coleta no restaurante.
                    </p>
                  </>
                )}

                {/* CLIENTE */}

                <div className="mt-4 rounded-2xl bg-zinc-50 p-5">
                  <p className="text-xs font-black text-zinc-400">
                    🏠 ENTREGA
                  </p>

                  <p className="mt-2 font-black">
                    {currentOrder.customer_name ??
                      "Cliente"}
                  </p>

                  <p className="text-sm text-zinc-600">
                    {
                      currentOrder.customer_street
                    }

                    {currentOrder.customer_number
                      ? `, ${currentOrder.customer_number}`
                      : ""}
                  </p>

                  {currentOrder.customer_complement && (
                    <p className="text-sm text-zinc-600">
                      {
                        currentOrder.customer_complement
                      }
                    </p>
                  )}

                  <p className="text-sm text-zinc-600">
                    {
                      currentOrder.customer_neighborhood
                    }
                    {" • "}
                    {
                      currentOrder.customer_city
                    }
                    {" - "}
                    {
                      currentOrder.customer_state
                    }
                  </p>

                  {currentOrder.customer_phone && (
                    <p className="mt-2 font-semibold">
                      ☎️{" "}
                      {
                        currentOrder.customer_phone
                      }
                    </p>
                  )}
                </div>

                {/* ITENS */}

                <div className="mt-4">
                  <p className="text-sm font-black">
                    Pedido
                  </p>

                  <div className="mt-3 space-y-2">
                    {(
                      currentOrder.items ??
                      []
                    ).map(
                      (
                        item,
                        index
                      ) => (
                        <div
                          key={
                            index
                          }
                          className="rounded-xl bg-zinc-50 px-4 py-3 text-sm"
                        >
                          {
                            item.quantity
                          }
                          x{" "}
                          {
                            item.name
                          }
                        </div>
                      )
                    )}
                  </div>
                </div>

                <div className="mt-5 flex justify-between border-t border-zinc-200 pt-5">
                  <span className="font-bold">
                    Valor da entrega
                  </span>

                  <span className="text-xl font-black text-green-600">
                    {money(
                      currentOrder.delivery_fee
                    )}
                  </span>
                </div>

                {/* COLETA CONFIRMADA */}

                {currentOrder.order_status ===
                  "picked_up" && (
                  <div className="mt-6">
                    <div className="mb-4 rounded-xl bg-green-50 p-4 font-bold text-green-700">
                      ✅ Restaurante confirmou
                      a retirada do pedido.
                    </div>

                    <button
                      type="button"
                      disabled={
                        processing
                      }
                      onClick={
                        startDelivery
                      }
                      className="w-full rounded-xl bg-red-600 px-5 py-4 font-black text-white disabled:bg-zinc-300"
                    >
                      🛵 Sair para entrega
                    </button>
                  </div>
                )}

                {/* A CAMINHO */}

                {currentOrder.order_status ===
                  "delivering" && (
                  <div className="mt-6">
                    <div className="rounded-2xl bg-green-50 p-5">
                      <p className="text-lg font-black text-green-700">
                        🛵 Você está a caminho
                        do cliente
                      </p>

                      <p className="mt-1 text-sm text-green-600">
                        Ao chegar, peça o código
                        de 4 números mostrado
                        para o cliente.
                      </p>
                    </div>

                    <div className="mt-4">
                      <label className="mb-2 block text-sm font-black">
                        Código de entrega
                      </label>

                      <input
                        value={
                          deliveryCodeInput
                        }
                        onChange={(
                          event
                        ) =>
                          setDeliveryCodeInput(
                            event.target.value
                              .replace(
                                /\D/g,
                                ""
                              )
                              .slice(
                                0,
                                4
                              )
                          )
                        }
                        inputMode="numeric"
                        maxLength={
                          4
                        }
                        className="w-full rounded-2xl border border-zinc-200 px-4 py-4 text-center text-3xl font-black tracking-[0.35em] outline-none focus:border-green-500"
                      />

                      <p className="mt-2 text-center text-xs text-zinc-500">
                        Peça o código somente
                        quando estiver com o
                        cliente.
                      </p>

                      <button
                        type="button"
                        disabled={
                          processing ||
                          deliveryCodeInput.length !==
                            4
                        }
                        onClick={
                          confirmDelivery
                        }
                        className="mt-4 w-full rounded-xl bg-green-600 px-5 py-4 font-black text-white disabled:bg-zinc-300"
                      >
                        ✅ Confirmar entrega
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}
          </>
        )}

        {/* ======================================
            GANHOS
        ====================================== */}

        {activeTab ===
          "ganhos" && (
          <>
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-red-600">
                Financeiro
              </p>

              <h1 className="mt-1 text-3xl font-black">
                Meus ganhos
              </h1>

              <p className="mt-2 text-zinc-500">
                Acompanhe quanto você ganhou
                com suas entregas.
              </p>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-100 text-2xl">
                  💰
                </div>

                <p className="mt-5 text-sm font-bold text-zinc-500">
                  Ganhos hoje
                </p>

                <p className="mt-2 text-4xl font-black">
                  {money(
                    earnings.today_earnings
                  )}
                </p>

                <p className="mt-2 text-sm text-zinc-500">
                  {
                    earnings.today_deliveries
                  }{" "}
                  entrega(s) concluída(s)
                </p>
              </div>

              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-2xl">
                  📅
                </div>

                <p className="mt-5 text-sm font-bold text-zinc-500">
                  Ganhos na semana
                </p>

                <p className="mt-2 text-4xl font-black">
                  {money(
                    earnings.week_earnings
                  )}
                </p>

                <p className="mt-2 text-sm text-zinc-500">
                  {
                    earnings.week_deliveries
                  }{" "}
                  entrega(s) concluída(s)
                </p>
              </div>
            </div>

            <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black">
                Resumo
              </h2>

              <div className="mt-5 divide-y divide-zinc-100">
                <div className="flex items-center justify-between py-4">
                  <span className="text-zinc-500">
                    Entregas hoje
                  </span>

                  <strong>
                    {
                      earnings.today_deliveries
                    }
                  </strong>
                </div>

                <div className="flex items-center justify-between py-4">
                  <span className="text-zinc-500">
                    Entregas na semana
                  </span>

                  <strong>
                    {
                      earnings.week_deliveries
                    }
                  </strong>
                </div>

                <div className="flex items-center justify-between py-4">
                  <span className="text-zinc-500">
                    Total hoje
                  </span>

                  <strong className="text-green-600">
                    {money(
                      earnings.today_earnings
                    )}
                  </strong>
                </div>

                <div className="flex items-center justify-between py-4">
                  <span className="text-zinc-500">
                    Total da semana
                  </span>

                  <strong className="text-green-600">
                    {money(
                      earnings.week_earnings
                    )}
                  </strong>
                </div>
              </div>
            </section>
          </>
        )}

        {/* ======================================
            MINHA CONTA
        ====================================== */}

        {activeTab ===
          "conta" && (
          <>
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-red-600">
                Perfil
              </p>

              <h1 className="mt-1 text-3xl font-black">
                Minha conta
              </h1>

              <p className="mt-2 text-zinc-500">
                Veja os dados do seu cadastro
                de entregador.
              </p>
            </div>

            <section className="mt-6 overflow-hidden rounded-3xl bg-white shadow-sm">
              <div className="border-b border-zinc-100 p-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl">
                    👤
                  </div>

                  <div>
                    <h2 className="text-xl font-black">
                      {
                        driverName
                      }
                    </h2>

                    <p className="mt-1 font-bold text-green-600">
                      ✅ Entregador aprovado
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-5 p-6">
                <div>
                  <p className="text-xs font-black text-zinc-400">
                    TELEFONE
                  </p>

                  <p className="mt-1 font-bold">
                    {driverPhone ||
                      "Não informado"}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-black text-zinc-400">
                    VEÍCULO
                  </p>

                  <p className="mt-1 font-bold">
                    {driverVehicle ===
                    "Moto"
                      ? "🏍️ Moto"
                      : driverVehicle ===
                          "Bicicleta"
                        ? "🚲 Bicicleta"
                        : driverVehicle ||
                          "Não informado"}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-black text-zinc-400">
                    PLACA
                  </p>

                  <p className="mt-1 font-bold">
                    {driverPlate ||
                      "Não possui"}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-black text-zinc-400">
                    STATUS
                  </p>

                  <p
                    className={`mt-1 font-black ${
                      online
                        ? "text-green-600"
                        : "text-zinc-500"
                    }`}
                  >
                    {online
                      ? "🟢 Online"
                      : "🔴 Offline"}
                  </p>
                </div>
              </div>
            </section>

            <button
              type="button"
              onClick={
                logout
              }
              className="mt-6 w-full rounded-xl border-2 border-red-200 bg-white px-5 py-4 font-black text-red-600 transition hover:bg-red-50"
            >
              ↪ Sair da conta
            </button>
          </>
        )}
      </div>
    </main>
  );
}