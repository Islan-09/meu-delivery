"use client";

import Link from "next/link";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useParams,
  useRouter,
} from "next/navigation";

import { supabase } from "@/lib/supabase";

type OrderItem = {
  name: string;
  quantity: number;
  unit_price: number | string;
};

type FulfillmentMethod =
  | "delivery"
  | "pickup";

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

type Step = {
  key: string;
  icon: string;
  title: string;
  text: string;
};

type PickupRoute = {
  restaurant_name: string | null;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
};

function money(
  value: number | string | null
) {
  return Number(
    value ?? 0
  ).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function dateTime(
  value: string
) {
  return new Date(
    value
  ).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
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

function paymentName(
  method: string | null
) {
  if (method === "pix") {
    return "PIX";
  }

  if (method === "card") {
    return "Cartão";
  }

  return (
    method || "Não informado"
  );
}

function statusTitle(
  status: string,
  pickup: boolean
) {
  if (pickup) {
    switch (status) {
      case "pending":
        return "Pedido recebido";
      case "accepted":
        return "Pedido aceito";
      case "preparing":
        return "Preparando pedido";
      case "ready":
        return "Pronto para retirada";
      case "delivered":
        return "Retirada concluída";
      case "cancelled":
        return "Pedido cancelado";
      default:
        return "Acompanhamento do pedido";
    }
  }

  switch (status) {
    case "pending":
      return "Pedido recebido";
    case "accepted":
      return "Pedido aceito";
    case "preparing":
      return "Preparando pedido";
    case "ready":
      return "Pedido pronto";
    case "driver_assigned":
      return "Entregador indo buscar";
    case "picked_up":
      return "Pedido retirado";
    case "delivering":
      return "Saiu para entrega";
    case "delivered":
      return "Pedido entregue";
    case "cancelled":
      return "Pedido cancelado";
    default:
      return "Acompanhamento do pedido";
  }
}

function statusText(
  status: string,
  pickup: boolean
) {
  if (pickup) {
    switch (status) {
      case "pending":
        return "Seu pedido foi registrado e está aguardando a próxima etapa.";
      case "accepted":
        return "A loja confirmou que vai preparar seu pedido.";
      case "preparing":
        return "O restaurante está preparando seu pedido.";
      case "ready":
        return "Seu pedido já está pronto para você buscar na loja.";
      case "delivered":
        return "Seu pedido foi retirado com sucesso.";
      case "cancelled":
        return "Este pedido foi cancelado.";
      default:
        return "Acompanhe o andamento do seu pedido.";
    }
  }

  switch (status) {
    case "pending":
      return "Seu pedido foi registrado e está aguardando a próxima etapa.";
    case "accepted":
      return "A loja confirmou que vai preparar seu pedido.";
    case "preparing":
      return "O restaurante está preparando seus produtos.";
    case "ready":
      return "Seu pedido está pronto e aguardando um entregador.";
    case "driver_assigned":
      return "Um entregador aceitou a entrega e está indo buscar o pedido.";
    case "picked_up":
      return "O pedido já foi retirado no restaurante.";
    case "delivering":
      return "Seu pedido está a caminho.";
    case "delivered":
      return "Sua entrega foi concluída.";
    case "cancelled":
      return "Este pedido foi cancelado.";
    default:
      return "Acompanhe o andamento do seu pedido.";
  }
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

function pickupRouteAddressLine1(
  route: PickupRoute | null,
  order: Order
) {
  if (!route) {
    return storeAddressLine1(order);
  }

  return [
    route.street,
    route.number,
  ]
    .filter(Boolean)
    .join(", ");
}

function pickupRouteAddressLine2(
  route: PickupRoute | null,
  order: Order
) {
  if (!route) {
    return storeAddressLine2(order);
  }

  const cityState = [
    route.city,
    route.state,
  ]
    .filter(Boolean)
    .join(" - ");

  return [
    route.neighborhood,
    cityState,
  ]
    .filter(Boolean)
    .join(" • ");
}

function getPickupSteps(): Step[] {
  return [
    {
      key: "pending",
      icon: "🧾",
      title: "Pedido recebido",
      text: "Seu pedido foi registrado.",
    },
    {
      key: "accepted",
      icon: "✅",
      title: "Restaurante aceitou",
      text: "A loja confirmou que vai preparar seu pedido.",
    },
    {
      key: "preparing",
      icon: "👨‍🍳",
      title: "Preparando seu pedido",
      text: "O restaurante está preparando seus produtos.",
    },
    {
      key: "ready",
      icon: "🏪",
      title: "Pronto para retirada",
      text: "Seu pedido já pode ser retirado na loja.",
    },
    {
      key: "delivered",
      icon: "✅",
      title: "Retirada concluída",
      text: "Seu pedido foi retirado com sucesso.",
    },
  ];
}

function getDeliverySteps(): Step[] {
  return [
    {
      key: "pending",
      icon: "🧾",
      title: "Pedido recebido",
      text: "Seu pedido foi registrado.",
    },
    {
      key: "accepted",
      icon: "✅",
      title: "Restaurante aceitou",
      text: "A loja confirmou que vai preparar seu pedido.",
    },
    {
      key: "preparing",
      icon: "👨‍🍳",
      title: "Preparando seu pedido",
      text: "O restaurante está preparando seus produtos.",
    },
    {
      key: "ready",
      icon: "📦",
      title: "Pedido pronto",
      text: "Seu pedido está pronto para coleta.",
    },
    {
      key: "driver_assigned",
      icon: "🛵",
      title: "Entregador a caminho da loja",
      text: "Um entregador aceitou a corrida e está indo buscar o pedido.",
    },
    {
      key: "picked_up",
      icon: "📦",
      title: "Pedido retirado",
      text: "O entregador retirou o pedido no restaurante.",
    },
    {
      key: "delivering",
      icon: "🛵",
      title: "Saiu para entrega",
      text: "Seu pedido está indo até o seu endereço.",
    },
    {
      key: "delivered",
      icon: "🏠",
      title: "Pedido entregue",
      text: "Sua entrega foi concluída.",
    },
  ];
}

function getStepState(
  currentStatus: string,
  stepKey: string,
  pickup: boolean
) {
  if (currentStatus === "cancelled") {
    return "inactive";
  }

  const order = pickup
    ? [
        "pending",
        "accepted",
        "preparing",
        "ready",
        "delivered",
      ]
    : [
        "pending",
        "accepted",
        "preparing",
        "ready",
        "driver_assigned",
        "picked_up",
        "delivering",
        "delivered",
      ];

  const currentIndex =
    order.indexOf(currentStatus);

  const stepIndex =
    order.indexOf(stepKey);

  if (
    currentIndex === -1 ||
    stepIndex === -1
  ) {
    return "inactive";
  }

  if (stepIndex < currentIndex) {
    return "done";
  }

  if (stepIndex === currentIndex) {
    return "current";
  }

  return "inactive";
}

export default function PedidoPage() {
  const router = useRouter();
  const params = useParams();

  const orderId = Array.isArray(
    params.id
  )
    ? params.id[0]
    : params.id;

  const [loading, setLoading] =
    useState(true);

  const [reordering, setReordering] =
    useState(false);

  const [
    actionError,
    setActionError,
  ] =
    useState("");

  const [error, setError] =
    useState("");

  const [order, setOrder] =
    useState<Order | null>(
      null
    );

    const [conversationOrderIds, setConversationOrderIds] =
  useState<string[]>([]);

  const [pickupCode, setPickupCode] =
    useState("");

  const [pickupCodeError, setPickupCodeError] =
    useState("");

  const [pickupRoute, setPickupRoute] =
    useState<PickupRoute | null>(null);

  const [routeLoading, setRouteLoading] =
    useState(false);

  const [routeError, setRouteError] =
    useState("");

const loadOrder =
  useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }

    setError("");

      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      if (!session) {
        sessionStorage.setItem(
          "after-login",
          `/pedido/${orderId}`
        );

        router.replace("/login");
        return;
      }

      const {
        data,
        error: ordersError,
      } = await supabase.rpc(
        "get_my_orders"
      );

      if (ordersError) {
        console.error(
          "Erro pedido:",
          ordersError
        );

        setError(
          "Não foi possível carregar este pedido."
        );

        setLoading(false);
        return;
      }

      const foundBase = (
        (data ?? []) as Order[]
      ).find(
        (item) =>
          item.order_id === orderId
      );

      if (!foundBase) {
        setError(
          "Pedido não encontrado."
        );

        setLoading(false);
        return;
      }

      const relatedOrderIds = (
  (data ?? []) as Order[]
)
  .filter(
    (item) =>
      item.restaurant_id ===
      foundBase.restaurant_id
  )
  .map((item) => item.order_id);

setConversationOrderIds(
  relatedOrderIds.length > 0
    ? relatedOrderIds
    : [foundBase.order_id]
);

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
          "Erro cupom do pedido:",
          couponDetailsError
        );
      }

      const couponRow =
        (
          couponData ??
          []
        ).find(
          (row: {
            order_id:
              string;
          }) =>
            row.order_id ===
            foundBase.order_id
        ) as
          | {
              order_id:
                string;

              coupon_code:
                | string
                | null;

              coupon_discount:
                | number
                | string
                | null;
            }
          | undefined;

      const found: Order = {
        ...foundBase,

        coupon_code:
          couponRow
            ?.coupon_code ??
          foundBase.coupon_code ??
          null,

        coupon_discount:
          couponRow
            ?.coupon_discount ??
          foundBase.coupon_discount ??
          0,
      };

      if (
        isPickupOrder(found) &&
        found.status === "ready" &&
        found.payment_status === "paid"
      ) {
        const {
          data: codeData,
          error: codeError,
        } = await supabase.rpc(
          "get_my_order_pickup_code",
          {
            p_order_id:
              found.order_id,
          }
        );

        if (codeError) {
          console.error(
            "Erro código de retirada:",
            codeError
          );

          setPickupCode("");
          setPickupCodeError(
            "Não foi possível carregar o código de retirada."
          );
        } else {
          setPickupCode(
            typeof codeData === "string"
              ? codeData
                  .trim()
                  .toUpperCase()
              : ""
          );
          setPickupCodeError("");
        }

        const {
          data: routeData,
          error: routeRpcError,
        } = await supabase.rpc(
          "get_my_order_pickup_route",
          {
            p_order_id: found.order_id,
          }
        );

        if (routeRpcError) {
          console.error(
            "Erro localização da loja:",
            routeRpcError
          );
          setPickupRoute(null);
        } else {
          const routeRow = Array.isArray(routeData)
            ? routeData[0]
            : routeData;

          setPickupRoute(
            routeRow
              ? (routeRow as PickupRoute)
              : null
          );
        }
      } else {
        setPickupCode("");
        setPickupCodeError("");
        setPickupRoute(null);
        setRouteError("");
      }

      setOrder(found);
      setLoading(false);
    }, [orderId, router]);

  function openExactPickupRoute() {
    if (!pickupRoute) {
      setRouteError(
        "Não foi possível carregar a localização da loja."
      );
      return;
    }

    const rawLatitude =
      pickupRoute.latitude;
    const rawLongitude =
      pickupRoute.longitude;

    const hasRawCoordinates =
      rawLatitude !== null &&
      rawLatitude !== undefined &&
      rawLongitude !== null &&
      rawLongitude !== undefined;

    const destinationLat =
      hasRawCoordinates
        ? Number(rawLatitude)
        : null;
    const destinationLng =
      hasRawCoordinates
        ? Number(rawLongitude)
        : null;

    const hasValidCoordinates =
      destinationLat !== null &&
      destinationLng !== null &&
      Number.isFinite(destinationLat) &&
      Number.isFinite(destinationLng) &&
      destinationLat >= -90 &&
      destinationLat <= 90 &&
      destinationLng >= -180 &&
      destinationLng <= 180 &&
      !(destinationLat === 0 &&
        destinationLng === 0);

    const destinationAddress = [
      pickupRoute.street,
      pickupRoute.number,
      pickupRoute.neighborhood,
      pickupRoute.city,
      pickupRoute.state,
      pickupRoute.postal_code,
      "Brasil",
    ]
      .filter(Boolean)
      .join(", ");

    if (
      !hasValidCoordinates &&
      !destinationAddress
    ) {
      setRouteError(
        "A loja ainda não possui localização cadastrada."
      );
      return;
    }

    if (!("geolocation" in navigator)) {
      setRouteError(
        "Seu navegador não permite acessar sua localização."
      );
      return;
    }

    setRouteLoading(true);
    setRouteError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const originLat =
          position.coords.latitude;
        const originLng =
          position.coords.longitude;

        const destination =
          hasValidCoordinates
            ? `${destinationLat},${destinationLng}`
            : destinationAddress;

        const mapsUrl =
          `https://www.google.com/maps/dir/?api=1` +
          `&origin=${encodeURIComponent(`${originLat},${originLng}`)}` +
          `&destination=${encodeURIComponent(destination)}` +
          `&travelmode=driving`;

        setRouteLoading(false);
        window.location.href = mapsUrl;
      },
      (geoError) => {
        console.error(
          "Erro ao obter localização:",
          geoError
        );

        setRouteLoading(false);

        if (geoError.code === 1) {
          setRouteError(
            "Permita o acesso à sua localização no navegador para montar a rota saindo de onde você está."
          );
        } else {
          setRouteError(
            "Não conseguimos descobrir onde você está. Ative a localização do aparelho e tente novamente."
          );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000,
      }
    );
  }

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    if (!order) {
      return;
    }

    if (
      ["delivered", "cancelled"].includes(
        order.status
      )
    ) {
      return;
    }

    const interval =
  window.setInterval(() => {
    loadOrder(false);
  }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [order, loadOrder]);

  const pickup = useMemo(
    () =>
      order
        ? isPickupOrder(order)
        : false,
    [order]
  );

  const steps = useMemo(
    () =>
      pickup
        ? getPickupSteps()
        : getDeliverySteps(),
    [pickup]
  );

  // ==========================================
  // PEDIR NOVAMENTE
  // ==========================================

  async function reorderCurrentOrder() {
    if (
      !order ||
      reordering
    ) {
      return;
    }

    setReordering(true);
    setActionError("");

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

    if (reorderError) {
      console.error(
        "Erro repetir pedido:",
        reorderError
      );

      setActionError(
        "Não foi possível montar este pedido novamente."
      );

      setReordering(false);
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
      setActionError(
        "Nenhum produto deste pedido está disponível atualmente."
      );

      setReordering(false);
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
        setReordering(false);
        return;
      }
    }

    localStorage.setItem(
      storageKey,
      JSON.stringify(items)
    );

    window.dispatchEvent(
      new Event(
        "cart-updated"
      )
    );

    router.push(
      "/carrinho"
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7]">
        <p className="font-bold">
          Carregando pedido...
        </p>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="min-h-screen bg-[#f7f7f7]">
        <header className="border-b border-zinc-200 bg-white">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
            <Link
              href="/meus-pedidos"
              className="font-bold text-red-600"
            >
              ← Voltar
            </Link>

            <p className="font-black text-red-600">
              Entrega Paudalho
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-3xl px-4 py-10">
          <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
            <div className="text-5xl">
              ⚠️
            </div>

            <h1 className="mt-4 text-2xl font-black">
              {error || "Pedido não encontrado"}
            </h1>

            <Link
              href="/meus-pedidos"
              className="mt-6 inline-block rounded-xl bg-red-600 px-6 py-4 font-black text-white"
            >
              Voltar aos pedidos
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const subtotal =
    Number(
      order.subtotal ?? 0
    );

  const discount =
    Number(
      order.discount ?? 0
    );

  const subtotalBeforeDiscount =
    subtotal + discount;

  const hasDiscount =
    discount > 0;

  const couponDiscount =
    Number(
      order.coupon_discount ?? 0
    );

  const hasCoupon =
    couponDiscount > 0;

  return (
    <main className="min-h-screen bg-[#f7f7f7] text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link
            href="/meus-pedidos"
            className="font-bold text-red-600"
          >
            ← Voltar
          </Link>

          <p className="font-black text-red-600">
            Entrega Paudalho
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8">
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

          <h1 className="text-3xl font-black">
            {pickup &&
            order.status === "ready"
              ? "Seu pedido está pronto!"
              : "Acompanhe seu pedido"}
          </h1>

          <p className="mt-1 text-zinc-500">
            {pickup &&
            order.status === "ready"
              ? "Vá até o restaurante e use o código abaixo para confirmar a retirada."
              : pickup
                ? "Acompanhe cada etapa até seu pedido ficar pronto para retirada."
                : "Acompanhe cada etapa até seu pedido chegar."}
          </p>
        </div>

        {pickup &&
          order.status === "ready" && (
          <section className="mt-6 overflow-hidden rounded-3xl border-2 border-green-200 bg-white shadow-sm">
            <div className="bg-green-600 px-6 py-5 text-white">
              <p className="text-xs font-black uppercase tracking-wider text-green-100">
                🏪 RETIRADA NA LOJA
              </p>

              <h2 className="mt-2 text-3xl font-black">
                Pedido pronto para retirar
              </h2>

              <p className="mt-2 text-sm font-semibold text-green-50">
                Seu pedido já está esperando por você.
              </p>
            </div>

            <div className="p-6">
              <div className="rounded-3xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-5 py-6 text-center">
                <p className="text-xs font-black uppercase tracking-wider text-zinc-500">
                  Seu código de retirada
                </p>

                {pickupCode ? (
                  <p className="mt-3 text-5xl font-black tracking-[0.28em] text-zinc-900 sm:text-6xl">
                    {pickupCode}
                  </p>
                ) : pickupCodeError ? (
                  <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">
                    ⚠️ {pickupCodeError}
                  </div>
                ) : (
                  <p className="mt-4 text-sm font-bold text-zinc-500">
                    Carregando código...
                  </p>
                )}

                <p className="mt-4 text-sm font-semibold leading-6 text-zinc-600">
                  Mostre este código ao restaurante somente quando receber seu pedido.
                </p>
              </div>

              <div className="mt-5 rounded-2xl bg-orange-50 p-4">
                <p className="text-xs font-black uppercase text-orange-600">
                  Onde retirar
                </p>

                <p className="mt-2 font-black text-zinc-900">
                  {pickupRoute?.restaurant_name ||
                    order.restaurant_name}
                </p>

                {pickupRouteAddressLine1(
                  pickupRoute,
                  order
                ) && (
                  <p className="mt-2 text-sm font-semibold text-zinc-700">
                    🏪 {pickupRouteAddressLine1(
                      pickupRoute,
                      order
                    )}
                  </p>
                )}

                {pickupRouteAddressLine2(
                  pickupRoute,
                  order
                ) && (
                  <p className="mt-1 text-sm text-zinc-600">
                    {pickupRouteAddressLine2(
                      pickupRoute,
                      order
                    )}
                  </p>
                )}

                <div className="mt-4 rounded-xl border border-orange-200 bg-white p-3 text-sm">
                  <p className="font-black text-zinc-900">
                    📍 Ponto de partida: sua localização atual
                  </p>
                  <p className="mt-1 text-zinc-500">
                    Ao tocar no botão, o navegador vai pedir sua localização para criar a rota exata.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    openExactPickupRoute
                  }
                  disabled={routeLoading}
                  className="mt-4 flex w-full items-center justify-center rounded-xl bg-red-600 px-5 py-4 text-center font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
                >
                  {routeLoading
                    ? "📍 Pegando sua localização..."
                    : "🗺️ Abrir rota exata"}
                </button>

                {routeError && (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold leading-5 text-red-700">
                    ⚠️ {routeError}
                  </div>
                )}

                <p className="mt-3 text-xs leading-5 text-orange-700">
                  A rota usa sua posição atual como origem e o pino confirmado da loja como destino.
                </p>
              </div>

              <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4">
                <p className="font-black text-red-700">
                  🔐 Não compartilhe antes da retirada
                </p>

                <p className="mt-1 text-sm leading-5 text-red-600">
                  O restaurante usa esse código para confirmar que o pedido foi entregue a você.
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="mt-6 rounded-3xl bg-white shadow-sm">
          <div className="flex items-start justify-between gap-4 p-6">
            <div>
              <p className="text-sm font-bold text-zinc-400">
                {order.restaurant_name}
              </p>

              <p className="mt-1 text-sm text-zinc-400">
                Pedido #
                {order.order_id
                  .slice(0, 8)
                  .toUpperCase()}
              </p>

              <h2 className="mt-5 text-3xl font-black">
                {statusTitle(
                  order.status,
                  pickup
                )}
              </h2>

              <p className="mt-2 max-w-xl text-zinc-500">
                {statusText(
                  order.status,
                  pickup
                )}
              </p>
            </div>

            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-zinc-50 text-3xl">
              {pickup ? "🏪" : "🧾"}
            </div>
          </div>

          <div className="border-t border-zinc-100 px-6 py-4">
            <p className="text-xs font-black uppercase text-zinc-400">
              Última atualização
            </p>

            <p className="mt-2 font-bold">
              {dateTime(
                order.updated_at ||
                  order.created_at
              )}
            </p>
          </div>
        </section>

        <section className="mt-4 rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase text-zinc-400">
            Seu pedido
          </p>

          <h3 className="mt-2 text-2xl font-black">
            Itens do pedido
          </h3>

          <div className="mt-5 space-y-3">
            {(order.items ?? []).map(
              (item, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-zinc-100 p-4"
                >
                  <div className="flex justify-between gap-4">
                    <div>
                      <p className="font-black">
                        {item.quantity}x{" "}
                        {item.name}
                      </p>

                      <p className="mt-1 text-sm text-zinc-500">
                        Preço unitário:{" "}
                        {money(
                          item.unit_price
                        )}
                      </p>
                    </div>

                    <p className="font-black">
                      {money(
                        Number(
                          item.unit_price
                        ) * item.quantity
                      )}
                    </p>
                  </div>
                </div>
              )
            )}
          </div>

          {pickup ? (
            <div className="mt-5 rounded-2xl border border-orange-200 bg-orange-50 p-4">
              <p className="text-xs font-black text-orange-600">
                RETIRADA NA LOJA
              </p>

              <p className="mt-2 font-black text-orange-800">
                Você vai buscar o pedido
                no restaurante
              </p>

              {(storeAddressLine1(order) ||
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
          ) : (
            order.address_street && (
              <div className="mt-5 rounded-2xl bg-zinc-50 p-4">
                <p className="text-xs font-black text-zinc-400">
                  ENDEREÇO DE ENTREGA
                </p>

                <p className="mt-2 text-sm font-semibold">
                  📍{" "}
                  {order.address_street}
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
            )
          )}
        </section>

        <section className="mt-4 rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase text-zinc-400">
            Acompanhamento
          </p>

          <h3 className="mt-2 text-2xl font-black">
            Etapas do pedido
          </h3>

          {order.status ===
            "cancelled" && (
            <div className="mt-5 rounded-2xl bg-red-50 p-4 font-semibold text-red-700">
              Este pedido foi cancelado.
            </div>
          )}

          <div className="mt-5 space-y-4">
            {steps.map((step, index) => {
              const state =
                getStepState(
                  order.status,
                  step.key,
                  pickup
                );

              return (
                <div
                  key={step.key}
                  className="flex gap-4"
                >
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm ${
                        state === "current"
                          ? "border-red-600 bg-red-600 text-white"
                          : state === "done"
                            ? "border-green-600 bg-green-50 text-green-700"
                            : "border-zinc-200 bg-white text-zinc-400"
                      }`}
                    >
                      {step.icon}
                    </div>

                    {index <
                      steps.length -
                        1 && (
                      <div className="h-8 w-px bg-zinc-200" />
                    )}
                  </div>

                  <div className="pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className={`font-black ${
                          state === "current"
                            ? "text-zinc-900"
                            : state === "done"
                              ? "text-zinc-800"
                              : "text-zinc-400"
                        }`}
                      >
                        {step.title}
                      </p>

                      {state ===
                        "current" && (
                        <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-black text-red-600">
                          AGORA
                        </span>
                      )}
                    </div>

                    <p
                      className={`mt-1 text-sm ${
                        state === "current"
                          ? "text-zinc-500"
                          : state === "done"
                            ? "text-zinc-500"
                            : "text-zinc-400"
                      }`}
                    >
                      {step.text}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        <section className="mt-4 rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase text-zinc-400">
            Resumo do pedido
          </p>

          <div className="mt-4 rounded-2xl bg-zinc-50 p-4">
            {hasDiscount ? (
              <>
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-zinc-500">
                    Subtotal dos produtos
                  </span>

                  <span className="font-semibold">
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

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase text-zinc-400">
                Pagamento
              </p>

              <p className="mt-2 font-bold">
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
                    order.payment_status ===
                    "paid"
                      ? "text-green-600"
                      : order.payment_status ===
                          "pending"
                        ? "text-yellow-600"
                        : "text-zinc-400"
                  }`}
                >
                  Status:{" "}
                  {order.payment_status}
                </p>
              )}
            </div>

            <div className="text-right">
              <p className="text-xs font-black uppercase text-zinc-400">
                Total
              </p>

              <p className="mt-2 text-2xl font-black">
                {money(order.total)}
              </p>
            </div>
          </div>
        </section>

        {order.status ===
          "delivered" &&
          order.payment_status ===
            "paid" && (
          <section className="mt-4 rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase text-zinc-400">
              Depois do pedido
            </p>

            <h2 className="mt-2 text-xl font-black">
              Peça novamente ou conte como foi sua experiência.
            </h2>

            {actionError && (
              <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">
                ⚠️ {actionError}
              </div>
            )}

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                disabled={
                  reordering
                }
                onClick={
                  reorderCurrentOrder
                }
                className="rounded-xl bg-red-600 px-4 py-4 font-black text-white transition hover:bg-red-700 disabled:bg-zinc-300"
              >
                {reordering
                  ? "Montando..."
                  : "🔁 Pedir novamente"}
              </button>

              <Link
                href={`/avaliar?order=${order.order_id}`}
                className="rounded-xl border-2 border-yellow-300 bg-yellow-50 px-4 py-4 text-center font-black text-yellow-800 transition hover:bg-yellow-100"
              >
                ⭐ Avaliar
              </Link>

              <Link
                href={`/restaurante/${order.restaurant_id}`}
                className="rounded-xl border border-zinc-200 px-4 py-4 text-center font-black transition hover:bg-zinc-50"
              >
                🍽️ Ver cardápio
              </Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}