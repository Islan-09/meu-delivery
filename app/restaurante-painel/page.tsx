"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import { supabase } from "@/lib/supabase";

import CardapioSection from "./CardapioSection";
import ComplementosSection from "./ComplementosSection";
import CuponsSection from "./CuponsSection";
import MinhaLojaSection from "./MinhaLojaSection";
import MinhaContaSection from "./MinhaContaSection";
import HorariosSection from "./HorariosSection";
import ConfiguracoesSection from "./ConfiguracoesSection";
import FinanceiroSection from "./FinanceiroSection";
import VisaoGeralSection from "./VisaoGeralSection";
import PedidosSection from "./PedidosSection";

type Restaurant = {
  id: string;
  name: string;
};

type PanelSection =
  | "overview"
  | "orders"
  | "menu"
  | "addons"
  | "coupons"
  | "hours"
  | "store"
  | "finance"
  | "account"
  | "settings";

function RestaurantPanelContent() {
  const router =
    useRouter();

  const searchParams =
    useSearchParams();

  const restaurantId =
    searchParams.get(
      "restaurant"
    ) ?? "";

  const [
    restaurant,
    setRestaurant,
  ] =
    useState<Restaurant | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    section,
    setSection,
  ] =
    useState<PanelSection>(
      "orders"
    );

  const [
    activeOrders,
    setActiveOrders,
  ] =
    useState(
      0
    );

  // ==========================================
  // CONTAR PEDIDOS ATIVOS
  // SOMENTE DA LOJA ABERTA
  // ==========================================

  const loadActiveOrders =
    useCallback(
      async () => {
        if (
          !restaurantId
        ) {
          return;
        }

        const {
          data,
          error:
            ordersError,
        } =
          await supabase.rpc(
            "get_my_restaurant_orders"
          );

        if (
          ordersError
        ) {
          console.error(
            "Erro ao contar pedidos:",
            ordersError
          );

          return;
        }

        const active =
          (
            data ??
            []
          ).filter(
            (
              order: {
                restaurant_id:
                  string;

                status:
                  string;
              }
            ) =>
              order.restaurant_id ===
                restaurantId &&
              order.status !==
                "delivered" &&
              order.status !==
                "cancelled"
          ).length;

        setActiveOrders(
          active
        );
      },
      [
        restaurantId,
      ]
    );

  // ==========================================
  // CARREGAR PAINEL
  // ==========================================

  useEffect(() => {
    let interval:
      | ReturnType<
          typeof setInterval
        >
      | null =
      null;

    async function startPanel() {
      setLoading(
        true
      );

      setError("");

      // ======================================
      // PRECISA INFORMAR QUAL LOJA ABRIR
      // ======================================

      if (
        !restaurantId
      ) {
        router.replace(
          "/restaurante/inicio"
        );

        return;
      }

      // ======================================
      // VERIFICAR LOGIN
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
        router.replace(
          "/restaurante"
        );

        return;
      }

      // ======================================
      // BUSCAR EXATAMENTE A LOJA DA URL
      //
      // E CONFIRMAR QUE PERTENCE
      // À CONTA LOGADA
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
            name
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

      // ======================================
      // LOJA NÃO EXISTE OU NÃO É DA CONTA
      // ======================================

      if (
        restaurantError ||
        !restaurantData
      ) {
        console.error(
          "Erro ao abrir restaurante:",
          restaurantError
        );

        setError(
          "Essa loja não foi encontrada ou não pertence à sua conta."
        );

        setLoading(
          false
        );

        return;
      }

      // ======================================
      // LOJA CORRETA
      // ======================================

      setRestaurant(
        restaurantData
      );

      await loadActiveOrders();

      setLoading(
        false
      );

      // ======================================
      // ATUALIZAR CONTADOR
      // ======================================

      interval =
        setInterval(
          loadActiveOrders,
          5000
        );
    }

    startPanel();

    return () => {
      if (
        interval
      ) {
        clearInterval(
          interval
        );
      }
    };
  }, [
    restaurantId,
    loadActiveOrders,
    router,
  ]);

  // ==========================================
  // VOLTAR PARA MINHAS LOJAS
  // ==========================================

  function goToMyStores() {
    router.push(
      "/restaurante/inicio"
    );
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
          Carregando painel...
        </p>
      </main>
    );
  }

  // ==========================================
  // ERRO
  // ==========================================

  if (
    error
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7] p-6">
        <div className="max-w-lg rounded-3xl bg-white p-8 text-center shadow-sm">
          <div className="text-5xl">
            ⚠️
          </div>

          <h1 className="mt-4 text-2xl font-black">
            Não foi possível abrir o painel
          </h1>

          <p className="mt-3 text-zinc-500">
            {
              error
            }
          </p>

          <button
            type="button"
            onClick={
              goToMyStores
            }
            className="mt-6 rounded-xl bg-red-600 px-5 py-3 font-black text-white transition hover:bg-red-700"
          >
            ← Voltar para minhas lojas
          </button>
        </div>
      </main>
    );
  }

  // ==========================================
  // MENU
  // ==========================================

  const menuItems: {
    id:
      PanelSection;

    icon:
      string;

    label:
      string;
  }[] = [
    {
      id:
        "overview",

      icon:
        "📊",

      label:
        "Visão geral",
    },

    {
      id:
        "orders",

      icon:
        "🧾",

      label:
        "Pedidos",
    },

    {
      id:
        "menu",

      icon:
        "🍔",

      label:
        "Cardápio",
    },

    {
      id:
        "addons",

      icon:
        "➕",

      label:
        "Complementos",
    },

    {
      id:
        "coupons",

      icon:
        "🎟️",

      label:
        "Cupons",
    },

    {
      id:
        "hours",

      icon:
        "🕐",

      label:
        "Horários",
    },

    {
      id:
        "store",

      icon:
        "🏪",

      label:
        "Minha loja",
    },

    {
      id:
        "finance",

      icon:
        "💰",

      label:
        "Financeiro",
    },


    {
      id:
        "account",

      icon:
        "👤",

      label:
        "Minha conta",
    },

    {
      id:
        "settings",

      icon:
        "⚙️",

      label:
        "Configurações",
    },
  ];

  return (
    <main className="min-h-screen bg-[#f7f7f7] text-zinc-900">
      {/* ======================================
          CABEÇALHO
      ====================================== */}

      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs font-bold uppercase text-red-600">
              Portal do Restaurante
            </p>

            <h1 className="text-xl font-black">
              {restaurant?.name ||
                "Entrega Paudalho"}
            </h1>
          </div>

          <button
            type="button"
            onClick={
              goToMyStores
            }
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-black text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
          >
            ← Minhas lojas
          </button>
        </div>
      </header>

      {/* ======================================
          PAINEL
      ====================================== */}

      <div className="grid w-full gap-6 px-6 py-6 lg:grid-cols-[230px_minmax(0,1fr)]">
        {/* ==================================
            MENU ESQUERDO
        ================================== */}

        <aside className="min-w-0">
          <div className="overflow-x-auto rounded-3xl bg-white p-3 shadow-sm lg:sticky lg:top-24">
            <div className="flex min-w-max gap-2 lg:min-w-0 lg:flex-col">
              {menuItems.map(
                (
                  item
                ) => (
                  <button
                    key={
                      item.id
                    }
                    type="button"
                    onClick={() =>
                      setSection(
                        item.id
                      )
                    }
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-bold transition ${
                      section ===
                      item.id
                        ? "bg-red-600 text-white"
                        : "text-zinc-600 hover:bg-zinc-100"
                    }`}
                  >
                    <span className="text-lg">
                      {
                        item.icon
                      }
                    </span>

                    <span>
                      {
                        item.label
                      }
                    </span>

                    {item.id ===
                      "orders" &&
                      activeOrders >
                        0 && (
                        <span
                          className={`ml-auto rounded-full px-2 py-0.5 text-xs font-black ${
                            section ===
                            "orders"
                              ? "bg-white text-red-600"
                              : "bg-red-100 text-red-600"
                          }`}
                        >
                          {
                            activeOrders
                          }
                        </span>
                      )}
                  </button>
                )
              )}
            </div>
          </div>
        </aside>

        {/* ==================================
            CONTEÚDO
        ================================== */}

        <section className="min-w-0">
          {section ===
            "overview" && (
            <VisaoGeralSection
              onNavigate={(
                target
              ) =>
                setSection(
                  target
                )
              }
            />
          )}

          {section ===
            "orders" && (
            <PedidosSection />
          )}

          {section ===
            "menu" && (
            <CardapioSection />
          )}

          {section ===
            "addons" && (
            <ComplementosSection />
          )}

          {section ===
            "coupons" && (
            <CuponsSection />
          )}

          {section ===
            "hours" && (
            <HorariosSection />
          )}

          {section ===
            "store" && (
            <MinhaLojaSection />
          )}

          {section ===
            "finance" && (
            <FinanceiroSection />
          )}


          {section ===
            "account" && (
            <MinhaContaSection />
          )}

          {section ===
            "settings" && (
            <ConfiguracoesSection />
          )}
        </section>
      </div>
    </main>
  );
}

// ==========================================
// SUSPENSE PARA useSearchParams
// ==========================================

export default function RestaurantPanelPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7]">
          <p className="font-bold">
            Carregando painel...
          </p>
        </main>
      }
    >
      <RestaurantPanelContent />
    </Suspense>
  );
}
