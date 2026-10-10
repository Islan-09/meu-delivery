"use client";

import Link from "next/link";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

type OrderItem = {
  name: string;
  quantity: number;
  unit_price: number | string;
};

type FulfillmentMethod =
  | "delivery"
  | "pickup";

type OrderView =
  | "payment"
  | "active"
  | "finished";

type Order = {
  order_id: string;

  restaurant_id: string;
  restaurant_name: string;

  restaurant_street: string | null;
  restaurant_number: string | null;
  restaurant_neighborhood: string | null;
  restaurant_city: string | null;
  restaurant_state: string | null;

  fulfillment_method?:
    | FulfillmentMethod
    | null;

  status: string;

  payment_method: string | null;
  payment_status: string | null;

  subtotal: number | string;
  delivery_fee: number | string;
  discount: number | string | null;

  coupon_code: string | null;
  coupon_discount: number | string | null;

  total: number | string;

  created_at: string;
  updated_at: string;

  address_street: string | null;
  address_number: string | null;
  address_neighborhood: string | null;

  items: OrderItem[];
};

function money(
  value: number | string | null
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

function dateTime(
  value: string
) {
  return new Date(
    value
  ).toLocaleString(
    "pt-BR",
    {
      dateStyle: "short",
      timeStyle: "short",
    }
  );
}

function isPickupOrder(
  order: Order
) {
  if (
    order.fulfillment_method ===
    "pickup"
  ) {
    return true;
  }

  if (
    order.fulfillment_method ===
    "delivery"
  ) {
    return false;
  }

  return (
    !order.address_street &&
    Number(
      order.delivery_fee ?? 0
    ) === 0
  );
}

function statusInfo(
  status: string,
  pickup: boolean
) {
  if (pickup) {
    switch (status) {
      case "pending":
        return {
          text: "Pedido recebido",
          icon: "🧾",
          className:
            "bg-yellow-50 text-yellow-700",
        };

      case "accepted":
        return {
          text: "Pedido aceito",
          icon: "✅",
          className:
            "bg-blue-50 text-blue-700",
        };

      case "preparing":
        return {
          text: "Preparando",
          icon: "👨‍🍳",
          className:
            "bg-orange-50 text-orange-700",
        };

      case "ready":
        return {
          text: "Pronto para retirar",
          icon: "🏪",
          className:
            "bg-purple-50 text-purple-700",
        };

      case "delivered":
        return {
          text: "Retirada concluída",
          icon: "✅",
          className:
            "bg-green-50 text-green-700",
        };

      case "cancelled":
        return {
          text: "Cancelado",
          icon: "❌",
          className:
            "bg-red-50 text-red-700",
        };

      default:
        return {
          text: status,
          icon: "🏪",
          className:
            "bg-zinc-100 text-zinc-700",
        };
    }
  }

  switch (status) {
    case "pending":
      return {
        text: "Pedido recebido",
        icon: "🧾",
        className:
          "bg-yellow-50 text-yellow-700",
      };

    case "accepted":
      return {
        text: "Pedido aceito",
        icon: "✅",
        className:
          "bg-blue-50 text-blue-700",
      };

    case "preparing":
      return {
        text: "Preparando",
        icon: "👨‍🍳",
        className:
          "bg-orange-50 text-orange-700",
      };

    case "ready":
      return {
        text: "Pronto para coleta",
        icon: "📦",
        className:
          "bg-purple-50 text-purple-700",
      };

    case "driver_assigned":
      return {
        text: "Entregador indo buscar",
        icon: "🛵",
        className:
          "bg-blue-50 text-blue-700",
      };

    case "picked_up":
      return {
        text: "Pedido retirado",
        icon: "📦",
        className:
          "bg-blue-50 text-blue-700",
      };

    case "delivering":
      return {
        text: "A caminho",
        icon: "🛵",
        className:
          "bg-green-50 text-green-700",
      };

    case "delivered":
      return {
        text: "Entregue",
        icon: "✅",
        className:
          "bg-green-50 text-green-700",
      };

    case "cancelled":
      return {
        text: "Cancelado",
        icon: "❌",
        className:
          "bg-red-50 text-red-700",
      };

    default:
      return {
        text: status,
        icon: "🧾",
        className:
          "bg-zinc-100 text-zinc-700",
      };
  }
}

function paymentName(
  method: string | null
) {
  if (
    method === "pix"
  ) {
    return "PIX";
  }

  if (
    method === "card"
  ) {
    return "Cartão";
  }

  return (
    method ||
    "Não informado"
  );
}

function isActiveOrder(
  status: string
) {
  return ![
    "delivered",
    "cancelled",
  ].includes(
    status
  );
}

function storeAddressLine1(
  order: Order
) {
  return [
    order.restaurant_street,
    order.restaurant_number,
  ]
    .filter(Boolean)
    .join(", ");
}

function storeAddressLine2(
  order: Order
) {
  const cityState = [
    order.restaurant_city,
    order.restaurant_state,
  ]
    .filter(Boolean)
    .join(" - ");

  return [
    order.restaurant_neighborhood,
    cityState,
  ]
    .filter(Boolean)
    .join(" • ");
}

export default function MeusPedidosPage() {
  const router =
    useRouter();

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

  const [
    orders,
    setOrders,
  ] =
    useState<Order[]>([]);

  const [
    selectedView,
    setSelectedView,
  ] =
    useState<OrderView>(
      "active"
    );

  const [
    deletingOrderId,
    setDeletingOrderId,
  ] =
    useState("");

  const [
    reorderingOrderId,
    setReorderingOrderId,
  ] =
    useState("");

  // ==========================================
  // CARREGAR PEDIDOS
  // ==========================================

  const loadOrders =
    useCallback(
      async (
        firstLoad = false
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

        const {
          data: {
            session,
          },
        } =
          await supabase.auth.getSession();

        if (
          !session
        ) {
          sessionStorage.setItem(
            "after-login",
            "/meus-pedidos"
          );

          router.replace(
            "/login"
          );

          return;
        }

        const {
          data,
          error:
            ordersError,
        } =
          await supabase.rpc(
            "get_my_orders"
          );

        if (
          ordersError
        ) {
          console.error(
            "Erro pedidos:",
            ordersError
          );

          setError(
            "Não foi possível carregar seus pedidos."
          );

          setLoading(
            false
          );

          setRefreshing(
            false
          );

          return;
        }

        const {
          data:
            couponData,

          error:
            couponDetailsError,
        } =
          await supabase.rpc(
            "get_my_order_coupon_details"
          );

        if (
          couponDetailsError
        ) {
          console.error(
            "Erro cupons dos pedidos:",
            couponDetailsError
          );
        }

        const couponByOrder =
          new Map<
            string,
            {
              coupon_code:
                | string
                | null;

              coupon_discount:
                number;
            }
          >(
            (
              couponData ??
              []
            ).map(
              (row: {
                order_id:
                  string;

                coupon_code:
                  | string
                  | null;

                coupon_discount:
                  | number
                  | string
                  | null;
              }) => [
                row.order_id,
                {
                  coupon_code:
                    row.coupon_code ??
                    null,

                  coupon_discount:
                    Number(
                      row.coupon_discount ??
                        0
                    ),
                },
              ]
            )
          );

        setOrders(
          (
            (
              data ??
              []
            ) as Order[]
          ).map(
            (
              order
            ) => {
              const coupon =
                couponByOrder.get(
                  order.order_id
                );

              return {
                ...order,

                coupon_code:
                  coupon
                    ?.coupon_code ??
                  order.coupon_code ??
                  null,

                coupon_discount:
                  coupon
                    ?.coupon_discount ??
                  Number(
                    order.coupon_discount ??
                      0
                  ),
              };
            }
          )
        );

        setError(
          ""
        );

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
  // EXCLUIR PEDIDO NÃO PAGO
  // ==========================================

  async function deleteUnpaidOrder(
    orderId: string
  ) {
    if (
      deletingOrderId
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "Deseja excluir este pedido?\n\nEsta opção está disponível somente porque o pagamento ainda não foi realizado."
      );

    if (
      !confirmed
    ) {
      return;
    }

    setDeletingOrderId(
      orderId
    );

    setError(
      ""
    );

    const {
      data,
      error:
        deleteError,
    } =
      await supabase.rpc(
        "delete_my_unpaid_order",
        {
          p_order_id:
            orderId,
        }
      );

    if (
      deleteError
    ) {
      console.error(
        "Erro excluindo pedido:",
        deleteError
      );

      const message =
        deleteError.message ??
        "";

      if (
        message.includes(
          "ORDER_CANNOT_BE_DELETED"
        )
      ) {
        setError(
          "Este pedido não pode mais ser excluído. Atualize a página para verificar o status."
        );
      } else if (
        message.includes(
          "LOGIN_REQUIRED"
        )
      ) {
        setError(
          "Sua sessão expirou. Entre novamente."
        );
      } else {
        setError(
          "Não foi possível excluir este pedido."
        );
      }

      setDeletingOrderId(
        ""
      );

      return;
    }

    if (
      data !== true
    ) {
      setError(
        "Não foi possível excluir este pedido."
      );

      setDeletingOrderId(
        ""
      );

      return;
    }

    // REMOVE IMEDIATAMENTE DA TELA
    setOrders(
      (
        current
      ) =>
        current.filter(
          (
            order
          ) =>
            order.order_id !==
            orderId
        )
    );

    setDeletingOrderId(
      ""
    );
  }

  // ==========================================
  // PEDIR NOVAMENTE
  // ==========================================

  async function reorder(
    order: Order
  ) {
    if (
      reorderingOrderId
    ) {
      return;
    }

    setError("");
    setReorderingOrderId(
      order.order_id
    );

    const {
      data,
      error:
        reorderError,
    } =
      await supabase.rpc(
        "get_my_reorder_cart",
        {
          p_order_id:
            order.order_id,
        }
      );

    if (
      reorderError
    ) {
      console.error(
        "Erro ao repetir pedido:",
        reorderError
      );

      setError(
        "Não foi possível montar este pedido novamente."
      );

      setReorderingOrderId(
        ""
      );

      return;
    }

    const row =
      Array.isArray(data)
        ? data[0]
        : data;

    const items =
      row?.cart_items;

    if (
      !Array.isArray(items) ||
      items.length === 0
    ) {
      setError(
        "Nenhum produto deste pedido está disponível atualmente."
      );

      setReorderingOrderId(
        ""
      );

      return;
    }

    const restaurantId =
      String(
        row.restaurant_id ??
          order.restaurant_id
      );

    const storageKey =
      `cart-${restaurantId}`;

    const existing =
      localStorage.getItem(
        storageKey
      );

    if (existing) {
      const confirmed =
        window.confirm(
          "Você já possui itens desta loja no carrinho. Deseja substituir pelo pedido antigo?"
        );

      if (!confirmed) {
        setReorderingOrderId(
          ""
        );

        return;
      }
    }

    localStorage.setItem(
      storageKey,
      JSON.stringify(
        items
      )
    );

    window.dispatchEvent(
      new Event(
        "cart-updated"
      )
    );

    const unavailable =
      Number(
        row?.unavailable_items ??
          0
      );

    if (
      unavailable > 0
    ) {
      sessionStorage.setItem(
        "reorder-warning",
        `${unavailable} item(ns) do pedido antigo não estão disponíveis e não foram adicionados.`
      );
    }

    router.push(
      "/carrinho"
    );
  }

  useEffect(() => {
    loadOrders(
      true
    );
  }, [
    loadOrders,
  ]);

  // ==========================================
  // ATUALIZAÇÃO AUTOMÁTICA
  // ==========================================

  useEffect(() => {
    const hasOrderToUpdate =
      orders.some(
        (
          order
        ) =>
          order.payment_status ===
            "pending" ||
          (
            order.payment_status ===
              "paid" &&
            isActiveOrder(
              order.status
            )
          )
      );

    if (
      !hasOrderToUpdate
    ) {
      return;
    }

    const interval =
      window.setInterval(
        () => {
          loadOrders(
            false
          );
        },
        5000
      );

    return () => {
      window.clearInterval(
        interval
      );
    };
  }, [
    orders,
    loadOrders,
  ]);

  // ==========================================
  // SEPARAR PEDIDOS
  // ==========================================

  const paymentOrders =
    orders.filter(
      (
        order
      ) =>
        order.payment_status ===
          "pending" &&
        isActiveOrder(
          order.status
        )
    );

  const activeOrders =
    orders.filter(
      (
        order
      ) =>
        order.payment_status ===
          "paid" &&
        isActiveOrder(
          order.status
        )
    );

  const finishedOrders =
    orders.filter(
      (
        order
      ) =>
        !isActiveOrder(
          order.status
        )
    );

  let visibleOrders:
    Order[] =
    [];

  if (
    selectedView ===
    "payment"
  ) {
    visibleOrders =
      paymentOrders;
  }

  if (
    selectedView ===
    "active"
  ) {
    visibleOrders =
      activeOrders;
  }

  if (
    selectedView ===
    "finished"
  ) {
    visibleOrders =
      finishedOrders;
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
          Carregando seus pedidos...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f7f7] text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link
            href="/"
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
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl">
              🧾
            </div>

            <h1 className="mt-4 text-3xl font-black">
              Meus pedidos
            </h1>

            <p className="mt-2 text-zinc-500">
              Acompanhe seus pagamentos,
              pedidos em andamento e
              histórico.
            </p>
          </div>

          {refreshing && (
            <p className="text-sm font-semibold text-green-600">
              Atualizando...
            </p>
          )}
        </div>

        {error && (
          <div className="mt-6 rounded-2xl bg-red-50 p-4 font-semibold text-red-700">
            {
              error
            }
          </div>
        )}

        {!error &&
          orders.length ===
            0 && (
            <section className="mt-8 rounded-3xl bg-white p-10 text-center shadow-sm">
              <div className="text-6xl">
                🛍️
              </div>

              <h2 className="mt-4 text-2xl font-black">
                Você ainda não fez pedidos
              </h2>

              <p className="mt-2 text-zinc-500">
                Quando fizer seu primeiro
                pedido, ele aparecerá aqui.
              </p>

              <Link
                href="/"
                className="mt-6 inline-block rounded-xl bg-red-600 px-6 py-4 font-black text-white"
              >
                Ver restaurantes
              </Link>
            </section>
          )}

        {!error &&
          orders.length >
            0 && (
            <>
              {/* =====================================
                  ABAS
              ===================================== */}

              <div className="mt-8 grid gap-2 rounded-2xl bg-white p-2 shadow-sm sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedView(
                      "payment"
                    )
                  }
                  className={`rounded-xl px-3 py-4 text-center font-black transition ${
                    selectedView ===
                    "payment"
                      ? "bg-yellow-400 text-zinc-900 shadow-sm"
                      : "bg-white text-zinc-600 hover:bg-yellow-50"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span>
                      💠 Aguardando pagamento
                    </span>

                    <span
                      className={`rounded-full px-2.5 py-1 text-xs ${
                        selectedView ===
                        "payment"
                          ? "bg-white text-yellow-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {
                        paymentOrders.length
                      }
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedView(
                      "active"
                    )
                  }
                  className={`rounded-xl px-3 py-4 text-center font-black transition ${
                    selectedView ===
                    "active"
                      ? "bg-red-600 text-white shadow-sm"
                      : "bg-white text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span>
                      🕐 Em andamento
                    </span>

                    <span
                      className={`rounded-full px-2.5 py-1 text-xs ${
                        selectedView ===
                        "active"
                          ? "bg-white text-red-600"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {
                        activeOrders.length
                      }
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedView(
                      "finished"
                    )
                  }
                  className={`rounded-xl px-3 py-4 text-center font-black transition ${
                    selectedView ===
                    "finished"
                      ? "bg-zinc-900 text-white shadow-sm"
                      : "bg-white text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span>
                      ✅ Finalizados
                    </span>

                    <span
                      className={`rounded-full px-2.5 py-1 text-xs ${
                        selectedView ===
                        "finished"
                          ? "bg-white text-zinc-900"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {
                        finishedOrders.length
                      }
                    </span>
                  </div>
                </button>
              </div>

              {/* =====================================
                  ABA VAZIA
              ===================================== */}

              {visibleOrders.length ===
                0 && (
                <section className="mt-5 rounded-3xl bg-white p-10 text-center shadow-sm">
                  <div className="text-5xl">
                    {selectedView ===
                    "payment"
                      ? "💠"
                      : selectedView ===
                          "active"
                        ? "🕐"
                        : "✅"}
                  </div>

                  <h2 className="mt-4 text-xl font-black">
                    {selectedView ===
                    "payment"
                      ? "Nenhum pagamento pendente"
                      : selectedView ===
                          "active"
                        ? "Nenhum pedido em andamento"
                        : "Nenhum pedido finalizado"}
                  </h2>

                  <p className="mt-2 text-zinc-500">
                    {selectedView ===
                    "payment"
                      ? "Pedidos que ainda precisam ser pagos aparecerão aqui."
                      : selectedView ===
                          "active"
                        ? "Pedidos pagos e em preparação ou entrega aparecerão aqui."
                        : "Seus pedidos concluídos e cancelados aparecerão aqui."}
                  </p>
                </section>
              )}

              {/* =====================================
                  PEDIDOS
              ===================================== */}

              <div className="mt-5 space-y-5">
                {visibleOrders.map(
                  (
                    order
                  ) => {
                    const pickup =
                      isPickupOrder(
                        order
                      );

                    const status =
                      statusInfo(
                        order.status,
                        pickup
                      );

                    const active =
                      isActiveOrder(
                        order.status
                      );

                    const paymentPending =
                      order.payment_status ===
                      "pending";

                    const deleting =
                      deletingOrderId ===
                      order.order_id;

                    const subtotal =
                      Number(
                        order.subtotal ??
                          0
                      );

                    const discount =
                      Number(
                        order.discount ??
                          0
                      );

                    const subtotalBeforeDiscount =
                      subtotal +
                      discount;

                    const hasDiscount =
                      discount >
                      0;

                    const couponDiscount =
                      Number(
                        order.coupon_discount ??
                          0
                      );

                    const hasCoupon =
                      couponDiscount >
                      0;

                    return (
                      <article
                        key={
                          order.order_id
                        }
                        className={`overflow-hidden rounded-3xl bg-white shadow-sm ${
                          paymentPending
                            ? "ring-2 ring-yellow-100"
                            : active
                              ? "ring-2 ring-red-100"
                              : ""
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-100 p-6">
                          <div>
                            <div className="mb-3">
                              {pickup ? (
                                <span className="inline-flex rounded-full bg-orange-100 px-3 py-1.5 text-xs font-black text-orange-700">
                                  🏪 RETIRADA NA LOJA
                                </span>
                              ) : (
                                <span className="inline-flex rounded-full bg-blue-100 px-3 py-1.5 text-xs font-black text-blue-700">
                                  🛵 ENTREGA
                                </span>
                              )}
                            </div>

                            <p className="text-xs font-black uppercase text-zinc-400">
                              Pedido #
                              {order.order_id
                                .slice(
                                  0,
                                  8
                                )
                                .toUpperCase()}
                            </p>

                            <h2 className="mt-2 text-xl font-black">
                              {
                                order.restaurant_name
                              }
                            </h2>

                            <p className="mt-1 text-sm text-zinc-500">
                              {dateTime(
                                order.created_at
                              )}
                            </p>
                          </div>

                          {paymentPending ? (
                            <span className="rounded-full bg-yellow-50 px-4 py-2 text-sm font-black text-yellow-700">
                              💠 Pagamento pendente
                            </span>
                          ) : (
                            <span
                              className={`rounded-full px-4 py-2 text-sm font-black ${status.className}`}
                            >
                              {
                                status.icon
                              }{" "}
                              {
                                status.text
                              }
                            </span>
                          )}
                        </div>

                        <div className="p-6">
                          <p className="text-sm font-black">
                            Itens
                          </p>

                          <div className="mt-3 space-y-2">
                            {(order.items ??
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
                                  className="flex justify-between gap-4 text-sm"
                                >
                                  <span className="text-zinc-600">
                                    {
                                      item.quantity
                                    }
                                    x{" "}
                                    {
                                      item.name
                                    }
                                  </span>

                                  <span className="font-semibold">
                                    {money(
                                      Number(
                                        item.unit_price
                                      ) *
                                        item.quantity
                                    )}
                                  </span>
                                </div>
                              )
                            )}
                          </div>

                          {pickup && (
                            <div className="mt-5 rounded-2xl border border-orange-200 bg-orange-50 p-4">
                              <p className="text-xs font-black text-orange-600">
                                COMO RECEBER
                              </p>

                              <p className="mt-2 font-black text-orange-800">
                                🏪 Retirada na loja
                              </p>

                              <p className="mt-2 text-sm leading-5 text-orange-700">
                                Você irá retirar
                                este pedido
                                diretamente no
                                restaurante.
                              </p>

                              {(storeAddressLine1(
                                order
                              ) ||
                                storeAddressLine2(
                                  order
                                )) && (
                                <div className="mt-4 rounded-xl bg-white/80 p-3">
                                  <p className="text-xs font-black text-orange-600">
                                    ENDEREÇO DA LOJA
                                  </p>

                                  {storeAddressLine1(
                                    order
                                  ) && (
                                    <p className="mt-2 text-sm font-semibold text-zinc-900">
                                      📍{" "}
                                      {storeAddressLine1(
                                        order
                                      )}
                                    </p>
                                  )}

                                  {storeAddressLine2(
                                    order
                                  ) && (
                                    <p className="mt-1 text-sm text-zinc-600">
                                      {storeAddressLine2(
                                        order
                                      )}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {!pickup &&
                            order.address_street && (
                              <div className="mt-5 rounded-2xl bg-zinc-50 p-4">
                                <p className="text-xs font-black text-zinc-400">
                                  ENTREGA
                                </p>

                                <p className="mt-2 text-sm font-semibold">
                                  📍{" "}
                                  {
                                    order.address_street
                                  }

                                  {order.address_number
                                    ? `, ${order.address_number}`
                                    : ""}
                                </p>

                                {order.address_neighborhood && (
                                  <p className="mt-1 text-sm text-zinc-500">
                                    {
                                      order.address_neighborhood
                                    }
                                  </p>
                                )}
                              </div>
                            )}

                          <div className="mt-5 rounded-2xl bg-zinc-50 p-4">
                            {hasDiscount ? (
                              <>
                                <div className="flex justify-between gap-4 text-sm">
                                  <span className="text-zinc-500">
                                    Subtotal dos produtos
                                  </span>

                                  <span className="font-semibold text-zinc-700">
                                    {money(
                                      subtotalBeforeDiscount
                                    )}
                                  </span>
                                </div>

                                <div className="mt-2 flex justify-between gap-4 text-sm">
                                  <span className="font-bold text-green-600">
                                    Desconto nos produtos
                                  </span>

                                  <span className="font-black text-green-600">
                                    - {money(
                                      discount
                                    )}
                                  </span>
                                </div>

                                <div className="mt-2 flex justify-between gap-4 border-t border-zinc-200 pt-2 text-sm">
                                  <span className="text-zinc-500">
                                    Subtotal com desconto
                                  </span>

                                  <span className="font-semibold">
                                    {money(
                                      subtotal
                                    )}
                                  </span>
                                </div>
                              </>
                            ) : (
                              <div className="flex justify-between gap-4 text-sm">
                                <span className="text-zinc-500">
                                  Subtotal
                                </span>

                                <span className="font-semibold">
                                  {money(
                                    subtotal
                                  )}
                                </span>
                              </div>
                            )}

                            {hasCoupon && (
                              <div className="mt-2 flex justify-between gap-4 rounded-xl bg-green-50 px-3 py-2 text-sm">
                                <span className="font-bold text-green-700">
                                  🎟️ Cupom{" "}
                                  {order.coupon_code ||
                                    ""}
                                </span>

                                <span className="font-black text-green-700">
                                  - {money(
                                    couponDiscount
                                  )}
                                </span>
                              </div>
                            )}

                            <div className="mt-2 flex justify-between gap-4 text-sm">
                              <span className="text-zinc-500">
                                {pickup
                                  ? "Retirada"
                                  : "Entrega"}
                              </span>

                              <span
                                className={
                                  pickup
                                    ? "font-bold text-green-600"
                                    : "font-semibold"
                                }
                              >
                                {pickup
                                  ? "R$ 0,00"
                                  : money(
                                      order.delivery_fee
                                    )}
                              </span>
                            </div>
                          </div>

                          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-black text-zinc-400">
                                PAGAMENTO
                              </p>

                              <p className="mt-1 text-sm font-bold">
                                {order.payment_method ===
                                "pix"
                                  ? "💠"
                                  : "💳"}{" "}
                                {paymentName(
                                  order.payment_method
                                )}
                              </p>

                              {order.payment_status && (
                                <p
                                  className={`mt-1 text-xs font-bold uppercase ${
                                    paymentPending
                                      ? "text-yellow-600"
                                      : order.payment_status ===
                                          "paid"
                                        ? "text-green-600"
                                        : "text-zinc-400"
                                  }`}
                                >
                                  Status:{" "}
                                  {
                                    order.payment_status
                                  }
                                </p>
                              )}
                            </div>

                            <div className="text-right">
                              <p className="text-xs font-black text-zinc-400">
                                TOTAL
                              </p>

                              <p className="mt-1 text-2xl font-black">
                                {money(
                                  order.total
                                )}
                              </p>
                            </div>
                          </div>

                          {paymentPending && (
                            <div className="mt-5 rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
                              <p className="font-black text-yellow-800">
                                💠 Pagamento ainda não realizado
                              </p>

                              <p className="mt-1 text-sm leading-5 text-yellow-700">
                                Seu pedido só será
                                enviado ao restaurante
                                depois que o pagamento
                                for confirmado.
                              </p>
                            </div>
                          )}
                        </div>

                        {/* =================================
                            BOTÕES
                        ================================= */}

                        <div className="border-t border-zinc-100 p-5">
                          {paymentPending ? (
                            <div className="grid grid-cols-2 gap-3">
                              <Link
                                href={`/pagamento?order=${order.order_id}`}
                                className="flex min-h-14 items-center justify-center rounded-xl bg-red-600 px-3 py-4 text-center font-black text-white transition hover:bg-red-700"
                              >
                                💠 Pagar agora
                              </Link>

                              <button
                                type="button"
                                disabled={
                                  deleting
                                }
                                onClick={() =>
                                  deleteUnpaidOrder(
                                    order.order_id
                                  )
                                }
                                className="min-h-14 rounded-xl border-2 border-red-200 bg-white px-3 py-4 text-center font-black text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:text-zinc-400"
                              >
                                {deleting
                                  ? "Excluindo..."
                                  : "🗑️ Excluir pedido"}
                              </button>
                            </div>
                          ) : active ? (
                            <Link
                              href={`/pedido/${order.order_id}`}
                              className="block w-full rounded-xl bg-red-600 px-5 py-4 text-center font-black text-white transition hover:bg-red-700"
                            >
                              {pickup
                                ? order.status ===
                                  "ready"
                                  ? "🏪 Ver retirada"
                                  : "🏪 Acompanhar retirada"
                                : order.status ===
                                  "delivering"
                                  ? "🛵 Acompanhar entrega"
                                  : "📍 Acompanhar pedido"}
                            </Link>
                          ) : order.status ===
                            "delivered" ? (
                            <div className="grid gap-3 sm:grid-cols-2">
                              <button
                                type="button"
                                disabled={
                                  reorderingOrderId ===
                                  order.order_id
                                }
                                onClick={() =>
                                  reorder(
                                    order
                                  )
                                }
                                className="min-h-14 rounded-xl bg-red-600 px-4 py-4 text-center font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
                              >
                                {reorderingOrderId ===
                                order.order_id
                                  ? "Montando carrinho..."
                                  : "🔁 Pedir novamente"}
                              </button>

                              <Link
                                href={`/avaliar?order=${order.order_id}`}
                                className="flex min-h-14 items-center justify-center rounded-xl border-2 border-yellow-300 bg-yellow-50 px-4 py-4 text-center font-black text-yellow-800 transition hover:bg-yellow-100"
                              >
                                ⭐ Avaliar pedido
                              </Link>

                              <Link
                                href={`/pedido/${order.order_id}`}
                                className="flex min-h-14 items-center justify-center rounded-xl border border-zinc-200 px-4 py-4 text-center font-black transition hover:bg-zinc-50"
                              >
                                🧾 Ver detalhes
                              </Link>

                              <Link
                                href={`/restaurante/${order.restaurant_id}`}
                                className="flex min-h-14 items-center justify-center rounded-xl border border-zinc-200 px-4 py-4 text-center font-black transition hover:bg-zinc-50"
                              >
                                🍽️ Ver cardápio
                              </Link>
                            </div>
                          ) : (
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="rounded-xl bg-red-50 p-4 text-center font-bold text-red-700">
                                Pedido cancelado
                              </div>

                              <Link
                                href={`/restaurante/${order.restaurant_id}`}
                                className="flex items-center justify-center rounded-xl border border-zinc-200 px-4 py-4 text-center font-black transition hover:bg-zinc-50"
                              >
                                🍽️ Voltar ao restaurante
                              </Link>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  }
                )}
              </div>
            </>
          )}
      </div>
    </main>
  );
}