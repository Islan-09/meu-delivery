"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { useSearchParams } from "next/navigation";

import { supabase } from "@/lib/supabase";

import ChatPedido from "@/app/components/ChatPedido";

type FulfillmentMethod =
  | "delivery"
  | "pickup";

type OrderStatus =
  | "pending"
  | "accepted"
  | "preparing"
  | "ready"
  | "driver_assigned"
  | "picked_up"
  | "delivering"
  | "delivered"
  | "cancelled";

type OrderItemAddon = {
  id: string;
  option_id: string | null;

  group_name: string;
  option_name: string;

  quantity: number;

  unit_price:
    | number
    | string;

  total:
    | number
    | string;
};

type OrderItem = {
  id: string;

  product_id:
    | string
    | null;

  name: string;
  quantity: number;

  base_unit_price:
    | number
    | string
    | null;

  unit_price:
    | number
    | string;

  total:
    | number
    | string;

  notes:
    | string
    | null;

  addons:
    OrderItemAddon[];
};

type Order = {
  order_id: string;

  restaurant_id: string;

  status:
    OrderStatus;

  fulfillment_method:
    FulfillmentMethod;

  payment_method:
    | string
    | null;

  payment_status:
    | "pending"
    | "paid"
    | "failed"
    | "refunded";

  subtotal:
    | number
    | string;

  delivery_fee:
    | number
    | string;

  discount:
    | number
    | string
    | null;

  coupon_code:
    | string
    | null;

  coupon_discount:
    | number
    | string
    | null;

  total:
    | number
    | string;

  created_at: string;

  customer_name:
    | string
    | null;

  customer_phone:
    | string
    | null;

  street:
    | string
    | null;

  number:
    | string
    | null;

  complement:
    | string
    | null;

  neighborhood:
    | string
    | null;

  city:
    | string
    | null;

  state:
    | string
    | null;

  items:
    OrderItem[];
};

  
type OrderCardProps = {
  order: Order;
  updating: string;
 unreadCount?: number;

  onOpen: (
    orderId: string
  ) => void;

  onAccept: (
    orderId: string
  ) => void;

  onCancel: (
    orderId: string
  ) => void;

  onMessages: (
    orderId: string
  ) => void;
};


type OrderColumnProps = {
  title: string;
  subtitle: string;
  icon: string;
  orders: Order[];
  headerClass: string;
  countClass: string;
  updating: string;
  unreadCounts: Record<string, number>;

  onOpen: (
    orderId: string
  ) => void;

  onAccept: (
    orderId: string
  ) => void;

  onCancel: (
    orderId: string
  ) => void;

  onMessages: (
    orderId: string
  ) => void;
};

type OrderSearchStatus =
  | "all"
  | "new"
  | "preparing"
  | "ready"
  | "delivery"
  | "finished"
  | "cancelled";

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

function dateTime(
  value: string
) {
  return new Date(
    value
  ).toLocaleString(
    "pt-BR",
    {
      dateStyle:
        "short",

      timeStyle:
        "short",
    }
  );
}

function statusName(
  status:
    OrderStatus
) {
  const names: Record<
    OrderStatus,
    string
  > = {
    pending:
      "Novo pedido",

    accepted:
      "Pedido aceito",

    preparing:
      "Preparando",

    ready:
      "Pedido pronto",

    driver_assigned:
      "Entregador a caminho",

    picked_up:
      "Pedido coletado",

    delivering:
      "Em entrega",

    delivered:
      "Concluído",

    cancelled:
      "Cancelado",
  };

  return names[
    status
  ];
}

function statusClass(
  status:
    OrderStatus
) {
  switch (
    status
  ) {
    case "pending":
      return "bg-red-100 text-red-700";

    case "accepted":
      return "bg-blue-100 text-blue-700";

    case "preparing":
      return "bg-orange-100 text-orange-700";

    case "ready":
      return "bg-purple-100 text-purple-700";

    case "driver_assigned":
    case "picked_up":
    case "delivering":
      return "bg-blue-100 text-blue-700";

    case "delivered":
      return "bg-green-100 text-green-700";

    case "cancelled":
      return "bg-zinc-200 text-zinc-600";

    default:
      return "bg-zinc-100 text-zinc-700";
  }
}

function paymentName(
  value:
    | string
    | null
) {
  if (
    value === "pix"
  ) {
    return "PIX";
  }

  if (
    value === "card"
  ) {
    return "Cartão";
  }

  return (
    value ||
    "Não informado"
  );
}

function escapePrintHtml(
  value:
    | string
    | number
    | null
    | undefined
) {
  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}

function thermalPrintBaseStyles() {
  return `
    @page {
      size: 80mm auto;
      margin: 4mm;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: Arial, Helvetica, sans-serif;
    }

    body {
      width: 72mm;
      margin: 0 auto;
      font-size: 12px;
      line-height: 1.35;
    }

    .center {
      text-align: center;
    }

    .strong {
      font-weight: 800;
    }

    .big {
      font-size: 18px;
      font-weight: 900;
    }

    .medium {
      font-size: 14px;
      font-weight: 800;
    }

    .small {
      font-size: 10px;
    }

    .divider {
      margin: 8px 0;
      border-top: 1px dashed #000;
    }

    .row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
    }

    .item {
      margin: 8px 0;
    }

    .addon {
      margin-left: 10px;
      font-size: 11px;
    }

    .note {
      margin-top: 5px;
      padding: 6px;
      border: 1px solid #000;
      font-weight: 700;
    }

    .total {
      font-size: 16px;
      font-weight: 900;
    }

    .type {
      margin-top: 5px;
      font-size: 16px;
      font-weight: 900;
    }

    .break-word {
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    @media print {
      body {
        width: 72mm;
      }
    }
  `;
}

