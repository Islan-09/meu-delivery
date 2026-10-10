"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useSearchParams } from "next/navigation";

import { supabase } from "@/lib/supabase";

type FulfillmentMethod =
  | "delivery"
  | "pickup";

type OverviewOrder = {
  order_id: string;

  restaurant_id: string;

  status:
    | "pending"
    | "accepted"
    | "preparing"
    | "ready"
    | "driver_assigned"
    | "picked_up"
    | "delivering"
    | "delivered"
    | "cancelled";

  fulfillment_method:
    FulfillmentMethod;

  payment_status:
    | string
    | null;

  subtotal:
    | number
    | string;

  delivery_fee:
    | number
    | string;

  total:
    | number
    | string;

  created_at: string;
};

type RestaurantSettings = {
  restaurant_id: string;
  restaurant_name: string;
  orders_paused: boolean;
};

type RestaurantOpenStatus = {
  is_open: boolean;

  current_day:
    | number
    | null;

  opens_at:
    | string
    | null;

  closes_at:
    | string
    | null;

  next_day:
    | number
    | null;

  next_opens_at:
    | string
    | null;
};

type CnpjCompliance = {
  has_cnpj: boolean;
  grace_started_at: string;
  deadline_at: string;
  days_remaining: number;
  blocked: boolean;
};

type NavigationSection =
  | "orders"
  | "menu"
  | "hours"
  | "finance"
  | "account"
  | "settings";

type Props = {
  onNavigate?: (
    section: NavigationSection
  ) => void;
};

const dayNames: Record<
  number,
  string
> = {
  0: "domingo",
  1: "segunda-feira",
  2: "terça-feira",
  3: "quarta-feira",
  4: "quinta-feira",
  5: "sexta-feira",
  6: "sábado",
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
      style: "currency",
      currency: "BRL",
    }
  );
}

function formatHour(
  value:
    | string
    | null
) {
  if (!value) {
    return "";
  }

  return value.slice(
    0,
    5
  );
}

function formatDate(
  value:
    | string
    | null
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleDateString(
    "pt-BR",
    {
      day:
        "2-digit",
      month:
        "2-digit",
      year:
        "numeric",
    }
  );
}

function nextOpeningText(
  status:
    | RestaurantOpenStatus
    | null
) {
  if (
    !status ||
    status.is_open
  ) {
    return "";
  }

  if (
    status.next_day ===
      null ||
    !status.next_opens_at
  ) {
    return "Próxima abertura não informada";
  }

  const day =
    dayNames[
      Number(
        status.next_day
      )
    ] ??
    "próximo dia";

  return `Abre ${day} às ${formatHour(
    status.next_opens_at
  )}`;
}

function isToday(
  value: string
) {
  const date =
    new Date(
      value
    );

  const today =
    new Date();

  return (
    date.getFullYear() ===
      today.getFullYear() &&
    date.getMonth() ===
      today.getMonth() &&
    date.getDate() ===
      today.getDate()
  );
}

