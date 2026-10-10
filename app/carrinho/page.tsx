"use client";

import Link from "next/link";

import {
  useEffect,
  useState,
} from "react";

import { supabase } from "@/lib/supabase";

type Product = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number | string;
  image_url: string | null;
};

type CartAddon = {
  group_id: string;
  group_name: string;

  option_id: string;
  option_name: string;

  price: number;
  quantity: number;
};

type CartItem = {
  product: Product;

  quantity: number;

  cart_key?: string;

  addons?: CartAddon[];

  notes?: string;

  unit_price?: number;
};

type Restaurant = {
  id: string;
  name: string;
  description: string | null;
  neighborhood: string | null;

  delivery_base_fee:
    | number
    | string;

  minimum_order:
    | number
    | string;

  estimated_delivery_minutes:
    | number
    | null;

  logo_url: string | null;
  cover_url: string | null;

  active: boolean;
};

type RestaurantCart = {
  restaurantId: string;

  restaurant:
    | Restaurant
    | null;

  items: CartItem[];
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
  ).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
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
    return "O próximo horário de abertura ainda não foi informado.";
  }

  const dayName =
    dayNames[
      Number(
        status.next_day
      )
    ] ??
    "próximo dia";

  return `Abre novamente ${dayName} às ${formatHour(
    status.next_opens_at
  )}`;
}

function restaurantFallback(
  restaurantName:
    | string
    | undefined
) {
  const name =
    (
      restaurantName ??
      ""
    ).toLowerCase();

  if (
    name.includes(
      "hamburg"
    )
  ) {
    return "🍔";
  }

  if (
    name.includes("açaí") ||
    name.includes("acai")
  ) {
    return "🥤";
  }

  if (
    name.includes("doce") ||
    name.includes("bolo")
  ) {
    return "🍰";
  }

  return "🍕";
}

// =========================================
// PREÇO UNITÁRIO REAL
// =========================================

function getUnitPrice(
  item: CartItem
) {
  if (
    item.unit_price !==
      undefined &&
    item.unit_price !==
      null
  ) {
    return Number(
      item.unit_price
    );
  }

  return Number(
    item.product.price
  );
}

// =========================================
// CHAVE ÚNICA DO ITEM
// =========================================

function getCartKey(
  item: CartItem
) {
  return (
    item.cart_key ||
    `${item.product.id}|legacy`
  );
}