function buildKitchenPrintHtml(
  order: Order,
  restaurantName: string
) {
  const itemsHtml =
    (
      order.items ??
      []
    )
      .map(
        (
          item
        ) => {
          const addonsHtml =
            Array.isArray(
              item.addons
            )
              ? item.addons
                  .map(
                    (
                      addon
                    ) => `
                      <div class="addon">
                        + ${escapePrintHtml(
                          addon.quantity
                        )}x ${escapePrintHtml(
                          addon.option_name
                        )}
                      </div>
                    `
                  )
                  .join("")
              : "";

          const noteHtml =
            item.notes &&
            item.notes.trim()
              ? `
                <div class="note">
                  OBS: ${escapePrintHtml(
                    item.notes
                  )}
                </div>
              `
              : "";

          return `
            <div class="item">
              <div class="medium">
                ${escapePrintHtml(
                  item.quantity
                )}x ${escapePrintHtml(
                  item.name
                )}
              </div>

              ${addonsHtml}
              ${noteHtml}
            </div>
          `;
        }
      )
      .join("");

  const typeText =
    order.fulfillment_method ===
    "pickup"
      ? "RETIRADA NA LOJA"
      : "ENTREGA";

  const shortId =
    order.order_id
      .slice(
        0,
        8
      )
      .toUpperCase();

  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Comanda ${escapePrintHtml(
          shortId
        )}</title>
        <style>
          ${thermalPrintBaseStyles()}
        </style>
      </head>

      <body>
        <div class="center strong">
          ${escapePrintHtml(
            restaurantName ||
              "Restaurante"
          )}
        </div>

        <div class="center big">
          COZINHA
        </div>

        <div class="center type">
          ${escapePrintHtml(
            typeText
          )}
        </div>

        <div class="divider"></div>

        <div class="big">
          PEDIDO #${escapePrintHtml(
            shortId
          )}
        </div>

        <div>
          ${escapePrintHtml(
            dateTime(
              order.created_at
            )
          )}
        </div>

        <div class="divider"></div>

        ${itemsHtml}

        <div class="divider"></div>

        <div class="center strong">
          FIM DO PEDIDO
        </div>

        <script>
          window.addEventListener("load", function () {
            setTimeout(function () {
              window.print();
            }, 200);
          });

          window.onafterprint = function () {
            window.close();
          };
        </script>
      </body>
    </html>
  `;
}

function buildPackagingPrintHtml(
  order: Order,
  restaurantName: string
) {
  const itemsHtml =
    (
      order.items ??
      []
    )
      .map(
        (
          item
        ) => {
          const addonsHtml =
            Array.isArray(
              item.addons
            )
              ? item.addons
                  .map(
                    (
                      addon
                    ) => `
                      <div class="addon row">
                        <span>
                          + ${escapePrintHtml(
                            addon.quantity
                          )}x ${escapePrintHtml(
                            addon.option_name
                          )}
                        </span>

                        <span>
                          ${escapePrintHtml(
                            money(
                              addon.total
                            )
                          )}
                        </span>
                      </div>
                    `
                  )
                  .join("")
              : "";

          const noteHtml =
            item.notes &&
            item.notes.trim()
              ? `
                <div class="note">
                  OBS: ${escapePrintHtml(
                    item.notes
                  )}
                </div>
              `
              : "";

          return `
            <div class="item">
              <div class="row">
                <span class="strong">
                  ${escapePrintHtml(
                    item.quantity
                  )}x ${escapePrintHtml(
                    item.name
                  )}
                </span>

                <span class="strong">
                  ${escapePrintHtml(
                    money(
                      item.total
                    )
                  )}
                </span>
              </div>

              ${addonsHtml}
              ${noteHtml}
            </div>
          `;
        }
      )
      .join("");

  const isPickup =
    order.fulfillment_method ===
    "pickup";

  const subtotal =
    Number(
      order.subtotal ?? 0
    );

  const discount =
    Number(
      order.discount ?? 0
    );

  const subtotalBeforeDiscount =
    subtotal +
    discount;

  const hasDiscount =
    discount > 0;

  const couponDiscount =
    Number(
      order.coupon_discount ?? 0
    );

  const hasCoupon =
    couponDiscount > 0;

  const fulfillmentHtml =
    isPickup
      ? `
        <div class="strong">
          RETIRADA NA LOJA
        </div>
      `
      : `
        <div class="strong">
          ENDEREÇO DE ENTREGA
        </div>

        <div class="break-word">
          ${escapePrintHtml(
            order.street
          )}${order.number
            ? `, ${escapePrintHtml(
                order.number
              )}`
            : ""}
        </div>

        ${
          order.complement
            ? `
              <div class="break-word">
                ${escapePrintHtml(
                  order.complement
                )}
              </div>
            `
            : ""
        }

        <div class="break-word">
          ${escapePrintHtml(
            order.neighborhood
          )}
        </div>

        <div class="break-word">
          ${escapePrintHtml(
            order.city
          )} - ${escapePrintHtml(
            order.state
          )}
        </div>
      `;

  const shortId =
    order.order_id
      .slice(
        0,
        8
      )
      .toUpperCase();

  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Pedido ${escapePrintHtml(
          shortId
        )}</title>

        <style>
          ${thermalPrintBaseStyles()}
        </style>
      </head>

      <body>
        <div class="center strong">
          ENTREGA PAUDALHO
        </div>

        <div class="center big">
          ${escapePrintHtml(
            restaurantName ||
              "Restaurante"
          )}
        </div>

        <div class="center type">
          ${isPickup
            ? "RETIRADA NA LOJA"
            : "ENTREGA"}
        </div>

        <div class="divider"></div>

        <div class="big">
          PEDIDO #${escapePrintHtml(
            shortId
          )}
        </div>

        <div>
          ${escapePrintHtml(
            dateTime(
              order.created_at
            )
          )}
        </div>

        <div class="divider"></div>

        <div class="strong">
          CLIENTE
        </div>

        <div class="break-word">
          ${escapePrintHtml(
            order.customer_name ||
              "Cliente"
          )}
        </div>

        ${
          order.customer_phone
            ? `
              <div>
                Tel: ${escapePrintHtml(
                  order.customer_phone
                )}
              </div>
            `
            : ""
        }

        <div class="divider"></div>

        ${fulfillmentHtml}

        <div class="divider"></div>

        <div class="strong">
          ITENS
        </div>

        ${itemsHtml}

        <div class="divider"></div>

        ${hasDiscount
          ? `
            <div class="row">
              <span>Subtotal produtos</span>
              <span>${escapePrintHtml(
                money(
                  subtotalBeforeDiscount
                )
              )}</span>
            </div>

            <div class="row">
              <span>Desconto produtos</span>
              <span>- ${escapePrintHtml(
                money(
                  discount
                )
              )}</span>
            </div>

            <div class="row">
              <span>Subtotal c/ desconto</span>
              <span>${escapePrintHtml(
                money(
                  subtotal
                )
              )}</span>
            </div>
          `
          : `
            <div class="row">
              <span>Subtotal</span>
              <span>${escapePrintHtml(
                money(
                  subtotal
                )
              )}</span>
            </div>
          `}

        ${hasCoupon
          ? `
            <div class="row">
              <span>Cupom ${escapePrintHtml(
                order.coupon_code ||
                  ""
              )}</span>
              <span>- ${escapePrintHtml(
                money(
                  couponDiscount
                )
              )}</span>
            </div>
          `
          : ""}

        <div class="row">
          <span>
            ${isPickup
              ? "Retirada"
              : "Entrega"}
          </span>

          <span>
            ${isPickup
              ? "R$ 0,00"
              : escapePrintHtml(
                  money(
                    order.delivery_fee
                  )
                )}
          </span>
        </div>

        <div class="divider"></div>

        <div class="row total">
          <span>
            TOTAL
          </span>

          <span>
            ${escapePrintHtml(
              money(
                order.total
              )
            )}
          </span>
        </div>

        <div class="divider"></div>

        <div>
          Pagamento: <span class="strong">${escapePrintHtml(
            paymentName(
              order.payment_method
            )
          )}</span>
        </div>

        <div>
          Status: <span class="strong">${
            order.payment_status ===
            "paid"
              ? "PAGO"
              : escapePrintHtml(
                  order.payment_status
                ).toUpperCase()
          }</span>
        </div>

        <div class="divider"></div>

        <div class="center strong">
          Obrigado pela preferência!
        </div>

        <div class="center small">
          Comprovante do pedido - não substitui documento fiscal.
        </div>

        <script>
          window.addEventListener("load", function () {
            setTimeout(function () {
              window.print();
            }, 200);
          });

          window.onafterprint = function () {
            window.close();
          };
        </script>
      </body>
    </html>
  `;
}

function openPrintWindow(
  html: string
) {
  const printWindow =
    window.open(
      "",
      "_blank",
      "width=430,height=760"
    );

  if (
    !printWindow
  ) {
    window.alert(
      "O navegador bloqueou a janela de impressão. Libere pop-ups para este site e tente novamente."
    );

    return;
  }

  printWindow.document.open();
  printWindow.document.write(
    html
  );
  printWindow.document.close();
}

