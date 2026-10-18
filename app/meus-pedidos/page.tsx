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
  [key: string]: unknown;
};

type FulfillmentMethod =
  | "delivery"
  | "pickup";

type OrderView =
  | "payment"
  | "active"
  | "finished"
  | "cancelled";

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
  cancellation_reason?: string | null;

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

type ReorderCartEntry = {
  name?: string | null;
  product_name?: string | null;
  product?: { id?: string | null; name?: string | null } | null;
  product_id?: string | null;
  id?: string | null;
  quantity?: number | string | null;
};

function normalizeProductName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function unavailableProductNames(
  originalItems: OrderItem[],
  availableCartItems: ReorderCartEntry[]
): string[] {
  const originalNames = originalItems
    .map((item) => item.name?.trim())
    .filter((name): name is string => Boolean(name));

  // Se nenhum item sobreviveu à validação do banco, todos os produtos
  // do pedido original estão indisponíveis.
  if (availableCartItems.length === 0) {
    return [...new Set(originalNames)];
  }

  const availableNameCounts = new Map<string, number>();
  let namesFound = 0;

  for (const item of availableCartItems) {
    const name =
      item.product?.name?.trim() ||
      item.name?.trim() ||
      item.product_name?.trim() ||
      "";
    if (!name) continue;

    namesFound += 1;
    const key = normalizeProductName(name);
    const quantity = Math.max(1, Number(item.quantity ?? 1) || 1);
    availableNameCounts.set(
      key,
      (availableNameCounts.get(key) ?? 0) + quantity
    );
  }

  // Se o RPC não retornar nomes para os itens disponíveis, não inventa
  // quais produtos faltaram; o contador do banco continuará sendo exibido.
  if (namesFound === 0) return [];

  const missing: string[] = [];
  const remaining = new Map(availableNameCounts);

  for (const item of originalItems) {
    const name = item.name?.trim();
    if (!name) continue;

    const key = normalizeProductName(name);
    const requestedQuantity = Math.max(1, Number(item.quantity ?? 1) || 1);
    const availableQuantity = remaining.get(key) ?? 0;

    if (availableQuantity < requestedQuantity) {
      missing.push(name);
      remaining.set(key, 0);
    } else {
      remaining.set(key, availableQuantity - requestedQuantity);
    }
  }

  return [...new Set(missing)];
}

type UnavailableProduct = {
  name: string;
  imageUrl: string | null;
};

type ReorderNotice = {
  title: string;
  summary: string;
  unavailableNames: string[];
  unavailableProducts?: UnavailableProduct[];
};

function formatUnavailableMessage(
  count: number,
  names: string[],
  noAvailableProducts = false
): ReorderNotice {
  const uniqueNames = [...new Set(names.filter((name) => name.trim()))];
  const itemCount = Math.max(count, uniqueNames.length);

  if (noAvailableProducts) {
    return {
      title: "Nenhum produto disponível",
      summary: "Nenhum produto deste pedido está disponível atualmente.",
      unavailableNames: uniqueNames,
    };
  }

  const countSentence = itemCount === 1
    ? "1 produto do pedido anterior não está disponível na loja."
    : `${itemCount} produtos do pedido anterior não estão disponíveis na loja.`;

  return {
    title: "Não foi possível repetir este pedido",
    summary: uniqueNames.length > 0
      ? countSentence
      : `${countSentence} Não foi possível identificar o nome do produto indisponível.`,
    unavailableNames: uniqueNames,
  };
}

function normalizeImageUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();
  if (/^https?:\/\//i.test(raw) || raw.startsWith("data:image/")) return raw;

  // Produto pode guardar o caminho do arquivo em vez da URL completa.
  const path = raw
    .replace(/^\/+/, "")
    .replace(/^storage\/v1\/object\/public\/product-images\//, "");
  if (!path || path.includes(" ")) return null;
  return supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
}

function extractProductImage(source: unknown): string | null {
  if (!source || typeof source !== "object") return null;
  const record = source as Record<string, unknown>;
  const keys = [
    "image_url",
    "imageUrl",
    "product_image_url",
    "photo_url",
    "photoUrl",
    "picture_url",
    "pictureUrl",
    "thumbnail_url",
    "thumbnailUrl",
    "image_path",
    "photo_path",
    "image",
    "photo",
    "picture",
    "thumbnail",
  ];

  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "string") {
      const url = normalizeImageUrl(candidate);
      if (url) return url;
    }
    if (candidate && typeof candidate === "object") {
      const nested = candidate as Record<string, unknown>;
      const nestedUrl = normalizeImageUrl(
        nested.url ?? nested.publicUrl ?? nested.public_url ?? nested.path
      );
      if (nestedUrl) return nestedUrl;
    }
  }
  return null;
}

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

  const [reorderMessage, setReorderMessage] = useState<ReorderNotice | null>(null);

  async function buildUnavailableProductDetails(
    order: Order,
    notice: ReorderNotice
  ): Promise<ReorderNotice> {
    const names = [...new Set(notice.unavailableNames.map((name) => name.trim()).filter(Boolean))];
    if (names.length === 0) {
      return { ...notice, unavailableProducts: [] };
    }

    let currentProducts: Record<string, unknown>[] = [];
    let unavailableProductRows: Record<string, unknown>[] = [];

    try {
      // Esta função SECURITY DEFINER lê a foto do produto mesmo quando active=false,
      // respeitando no servidor a propriedade do pedido pelo cliente autenticado.
      const { data: unavailableData, error: unavailableError } = await supabase.rpc(
        "get_my_reorder_unavailable_products",
        { p_order_id: order.order_id }
      );

      if (unavailableError) {
        console.warn(
          "Não foi possível buscar os dados dos produtos indisponíveis pelo RPC:",
          unavailableError
        );
      } else {
        unavailableProductRows = (unavailableData ?? []) as Record<string, unknown>[];
      }
    } catch (lookupError) {
      console.warn("Erro ao buscar fotos dos produtos indisponíveis pelo RPC:", lookupError);
    }

    // Fallback para fotos públicas, se a função RPC ainda não tiver sido criada.
    // Esta consulta pode não retornar produtos desativados por causa das políticas RLS.
    try {
      const { data, error: productsError } = await supabase
        .from("products")
        .select("*")
        .eq("restaurant_id", order.restaurant_id);

      if (productsError) {
        console.warn("Não foi possível buscar as fotos pelo catálogo público:", productsError);
      } else {
        currentProducts = (data ?? []) as Record<string, unknown>[];
      }
    } catch (lookupError) {
      console.warn("Erro ao consultar imagens no catálogo:", lookupError);
    }

    const originalItems = (order.items ?? []) as (OrderItem & Record<string, unknown>)[];
    const details = names.map((name) => {
      const normalized = normalizeProductName(name);
      const originalItem = originalItems.find(
        (item) => normalizeProductName(String(item.name ?? "")) === normalized
      );
      const originalProductId = String(
        originalItem?.product_id ??
        originalItem?.productId ??
        (originalItem?.product && typeof originalItem.product === "object"
          ? (originalItem.product as Record<string, unknown>).id
          : "") ??
        ""
      );

      const rpcProduct = unavailableProductRows.find((product) =>
        (originalProductId && String(product.product_id ?? "") === originalProductId) ||
        normalizeProductName(String(product.product_name ?? "")) === normalized
      );
      const rpcImage = normalizeImageUrl(rpcProduct?.image_url);
      const originalImage = extractProductImage(originalItem);
      const matchedProduct = currentProducts.find((product) =>
        normalizeProductName(String(product.name ?? "")) === normalized
      );
      const currentImage = extractProductImage(matchedProduct);
      return {
        name,
        imageUrl: rpcImage ?? originalImage ?? currentImage,
      };
    });

    return { ...notice, unavailableProducts: details };
  }

  useEffect(() => {
    if (!reorderMessage) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setReorderMessage(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [reorderMessage]);

  // ==========================================
  // CARREGAR PEDIDOS
  // ==========================================

  const loadOrders =
    useCallback(
      async (
        firstLoad = false
      ) => {
        if (firstLoad) {
          setLoading(true);
          setError("");
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

        const {
          data: cancellationData,
          error: cancellationError,
        } = await supabase.rpc("get_my_order_cancellation_reasons");

        if (cancellationError) {
          console.error(
            "Erro ao carregar motivos de cancelamento:",
            cancellationError
          );
        }

        const cancellationReasonByOrder = new Map<string, string>(
          ((cancellationData ?? []) as Array<{
            order_id: string;
            cancellation_reason: string | null;
          }>)
            .filter((row) => Boolean(row.cancellation_reason?.trim()))
            .map((row) => [row.order_id, row.cancellation_reason!.trim()])
        );

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

                cancellation_reason:
                  cancellationReasonByOrder.get(order.order_id) ??
                  order.cancellation_reason ??
                  null,

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

        if (firstLoad) {
          setError("");
        }

        setLoading(false);
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

  async function reorder(order: Order) {
    if (reorderingOrderId) return;

    setReorderMessage(null);
    setReorderingOrderId(order.order_id);

    try {
      const { data, error: reorderError } = await supabase.rpc(
        "get_my_reorder_cart",
        { p_order_id: order.order_id }
      );

      if (reorderError) {
        console.error("Erro ao repetir pedido:", reorderError);
        setReorderMessage({
          title: "Não foi possível repetir este pedido",
          summary: "Não conseguimos verificar a disponibilidade dos produtos. Tente novamente em alguns instantes.",
          unavailableNames: [],
          unavailableProducts: [],
        });
        return;
      }

      const row = Array.isArray(data) ? data[0] : data;
      const availableItems = Array.isArray(row?.cart_items)
        ? (row.cart_items as ReorderCartEntry[])
        : [];

      // O RPC pode retornar os itens disponíveis sem os nomes. Buscamos os nomes
      // atuais para identificar com clareza o que está faltando no pedido antigo.
      let itemsForComparison = availableItems;
      const needProductNames = availableItems.some((item) =>
        !(
          item.product?.name?.trim() ||
          item.name?.trim() ||
          item.product_name?.trim()
        )
      );

      if (needProductNames && availableItems.length > 0) {
        const productIds = [...new Set(
          availableItems
            .map((item) => String(item.product?.id ?? item.product_id ?? item.id ?? ""))
            .filter(Boolean)
        )];

        if (productIds.length > 0) {
          const { data: currentProducts, error: productNameError } = await supabase
            .from("products")
            .select("id, name")
            .in("id", productIds);

          if (productNameError) {
            console.warn(
              "Não foi possível consultar os nomes dos produtos disponíveis:",
              productNameError
            );
          } else {
            const productNameById = new Map<string, string>(
              (currentProducts ?? []).map(
                (product: { id: string; name: string }) => [product.id, product.name] as [string, string]
              )
            );
            itemsForComparison = availableItems.map((item) => {
              const id = String(item.product?.id ?? item.product_id ?? item.id ?? "");
              return {
                ...item,
                name:
                  item.product?.name ??
                  item.name ??
                  item.product_name ??
                  productNameById.get(id) ??
                  null,
              };
            });
          }
        }
      }

      const missingNames = unavailableProductNames(
        order.items ?? [],
        itemsForComparison
      );
      const reportedUnavailable = Math.max(
        0,
        Number(row?.unavailable_items ?? 0) || 0
      );
      const unavailableCount = Math.max(
        reportedUnavailable,
        missingNames.length
      );

      // Bloqueia a recompra se faltar pelo menos um produto. O carrinho não é
      // alterado e a página não navega para o checkout.
      if (unavailableCount > 0 || missingNames.length > 0) {
        const notice = formatUnavailableMessage(
          unavailableCount,
          missingNames,
          availableItems.length === 0
        );
        setReorderMessage(await buildUnavailableProductDetails(order, notice));
        return;
      }

      if (availableItems.length === 0) {
        const notice = formatUnavailableMessage(
          0,
          (order.items ?? []).map((item) => item.name).filter(Boolean),
          true
        );
        setReorderMessage(await buildUnavailableProductDetails(order, notice));
        return;
      }

      const restaurantId = String(row?.restaurant_id ?? order.restaurant_id);

      // A recompra usa o pedido antigo como uma sessão separada no checkout.
      // Não sobrescreve nem limpa o carrinho que o cliente já tinha salvo.
      router.push(
        `/checkout?restaurant=${encodeURIComponent(restaurantId)}&reorder_order=${encodeURIComponent(order.order_id)}`
      );
    } catch (reorderUnexpectedError) {
      console.error("Erro inesperado ao repetir pedido:", reorderUnexpectedError);
      setReorderMessage({
        title: "Não foi possível repetir este pedido",
        summary: "Ocorreu um problema ao consultar os produtos. O carrinho não foi alterado. Tente novamente.",
        unavailableNames: [],
        unavailableProducts: [],
      });
    } finally {
      // Garante que o botão nunca fique preso no estado de carregamento,
      // mesmo se a RPC, o Storage ou a navegação falharem.
      setReorderingOrderId("");
    }
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
    orders.filter((order) => order.status === "delivered");

  const cancelledOrders =
    orders.filter((order) => order.status === "cancelled");

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

  if (
    selectedView ===
    "cancelled"
  ) {
    visibleOrders =
      cancelledOrders;
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

        </div>

        {error && (
          <div className="mt-6 rounded-2xl bg-red-50 p-4 font-semibold text-red-700">
            {error}
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

              <div className="mt-8 grid gap-2 rounded-2xl bg-white p-2 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
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

                <button
                  type="button"
                  onClick={() => setSelectedView("cancelled")}
                  className={`rounded-xl px-3 py-4 text-center font-black transition ${
                    selectedView === "cancelled"
                      ? "bg-red-600 text-white shadow-sm"
                      : "bg-white text-zinc-600 hover:bg-red-50"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span>❌ Cancelados</span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs ${
                        selectedView === "cancelled"
                          ? "bg-white text-red-600"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {cancelledOrders.length}
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
                    {selectedView === "payment"
                      ? "💠"
                      : selectedView === "active"
                        ? "🕐"
                        : selectedView === "cancelled"
                          ? "❌"
                          : "✅"}
                  </div>

                  <h2 className="mt-4 text-xl font-black">
                    {selectedView === "payment"
                      ? "Nenhum pagamento pendente"
                      : selectedView === "active"
                        ? "Nenhum pedido em andamento"
                        : selectedView === "cancelled"
                          ? "Nenhum pedido cancelado"
                          : "Nenhum pedido finalizado"}
                  </h2>

                  <p className="mt-2 text-zinc-500">
                    {selectedView === "payment"
                      ? "Pedidos que ainda precisam ser pagos aparecerão aqui."
                      : selectedView === "active"
                        ? "Pedidos pagos e em preparação ou entrega aparecerão aqui."
                        : selectedView === "cancelled"
                          ? "Seus pedidos cancelados e os motivos informados pelo restaurante aparecerão aqui."
                          : "Seus pedidos entregues aparecerão aqui."}
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
                          {order.status === "cancelled" && (
                            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4">
                              <p className="text-xs font-black uppercase tracking-wide text-red-700">
                                Motivo do cancelamento
                              </p>
                              <p className="mt-2 whitespace-pre-wrap break-words text-sm font-semibold leading-6 text-red-900">
                                {order.cancellation_reason?.trim() ||
                                  "O restaurante não informou o motivo do cancelamento."}
                              </p>
                            </div>
                          )}

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
                                🔁 Pedir novamente
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
                          ) : order.status === "cancelled" ? (
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center font-bold text-red-700">
                                ❌ Pedido cancelado
                              </div>

                              <Link
                                href={`/restaurante/${order.restaurant_id}`}
                                className="flex items-center justify-center rounded-xl border border-zinc-200 px-4 py-4 text-center font-black transition hover:bg-zinc-50"
                              >
                                🍽️ Voltar ao restaurante
                              </Link>
                            </div>
                          ) : (
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="rounded-xl bg-green-50 p-4 text-center font-bold text-green-700">
                                ✅ Pedido finalizado
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

      {reorderMessage && (
        <div
          role="presentation"
          onClick={() => setReorderMessage(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="reorder-unavailable-title"
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-xl overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl"
          >
            <header className="flex items-start gap-4 border-b border-amber-100 bg-amber-50 px-5 py-5 sm:px-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-2xl" aria-hidden="true">
                ⚠️
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-800">
                  Repetir pedido
                </p>
                <h2 id="reorder-unavailable-title" className="mt-1 text-xl font-black text-zinc-900 sm:text-2xl">
                  {reorderMessage.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {reorderMessage.summary}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReorderMessage(null)}
                aria-label="Fechar aviso"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-2xl text-zinc-500 transition hover:bg-amber-100 hover:text-zinc-900"
              >
                ×
              </button>
            </header>

            {(reorderMessage.unavailableProducts?.length ?? 0) > 0 && (
              <div className="max-h-[55vh] overflow-y-auto px-5 py-5 sm:px-6">
                <p className="text-xs font-black uppercase tracking-wide text-zinc-500">
                  Produto(s) indisponível(is)
                </p>
                <div className="mt-3 space-y-3">
                  {reorderMessage.unavailableProducts!.map((product, index) => (
                    <div key={`${product.name}-${index}`} className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-3">
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="h-full w-full object-cover"
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-3xl" aria-label="Foto indisponível">
                            🍽️
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="break-words font-black text-zinc-900">{product.name}</p>
                        <span className="mt-2 inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700">
                          Indisponível na loja
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <footer className="border-t border-zinc-100 bg-zinc-50 px-5 py-4 sm:px-6">
              <p className="text-sm leading-6 text-zinc-500">
                Seu carrinho não foi alterado e o checkout não foi aberto.
              </p>
              <button
                type="button"
                onClick={() => setReorderMessage(null)}
                className="mt-4 w-full rounded-xl bg-red-600 px-5 py-3.5 text-sm font-black text-white transition hover:bg-red-700"
              >
                Entendi
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}