export default function CarrinhoPage() {
  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    carts,
    setCarts,
  ] =
    useState<
      RestaurantCart[]
    >([]);

  // =========================================
  // HORÁRIOS DAS LOJAS
  // =========================================

  const [
    openStatuses,
    setOpenStatuses,
  ] =
    useState<
      Record<
        string,
        RestaurantOpenStatus
      >
    >({});

  /*
    Essa string só muda quando entrar/sair
    uma loja do carrinho.

    Alterar quantidade de produto não fica
    recriando a verificação de horário.
  */

  const restaurantIdsKey =
    carts
      .map(
        (
          cart
        ) =>
          cart.restaurantId
      )
      .sort()
      .join("|");

  // =========================================
  // SALVAR ALTERAÇÃO
  // =========================================

  function saveCart(
    restaurantId: string,
    items: CartItem[]
  ) {
    const key =
      `cart-${restaurantId}`;

    if (
      items.length ===
      0
    ) {
      localStorage.removeItem(
        key
      );
    } else {
      localStorage.setItem(
        key,
        JSON.stringify(
          items
        )
      );
    }

    window.dispatchEvent(
      new Event(
        "cart-updated"
      )
    );
  }

  // =========================================
  // CARREGAR TODOS OS CARRINHOS
  // =========================================

  useEffect(() => {
    async function loadCarts() {
      setLoading(
        true
      );

      const savedCarts: {
        restaurantId: string;
        items: CartItem[];
      }[] = [];

      for (
        let index = 0;
        index <
        localStorage.length;
        index++
      ) {
        const key =
          localStorage.key(
            index
          );

        if (
          !key ||
          !key.startsWith(
            "cart-"
          )
        ) {
          continue;
        }

        const restaurantId =
          key.substring(
            "cart-".length
          );

        try {
          const saved =
            localStorage.getItem(
              key
            );

          if (!saved) {
            continue;
          }

          const parsed =
            JSON.parse(
              saved
            );

          if (
            !Array.isArray(
              parsed
            ) ||
            parsed.length ===
              0
          ) {
            continue;
          }

          const normalizedItems =
            parsed.map(
              (
                item: CartItem,
                itemIndex:
                  number
              ) => ({
                ...item,

                cart_key:
                  item.cart_key ||
                  `${item.product.id}|legacy|${itemIndex}`,

                addons:
                  Array.isArray(
                    item.addons
                  )
                    ? item.addons
                    : [],

                notes:
                  item.notes ||
                  "",

                unit_price:
                  item.unit_price ??
                  Number(
                    item.product
                      .price
                  ),
              })
            );

          localStorage.setItem(
            key,
            JSON.stringify(
              normalizedItems
            )
          );

          savedCarts.push({
            restaurantId,

            items:
              normalizedItems,
          });
        } catch (
          error
        ) {
          console.error(
            "Carrinho inválido:",
            key,
            error
          );
        }
      }

      if (
        savedCarts.length ===
        0
      ) {
        setCarts(
          []
        );

        setLoading(
          false
        );

        return;
      }

      const restaurantIds =
        savedCarts.map(
          (
            cart
          ) =>
            cart.restaurantId
        );

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "restaurants"
          )
          .select(`
            id,
            name,
            description,
            neighborhood,
            delivery_base_fee,
            minimum_order,
            estimated_delivery_minutes,
            logo_url,
            cover_url,
            active
          `)
          .in(
            "id",
            restaurantIds
          );

      if (error) {
        console.error(
          "Erro ao carregar lojas:",
          error
        );
      }

      const restaurantMap =
        new Map<
          string,
          Restaurant
        >(
          (
            (data ??
              []) as Restaurant[]
          ).map(
            (
              restaurant
            ) => [
              restaurant.id,
              restaurant,
            ]
          )
        );

      const finalCarts =
        savedCarts.map(
          (
            cart
          ) => ({
            ...cart,

            restaurant:
              restaurantMap.get(
                cart.restaurantId
              ) ??
              null,
          })
        );

      setCarts(
        finalCarts
      );

      setLoading(
        false
      );
    }

    loadCarts();
  }, []);

  // =========================================
  // VERIFICAR ABERTO / FECHADO
  // =========================================

  useEffect(() => {
    if (
      !restaurantIdsKey
    ) {
      setOpenStatuses(
        {}
      );

      return;
    }

    const restaurantIds =
      restaurantIdsKey.split(
        "|"
      );

    let cancelled =
      false;

    async function loadOpenStatuses() {
      const results =
        await Promise.all(
          restaurantIds.map(
            async (
              restaurantId
            ) => {
              const {
                data,
                error,
              } =
                await supabase.rpc(
                  "get_restaurant_open_status",
                  {
                    p_restaurant_id:
                      restaurantId,
                  }
                );

              if (
                error
              ) {
                console.error(
                  `Erro ao verificar horário da loja ${restaurantId}:`,
                  error
                );

                return {
                  restaurantId,
                  status:
                    null,
                };
              }

              const status =
                Array.isArray(
                  data
                ) &&
                data.length >
                  0
                  ? (
                      data[0] as RestaurantOpenStatus
                    )
                  : null;

              return {
                restaurantId,
                status,
              };
            }
          )
        );

      if (
        cancelled
      ) {
        return;
      }

      const newStatuses:
        Record<
          string,
          RestaurantOpenStatus
        > = {};

      results.forEach(
        (
          result
        ) => {
          if (
            result.status
          ) {
            newStatuses[
              result.restaurantId
            ] =
              result.status;
          }
        }
      );

      setOpenStatuses(
        newStatuses
      );
    }

    loadOpenStatuses();

    /*
      Atualiza sozinho de 1 em 1 minuto.

      Exemplo:
      17:59 = fechado
      18:00 = abre
      botão libera sem F5.
    */

    const interval =
      window.setInterval(
        loadOpenStatuses,
        60000
      );

    return () => {
      cancelled =
        true;

      window.clearInterval(
        interval
      );
    };
  }, [
    restaurantIdsKey,
  ]);

  // =========================================
  // AUMENTAR QUANTIDADE
  // =========================================

  function increase(
    restaurantId: string,
    itemKey: string
  ) {
    setCarts(
      (
        current
      ) =>
        current.map(
          (
            cart
          ) => {
            if (
              cart.restaurantId !==
              restaurantId
            ) {
              return cart;
            }

            const items =
              cart.items.map(
                (
                  item
                ) =>
                  getCartKey(
                    item
                  ) ===
                  itemKey
                    ? {
                        ...item,

                        quantity:
                          item.quantity +
                          1,
                      }
                    : item
              );

            saveCart(
              restaurantId,
              items
            );

            return {
              ...cart,
              items,
            };
          }
        )
    );
  }

  // =========================================
  // DIMINUIR QUANTIDADE
  // =========================================

  function decrease(
    restaurantId: string,
    itemKey: string
  ) {
    setCarts(
      (
        current
      ) =>
        current
          .map(
            (
              cart
            ) => {
              if (
                cart.restaurantId !==
                  restaurantId
              ) {
                return cart;
              }

              const items =
                cart.items
                  .map(
                    (
                      item
                    ) =>
                      getCartKey(
                        item
                      ) ===
                      itemKey
                        ? {
                            ...item,

                            quantity:
                              item.quantity -
                              1,
                          }
                        : item
                  )
                  .filter(
                    (
                      item
                    ) =>
                      item.quantity >
                      0
                  );

              saveCart(
                restaurantId,
                items
              );

              return {
                ...cart,
                items,
              };
            }
          )
          .filter(
            (
              cart
            ) =>
              cart.items
                .length >
              0
          )
    );
  }

  // =========================================
  // REMOVER ITEM
  // =========================================

  function removeItem(
    restaurantId: string,
    itemKey: string
  ) {
    setCarts(
      (
        current
      ) =>
        current
          .map(
            (
              cart
            ) => {
              if (
                cart.restaurantId !==
                  restaurantId
              ) {
                return cart;
              }

              const items =
                cart.items.filter(
                  (
                    item
                  ) =>
                    getCartKey(
                      item
                    ) !==
                    itemKey
                );

              saveCart(
                restaurantId,
                items
              );

              return {
                ...cart,
                items,
              };
            }
          )
          .filter(
            (
              cart
            ) =>
              cart.items
                .length >
              0
          )
    );
  }

  // =========================================
  // LIMPAR UMA LOJA
  // =========================================

  function clearRestaurantCart(
    restaurantId: string
  ) {
    localStorage.removeItem(
      `cart-${restaurantId}`
    );

    window.dispatchEvent(
      new Event(
        "cart-updated"
      )
    );

    setCarts(
      (
        current
      ) =>
        current.filter(
          (
            cart
          ) =>
            cart.restaurantId !==
            restaurantId
        )
    );
  }

  // =========================================
  // LIMPAR TUDO
  // =========================================

  function clearEverything() {
    carts.forEach(
      (
        cart
      ) => {
        localStorage.removeItem(
          `cart-${cart.restaurantId}`
        );
      }
    );

    window.dispatchEvent(
      new Event(
        "cart-updated"
      )
    );

    setCarts(
      []
    );
  }

  // =========================================
  // TOTAL DE ITENS
  // =========================================

  const totalItems =
    carts.reduce(
      (
        total,
        cart
      ) =>
        total +
        cart.items.reduce(
          (
            sum,
            item
          ) =>
            sum +
            Number(
              item.quantity
            ),
          0
        ),
      0
    );

  // =========================================
  // CARREGANDO
  // =========================================

  if (
    loading
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7]">
        <p className="font-bold">
          Carregando carrinho...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f7f7] text-zinc-900">
      {/* =====================================
          CABEÇALHO
      ===================================== */}

      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
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

      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* =====================================
            TÍTULO
        ===================================== */}

        <div className="flex items-start justify-between gap-5">
          <div>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl">
              🛒
            </div>

            <h1 className="mt-4 text-3xl font-black">
              Meu carrinho
            </h1>

            <p className="mt-2 text-zinc-500">
              Seus pedidos estão separados por
              loja.
            </p>
          </div>

          {carts.length >
            0 && (
            <button
              type="button"
              onClick={
                clearEverything
              }
              className="rounded-xl px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50"
            >
              Limpar tudo
            </button>
          )}
        </div>

        {/* =====================================
            CARRINHO VAZIO
        ===================================== */}

        {carts.length ===
          0 && (
          <section className="mt-8 rounded-3xl bg-white p-10 text-center shadow-sm">
            <div className="text-6xl">
              🛒
            </div>

            <h2 className="mt-4 text-2xl font-black">
              Seu carrinho está vazio
            </h2>

            <p className="mt-2 text-zinc-500">
              Adicione produtos de uma loja
              para eles aparecerem aqui.
            </p>

            <Link
              href="/"
              className="mt-6 inline-block rounded-xl bg-red-600 px-6 py-4 font-black text-white"
            >
              Ver restaurantes
            </Link>
          </section>
        )}

        {/* =====================================
            RESUMO
        ===================================== */}

        {carts.length >
          0 && (
          <div className="mt-8 flex items-center justify-between rounded-2xl bg-white p-5 shadow-sm">
            <span className="text-zinc-500">
              Total de itens salvos
            </span>

            <strong className="rounded-full bg-red-100 px-3 py-1 text-red-600">
              {
                totalItems
              }
            </strong>
          </div>
        )}

        {/* =====================================
            CARRINHOS
        ===================================== */}

        <div className="mt-6 space-y-6">
          {carts.map(
            (
              cart
            ) => {
              // ==============================
              // SUBTOTAL COM ADICIONAIS
              // ==============================

              const subtotal =
                cart.items.reduce(
                  (
                    sum,
                    item
                  ) =>
                    sum +
                    getUnitPrice(
                      item
                    ) *
                      Number(
                        item.quantity
                      ),
                  0
                );

              const minimum =
                Number(
                  cart.restaurant
                    ?.minimum_order ??
                    0
                );

              const minimumReached =
                subtotal >=
                minimum;

              const imageUrl =
                cart.restaurant
                  ?.cover_url ||
                cart.restaurant
                  ?.logo_url ||
                null;

              // ==============================
              // STATUS DA LOJA
              // ==============================

              const openStatus =
                openStatuses[
                  cart.restaurantId
                ] ??
                null;

              const statusLoaded =
                openStatus !==
                null;

              const storeIsOpen =
                openStatus
                  ?.is_open ===
                true;

              const storeIsClosed =
                statusLoaded &&
                !storeIsOpen;

              const nextOpening =
                nextOpeningText(
                  openStatus
                );

              const canCheckout =
                Boolean(
                  cart.restaurant
                ) &&
                Boolean(
                  cart.restaurant
                    ?.active
                ) &&
                minimumReached &&
                storeIsOpen;

              return (
                <section
                  key={
                    cart.restaurantId
                  }
                  className="overflow-hidden rounded-3xl bg-white shadow-sm"
                >
                  {/* ==========================
                      LOJA
                  ========================== */}

                  <div className="flex items-start justify-between gap-5 border-b border-zinc-100 p-6">
                    <div className="flex min-w-0 items-center gap-5">
                      {/* FOTO */}

                      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-zinc-100 shadow-sm">
                        {imageUrl ? (
                          <img
                            src={
                              imageUrl
                            }
                            alt={
                              cart.restaurant
                                ?.name ??
                              "Restaurante"
                            }
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-5xl">
                            {restaurantFallback(
                              cart.restaurant
                                ?.name
                            )}
                          </div>
                        )}
                      </div>

                      {/* DADOS */}

                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-wide text-red-600">
                          Loja
                        </p>

                        <h2 className="mt-1 text-2xl font-black">
                          {cart.restaurant
                            ?.name ??
                            "Restaurante"}
                        </h2>

                        {cart.restaurant
                          ?.description && (
                          <p className="mt-1 text-sm text-zinc-500">
                            {
                              cart.restaurant
                                .description
                            }
                          </p>
                        )}

                        {cart.restaurant
                          ?.neighborhood && (
                          <p className="mt-2 text-sm font-medium text-zinc-600">
                            📍{" "}
                            {
                              cart.restaurant
                                .neighborhood
                            }
                          </p>
                        )}

                        {cart.restaurant
                          ?.estimated_delivery_minutes && (
                          <p className="mt-1 text-sm text-zinc-500">
                            ⏱{" "}
                            {
                              cart.restaurant
                                .estimated_delivery_minutes
                            }{" "}
                            min
                          </p>
                        )}

                        {/* ABERTO / FECHADO */}

                        {!statusLoaded ? (
                          <p className="mt-2 text-sm font-bold text-zinc-400">
                            🕐 Verificando horário...
                          </p>
                        ) : storeIsOpen ? (
                          <p className="mt-2 text-sm font-black text-green-600">
                            ● Aberto agora
                          </p>
                        ) : (
                          <div className="mt-2">
                            <p className="text-sm font-black text-red-600">
                              ● Fechado agora
                            </p>

                            <p className="mt-1 text-xs font-semibold text-red-500">
                              {
                                nextOpening
                              }
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        clearRestaurantCart(
                          cart.restaurantId
                        )
                      }
                      className="shrink-0 rounded-xl px-3 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50"
                    >
                      Limpar
                    </button>
                  </div>

                  {/* ==========================
                      ITENS
                  ========================== */}

                  <div className="p-6">
                    <div className="space-y-5">
                      {cart.items.map(
                        (
                          item
                        ) => {
                          const itemKey =
                            getCartKey(
                              item
                            );

                          const unitPrice =
                            getUnitPrice(
                              item
                            );

                          const itemTotal =
                            unitPrice *
                            Number(
                              item.quantity
                            );

                          const addons =
                            Array.isArray(
                              item.addons
                            )
                              ? item.addons
                              : [];

                          return (
                            <div
                              key={
                                itemKey
                              }
                              className="rounded-2xl border border-zinc-100 bg-white p-5"
                            >
                              <div className="flex flex-col gap-5 sm:flex-row">
                                {/* FOTO DO PRODUTO */}

                                <div className="h-28 w-full shrink-0 overflow-hidden rounded-2xl bg-zinc-100 sm:w-28">
                                  {item.product
                                    .image_url ? (
                                    <img
                                      src={
                                        item.product
                                          .image_url
                                      }
                                      alt={
                                        item.product
                                          .name
                                      }
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-4xl">
                                      🍔
                                    </div>
                                  )}
                                </div>

                                {/* DADOS */}

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div>
                                      <h3 className="text-lg font-black">
                                        {
                                          item.product
                                            .name
                                        }
                                      </h3>

                                      <p className="mt-1 text-sm text-zinc-500">
                                        Produto:{" "}
                                        {money(
                                          item.product
                                            .price
                                        )}
                                      </p>
                                    </div>

                                    <strong className="text-lg">
                                      {money(
                                        itemTotal
                                      )}
                                    </strong>
                                  </div>

                                  {/* ADICIONAIS */}

                                  {addons.length >
                                    0 && (
                                    <div className="mt-4 rounded-xl bg-zinc-50 p-4">
                                      <p className="text-xs font-black uppercase tracking-wide text-zinc-500">
                                        Adicionais
                                      </p>

                                      <div className="mt-3 space-y-2">
                                        {addons.map(
                                          (
                                            addon
                                          ) => (
                                            <div
                                              key={
                                                `${addon.option_id}-${addon.quantity}`
                                              }
                                              className="flex items-center justify-between gap-4 text-sm"
                                            >
                                              <span className="font-semibold text-zinc-700">
                                                {
                                                  addon.quantity
                                                }
                                                x{" "}
                                                {
                                                  addon.option_name
                                                }
                                              </span>

                                              <span className="font-bold text-zinc-600">
                                                +{" "}
                                                {money(
                                                  Number(
                                                    addon.price
                                                  ) *
                                                    Number(
                                                      addon.quantity
                                                    )
                                                )}
                                              </span>
                                            </div>
                                          )
                                        )}
                                      </div>

                                      {item.quantity >
                                        1 && (
                                        <p className="mt-3 text-xs text-zinc-400">
                                          Esses adicionais estão
                                          em cada unidade do
                                          produto.
                                        </p>
                                      )}
                                    </div>
                                  )}

                                  {/* OBSERVAÇÃO */}

                                  {item.notes &&
                                    item.notes.trim() && (
                                    <div className="mt-3 rounded-xl bg-yellow-50 p-4">
                                      <p className="text-xs font-black uppercase tracking-wide text-yellow-700">
                                        Observação
                                      </p>

                                      <p className="mt-1 text-sm text-yellow-900">
                                        {
                                          item.notes
                                        }
                                      </p>
                                    </div>
                                  )}

                                  {/* PREÇO UNITÁRIO */}

                                  {addons.length >
                                    0 && (
                                    <p className="mt-3 text-sm text-zinc-500">
                                      Valor por unidade com
                                      adicionais:{" "}
                                      <strong className="text-zinc-900">
                                        {money(
                                          unitPrice
                                        )}
                                      </strong>
                                    </p>
                                  )}

                                  {/* AÇÕES */}

                                  <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeItem(
                                          cart.restaurantId,
                                          itemKey
                                        )
                                      }
                                      className="text-sm font-bold text-red-600"
                                    >
                                      Remover
                                    </button>

                                    <div className="flex items-center gap-3">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          decrease(
                                            cart.restaurantId,
                                            itemKey
                                          )
                                        }
                                        className="flex h-9 w-9 items-center justify-center rounded-full border border-red-600 font-black text-red-600 transition hover:bg-red-50"
                                      >
                                        −
                                      </button>

                                      <strong className="min-w-5 text-center">
                                        {
                                          item.quantity
                                        }
                                      </strong>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          increase(
                                            cart.restaurantId,
                                            itemKey
                                          )
                                        }
                                        className="flex h-9 w-9 items-center justify-center rounded-full bg-red-600 font-black text-white transition hover:bg-red-700"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>

{/* ==========================
    SUBTOTAL DO PEDIDO
========================== */}

<div className="mt-6 border-t border-zinc-200 pt-4">
  <div className="flex items-center justify-between gap-4">
    <span className="font-bold text-zinc-600">
      Subtotal do pedido
    </span>

    <strong className="text-lg">
      {money(
        subtotal
      )}
    </strong>
  </div>
</div>

                    {/* ==========================
                        PEDIDO MÍNIMO
                    ========================== */}

                    {!minimumReached && (
                      <div className="mt-5 rounded-xl bg-yellow-50 p-4 text-sm text-yellow-800">
                        Faltam{" "}
                        <strong>
                          {money(
                            minimum -
                              subtotal
                          )}
                        </strong>{" "}
                        para atingir o pedido
                        mínimo desta loja.
                      </div>
                    )}

                    {/* ==========================
                        LOJA FECHADA
                    ========================== */}

                    {storeIsClosed && (
                      <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-5">
                        <div className="flex items-start gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-2xl shadow-sm">
                            🔒
                          </div>

                          <div>
                            <p className="font-black text-red-700">
                              Loja fechada
                            </p>

                            <p className="mt-1 font-bold text-red-600">
                              {
                                nextOpening
                              }
                            </p>

                            <p className="mt-2 text-sm leading-5 text-red-600">
                              Seus produtos continuam
                              salvos no carrinho. Você
                              poderá finalizar o pedido
                              quando a loja abrir.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ==========================
                        BOTÕES
                    ========================== */}

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <Link
                        href={`/restaurante/${cart.restaurantId}`}
                        className="rounded-xl border border-red-600 px-5 py-4 text-center font-black text-red-600 transition hover:bg-red-50"
                      >
                        Continuar comprando
                      </Link>

                      {canCheckout ? (
                        <Link
                          href={`/checkout?restaurant=${cart.restaurantId}`}
                          className="rounded-xl bg-red-600 px-5 py-4 text-center font-black text-white transition hover:bg-red-700"
                        >
                          Finalizar este pedido
                        </Link>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="rounded-xl bg-zinc-300 px-5 py-4 font-black text-white"
                        >
                          {!cart.restaurant
                            ? "Loja indisponível"
                            : !cart.restaurant
                                  .active
                              ? "Loja indisponível"
                              : !statusLoaded
                                ? "Verificando horário..."
                                : storeIsClosed
                                  ? "🔒 Loja fechada"
                                  : !minimumReached
                                    ? "Atingir pedido mínimo"
                                    : "Finalizar este pedido"}
                        </button>
                      )}
                    </div>

                    {!cart.restaurant
                      ?.active && (
                      <p className="mt-3 text-center text-sm font-bold text-red-600">
                        Esta loja está
                        indisponível no momento.
                      </p>
                    )}
                  </div>
                </section>
              );
            }
          )}
        </div>
      </div>
    </main>
  );
}