function normalizeSearchText(
  value:
    | string
    | null
    | undefined
) {
  return (
    value ??
    ""
  )
    .normalize(
      "NFD"
    )
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .trim();
}

function orderDateKey(
  value: string
) {
  const date =
    new Date(
      value
    );

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() +
        1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${day}`;
}

  // ==========================================
  // CARD PEQUENO
  // ==========================================

  
function OrderCard({
  order,
  updating,
  onOpen,
  onAccept,
  onCancel,
  onMessages,
  unreadCount = 0,
}: OrderCardProps) {
    const isPickup =
      order.fulfillment_method ===
      "pickup";

    const itemCount =
      (
        order.items ??
        []
      ).reduce(
        (
          total,
          item
        ) =>
          total +
          Number(
            item.quantity ??
              0
          ),
        0
      );

    return (
      <article
        onClick={() =>
          onOpen(
            order.order_id
          )
        }
      className="w-full cursor-pointer overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
    >
      {/* CONTEÚDO */}

      <div className="p-4">
        {/* TIPO */}

        <div className="flex items-start justify-between gap-2">
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${
              isPickup
                ? "bg-orange-100 text-orange-700"
                : "bg-blue-100 text-blue-700"
            }`}
          >
            {isPickup
              ? "🏪 Retirada"
              : "🛵 Entrega"}
          </span>

          <p className="text-lg font-black">
            {money(
              order.total
            )}
          </p>
        </div>

        {/* STATUS */}

        <div className="mt-3">
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${statusClass(
              order.status
            )}`}
          >
            {statusName(
              order.status
            )}
          </span>
        </div>

        {/* CLIENTE */}

        <div className="mt-4">
          <p className="truncate font-black">
            {order.customer_name ||
              "Cliente"}
          </p>

          <p className="mt-1 text-sm text-zinc-500">
            {
              itemCount
            }{" "}
            {itemCount ===
            1
              ? "item"
              : "itens"}
          </p>
        </div>

        {/* NÚMERO */}

        <div className="mt-4 border-t border-zinc-100 pt-3">
          <p className="text-[11px] font-bold text-zinc-400">
            #
            {order.order_id
              .slice(
                0,
                8
              )
              .toUpperCase()}
          </p>

          <p className="mt-1 text-[11px] text-zinc-400">
            {dateTime(
              order.created_at
            )}
          </p>
        </div>
      </div>

      {/* ==================================
          NOVO PEDIDO
      ================================== */}

      {order.status ===
        "pending" &&
        order.payment_status ===
          "paid" && (
        <div className="grid grid-cols-2 gap-2 border-t border-zinc-100 p-3">
          <button
            type="button"
            disabled={
              updating ===
              order.order_id
            }
            onClick={(
              event
            ) => {
              event.stopPropagation();

              onAccept(
                order.order_id
              );
            }}
            className="rounded-xl bg-green-600 px-2 py-2.5 text-xs font-black text-white transition hover:bg-green-700 disabled:bg-zinc-300"
          >
            ✅ Aceitar
          </button>

          <button
            type="button"
            disabled={
              updating ===
              order.order_id
            }
            onClick={(
              event
            ) => {
              event.stopPropagation();

              onCancel(
                order.order_id
              );
            }}
            className="rounded-xl border border-red-300 px-2 py-2.5 text-xs font-black text-red-600 transition hover:bg-red-50 disabled:text-zinc-300"
          >
            Cancelar
          </button>
        </div>
      )}


      {/* ==================================
          MENSAGENS E VER PEDIDO
      ================================== */}

      <div className="grid grid-cols-2 gap-2 border-t border-zinc-100 p-3">
        <button
  type="button"
  onClick={(event) => {
    event.stopPropagation();
    onMessages(order.order_id);
  }}
  className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-2 py-2.5 text-xs font-black text-white transition hover:bg-blue-700"
>
  <span>💬 Mensagens</span>

  {unreadCount > 0 && (
    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-black text-white">
      {unreadCount > 99 ? "99+" : unreadCount}
    </span>
  )}
</button>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen(order.order_id);
          }}
          className="rounded-xl border border-zinc-200 px-2 py-2.5 text-xs font-black text-zinc-700 transition hover:bg-zinc-50"
        >
          Ver pedido →
        </button>
      </div>
    </article>
  );
}

// ==========================================
// COLUNA
// ==========================================

function OrderColumn({
  title,
  subtitle,
  icon,
  orders,
  headerClass,
  countClass,
  updating,
 unreadCounts,
  onOpen,
  onAccept,
  onCancel,
  onMessages,
}: OrderColumnProps) {
  return (
    <section className="min-w-0">
      {/* CABEÇALHO */}

      <div
        className={`rounded-2xl border p-4 ${headerClass}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-black">
              {icon}{" "}
              {title}
            </h3>

            <p className="mt-1 text-xs leading-5 opacity-70">
              {
                subtitle
              }
            </p>
          </div>

          <span
            className={`flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-black ${countClass}`}
          >
            {
              orders.length
            }
          </span>
        </div>
      </div>

      {/* CARDS */}

      <div className="mt-3 space-y-3">
        {orders.length ===
        0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-white/60 p-5 text-center">
            <p className="text-2xl">
              ✓
            </p>

            <p className="mt-2 text-xs font-bold text-zinc-400">
              Nenhum pedido
            </p>
          </div>
        ) : (
          orders.map(
            (
              order
            ) => (
              <OrderCard
                key={
                  order.order_id
                }
                order={
                  order
                }
                updating={
                  updating
                }
                onOpen={
                  onOpen
                }
                onAccept={
                  onAccept
                }
                onCancel={
                  onCancel
                }
                onMessages={
                  onMessages
                }
                unreadCount={unreadCounts[order.order_id] ?? 0}
              />
            )
          )
        )}
      </div>
    </section>
  );
}

type PedidosSectionProps = {
  onOpenMessages: (orderId: string) => void;
   unreadCounts: Record<string, number>;
};