export default function VisaoGeralSection({
  onNavigate,
}: Props) {
  const searchParams =
    useSearchParams();

  const restaurantId =
    searchParams.get(
      "restaurant"
    ) ?? "";

  const [
    settings,
    setSettings,
  ] =
    useState<
      RestaurantSettings | null
    >(null);

  const [
    openStatus,
    setOpenStatus,
  ] =
    useState<
      RestaurantOpenStatus | null
    >(null);

  const [
    cnpjCompliance,
    setCnpjCompliance,
  ] =
    useState<CnpjCompliance | null>(
      null
    );

  const [
    orders,
    setOrders,
  ] =
    useState<
      OverviewOrder[]
    >([]);

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
    error,
    setError,
  ] =
    useState("");

  // ==========================================
  // CARREGAR VISÃO GERAL
  // SOMENTE DA LOJA SELECIONADA
  // ==========================================

  const loadOverview =
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
        } else {
          setRefreshing(
            true
          );
        }

        setError("");

        if (
          !restaurantId
        ) {
          setError(
            "Loja não informada."
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
        // USUÁRIO LOGADO
        // ======================================

        const {
          data: {
            session,
          },
        } =
          await supabase.auth
            .getSession();

        if (
          !session
        ) {
          setError(
            "Sua sessão expirou. Entre novamente."
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
        // RESTAURANTE EXATO DA URL
        // CONFIRMA TAMBÉM O DONO
        // ======================================

        const {
          data:
            restaurantData,

          error:
            restaurantError,
        } =
          await supabase
            .from(
              "restaurants"
            )
            .select(`
              id,
              name,
              orders_paused
            `)
            .eq(
              "id",
              restaurantId
            )
            .eq(
              "owner_id",
              session.user.id
            )
            .maybeSingle();

        if (
          restaurantError ||
          !restaurantData
        ) {
          console.error(
            "Erro restaurante:",
            restaurantError
          );

          setError(
            "Essa loja não foi encontrada ou não pertence à sua conta."
          );

          setLoading(
            false
          );

          setRefreshing(
            false
          );

          return;
        }

        const currentSettings:
          RestaurantSettings = {
            restaurant_id:
              restaurantData.id,

            restaurant_name:
              restaurantData.name,

            orders_paused:
              Boolean(
                restaurantData.orders_paused
              ),
          };

        setSettings(
          currentSettings
        );

        // ======================================
        // PEDIDOS + HORÁRIO
        // ======================================

        const [
          ordersResponse,
          statusResponse,
          cnpjResponse,
        ] =
          await Promise.all([
            supabase.rpc(
              "get_my_restaurant_orders"
            ),

            supabase.rpc(
              "get_restaurant_open_status",
              {
                p_restaurant_id:
                  restaurantId,
              }
            ),

            supabase.rpc(
              "get_my_cnpj_compliance",
              {
                p_restaurant_id:
                  restaurantId,
              }
            ),
          ]);

        // ======================================
        // PEDIDOS
        // ======================================

        if (
          ordersResponse.error
        ) {
          console.error(
            "Erro pedidos:",
            ordersResponse.error
          );

          setError(
            "Não foi possível carregar os pedidos."
          );

          setLoading(
            false
          );

          setRefreshing(
            false
          );

          return;
        }

        const storeOrders =
          (
            ordersResponse.data ??
            []
          )
            .filter(
              (
                order: {
                  restaurant_id?:
                    string;

                  payment_status?:
                    string | null;
                }
              ) =>
                order.restaurant_id ===
                  restaurantId &&
                order.payment_status ===
                  "paid"
            ) as OverviewOrder[];

        setOrders(
          storeOrders
        );

        // ======================================
        // HORÁRIO
        // ======================================

        if (
          statusResponse.error
        ) {
          console.error(
            "Erro horário:",
            statusResponse.error
          );

          setOpenStatus(
            null
          );
        } else {
          const result =
            Array.isArray(
              statusResponse.data
            ) &&
            statusResponse.data.length >
              0
              ? (
                  statusResponse.data[0] as RestaurantOpenStatus
                )
              : null;

          setOpenStatus(
            result
          );
        }

        if (
          cnpjResponse.error
        ) {
          console.error(
            "Erro ao carregar prazo do CNPJ:",
            cnpjResponse.error
          );

          setCnpjCompliance(
            null
          );
        } else {
          const cnpjResult =
            Array.isArray(
              cnpjResponse.data
            ) &&
            cnpjResponse.data.length >
              0
              ? (
                  cnpjResponse.data[0] as CnpjCompliance
                )
              : null;

          setCnpjCompliance(
            cnpjResult
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
        restaurantId,
      ]
    );

  // ==========================================
  // PRIMEIRO CARREGAMENTO
  // ==========================================

  useEffect(() => {
    loadOverview(
      true
    );
  }, [
    loadOverview,
  ]);

  // ==========================================
  // ATUALIZA AUTOMATICAMENTE
  // ==========================================

  useEffect(() => {
    const interval =
      window.setInterval(
        () => {
          loadOverview(
            false
          );
        },
        15000
      );

    return () => {
      window.clearInterval(
        interval
      );
    };
  }, [
    loadOverview,
  ]);

  // ==========================================
  // PEDIDOS DE HOJE
  // ==========================================

  const todayOrders =
    useMemo(
      () =>
        orders.filter(
          (
            order
          ) =>
            isToday(
              order.created_at
            )
        ),
      [
        orders,
      ]
    );

  // ==========================================
  // ATIVOS
  // ==========================================

  const activeOrders =
    useMemo(
      () =>
        orders.filter(
          (
            order
          ) =>
            order.status !==
              "delivered" &&
            order.status !==
              "cancelled"
        ),
      [
        orders,
      ]
    );

  // ==========================================
  // FINANCEIRO DE HOJE
  //
  // IMPORTANTE:
  // get_my_restaurant_orders só libera
  // pedidos com payment_status = paid.
  // Logo, pedido ainda não pago não é exposto
  // ao restaurante.
  // ==========================================

  const paidToday =
    useMemo(
      () =>
        todayOrders.filter(
          (
            order
          ) =>
            order.status !==
              "cancelled" &&
            order.payment_status ===
              "paid"
        ),
      [
        todayOrders,
      ]
    );

  const pendingToday:
    OverviewOrder[] =
    [];

  const grossPaidToday =
    paidToday.reduce(
      (
        total,
        order
      ) =>
        total +
        Number(
          order.total ??
            0
        ),
      0
    );

  const pendingValueToday =
    0;

  // ==========================================
  // STATUS OPERACIONAIS
  // ==========================================

  const newOrders =
    activeOrders.filter(
      (
        order
      ) =>
        order.status ===
        "pending"
    ).length;

  const acceptedOrders =
    activeOrders.filter(
      (
        order
      ) =>
        order.status ===
        "accepted"
    ).length;

  const preparingOrders =
    activeOrders.filter(
      (
        order
      ) =>
        order.status ===
        "preparing"
    ).length;

  const readyOrders =
    activeOrders.filter(
      (
        order
      ) =>
        order.status ===
        "ready"
    ).length;

  const onTheWayOrders =
    activeOrders.filter(
      (
        order
      ) =>
        [
          "driver_assigned",
          "picked_up",
          "delivering",
        ].includes(
          order.status
        )
    ).length;

  // ==========================================
  // TIPOS DE PEDIDO DE HOJE
  // ==========================================

  const deliveriesToday =
    todayOrders.filter(
      (
        order
      ) =>
        order.status !==
          "cancelled" &&
        order.fulfillment_method ===
          "delivery"
    ).length;

  const pickupsToday =
    todayOrders.filter(
      (
        order
      ) =>
        order.status !==
          "cancelled" &&
        order.fulfillment_method ===
          "pickup"
    ).length;

  const completedToday =
    todayOrders.filter(
      (
        order
      ) =>
        order.status ===
        "delivered"
    ).length;

  // ==========================================
  // REGULARIZAÇÃO DO CNPJ
  // ==========================================

  const cnpjBlocked =
    cnpjCompliance
      ?.blocked ===
    true;

  const cnpjDaysRemaining =
    cnpjCompliance
      ?.days_remaining ??
    0;

  const showCnpjWarning =
    Boolean(
      cnpjCompliance &&
      !cnpjCompliance.has_cnpj &&
      (
        cnpjCompliance.blocked ||
        cnpjDaysRemaining <=
          30
      )
    );

  // ==========================================
  // STATUS DA LOJA
  // ==========================================

  const storeIsOpen =
    openStatus
      ?.is_open ===
    true;

  const deliveriesPaused =
    Boolean(
      settings
        ?.orders_paused
    );

  let operationTitle =
    "Status indisponível";

  let operationDescription =
    "Não foi possível verificar o horário.";

  let operationDotClass =
    "bg-zinc-400";

  let operationBadgeClass =
    "border-zinc-200 bg-zinc-50 text-zinc-700";

  if (
    cnpjBlocked
  ) {
    operationTitle =
      "Vendas bloqueadas";

    operationDescription =
      "O prazo para informar o CNPJ terminou. Regularize a conta para voltar a receber pedidos.";

    operationDotClass =
      "bg-red-500";

    operationBadgeClass =
      "border-red-200 bg-red-50 text-red-700";
  } else if (
    openStatus &&
    !storeIsOpen
  ) {
    operationTitle =
      "Loja fechada";

    operationDescription =
      nextOpeningText(
        openStatus
      );

    operationDotClass =
      "bg-red-500";

    operationBadgeClass =
      "border-red-200 bg-red-50 text-red-700";
  } else if (
    storeIsOpen &&
    deliveriesPaused
  ) {
    operationTitle =
      "Somente retirada";

    operationDescription =
      openStatus?.closes_at
        ? `Retirada disponível • Fecha às ${formatHour(
            openStatus.closes_at
          )}`
        : "Retirada na loja disponível";

    operationDotClass =
      "bg-amber-500";

    operationBadgeClass =
      "border-amber-200 bg-amber-50 text-amber-700";
  } else if (
    storeIsOpen
  ) {
    operationTitle =
      "Entrega e retirada";

    operationDescription =
      openStatus?.closes_at
        ? `Loja aberta • Fecha às ${formatHour(
            openStatus.closes_at
          )}`
        : "Loja aberta";

    operationDotClass =
      "bg-emerald-500";

    operationBadgeClass =
      "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  // ==========================================
  // CARREGANDO
  // ==========================================

  if (
    loading
  ) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center">
        <p className="text-sm font-semibold text-zinc-600">
          Carregando visão geral...
        </p>
      </div>
    );
  }

  return (
    <div className="pb-2">
      {/* ==================================
          TOPO
      ================================== */}

      <div className="flex flex-wrap items-end justify-between gap-5 border-b border-zinc-200 pb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-600">
            Painel do restaurante
          </p>

          <h2 className="mt-2 text-3xl font-bold tracking-tight text-zinc-950">
            Visão geral
          </h2>

          <p className="mt-2 text-sm text-zinc-500">
            Acompanhe a operação do{" "}
            <strong className="font-semibold text-zinc-700">
              {
                settings?.restaurant_name
              }
            </strong>
            .
          </p>
        </div>

        <button
          type="button"
          disabled={
            refreshing
          }
          onClick={() =>
            loadOverview(
              false
            )
          }
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {refreshing
            ? "Atualizando..."
            : "Atualizar"}
        </button>
      </div>

      {/* ==================================
          ERRO
      ================================== */}

      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {showCnpjWarning && (
        <div
          className={`mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border px-5 py-4 ${
            cnpjBlocked ||
            cnpjDaysRemaining <= 7
              ? "border-red-200 bg-red-50"
              : "border-amber-200 bg-amber-50"
          }`}
        >
          <div>
            <p
              className={`text-sm font-bold ${
                cnpjBlocked ||
                cnpjDaysRemaining <= 7
                  ? "text-red-700"
                  : "text-amber-800"
              }`}
            >
              {cnpjBlocked
                ? "Pendência de CNPJ — vendas bloqueadas"
                : cnpjDaysRemaining <= 7
                  ? `Atenção: faltam ${cnpjDaysRemaining} ${
                      cnpjDaysRemaining === 1
                        ? "dia"
                        : "dias"
                    } para informar o CNPJ`
                  : `Faltam ${cnpjDaysRemaining} dias para informar o CNPJ`}
            </p>

            <p
              className={`mt-1 text-sm ${
                cnpjBlocked ||
                cnpjDaysRemaining <= 7
                  ? "text-red-600"
                  : "text-amber-700"
              }`}
            >
              {cnpjBlocked
                ? "Cadastre um CNPJ válido para a loja voltar a receber novos pedidos."
                : `Prazo final: ${formatDate(
                    cnpjCompliance?.deadline_at ??
                      null
                  )}.`}
            </p>
          </div>

          {onNavigate && (
            <button
              type="button"
              onClick={() =>
                onNavigate(
                  "account"
                )
              }
              className={`rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition ${
                cnpjBlocked ||
                cnpjDaysRemaining <= 7
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-zinc-900 hover:bg-zinc-800"
              }`}
            >
              {cnpjBlocked
                ? "Regularizar CNPJ"
                : "Ver prazo do CNPJ"}
            </button>
          )}
        </div>
      )}

      {/* ==================================
          STATUS DA LOJA
      ================================== */}

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
              Operação
            </p>

            <div className="mt-3 flex items-center gap-3">
              <span
                className={`h-2.5 w-2.5 rounded-full ${operationDotClass}`}
              />

              <h3 className="text-xl font-bold text-zinc-950">
                {
                  operationTitle
                }
              </h3>
            </div>

            <p className="mt-2 text-sm text-zinc-500">
              {
                operationDescription
              }
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${operationBadgeClass}`}
            >
              {cnpjBlocked
                ? "Vendas bloqueadas"
                : storeIsOpen
                  ? "Operação ativa"
                  : "Operação indisponível"}
            </span>

            {onNavigate && (
              <button
                type="button"
                onClick={() =>
                  onNavigate(
                    "settings"
                  )
                }
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                Ajustar operação
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ==================================
          HOJE - RESUMO
      ================================== */}

      <div className="mt-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
              Hoje
            </p>

            <h3 className="mt-1 text-xl font-bold text-zinc-950">
              Resumo do dia
            </h3>
          </div>

          <p className="text-sm font-medium text-zinc-400">
            {
              todayOrders.length
            }{" "}
            pedidos hoje
          </p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Valor bruto pago
            </p>

            <p className="mt-3 text-3xl font-bold tracking-tight text-zinc-950">
              {money(
                grossPaidToday
              )}
            </p>

            <p className="mt-2 text-xs leading-5 text-zinc-400">
              Antes de comissão, taxa de entrega e repasses.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Aguardando pagamento
            </p>

            <p className="mt-3 text-3xl font-bold tracking-tight text-zinc-950">
              {money(
                pendingValueToday
              )}
            </p>

            <p className="mt-2 text-xs text-zinc-400">
              {
                pendingToday.length
              }{" "}
              pagamentos pendentes
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Pedidos ativos
            </p>

            <p className="mt-3 text-3xl font-bold tracking-tight text-zinc-950">
              {
                activeOrders.length
              }
            </p>

            <p className="mt-2 text-xs text-zinc-400">
              Pedidos ainda em andamento
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Concluídos
            </p>

            <p className="mt-3 text-3xl font-bold tracking-tight text-zinc-950">
              {
                completedToday
              }
            </p>

            <p className="mt-2 text-xs text-zinc-400">
              Pedidos concluídos hoje
            </p>
          </div>
        </div>
      </div>

      {/* ==================================
          OPERAÇÃO
      ================================== */}

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
              Operação
            </p>

            <h3 className="mt-1 text-xl font-bold text-zinc-950">
              Pedidos em andamento
            </h3>
          </div>

          {onNavigate && (
            <button
              type="button"
              onClick={() =>
                onNavigate(
                  "orders"
                )
              }
              className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Ver pedidos
            </button>
          )}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-zinc-200 border-l-4 border-l-red-500 bg-white p-4">
            <p className="text-sm font-semibold text-zinc-600">
              Novos
            </p>

            <p className="mt-2 text-3xl font-bold text-zinc-950">
              {
                newOrders
              }
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 border-l-4 border-l-blue-500 bg-white p-4">
            <p className="text-sm font-semibold text-zinc-600">
              Aceitos
            </p>

            <p className="mt-2 text-3xl font-bold text-zinc-950">
              {
                acceptedOrders
              }
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 border-l-4 border-l-amber-500 bg-white p-4">
            <p className="text-sm font-semibold text-zinc-600">
              Preparando
            </p>

            <p className="mt-2 text-3xl font-bold text-zinc-950">
              {
                preparingOrders
              }
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 border-l-4 border-l-violet-500 bg-white p-4">
            <p className="text-sm font-semibold text-zinc-600">
              Prontos
            </p>

            <p className="mt-2 text-3xl font-bold text-zinc-950">
              {
                readyOrders
              }
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 border-l-4 border-l-emerald-500 bg-white p-4">
            <p className="text-sm font-semibold text-zinc-600">
              Em entrega
            </p>

            <p className="mt-2 text-3xl font-bold text-zinc-950">
              {
                onTheWayOrders
              }
            </p>
          </div>
        </div>
      </section>

      {/* ==================================
          ENTREGA X RETIRADA + FINANCEIRO
      ================================== */}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-zinc-200 bg-white p-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
            Pedidos de hoje
          </p>

          <h3 className="mt-1 text-xl font-bold text-zinc-950">
            Modalidade
          </h3>

          <div className="mt-6 divide-y divide-zinc-100 rounded-xl border border-zinc-200">
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-semibold text-zinc-800">
                  Entregas
                </p>

                <p className="mt-1 text-xs text-zinc-400">
                  Pedidos enviados ao endereço do cliente
                </p>
              </div>

              <p className="text-2xl font-bold text-zinc-950">
                {
                  deliveriesToday
                }
              </p>
            </div>

            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-semibold text-zinc-800">
                  Retiradas
                </p>

                <p className="mt-1 text-xs text-zinc-400">
                  Pedidos retirados no estabelecimento
                </p>
              </div>

              <p className="text-2xl font-bold text-zinc-950">
                {
                  pickupsToday
                }
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
            Financeiro
          </p>

          <h3 className="mt-1 text-xl font-bold text-zinc-950">
            Pagamentos de hoje
          </h3>

          <div className="mt-6 divide-y divide-zinc-100 rounded-xl border border-zinc-200">
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-semibold text-zinc-800">
                  Pagos
                </p>

                <p className="mt-1 text-xs text-zinc-400">
                  {
                    paidToday.length
                  }{" "}
                  pedidos
                </p>
              </div>

              <p className="text-lg font-bold text-zinc-950">
                {money(
                  grossPaidToday
                )}
              </p>
            </div>

            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-semibold text-zinc-800">
                  Pendentes
                </p>

                <p className="mt-1 text-xs text-zinc-400">
                  {
                    pendingToday.length
                  }{" "}
                  pedidos
                </p>
              </div>

              <p className="text-lg font-bold text-zinc-950">
                {money(
                  pendingValueToday
                )}
              </p>
            </div>
          </div>

          {onNavigate && (
            <button
              type="button"
              onClick={() =>
                onNavigate(
                  "finance"
                )
              }
              className="mt-4 w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
            >
              Abrir financeiro
            </button>
          )}
        </section>
      </div>

      {/* ==================================
          ATALHOS
      ================================== */}

      {onNavigate && (
        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
            Navegação
          </p>

          <h3 className="mt-1 text-xl font-bold text-zinc-950">
            Acesso rápido
          </h3>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <button
              type="button"
              onClick={() =>
                onNavigate(
                  "orders"
                )
              }
              className="group rounded-xl border border-zinc-200 p-4 text-left transition hover:border-zinc-300 hover:bg-zinc-50"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-zinc-800">
                  Pedidos
                </p>

                <span className="text-zinc-300 transition group-hover:text-zinc-500">
                  →
                </span>
              </div>

              <p className="mt-1 text-xs text-zinc-400">
                Acompanhar operação
              </p>
            </button>

            <button
              type="button"
              onClick={() =>
                onNavigate(
                  "menu"
                )
              }
              className="group rounded-xl border border-zinc-200 p-4 text-left transition hover:border-zinc-300 hover:bg-zinc-50"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-zinc-800">
                  Cardápio
                </p>

                <span className="text-zinc-300 transition group-hover:text-zinc-500">
                  →
                </span>
              </div>

              <p className="mt-1 text-xs text-zinc-400">
                Produtos e categorias
              </p>
            </button>

            <button
              type="button"
              onClick={() =>
                onNavigate(
                  "hours"
                )
              }
              className="group rounded-xl border border-zinc-200 p-4 text-left transition hover:border-zinc-300 hover:bg-zinc-50"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-zinc-800">
                  Horários
                </p>

                <span className="text-zinc-300 transition group-hover:text-zinc-500">
                  →
                </span>
              </div>

              <p className="mt-1 text-xs text-zinc-400">
                Funcionamento da loja
              </p>
            </button>

            <button
              type="button"
              onClick={() =>
                onNavigate(
                  "account"
                )
              }
              className="group rounded-xl border border-zinc-200 p-4 text-left transition hover:border-zinc-300 hover:bg-zinc-50"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-zinc-800">
                  Minha conta
                </p>

                <span className="text-zinc-300 transition group-hover:text-zinc-500">
                  →
                </span>
              </div>

              <p className="mt-1 text-xs text-zinc-400">
                Cadastro e regularização
              </p>
            </button>

            <button
              type="button"
              onClick={() =>
                onNavigate(
                  "settings"
                )
              }
              className="group rounded-xl border border-zinc-200 p-4 text-left transition hover:border-zinc-300 hover:bg-zinc-50"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-zinc-800">
                  Configurações
                </p>

                <span className="text-zinc-300 transition group-hover:text-zinc-500">
                  →
                </span>
              </div>

              <p className="mt-1 text-xs text-zinc-400">
                Preferências da operação
              </p>
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
