"use client";

import Link from "next/link";

import {
  MouseEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

import UserMenu from "./components/UserMenu";
import CartButton from "./components/CartButton";
import RestaurantRatingBadge from "./components/RestaurantRatingBadge";

const categories = [
  {
    name: "Lanches",
    icon: "🍔",
  },
  {
    name: "Pizza",
    icon: "🍕",
  },
  {
    name: "Açaí",
    icon: "🥤",
  },
  {
    name: "Doces",
    icon: "🍰",
  },
  {
    name: "Almoço",
    icon: "🍛",
  },
  {
    name: "Mercado",
    icon: "🛒",
  },
];

type Restaurant = {
  id: string;
  name: string;
  description: string | null;
  neighborhood: string | null;
  delivery_base_fee: number | string;
  estimated_delivery_minutes: number | null;
  logo_url: string | null;
  cover_url: string | null;
};

type ProductIndex = {
  restaurant_id: string;
  name: string;
  category: string | null;
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

function normalizeText(
  value:
    | string
    | null
    | undefined
) {
  return (value ?? "")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .trim();
}

function matchesCategory(
  product: ProductIndex,
  selectedCategory: string
) {
  const productName =
    normalizeText(
      product.name
    );

  const productCategory =
    normalizeText(
      product.category
    );

  const text =
    `${productName} ${productCategory}`;

  switch (
    normalizeText(
      selectedCategory
    )
  ) {
    case "lanches":
      return (
        text.includes("lanche") ||
        text.includes("hamburg") ||
        text.includes("burger") ||
        text.includes("sandu") ||
        text.includes("pastel") ||
        text.includes("coxinha")
      );

    case "pizza":
      return (
        text.includes("pizza") ||
        text.includes("pizzaria")
      );

    case "acai":
      return text.includes(
        "acai"
      );

    case "doces":
      return (
        text.includes("doce") ||
        text.includes("bolo") ||
        text.includes("sobremesa") ||
        text.includes("brigadeiro")
      );

    case "almoco":
      return (
        text.includes("almoco") ||
        text.includes("prato") ||
        text.includes("marmita") ||
        text.includes("refeicao")
      );

    case "mercado":
      return (
        text.includes("mercado") ||
        text.includes("mercearia") ||
        text.includes("bebida") ||
        text.includes("conveniencia")
      );

    default:
      return true;
  }
}

export default function Home() {
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
    restaurants,
    setRestaurants,
  ] =
    useState<Restaurant[]>(
      []
    );

  const [
    products,
    setProducts,
  ] =
    useState<ProductIndex[]>(
      []
    );

  const [
    favoriteIds,
    setFavoriteIds,
  ] =
    useState<string[]>(
      []
    );

  const [
    favoriteLoading,
    setFavoriteLoading,
  ] =
    useState("");

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

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    selectedCategory,
    setSelectedCategory,
  ] =
    useState("");

  // ==========================================
  // CARREGAR HOME
  // ==========================================

  useEffect(() => {
    async function loadHome() {
      setLoading(
        true
      );

      setError(
        ""
      );

      // ======================================
      // RESTAURANTES
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
            description,
            neighborhood,
            delivery_base_fee,
            estimated_delivery_minutes,
            logo_url,
            cover_url
          `)
          .eq(
            "active",
            true
          )
          .order(
            "created_at",
            {
              ascending:
                false,
            }
          );

      if (
        restaurantError
      ) {
        console.error(
          "Erro restaurantes:",
          restaurantError
        );

        setError(
          "Não foi possível carregar os restaurantes."
        );

        setLoading(
          false
        );

        return;
      }

      const loadedRestaurants =
        (
          restaurantData ??
          []
        ) as Restaurant[];

      setRestaurants(
        loadedRestaurants
      );

      // ======================================
      // PRODUTOS
      // ======================================

      const {
        data:
          productData,

        error:
          productError,
      } =
        await supabase
          .from(
            "products"
          )
          .select(`
            restaurant_id,
            name,
            category
          `)
          .eq(
            "active",
            true
          );

      if (
        productError
      ) {
        console.error(
          "Erro produtos:",
          productError
        );
      }

      setProducts(
        (
          productData ??
          []
        ) as ProductIndex[]
      );

      // ======================================
      // FAVORITOS
      // ======================================

      const {
        data: {
          session,
        },
      } =
        await supabase.auth.getSession();

      if (
        session
      ) {
        const {
          data:
            favoritesData,

          error:
            favoritesError,
        } =
          await supabase
            .from(
              "restaurant_favorites"
            )
            .select(
              "restaurant_id"
            )
            .eq(
              "user_id",
              session.user.id
            );

        if (
          favoritesError
        ) {
          console.error(
            "Erro favoritos:",
            favoritesError
          );
        } else {
          setFavoriteIds(
            (
              favoritesData ??
              []
            ).map(
              (
                favorite
              ) =>
                favorite.restaurant_id
            )
          );
        }
      } else {
        setFavoriteIds(
          []
        );
      }

      setLoading(
        false
      );
    }

    loadHome();

    const {
      data: {
        subscription,
      },
    } =
      supabase.auth.onAuthStateChange(
        () => {
          loadHome();
        }
      );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // ==========================================
  // ABERTO / FECHADO
  // ==========================================

  useEffect(() => {
    if (
      restaurants.length ===
      0
    ) {
      setOpenStatuses(
        {}
      );

      return;
    }

    let cancelled =
      false;

    async function loadOpenStatuses() {
      const results =
        await Promise.all(
          restaurants.map(
            async (
              restaurant
            ) => {
              const {
                data,
                error:
                  statusError,
              } =
                await supabase.rpc(
                  "get_restaurant_open_status",
                  {
                    p_restaurant_id:
                      restaurant.id,
                  }
                );

              if (
                statusError
              ) {
                console.error(
                  `Erro ao verificar horário de ${restaurant.name}:`,
                  statusError
                );

                return {
                  restaurantId:
                    restaurant.id,

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
                restaurantId:
                  restaurant.id,

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
        > =
          {};

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
    restaurants,
  ]);

  // ==========================================
  // FAVORITAR
  // ==========================================

  async function toggleFavorite(
    event: MouseEvent<HTMLButtonElement>,
    restaurantId: string
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (
      favoriteLoading ===
      restaurantId
    ) {
      return;
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
        "/"
      );

      router.push(
        "/login"
      );

      return;
    }

    setFavoriteLoading(
      restaurantId
    );

    const isFavorite =
      favoriteIds.includes(
        restaurantId
      );

    if (
      isFavorite
    ) {
      const {
        error:
          deleteError,
      } =
        await supabase
          .from(
            "restaurant_favorites"
          )
          .delete()
          .eq(
            "user_id",
            session.user.id
          )
          .eq(
            "restaurant_id",
            restaurantId
          );

      if (
        deleteError
      ) {
        console.error(
          "Erro remover favorito:",
          deleteError
        );

        setFavoriteLoading(
          ""
        );

        return;
      }

      setFavoriteIds(
        (
          current
        ) =>
          current.filter(
            (
              id
            ) =>
              id !==
              restaurantId
          )
      );

      setFavoriteLoading(
        ""
      );

      return;
    }

    const {
      error:
        insertError,
    } =
      await supabase
        .from(
          "restaurant_favorites"
        )
        .insert({
          user_id:
            session.user.id,

          restaurant_id:
            restaurantId,
        });

    if (
      insertError
    ) {
      console.error(
        "Erro adicionar favorito:",
        insertError
      );

      setFavoriteLoading(
        ""
      );

      return;
    }

    setFavoriteIds(
      (
        current
      ) => [
        ...current,
        restaurantId,
      ]
    );

    setFavoriteLoading(
      ""
    );
  }

  // ==========================================
  // FILTROS
  // ==========================================

  const filteredRestaurants =
    useMemo(
      () => {
        const normalizedSearch =
          normalizeText(
            search
          );

        return restaurants.filter(
          (
            restaurant
          ) => {
            const restaurantText =
              normalizeText(
                [
                  restaurant.name,
                  restaurant.description,
                  restaurant.neighborhood,
                ]
                  .filter(
                    Boolean
                  )
                  .join(
                    " "
                  )
              );

            const restaurantProducts =
              products.filter(
                (
                  product
                ) =>
                  product.restaurant_id ===
                  restaurant.id
              );

            let matchesSearch =
              true;

            if (
              normalizedSearch
            ) {
              const restaurantMatches =
                restaurantText.includes(
                  normalizedSearch
                );

              const productMatches =
                restaurantProducts.some(
                  (
                    product
                  ) =>
                    normalizeText(
                      `${product.name} ${
                        product.category ??
                        ""
                      }`
                    ).includes(
                      normalizedSearch
                    )
                );

              matchesSearch =
                restaurantMatches ||
                productMatches;
            }

            let categoryMatches =
              true;

            if (
              selectedCategory
            ) {
              categoryMatches =
                restaurantProducts.some(
                  (
                    product
                  ) =>
                    matchesCategory(
                      product,
                      selectedCategory
                    )
                );

              if (
                !categoryMatches
              ) {
                const categoryName =
                  normalizeText(
                    selectedCategory
                  );

                if (
                  categoryName ===
                    "pizza" &&
                  restaurantText.includes(
                    "pizza"
                  )
                ) {
                  categoryMatches =
                    true;
                }

                if (
                  categoryName ===
                    "acai" &&
                  restaurantText.includes(
                    "acai"
                  )
                ) {
                  categoryMatches =
                    true;
                }

                if (
                  categoryName ===
                    "mercado" &&
                  restaurantText.includes(
                    "mercado"
                  )
                ) {
                  categoryMatches =
                    true;
                }
              }
            }

            return (
              matchesSearch &&
              categoryMatches
            );
          }
        );
      },
      [
        restaurants,
        products,
        search,
        selectedCategory,
      ]
    );

  function selectCategory(
    category: string
  ) {
    if (
      selectedCategory ===
      category
    ) {
      setSelectedCategory(
        ""
      );

      return;
    }

    setSelectedCategory(
      category
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f7f7] text-zinc-900">
      {/* ==================================
          CABEÇALHO
      ================================== */}

      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <img
              src="/logo-pedeja.png"
              alt="PedeJá"
              className="h-12 w-12 rounded-xl object-cover"
            />

            <h1 className="text-2xl font-black text-black">
              PedeJá
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <CartButton />

            <UserMenu />
          </div>
        </div>
      </header>

      {/* ==================================
          DESTAQUE
      ================================== */}

      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="rounded-3xl bg-gradient-to-r from-red-600 to-red-500 p-7 text-white md:p-10">
          <p className="text-sm font-semibold opacity-90">
            ENTREGA LOCAL
          </p>

          <h2 className="mt-2 max-w-xl text-3xl font-black md:text-5xl">
            O que você gosta, entregue em
            sua casa
          </h2>

          <p className="mt-3 text-red-50">
            Restaurantes, lanches, açaí,
            pizza e muito mais.
          </p>

          <div className="mt-7 flex max-w-2xl items-center rounded-2xl bg-white px-4 py-1">
            <span className="text-xl">
              🔎
            </span>

            <input
              type="text"
              value={
                search
              }
              onChange={(
                event
              ) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Buscar restaurantes ou produtos"
              className="w-full px-3 py-4 text-zinc-900 outline-none"
            />

            {search && (
              <button
                type="button"
                onClick={() =>
                  setSearch(
                    ""
                  )
                }
                className="rounded-lg px-3 py-2 font-bold text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ==================================
          CATEGORIAS
      ================================== */}

      <section className="mx-auto max-w-6xl px-4">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold">
            Categorias
          </h2>

          {selectedCategory && (
            <button
              type="button"
              onClick={() =>
                setSelectedCategory(
                  ""
                )
              }
              className="text-sm font-bold text-red-600"
            >
              Limpar filtro
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
          {categories.map(
            (
              category
            ) => {
              const selected =
                selectedCategory ===
                category.name;

              return (
                <button
                  type="button"
                  key={
                    category.name
                  }
                  onClick={() =>
                    selectCategory(
                      category.name
                    )
                  }
                  className={`rounded-2xl border p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md ${
                    selected
                      ? "border-red-600 bg-red-50 text-red-600"
                      : "border-zinc-100 bg-white"
                  }`}
                >
                  <div className="text-4xl">
                    {
                      category.icon
                    }
                  </div>

                  <div className="mt-3 text-sm font-semibold">
                    {
                      category.name
                    }
                  </div>
                </button>
              );
            }
          )}
        </div>
      </section>

      {/* ==================================
          RESTAURANTES
      ================================== */}

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">
              {selectedCategory
                ? selectedCategory
                : search
                  ? "Resultados"
                  : "Restaurantes próximos"}
            </h2>
          </div>

          <span className="text-sm font-semibold text-red-600">
            {
              filteredRestaurants.length
            }{" "}
            {filteredRestaurants.length ===
            1
              ? "disponível"
              : "disponíveis"}
          </span>
        </div>

        {loading && (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            Carregando restaurantes...
          </div>
        )}

        {!loading &&
          error && (
            <div className="rounded-xl bg-red-100 p-4 text-red-700">
              {
                error
              }
            </div>
          )}

        {!loading &&
          !error &&
          filteredRestaurants.length ===
            0 && (
            <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
              <div className="text-5xl">
                🔎
              </div>

              <h3 className="mt-4 text-xl font-black">
                Nenhum resultado
              </h3>

              <p className="mt-2 text-zinc-500">
                Não encontramos restaurantes
                ou produtos com esse filtro.
              </p>
            </div>
          )}

        {!loading &&
          !error && (
            <div className="grid gap-5 md:grid-cols-3">
              {filteredRestaurants.map(
                (
                  restaurant
                ) => {
                  const isFavorite =
                    favoriteIds.includes(
                      restaurant.id
                    );

                  const openStatus =
                    openStatuses[
                      restaurant.id
                    ];

                  const isOpen =
                    openStatus?.is_open ===
                    true;

                  return (
                    <Link
                      key={
                        restaurant.id
                      }
                      href={`/restaurante/${restaurant.id}`}
                      className="block overflow-hidden rounded-2xl border border-zinc-100 bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                    >
                      {/* CAPA */}

                      <div className="relative h-48 w-full overflow-hidden bg-zinc-100">
                        {restaurant.cover_url ? (
                          <img
                            src={
                              restaurant.cover_url
                            }
                            alt={
                              restaurant.name
                            }
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-7xl">
                            🍕
                          </div>
                        )}

                        {openStatus && (
                          <div
                            className={`pointer-events-none absolute left-[-45px] top-[22px] z-20 w-44 -rotate-45 py-2 text-center text-xs font-black uppercase tracking-widest text-white shadow-lg ${
                              isOpen
                                ? "bg-green-600"
                                : "bg-red-600"
                            }`}
                          >
                            {isOpen
                              ? "ABERTO"
                              : "FECHADO"}
                          </div>
                        )}
                      </div>

                      {/* DADOS */}

                      <div className="p-3">
                        <div className="flex items-start gap-3">
                          {restaurant.logo_url && (
                            <img
                              src={
                                restaurant.logo_url
                              }
                              alt=""
                              className="h-12 w-12 rounded-xl object-cover"
                            />
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="min-w-0 flex-1 truncate text-lg font-bold">
                                {
                                  restaurant.name
                                }
                              </h3>

                              <RestaurantRatingBadge
                                restaurantId={
                                  restaurant.id
                                }
                                compact
                              />
                            </div>

                            <p className="mt-1 line-clamp-1 text-xs text-zinc-500">
                              {restaurant.description ||
                                "Restaurante"}
                            </p>
                          </div>
                        </div>

                        {restaurant.neighborhood && (
                          <p className="mt-2 text-xs text-zinc-600">
                            📍{" "}
                            {
                              restaurant.neighborhood
                            }
                          </p>
                        )}

                        <div className="mt-1.5 text-xs text-zinc-600">
                          ⏱{" "}
                          {restaurant.estimated_delivery_minutes ??
                            40}{" "}
                          min
                        </div>

                        <p className="mt-1.5 text-xs font-medium text-zinc-700">
                          🛵 Entrega{" "}
                          {money(
                            restaurant.delivery_base_fee
                          )}
                        </p>

                        {openStatus && (
                          <p
                            className={`mt-2 text-xs font-black ${
                              isOpen
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {isOpen
                              ? "● Aberto agora"
                              : "● Fechado agora"}
                          </p>
                        )}

                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-sm font-bold text-red-600">
                            Ver cardápio →
                          </span>

                          <button
                            type="button"
                            disabled={
                              favoriteLoading ===
                              restaurant.id
                            }
                            onClick={(
                              event
                            ) =>
                              toggleFavorite(
                                event,
                                restaurant.id
                              )
                            }
                            className={`flex h-10 w-10 items-center justify-center rounded-full text-3xl transition hover:bg-red-50 disabled:opacity-50 ${
                              isFavorite
                                ? "text-red-600"
                                : "text-zinc-400"
                            }`}
                            title={
                              isFavorite
                                ? "Remover dos favoritos"
                                : "Adicionar aos favoritos"
                            }
                          >
                            {isFavorite
                              ? "♥"
                              : "♡"}
                          </button>
                        </div>
                      </div>
                    </Link>
                  );
                }
              )}
            </div>
          )}
      </section>

      {/* ==================================
          RODAPÉ
      ================================== */}

      <footer className="mt-10 border-t border-zinc-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 text-center">
          <div className="flex items-center justify-center gap-2">
            <img
              src="/logo-pedeja.png"
              alt=""
              className="h-8 w-8 rounded-lg object-cover"
            />
            <p className="font-bold text-black">
              PedeJá
            </p>
          </div>

          <p className="mt-1 text-sm text-zinc-500">
            Peça fácil. Receba rápido. ❤️
          </p>
        </div>
      </footer>
    </main>
  );
}