export default function PedidosSection({
  onOpenMessages,
   unreadCounts,
}: PedidosSectionProps) {
  const searchParams =
    useSearchParams();

  const restaurantId =
    searchParams.get(
      "restaurant"
    ) ?? "";

const isDemoMode =
  searchParams.get("demo") === "1";

  const [
    orders,
    setOrders,
  ] =
    useState<Order[]>(
      []
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    updating,
    setUpdating,
  ] =
    useState("");

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    restaurantName,
    setRestaurantName,
  ] =
    useState("");

  const [
    searchTerm,
    setSearchTerm,
  ] =
    useState("");

  const [
    dateFrom,
    setDateFrom,
  ] =
    useState("");

  const [
    dateTo,
    setDateTo,
  ] =
    useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState<OrderSearchStatus>(
      "all"
    );

  function clearOrderFilters() {
    setSearchTerm(
      ""
    );

    setDateFrom(
      ""
    );

    setDateTo(
      ""
    );

    setStatusFilter(
      "all"
    );
  }

  const [
    selectedOrderId,
    setSelectedOrderId,
  ] =
    useState<
      string | null
    >(null);

  // ==========================================
  // CÓDIGO DO MOTOBOY
  // ==========================================

  const [
    driverCodes,
    setDriverCodes,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    driverCodeErrors,
    setDriverCodeErrors,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  // ==========================================
  // CÓDIGO DO CLIENTE
  // ==========================================

  const [
    customerCodes,
    setCustomerCodes,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    customerCodeErrors,
    setCustomerCodeErrors,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  // ==========================================
  // CARREGAR PEDIDOS
  // ==========================================

  const loadOrders =
    useCallback(
      async () => {
        if (
          !restaurantId
        ) {
          setOrders(
            []
          );

          setError(
            "Loja não informada."
          );

          setLoading(
            false
          );

          return;
        }

        const [
          ordersResponse,
          discountsResponse,
          couponsResponse,
        ] =
          await Promise.all([
            supabase.rpc(
              "get_my_restaurant_orders"
            ),

            supabase.rpc(
              "get_my_restaurant_order_discounts",
              {
                p_restaurant_id:
                  restaurantId,
              }
            ),

            supabase.rpc(
              "get_my_restaurant_order_coupon_details",
              {
                p_restaurant_id:
                  restaurantId,
              }
            ),
          ]);

        const {
          data,
          error:
            ordersError,
        } =
          ordersResponse;

        if (
          ordersError
        ) {
          console.error(
            "Erro pedidos:",
            ordersError
          );

          setError(
            "Não foi possível carregar os pedidos."
          );

          setLoading(
            false
          );

          return;
        }

        if (
          discountsResponse.error
        ) {
          console.error(
            "Erro descontos dos pedidos:",
            discountsResponse.error
          );
        }

        const discountByOrder =
          new Map<
            string,
            number
          >(
            (
              discountsResponse.data ??
              []
            ).map(
              (row: {
                order_id: string;
                discount:
                  | number
                  | string
                  | null;
              }) => [
                row.order_id,
                Number(
                  row.discount ?? 0
                ),
              ]
            )
          );

        if (
          couponsResponse.error
        ) {
          console.error(
            "Erro cupons dos pedidos:",
            couponsResponse.error
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
              couponsResponse.data ??
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

        const paidOrders =
          (
            (
              data ??
              []
            ) as Order[]
          )
            .filter(
              (order) =>
                order.restaurant_id ===
                  restaurantId &&
                order.payment_status ===
                  "paid"
            )
            .map(
              (order) => ({
                ...order,
                discount:
                  discountByOrder.has(
                    order.order_id
                  )
                    ? discountByOrder.get(
                        order.order_id
                      ) ?? 0
                    : Number(
                        order.discount ?? 0
                      ),

                coupon_code:
                  couponByOrder.get(
                    order.order_id
                  )?.coupon_code ??
                  order.coupon_code ??
                  null,

                coupon_discount:
                  couponByOrder.get(
                    order.order_id
                  )?.coupon_discount ??
                  Number(
                    order.coupon_discount ??
                      0
                  ),
              })
            );

        setOrders(
          paidOrders
        );

        setError("");

        setLoading(
          false
        );
      },
      [
        restaurantId,
      ]
    );

  useEffect(() => {
    let cancelled =
      false;

    async function loadRestaurantName() {
      if (
        !restaurantId
      ) {
        setRestaurantName(
          ""
        );

        return;
      }

      const {
        data,
        error:
          restaurantError,
      } =
        await supabase
          .from(
            "restaurants"
          )
          .select(
            "name"
          )
          .eq(
            "id",
            restaurantId
          )
          .maybeSingle();

      if (
        cancelled
      ) {
        return;
      }

      if (
        restaurantError
      ) {
        console.error(
          "Erro nome restaurante:",
          restaurantError
        );

        setRestaurantName(
          ""
        );

        return;
      }

      setRestaurantName(
        data?.name ??
          ""
      );
    }

    loadRestaurantName();

    return () => {
      cancelled =
        true;
    };
  }, [
    restaurantId,
  ]);

  useEffect(() => {
    loadOrders();
  }, [
    loadOrders,
  ]);

  // ==========================================
  // ATUALIZAÇÃO AUTOMÁTICA
  // ==========================================

  useEffect(() => {
    const interval =
      window.setInterval(
        () => {
          loadOrders();
        },
        3000
      );

    return () => {
      window.clearInterval(
        interval
      );
    };
  }, [
    loadOrders,
  ]);

  // ==========================================
  // ALTERAR STATUS
  // ==========================================

  async function updateStatus(
    orderId: string,
    status:
      OrderStatus
  ) {
    setUpdating(
      orderId
    );

    setError("");

    const currentOrder =
      orders.find(
        (order) =>
          order.order_id ===
          orderId
      );

    if (
      !currentOrder ||
      currentOrder.restaurant_id !==
        restaurantId ||
      currentOrder.payment_status !==
        "paid"
    ) {
      setError(
        "Este pedido não pertence à loja aberta ou ainda não teve o pagamento confirmado."
      );

      setUpdating(
        ""
      );

      await loadOrders();

      return;
    }

    const {
      error:
        updateError,
    } =
      await supabase.rpc(
        "restaurant_update_order_status",
        {
          p_order_id:
            orderId,

          p_status:
            status,
        }
      );

    if (
      updateError
    ) {
      console.error(
        "Erro status:",
        updateError
      );

      if (
        updateError.message.includes(
          "ORDER_NOT_PAID"
        )
      ) {
        setError(
          "Este pedido ainda não teve o pagamento confirmado."
        );
      } else {
        setError(
          "Não foi possível alterar o status do pedido."
        );
      }

      setUpdating(
        ""
      );

      return;
    }

    await loadOrders();

    setUpdating(
      ""
    );
  }

  // ==========================================
  // ACEITAR
  // ==========================================

  async function acceptOrder(
    orderId: string
  ) {
    await updateStatus(
      orderId,
      "accepted"
    );
  }

  // ==========================================
  // CANCELAR
  // ==========================================

  async function cancelOrder(
    orderId: string
  ) {
    const confirmed =
      window.confirm(
        "Tem certeza que deseja cancelar este pedido?"
      );

    if (
      !confirmed
    ) {
      return;
    }

    await updateStatus(
      orderId,
      "cancelled"
    );
  }

  // ==========================================
  // CONFIRMAR RETIRADA DO CLIENTE
  // ==========================================

  async function confirmCustomerPickup(
    orderId: string
  ) {
    const code =
      (
        customerCodes[
          orderId
        ] ??
        ""
      )
        .trim()
        .toUpperCase();

    if (
      code.length !==
      4
    ) {
      setCustomerCodeErrors(
        (
          current
        ) => ({
          ...current,

          [orderId]:
            "Digite o código de 4 caracteres do cliente.",
        })
      );

      return;
    }

    setUpdating(
      orderId
    );

    setCustomerCodeErrors(
      (
        current
      ) => ({
        ...current,

        [orderId]:
          "",
      })
    );

    const {
      data,
      error:
        rpcError,
    } =
      await supabase.rpc(
        "restaurant_confirm_customer_pickup",
        {
          p_order_id:
            orderId,

          p_code:
            code,
        }
      );

    if (
      rpcError
    ) {
      console.error(
        "Erro retirada:",
        rpcError
      );

      let message =
        "Não foi possível confirmar a retirada.";

      if (
        rpcError.message.includes(
          "TOO_MANY_ATTEMPTS"
        )
      ) {
        message =
          "Muitas tentativas incorretas.";
      }

      if (
        rpcError.message.includes(
          "CODE_ALREADY_USED"
        )
      ) {
        message =
          "Esse código já foi utilizado.";
      }

      setCustomerCodeErrors(
        (
          current
        ) => ({
          ...current,

          [orderId]:
            message,
        })
      );

      setUpdating(
        ""
      );

      return;
    }

    if (
      data !== true
    ) {
      setCustomerCodeErrors(
        (
          current
        ) => ({
          ...current,

          [orderId]:
            "Código incorreto. Confira com o cliente.",
        })
      );

      setCustomerCodes(
        (
          current
        ) => ({
          ...current,

          [orderId]:
            "",
        })
      );

      setUpdating(
        ""
      );

      return;
    }

    setCustomerCodes(
      (
        current
      ) => ({
        ...current,

        [orderId]:
          "",
      })
    );

    await loadOrders();

    setUpdating(
      ""
    );
  }

  // ==========================================
  // CONFIRMAR COLETA DO MOTOBOY
  // ==========================================

  async function confirmDriverPickup(
    orderId: string
  ) {
    const code =
      (
        driverCodes[
          orderId
        ] ??
        ""
      )
        .trim()
        .toUpperCase();

    if (
      code.length !==
      4
    ) {
      setDriverCodeErrors(
        (
          current
        ) => ({
          ...current,

          [orderId]:
            "Digite o código de coleta de 4 caracteres.",
        })
      );

      return;
    }

    setUpdating(
      orderId
    );

    setDriverCodeErrors(
      (
        current
      ) => ({
        ...current,

        [orderId]:
          "",
      })
    );

    const {
      data,
      error:
        rpcError,
    } =
      await supabase.rpc(
        "restaurant_confirm_pickup_code",
        {
          p_order_id:
            orderId,

          p_code:
            code,
        }
      );

    if (
      rpcError
    ) {
      console.error(
        "Erro coleta:",
        rpcError
      );

      let message =
        "Não foi possível confirmar a coleta.";

      if (
        rpcError.message.includes(
          "TOO_MANY_ATTEMPTS"
        )
      ) {
        message =
          "Muitas tentativas incorretas.";
      }

      setDriverCodeErrors(
        (
          current
        ) => ({
          ...current,

          [orderId]:
            message,
        })
      );

      setUpdating(
        ""
      );

      return;
    }

    if (
      data !== true
    ) {
      setDriverCodeErrors(
        (
          current
        ) => ({
          ...current,

          [orderId]:
            "Código incorreto. Confira com o entregador.",
        })
      );

      setDriverCodes(
        (
          current
        ) => ({
          ...current,

          [orderId]:
            "",
        })
      );

      setUpdating(
        ""
      );

      return;
    }

    setDriverCodes(
      (
        current
      ) => ({
        ...current,

        [orderId]:
          "",
      })
    );

    await loadOrders();

    setUpdating(
      ""
    );
  }

  // ==========================================
  // PEDIDO SELECIONADO
  // ==========================================

  const selectedOrder =
    selectedOrderId
      ? orders.find(
          (
            order
          ) =>
            order.order_id ===
            selectedOrderId
        ) ??
        null
      : null;

  // ==========================================
  // CARREGANDO
  // ==========================================

  if (
    loading
  ) {
    return (
      <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
        <p className="font-bold">
          Carregando pedidos...
        </p>
      </div>
    );
  }

  // ==========================================
  // DETALHES DO PEDIDO
  // ==========================================

  if (
    selectedOrder
  ) {
    const isPickup =
      selectedOrder.fulfillment_method ===
      "pickup";

    const selectedSubtotal =
      Number(
        selectedOrder.subtotal ?? 0
      );

    const selectedDiscount =
      Number(
        selectedOrder.discount ?? 0
      );

    const selectedSubtotalBeforeDiscount =
      selectedSubtotal +
      selectedDiscount;

    const selectedHasDiscount =
      selectedDiscount > 0;

    const selectedCouponDiscount =
      Number(
        selectedOrder.coupon_discount ??
          0
      );

    const selectedHasCoupon =
      selectedCouponDiscount >
      0;

    return (
      <div className="max-w-5xl">
        {/* VOLTAR */}

        <button
          type="button"
          onClick={() =>
            setSelectedOrderId(
              null
            )
          }
          className="mb-5 rounded-xl border border-zinc-200 bg-white px-4 py-3 font-black transition hover:bg-zinc-50"
        >
          ← Voltar para pedidos
        </button>

        ```
    {/* CHAT COM O CLIENTE */}

    <div
  id="chat-pedido"
  className="mb-5 overflow-hidden rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm"
>
      <h3 className="mb-4 text-xl font-black">
        💬 Chat com o cliente
      </h3>

      <ChatPedido orderId={selectedOrder.order_id} />
    </div>

        {/* PEDIDO */}

        <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
          {/* TOPO */}

          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-100 p-6">
            <div>
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${
                  isPickup
                    ? "bg-orange-100 text-orange-700"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                {isPickup
                  ? "🏪 RETIRADA NA LOJA"
                  : "🛵 ENTREGA"}
              </span>

              <h2 className="mt-4 text-3xl font-black">
                {statusName(
                  selectedOrder.status
                )}
              </h2>

              <p className="mt-2 text-zinc-500">
                Pedido #
                {selectedOrder.order_id
                  .slice(
                    0,
                    8
                  )
                  .toUpperCase()}
                {" • "}
                {dateTime(
                  selectedOrder.created_at
                )}
              </p>
            </div>

            <p className="text-3xl font-black">
              {money(
                selectedOrder.total
              )}
            </p>
          </div>

          {/* ==================================
              NOTA / IMPRESSÃO DO PEDIDO
          ================================== */}

          <div className="border-b border-zinc-100 bg-zinc-50 px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black text-zinc-900">
                  🧾 Nota do pedido / impressão
                </p>

                <p className="mt-1 text-xs text-zinc-500">
                  Escolha a via da cozinha ou a via que acompanha a embalagem.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    openPrintWindow(
                      buildKitchenPrintHtml(
                        selectedOrder,
                        restaurantName
                      )
                    )
                  }
                  className="rounded-xl bg-zinc-900 px-4 py-3 text-sm font-black text-white transition hover:bg-zinc-800"
                >
                  👨‍🍳 Imprimir cozinha
                </button>

                <button
                  type="button"
                  onClick={() =>
                    openPrintWindow(
                      buildPackagingPrintHtml(
                        selectedOrder,
                        restaurantName
                      )
                    )
                  }
                  className="rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white transition hover:bg-red-700"
                >
                  🛍️ Imprimir embalagem
                </button>
              </div>
            </div>
          </div>

          {/* CORPO */}

          <div className="grid lg:grid-cols-[1fr_330px]">
            {/* ITENS */}

            <div className="p-6">
              <h3 className="text-xl font-black">
                Itens do pedido
              </h3>

              <div className="mt-5 space-y-4">
                {(
                  selectedOrder.items ??
                  []
                ).map(
                  (
                    item
                  ) => (
                    <div
                      key={
                        item.id
                      }
                      className="rounded-2xl border border-zinc-100 p-4"
                    >
                      <div className="flex justify-between gap-4">
                        <div>
                          <p className="font-black">
                            {
                              item.quantity
                            }
                            x{" "}
                            {
                              item.name
                            }
                          </p>

                          {item.base_unit_price !==
                            null &&
                            item.base_unit_price !==
                              undefined && (
                              <p className="mt-1 text-sm text-zinc-500">
                                Preço no pedido:{" "}
                                {money(
                                  item.base_unit_price
                                )}
                              </p>
                            )}
                        </div>

                        <p className="font-black">
                          {money(
                            item.total
                          )}
                        </p>
                      </div>

                      {/* ADICIONAIS */}

                      {Array.isArray(
                        item.addons
                      ) &&
                        item.addons.length >
                          0 && (
                          <div className="mt-4 rounded-xl bg-zinc-50 p-4">
                            <p className="text-xs font-black uppercase text-zinc-400">
                              Adicionais
                            </p>

                            <div className="mt-3 space-y-2">
                              {item.addons.map(
                                (
                                  addon
                                ) => (
                                  <div
                                    key={
                                      addon.id
                                    }
                                    className="flex justify-between gap-4 text-sm"
                                  >
                                    <span>
                                      {
                                        addon.quantity
                                      }
                                      x{" "}
                                      {
                                        addon.option_name
                                      }
                                    </span>

                                    <strong>
                                      +{" "}
                                      {money(
                                        addon.total
                                      )}
                                    </strong>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )}

                      {/* OBSERVAÇÃO */}

                      {item.notes &&
                        item.notes.trim() && (
                          <div className="mt-4 rounded-xl bg-yellow-50 p-4">
                            <p className="text-xs font-black uppercase text-yellow-700">
                              Observação
                            </p>

                            <p className="mt-2 text-sm font-semibold text-yellow-900">
                              {
                                item.notes
                              }
                            </p>
                          </div>
                        )}
                    </div>
                  )
                )}
              </div>

              {/* VALORES */}

              <div className="mt-6 space-y-3 border-t border-zinc-100 pt-5">
                {selectedHasDiscount ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">
                        Subtotal dos produtos
                      </span>

                      <strong>
                        {money(
                          selectedSubtotalBeforeDiscount
                        )}
                      </strong>
                    </div>

                    <div className="flex justify-between rounded-xl bg-green-50 px-3 py-2">
                      <span className="font-bold text-green-700">
                        Desconto nos produtos
                      </span>

                      <strong className="text-green-700">
                        - {money(
                          selectedDiscount
                        )}
                      </strong>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-zinc-500">
                        Subtotal com desconto
                      </span>

                      <strong>
                        {money(
                          selectedSubtotal
                        )}
                      </strong>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">
                      Subtotal
                    </span>

                    <strong>
                      {money(
                        selectedSubtotal
                      )}
                    </strong>
                  </div>
                )}

                {selectedHasCoupon && (
                  <div className="flex justify-between rounded-xl bg-green-50 px-3 py-2">
                    <span className="font-bold text-green-700">
                      🎟️ Cupom{" "}
                      {selectedOrder.coupon_code ||
                        ""}
                    </span>

                    <strong className="text-green-700">
                      - {money(
                        selectedCouponDiscount
                      )}
                    </strong>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-zinc-500">
                    {isPickup
                      ? "Retirada"
                      : "Entrega"}
                  </span>

                  <strong
                    className={
                      isPickup
                        ? "text-green-600"
                        : ""
                    }
                  >
                    {isPickup
                      ? "R$ 0,00"
                      : money(
                          selectedOrder.delivery_fee
                        )}
                  </strong>
                </div>

                <div className="flex justify-between border-t border-zinc-100 pt-4 text-lg">
                  <strong>
                    Total
                  </strong>

                  <strong>
                    {money(
                      selectedOrder.total
                    )}
                  </strong>
                </div>
              </div>
            </div>

            {/* CLIENTE */}

            <div className="border-t border-zinc-100 bg-zinc-50 p-6 lg:border-l lg:border-t-0">
              <h3 className="font-black">
                Cliente
              </h3>

              <p className="mt-3 font-bold">
                {selectedOrder.customer_name ||
                  "Cliente"}
              </p>

              {selectedOrder.customer_phone && (
                <p className="mt-1 text-sm text-zinc-500">
                  📱{" "}
                  {
                    selectedOrder.customer_phone
                  }
                </p>
              )}

              {/* ENTREGA / RETIRADA */}

              {isPickup ? (
                <>
                  <h3 className="mt-6 font-black">
                    Como receber
                  </h3>

                  <div className="mt-3 rounded-2xl border border-orange-200 bg-orange-50 p-4">
                    <p className="font-black text-orange-700">
                      🏪 Retirada na loja
                    </p>

                    <p className="mt-2 text-sm text-orange-700">
                      O cliente virá buscar o
                      pedido no restaurante.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="mt-6 font-black">
                    Endereço de entrega
                  </h3>

                  <p className="mt-3 text-sm leading-6">
                    📍{" "}
                    {
                      selectedOrder.street
                    }

                    {selectedOrder.number
                      ? `, ${selectedOrder.number}`
                      : ""}

                    <br />

                    {selectedOrder.complement && (
                      <>
                        {
                          selectedOrder.complement
                        }
                        <br />
                      </>
                    )}

                    {
                      selectedOrder.neighborhood
                    }

                    <br />

                    {
                      selectedOrder.city
                    }{" "}
                    -{" "}
                    {
                      selectedOrder.state
                    }
                  </p>
                </>
              )}

              {/* PAGAMENTO */}

              <h3 className="mt-6 font-black">
                Pagamento
              </h3>

              <p className="mt-2">
                {selectedOrder.payment_method ===
                "pix"
                  ? "💠"
                  : "💳"}{" "}
                {paymentName(
                  selectedOrder.payment_method
                )}
              </p>

              <p className="mt-2 text-xs font-black uppercase text-zinc-400">
                Status:{" "}
                {
                  selectedOrder.payment_status
                }
              </p>
            </div>
          </div>


          {/* ==================================
              AÇÕES
          ================================== */}

          <div className="border-t border-zinc-100 p-6">
            {/* NOVO */}

            {selectedOrder.status === "pending" &&
              selectedOrder.payment_status === "paid" && (
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={updating === selectedOrder.order_id}
                    onClick={() =>
                      acceptOrder(selectedOrder.order_id)
                    }
                    className="rounded-xl bg-green-600 px-6 py-3 font-black text-white disabled:bg-zinc-300"
                  >
                    ✅ Aceitar pedido
                  </button>

                  <button
                    type="button"
                    disabled={updating === selectedOrder.order_id}
                    onClick={() =>
                      cancelOrder(selectedOrder.order_id)
                    }
                    className="rounded-xl border border-red-500 px-6 py-3 font-black text-red-600 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </div>
              )}

            {/* MENSAGENS — DISPONÍVEL EM TODAS AS ETAPAS */}

            <div className="mt-3">
              <button
                type="button"
                onClick={() =>
                  document
                    .getElementById("chat-pedido")
                    ?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    })
                }
                className="rounded-xl bg-blue-600 px-6 py-3 font-black text-white hover:bg-blue-700"
              >
                💬 Mensagens
              </button>
            </div>

            {/* ACEITO */}

            {selectedOrder.status === "accepted" && (
              <button
                type="button"
                disabled={updating === selectedOrder.order_id}
                onClick={() =>
                  updateStatus(selectedOrder.order_id, "preparing")
                }
                className="rounded-xl bg-orange-500 px-6 py-3 font-black text-white disabled:bg-zinc-300"
              >
                👨‍🍳 Começar preparo
              </button>
            )}

            {/* PREPARANDO */}

            {selectedOrder.status === "preparing" && (
              <button
                type="button"
                disabled={updating === selectedOrder.order_id}
                onClick={() =>
                  updateStatus(selectedOrder.order_id, "ready")
                }
                className="rounded-xl bg-green-600 px-6 py-3 font-black text-white disabled:bg-zinc-300"
              >
                {isPickup
                  ? "🏪 Pedido pronto para retirada"
                  : "📦 Pedido pronto"}
              </button>
            )}

            {/* ==================================
                RETIRADA NA LOJA
            ================================== */}

            {selectedOrder.status === "ready" && isPickup && (
              <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
                <p className="text-lg font-black text-orange-800">
                  🏪 Aguardando cliente
                </p>

                <p className="mt-2 text-sm text-orange-700">
                  Peça ao cliente o código de retirada de 4 caracteres.
                </p>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input
                    value={customerCodes[selectedOrder.order_id] ?? ""}
                    onChange={(event) => {
                      const value = event.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, "")
                        .slice(0, 4);

                      setCustomerCodes((current) => ({
                        ...current,
                        [selectedOrder.order_id]: value,
                      }));

                      setCustomerCodeErrors((current) => ({
                        ...current,
                        [selectedOrder.order_id]: "",
                      }));
                    }}
                    maxLength={4}
                    placeholder=""
                    className="w-full rounded-xl border border-orange-300 bg-white px-4 py-3 text-center text-xl font-black uppercase tracking-[0.2em] outline-none sm:w-48"
                  />

                  <button
                    type="button"
                    disabled={
                      updating === selectedOrder.order_id ||
                      (customerCodes[selectedOrder.order_id] ?? "").length !== 4
                    }
                    onClick={() =>
                      confirmCustomerPickup(selectedOrder.order_id)
                    }
                    className="rounded-xl bg-green-600 px-6 py-3 font-black text-white disabled:bg-zinc-300"
                  >
                    ✅ Confirmar retirada
                  </button>
                </div>

                {customerCodeErrors[selectedOrder.order_id] && (
                  <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">
                    ⚠️ {customerCodeErrors[selectedOrder.order_id]}
                  </div>
                )}
              </div>
            )}

            {/* ==================================
                ENTREGA PRONTA
            ================================== */}

            {selectedOrder.status === "ready" && !isPickup && (
              <div className="rounded-xl bg-green-50 p-4">
                <p className="font-black text-green-700">
                  📦 Pedido pronto
                </p>

                <p className="mt-1 text-sm text-green-600">
                  Aguardando um entregador aceitar.
                </p>
              </div>
            )}

            {/* ==================================
                MOTOBOY
            ================================== */}

            {selectedOrder.status === "driver_assigned" && !isPickup && (
              <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5">
                <p className="font-black text-yellow-800">
                  🛵 Entregador chegou?
                </p>

                <p className="mt-2 text-sm text-yellow-700">
                  Peça o código de coleta que aparece para o entregador.
                </p>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input
                    value={driverCodes[selectedOrder.order_id] ?? ""}
                    onChange={(event) => {
                      const value = event.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, "")
                        .slice(0, 4);

                      setDriverCodes((current) => ({
                        ...current,
                        [selectedOrder.order_id]: value,
                      }));

                      setDriverCodeErrors((current) => ({
                        ...current,
                        [selectedOrder.order_id]: "",
                      }));
                    }}
                    maxLength={4}
                    placeholder=""
                    className="w-full rounded-xl border border-yellow-300 bg-white px-4 py-3 text-center text-xl font-black uppercase tracking-[0.2em] sm:w-48"
                  />

                  <button
                    type="button"
                    disabled={
                      updating === selectedOrder.order_id ||
                      (driverCodes[selectedOrder.order_id] ?? "").length !== 4
                    }
                    onClick={() =>
                      confirmDriverPickup(selectedOrder.order_id)
                    }
                    className="rounded-xl bg-green-600 px-6 py-3 font-black text-white disabled:bg-zinc-300"
                  >
                    ✅ Confirmar coleta
                  </button>
                </div>

                {driverCodeErrors[selectedOrder.order_id] && (
                  <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">
                    ⚠️ {driverCodeErrors[selectedOrder.order_id]}
                  </div>
                )}
              </div>
            )}

            {/* ==================================
                CONCLUÍDO
            ================================== */}

            {selectedOrder.status === "delivered" && (
              <div className="rounded-xl bg-green-50 p-4 font-black text-green-700">
                ✅ {isPickup ? "Retirada concluída" : "Pedido entregue"}
              </div>
            )}

            {/* ==================================
                CANCELADO
            ================================== */}

            {selectedOrder.status === "cancelled" && (
              <div className="rounded-xl bg-red-50 p-4 font-black text-red-700">
                ❌ Pedido cancelado
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // PESQUISA + PERÍODO + STATUS
  // ==========================================

  const normalizedSearch = normalizeSearchText(searchTerm);

  function orderMatchesStatusFilter(order: Order) {
    if (statusFilter === "all") {
      return true;
    }

    if (statusFilter === "new") {
      return (
        order.status === "pending" &&
        order.payment_status === "paid"
      );
    }

    if (statusFilter === "preparing") {
      return (
        order.status === "accepted" ||
        order.status === "preparing"
      );
    }

    if (statusFilter === "ready") {
      return order.status === "ready";
    }

    if (statusFilter === "delivery") {
      return [
        "driver_assigned",
        "picked_up",
        "delivering",
      ].includes(order.status);
    }

    if (statusFilter === "finished") {
      return order.status === "delivered";
    }

    if (statusFilter === "cancelled") {
      return order.status === "cancelled";
    }

    return true;
  }

  const hasInvalidDateRange = Boolean(
    dateFrom && dateTo && dateFrom > dateTo
  );

  const filteredResults = hasInvalidDateRange
    ? []
    : orders.filter((order) => {
        const matchesName =
          !normalizedSearch ||
          normalizeSearchText(order.customer_name).includes(
            normalizedSearch
          );

        const orderDate = orderDateKey(order.created_at);
        const matchesStartDate = !dateFrom || orderDate >= dateFrom;
        const matchesEndDate = !dateTo || orderDate <= dateTo;
        const matchesStatus = orderMatchesStatusFilter(order);

        return (
          matchesName &&
          matchesStartDate &&
          matchesEndDate &&
          matchesStatus
        );
      });

  const isFiltering =
    normalizedSearch.length > 0 ||
    Boolean(dateFrom || dateTo) ||
    statusFilter !== "all";

  // ==========================================
  // SEPARAR PEDIDOS NAS COLUNAS
  // ==========================================

  const newOrders = orders.filter(
    (order) =>
      order.status === "pending" &&
      order.payment_status === "paid"
  );

  const preparingOrders = orders.filter(
    (order) =>
      order.status === "accepted" ||
      order.status === "preparing"
  );

  const readyOrders = orders.filter(
    (order) => order.status === "ready"
  );

  const deliveryOrders = orders.filter(
    (order) =>
      order.status === "driver_assigned" ||
      order.status === "picked_up" ||
      order.status === "delivering"
  );

  const finishedOrders = orders.filter(
    (order) =>
      order.status === "delivered" ||
      order.status === "cancelled"
  );

  const activeOrders = orders.filter(
    (order) =>
      order.status !== "delivered" &&
      order.status !== "cancelled"
  ).length;

  // ==========================================
  // LISTA / KANBAN
  // ==========================================

  return (
    <div className="min-w-0">
      {/* ==================================
          CABEÇALHO
      ================================== */}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-black text-red-600">
            OPERAÇÃO
          </p>

          <h2 className="mt-1 text-3xl font-black">
            Pedidos
          </h2>

          <p className="mt-1 text-zinc-500">
            Acompanhe todos os pedidos por etapa.
          </p>
        </div>

        <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
          <span className="font-black text-red-600">
            {activeOrders}
          </span>{" "}
          pedidos ativos
        </div>
      </div>

      {/* ==================================
          PESQUISA E FILTROS
      ================================== */}

      {orders.length > 0 && (
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5">
          <div>
            <h3 className="text-base font-black text-zinc-900">
              Buscar pedidos
            </h3>

            <p className="mt-1 text-sm text-zinc-500">
              Filtre pelo cliente, período e status. Os filtros funcionam juntos.
            </p>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-5 lg:items-end">
            <div>
              <label
                htmlFor="customer-search"
                className="mb-2 block text-xs font-black uppercase tracking-wide text-zinc-500"
              >
                Cliente
              </label>

              <input
                id="customer-search"
                type="text"
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(event.target.value)
                }
                placeholder=""
                className="h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 font-semibold outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
              />
            </div>

            <div>
              <label
                htmlFor="date-from"
                className="mb-2 block text-xs font-black uppercase tracking-wide text-zinc-500"
              >
                De
              </label>

              <input
                id="date-from"
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(event) =>
                  setDateFrom(event.target.value)
                }
                className="h-12 w-full rounded-xl border border-zinc-200 bg-white px-3 font-semibold outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
              />
            </div>

            <div>
              <label
                htmlFor="date-to"
                className="mb-2 block text-xs font-black uppercase tracking-wide text-zinc-500"
              >
                Até
              </label>

              <input
                id="date-to"
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(event) =>
                  setDateTo(event.target.value)
                }
                className="h-12 w-full rounded-xl border border-zinc-200 bg-white px-3 font-semibold outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
              />
            </div>

            <div>
              <label
                htmlFor="status-filter"
                className="mb-2 block text-xs font-black uppercase tracking-wide text-zinc-500"
              >
                Status
              </label>

              <select
                id="status-filter"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as OrderSearchStatus
                  )
                }
                className="h-12 w-full rounded-xl border border-zinc-200 bg-white px-3 font-semibold outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
              >
                <option value="all">Todos</option>
                <option value="new">Novos</option>
                <option value="preparing">Em preparo</option>
                <option value="ready">Prontos</option>
                <option value="delivery">Em entrega</option>
                <option value="finished">Finalizados</option>
                <option value="cancelled">Cancelados</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                disabled={!isFiltering}
                onClick={clearOrderFilters}
                className="h-12 w-full rounded-xl border border-zinc-200 bg-white px-5 text-sm font-black text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 lg:w-auto"
              >
                Limpar
              </button>
            </div>
          </div>

          {hasInvalidDateRange && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              A data inicial não pode ser maior que a data final.
            </div>
          )}

          {isFiltering && !hasInvalidDateRange && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4">
              <p className="text-sm text-zinc-500">
                Mostrando somente os pedidos que atendem aos filtros selecionados.
              </p>

              <span className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-black text-zinc-700">
                {filteredResults.length}{" "}
                {filteredResults.length === 1 ? "pedido" : "pedidos"}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ==================================
          ERRO
      ================================== */}

      {error && (
        <div className="mt-5 rounded-xl bg-red-50 p-4 font-bold text-red-700">
          ⚠️ {error}
        </div>
      )}

      {/* ==================================
          SEM NENHUM PEDIDO
      ================================== */}

      {!error && orders.length === 0 && (
        <div className="mt-6 rounded-3xl bg-white p-10 text-center shadow-sm">
          <div className="text-5xl">🔔</div>

          <h3 className="mt-4 text-xl font-black">
            Nenhum pedido
          </h3>

          <p className="mt-2 text-zinc-500">
            Quando chegar um pedido, ele aparecerá aqui.
          </p>
        </div>
      )}

      {/* ==================================
          RESULTADOS DOS FILTROS
      ================================== */}

      {!error && orders.length > 0 && isFiltering && (
        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-black">
                Pedidos encontrados
              </h3>

              <p className="mt-1 text-sm text-zinc-500">
                Resultado do cliente, período e status selecionados.
              </p>
            </div>

            <div className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-black text-white">
              {filteredResults.length}{" "}
              {filteredResults.length === 1 ? "pedido" : "pedidos"}
            </div>
          </div>

          {filteredResults.length === 0 ? (
            <div className="mt-4 rounded-3xl bg-white p-10 text-center shadow-sm">
              <div className="text-5xl">🔎</div>

              <h3 className="mt-4 text-xl font-black">
                Nenhum pedido encontrado
              </h3>

              <p className="mt-2 text-zinc-500">
                Não encontramos pedidos com esses filtros nesta loja.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredResults.map((order) => (
                <OrderCard
                  key={order.order_id}
                  order={order}
                  updating={updating}
                  onOpen={setSelectedOrderId}
                  onAccept={acceptOrder}
                  onCancel={cancelOrder}
                  onMessages={onOpenMessages}
                  unreadCount={unreadCounts[order.order_id] ?? 0}
                  
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================================
          5 COLUNAS
      ================================== */}

      {!isFiltering && orders.length > 0 && (
        <div className="mt-6 overflow-x-auto pb-5">
          <div className="grid min-w-[1250px] grid-cols-5 items-start gap-4">

            {/* NOVOS */}

            <OrderColumn
              title="Novos"
              subtitle="Aguardando aceite."
              icon="🔴"
              orders={newOrders}
              headerClass="border-red-200 bg-red-50 text-red-900"
              countClass="bg-red-600 text-white"
              updating={updating}
              
              onOpen={setSelectedOrderId}
              onAccept={acceptOrder}
              onCancel={cancelOrder}
             onMessages={onOpenMessages}
             unreadCounts={unreadCounts}
            />

            {/* EM PREPARO */}

            <OrderColumn
              title="Em preparo"
              subtitle="Aceitos e preparando."
              icon="👨‍🍳"
              orders={preparingOrders}
              headerClass="border-orange-200 bg-orange-50 text-orange-900"
              countClass="bg-orange-500 text-white"
              updating={updating}
             
              onOpen={setSelectedOrderId}
              onAccept={acceptOrder}
              onCancel={cancelOrder}
              onMessages={onOpenMessages}
              unreadCounts={unreadCounts}
            />

            {/* PRONTOS */}

            <OrderColumn
              title="Prontos"
              subtitle="Aguardando retirada."
              icon="📦"
              orders={readyOrders}
              headerClass="border-purple-200 bg-purple-50 text-purple-900"
              countClass="bg-purple-600 text-white"
              updating={updating}
              
              onOpen={setSelectedOrderId}
              onAccept={acceptOrder}
              onCancel={cancelOrder}
              onMessages={onOpenMessages}
              unreadCounts={unreadCounts}
            />

            {/* EM ENTREGA */}

            <OrderColumn
              title="Em entrega"
              subtitle="Com fluxo do entregador."
              icon="🛵"
              orders={deliveryOrders}
              headerClass="border-blue-200 bg-blue-50 text-blue-900"
              countClass="bg-blue-600 text-white"
              updating={updating}
             
              onOpen={setSelectedOrderId}
              onAccept={acceptOrder}
              onCancel={cancelOrder}
              onMessages={onOpenMessages}
              unreadCounts={unreadCounts}
            />

            {/* FINALIZADOS */}

            <OrderColumn
              title="Finalizados"
              subtitle="Concluídos e cancelados."
              icon="✅"
              orders={finishedOrders}
              headerClass="border-green-200 bg-green-50 text-green-900"
              countClass="bg-green-600 text-white"
              updating={updating}
             
              onOpen={setSelectedOrderId}
              onAccept={acceptOrder}
              onCancel={cancelOrder}
              onMessages={onOpenMessages}
              unreadCounts={unreadCounts}
            />
          </div>
        </div>
      )}
    </div>
  );
}