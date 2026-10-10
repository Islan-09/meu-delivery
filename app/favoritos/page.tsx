"use client";

import Link from "next/link";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

import RestaurantRatingBadge from "../components/RestaurantRatingBadge";

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

export default function FavoritosPage() {
  const router = useRouter();

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [
    removingId,
    setRemovingId,
  ] = useState("");

  const [
    restaurants,
    setRestaurants,
  ] = useState<Restaurant[]>([]);

  // ==========================================
  // CARREGAR FAVORITOS
  // ==========================================

  const loadFavorites =
    useCallback(async () => {
      setLoading(true);
      setError("");

      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      if (!session) {
        sessionStorage.setItem(
          "after-login",
          "/favoritos"
        );

        router.replace("/login");

        return;
      }

      // PEGAR IDS FAVORITOS

      const {
        data: favoriteData,
        error: favoriteError,
      } = await supabase
        .from(
          "restaurant_favorites"
        )
        .select(`
          restaurant_id,
          created_at
        `)
        .eq(
          "user_id",
          session.user.id
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        );

      if (favoriteError) {
        console.error(
          "Erro favoritos:",
          favoriteError
        );

        setError(
          "Não foi possível carregar seus favoritos."
        );

        setLoading(false);

        return;
      }

      const ids =
        (favoriteData ?? []).map(
          (favorite) =>
            favorite.restaurant_id
        );

      if (ids.length === 0) {
        setRestaurants([]);
        setLoading(false);

        return;
      }

      // BUSCAR RESTAURANTES

      const {
        data: restaurantData,
        error: restaurantError,
      } = await supabase
        .from("restaurants")
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
        .in(
          "id",
          ids
        )
        .eq(
          "active",
          true
        );

      if (restaurantError) {
        console.error(
          "Erro restaurantes:",
          restaurantError
        );

        setError(
          "Não foi possível carregar os restaurantes favoritos."
        );

        setLoading(false);

        return;
      }

      // MANTER A ORDEM EM QUE
      // FORAM FAVORITADOS

      const restaurantMap =
        new Map(
          (
            restaurantData ??
            []
          ).map(
            (restaurant) => [
              restaurant.id,
              restaurant,
            ]
          )
        );

      const orderedRestaurants =
        ids
          .map(
            (id) =>
              restaurantMap.get(
                id
              )
          )
          .filter(
            Boolean
          ) as Restaurant[];

      setRestaurants(
        orderedRestaurants
      );

      setLoading(false);
    }, [router]);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  // ==========================================
  // REMOVER FAVORITO
  // ==========================================

  async function removeFavorite(
    restaurantId: string
  ) {
    setRemovingId(
      restaurantId
    );

    setError("");

    const {
      data: { session },
    } =
      await supabase.auth.getSession();

    if (!session) {
      router.replace("/login");

      return;
    }

    const {
      error: deleteError,
    } = await supabase
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

    if (deleteError) {
      console.error(
        "Erro remover favorito:",
        deleteError
      );

      setError(
        "Não foi possível remover o favorito."
      );

      setRemovingId("");

      return;
    }

    setRestaurants(
      (current) =>
        current.filter(
          (restaurant) =>
            restaurant.id !==
            restaurantId
        )
    );

    setRemovingId("");
  }

  // ==========================================
  // CARREGANDO
  // ==========================================

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7]">
        <p className="font-bold">
          Carregando favoritos...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f7f7] text-zinc-900">
      {/* CABEÇALHO */}

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
        {/* TÍTULO */}

        <div>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl">
            ❤️
          </div>

          <h1 className="mt-4 text-3xl font-black">
            Favoritos
          </h1>

          <p className="mt-2 text-zinc-500">
            Seus restaurantes preferidos
            ficam salvos aqui.
          </p>
        </div>

        {/* ERRO */}

        {error && (
          <div className="mt-6 rounded-2xl bg-red-50 p-4 font-semibold text-red-700">
            {error}
          </div>
        )}

        {/* SEM FAVORITOS */}

        {!error &&
          restaurants.length === 0 && (
            <section className="mt-8 rounded-3xl bg-white p-10 text-center shadow-sm">
              <div className="text-6xl">
                ♡
              </div>

              <h2 className="mt-4 text-2xl font-black">
                Nenhum favorito ainda
              </h2>

              <p className="mt-2 text-zinc-500">
                Toque no coração de uma loja
                para salvar ela aqui.
              </p>

              <Link
                href="/"
                className="mt-6 inline-block rounded-xl bg-red-600 px-6 py-4 font-black text-white"
              >
                Ver restaurantes
              </Link>
            </section>
          )}

        {/* FAVORITOS */}

        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {restaurants.map(
            (restaurant) => (
              <article
                key={
                  restaurant.id
                }
                className="overflow-hidden rounded-3xl border border-zinc-100 bg-white shadow-sm"
              >
                {/* CAPA */}

                {restaurant.cover_url ? (
                  <img
                    src={
                      restaurant.cover_url
                    }
                    alt={
                      restaurant.name
                    }
                    className="h-40 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-40 items-center justify-center bg-zinc-100 text-7xl">
                    🍕
                  </div>
                )}

                {/* DADOS */}

                <div className="p-5">
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
                      <h2 className="truncate text-lg font-black">
                        {
                          restaurant.name
                        }
                      </h2>

                      <p className="mt-1 line-clamp-2 text-sm text-zinc-500">
                        {restaurant.description ||
                          "Restaurante"}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={
                        removingId ===
                        restaurant.id
                      }
                      onClick={() =>
                        removeFavorite(
                          restaurant.id
                        )
                      }
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-3xl text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                      title="Remover dos favoritos"
                    >
                      ♥
                    </button>
                  </div>

                  <div className="mt-4">
                    <RestaurantRatingBadge
                      restaurantId={
                        restaurant.id
                      }
                    />
                  </div>

                  {restaurant.neighborhood && (
                    <p className="mt-4 text-sm text-zinc-600">
                      📍{" "}
                      {
                        restaurant.neighborhood
                      }
                    </p>
                  )}

                  <div className="mt-2 text-sm text-zinc-600">
                    ⏱{" "}
                    {restaurant.estimated_delivery_minutes ??
                      40}{" "}
                    min
                  </div>

                  <p className="mt-2 text-sm font-medium text-zinc-700">
                    🛵 Entrega{" "}
                    {money(
                      restaurant.delivery_base_fee
                    )}
                  </p>

                  <Link
                    href={`/restaurante/${restaurant.id}`}
                    className="mt-5 block w-full rounded-xl bg-red-600 px-5 py-3 text-center font-black text-white transition hover:bg-red-700"
                  >
                    Ver cardápio
                  </Link>
                </div>
              </article>
            )
          )}
        </div>
      </div>
    </main>
  );
}
