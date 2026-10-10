"use client";

import Link from "next/link";

import {
  FormEvent,
  Suspense,
  useEffect,
  useState,
} from "react";

import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import { supabase } from "@/lib/supabase";

type Order = {
  order_id: string;
  restaurant_id: string;
  restaurant_name: string;
  status: string;
  payment_status: string | null;
  created_at: string;
};

function AvaliarPedidoContent() {
  const router = useRouter();
  const searchParams =
    useSearchParams();

  const orderId =
    searchParams.get("order") ?? "";

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [order, setOrder] =
    useState<Order | null>(
      null
    );

  const [rating, setRating] =
    useState(0);

  const [
    hoverRating,
    setHoverRating,
  ] = useState(0);

  const [comment, setComment] =
    useState("");

  const [
    alreadyReviewed,
    setAlreadyReviewed,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  useEffect(() => {
    async function loadPage() {
      setLoading(true);
      setError("");

      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      if (!session) {
        sessionStorage.setItem(
          "after-login",
          `/avaliar?order=${orderId}`
        );

        router.replace("/login");

        return;
      }

      if (!orderId) {
        setError(
          "Pedido não informado."
        );

        setLoading(false);
        return;
      }

      const [
        ordersResult,
        reviewResult,
      ] =
        await Promise.all([
          supabase.rpc(
            "get_my_orders"
          ),

          supabase.rpc(
            "get_my_order_review",
            {
              p_order_id:
                orderId,
            }
          ),
        ]);

      if (ordersResult.error) {
        console.error(
          "Erro pedido:",
          ordersResult.error
        );

        setError(
          "Não foi possível carregar o pedido."
        );

        setLoading(false);
        return;
      }

      const found =
        (
          ordersResult.data ??
          []
        ).find(
          (
            item: Order
          ) =>
            item.order_id ===
            orderId
        ) as
          | Order
          | undefined;

      if (!found) {
        setError(
          "Pedido não encontrado."
        );

        setLoading(false);
        return;
      }

      setOrder(found);

      if (reviewResult.error) {
        console.error(
          "Erro avaliação:",
          reviewResult.error
        );
      } else {
        const current =
          Array.isArray(
            reviewResult.data
          )
            ? reviewResult
                .data[0]
            : reviewResult.data;

        if (current) {
          setRating(
            Number(
              current.rating ??
                0
            )
          );

          setComment(
            current.comment ??
              ""
          );

          setAlreadyReviewed(
            true
          );
        }
      }

      setLoading(false);
    }

    loadPage();
  }, [
    orderId,
    router,
  ]);

  async function saveReview(
    event: FormEvent
  ) {
    event.preventDefault();

    if (
      !order ||
      saving
    ) {
      return;
    }

    setError("");
    setSuccess("");

    if (
      rating < 0.5 ||
      rating > 5
    ) {
      setError(
        "Escolha uma nota de 0,5 a 5 estrelas."
      );

      return;
    }

    if (
      Math.abs(
        rating * 2 -
          Math.round(
            rating * 2
          )
      ) > 0.001
    ) {
      setError(
        "A nota precisa ser inteira ou meia estrela."
      );

      return;
    }

    if (
      comment.length > 500
    ) {
      setError(
        "O comentário pode ter no máximo 500 caracteres."
      );

      return;
    }

    setSaving(true);

    const {
      error: reviewError,
    } =
      await supabase.rpc(
        "upsert_my_order_review",
        {
          p_order_id:
            order.order_id,

          p_rating:
            rating,

          p_comment:
            comment.trim() ||
            null,
        }
      );

    if (reviewError) {
      console.error(
        "Erro salvando avaliação:",
        reviewError
      );

      const message =
        reviewError.message ??
        "";

      if (
        message.includes(
          "ORDER_NOT_ELIGIBLE_FOR_REVIEW"
        )
      ) {
        setError(
          "Este pedido ainda não pode ser avaliado. A avaliação é liberada depois que o pedido pago for concluído."
        );
      } else if (
        message.includes(
          "INVALID_RATING"
        )
      ) {
        setError(
          "Escolha uma nota válida de 0,5 a 5 estrelas."
        );
      } else {
        setError(
          "Não foi possível salvar sua avaliação."
        );
      }

      setSaving(false);
      return;
    }

    setAlreadyReviewed(
      true
    );

    setSuccess(
      "Avaliação salva com sucesso!"
    );

    setSaving(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7]">
        <p className="font-bold">
          Carregando avaliação...
        </p>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="min-h-screen bg-[#f7f7f7] px-4 py-10">
        <div className="mx-auto max-w-lg rounded-3xl bg-white p-7 text-center shadow-sm">
          <div className="text-5xl">
            ⚠️
          </div>

          <h1 className="mt-4 text-2xl font-black">
            Não foi possível avaliar
          </h1>

          <p className="mt-2 text-zinc-500">
            {error ||
              "Pedido não encontrado."}
          </p>

          <Link
            href="/meus-pedidos"
            className="mt-6 inline-block rounded-xl bg-red-600 px-5 py-3 font-black text-white"
          >
            Voltar para meus pedidos
          </Link>
        </div>
      </main>
    );
  }

  const eligible =
    order.status ===
      "delivered" &&
    order.payment_status ===
      "paid";

  return (
    <main className="min-h-screen bg-[#f7f7f7] text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
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

      <div className="mx-auto max-w-2xl px-4 py-8">
        <section className="rounded-3xl bg-white p-6 shadow-sm md:p-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-yellow-50 text-3xl">
            ⭐
          </div>

          <p className="mt-5 text-xs font-black uppercase text-zinc-400">
            Pedido #
            {order.order_id
              .slice(0, 8)
              .toUpperCase()}
          </p>

          <h1 className="mt-2 text-3xl font-black">
            Avaliar pedido
          </h1>

          <p className="mt-2 text-zinc-500">
            {order.restaurant_name}
          </p>

          {!eligible && (
            <div className="mt-6 rounded-2xl bg-yellow-50 p-4 text-sm font-bold text-yellow-800">
              A avaliação será liberada quando o pedido estiver pago e concluído.
            </div>
          )}

          {error && eligible && (
            <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">
              ⚠️ {error}
            </div>
          )}

          {success && (
            <div className="mt-6 rounded-2xl bg-green-50 p-4 text-sm font-bold text-green-700">
              ✅ {success}
            </div>
          )}

          {eligible && (
            <form
              onSubmit={saveReview}
              className="mt-7"
            >
              <p className="font-black">
                Como foi sua experiência?
              </p>

              <p className="mt-1 text-sm text-zinc-500">
                Clique na metade esquerda da estrela para dar meia estrela.
              </p>

              <div
                className="mt-4 flex items-center gap-1"
                onMouseLeave={() =>
                  setHoverRating(0)
                }
              >
                {[1, 2, 3, 4, 5].map(
                  (star) => {
                    const preview =
                      hoverRating ||
                      rating;

                    const halfValue =
                      star - 0.5;

                    const fill =
                      preview >= star
                        ? 100
                        : preview >= halfValue
                          ? 50
                          : 0;

                    return (
                      <div
                        key={star}
                        className="relative h-14 w-14 shrink-0"
                      >
                        <span className="absolute inset-0 flex items-center justify-center text-5xl leading-none text-zinc-200">
                          ★
                        </span>

                        <span
                          className="pointer-events-none absolute inset-y-0 left-0 overflow-hidden text-yellow-400"
                          style={{
                            width: `${fill}%`,
                          }}
                        >
                          <span className="flex h-14 w-14 items-center justify-center text-5xl leading-none">
                            ★
                          </span>
                        </span>

                        <button
                          type="button"
                          onMouseEnter={() =>
                            setHoverRating(
                              halfValue
                            )
                          }
                          onClick={() =>
                            setRating(
                              halfValue
                            )
                          }
                          className="absolute inset-y-0 left-0 z-10 w-1/2 bg-transparent"
                          aria-label={`${halfValue.toFixed(1).replace(".", ",")} estrelas`}
                        />

                        <button
                          type="button"
                          onMouseEnter={() =>
                            setHoverRating(
                              star
                            )
                          }
                          onClick={() =>
                            setRating(star)
                          }
                          className="absolute inset-y-0 right-0 z-10 w-1/2 bg-transparent"
                          aria-label={`${star} estrelas`}
                        />
                      </div>
                    );
                  }
                )}
              </div>

              <p className="mt-3 text-sm font-bold text-zinc-500">
                {(hoverRating || rating) === 0
                  ? "Escolha de 0,5 a 5 estrelas"
                  : `${(hoverRating || rating)
                      .toFixed(1)
                      .replace(".", ",")} de 5 estrelas`}
              </p>

              <div className="mt-7">
                <div className="flex items-center justify-between gap-3">
                  <label className="font-black">
                    Comentário
                  </label>

                  <span className="text-xs font-bold text-zinc-400">
                    {comment.length}/500
                  </span>
                </div>

                <textarea
                  value={comment}
                  onChange={(event) =>
                    setComment(
                      event.target
                        .value
                        .slice(
                          0,
                          500
                        )
                    )
                  }
                  rows={5}
                  placeholder="Conte como foi seu pedido (opcional)"
                  className="mt-2 w-full resize-none rounded-2xl border border-zinc-200 px-4 py-4 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="mt-6 w-full rounded-xl bg-red-600 px-5 py-4 font-black text-white transition hover:bg-red-700 disabled:bg-zinc-300"
              >
                {saving
                  ? "Salvando..."
                  : alreadyReviewed
                    ? "Atualizar avaliação"
                    : "Enviar avaliação"}
              </button>
            </form>
          )}

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link
              href={`/pedido/${order.order_id}`}
              className="rounded-xl border border-zinc-200 px-5 py-3 text-center font-black transition hover:bg-zinc-50"
            >
              Ver pedido
            </Link>

            <Link
              href={`/restaurante/${order.restaurant_id}`}
              className="rounded-xl border border-zinc-200 px-5 py-3 text-center font-black transition hover:bg-zinc-50"
            >
              Ver restaurante
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
export default function AvaliarPedidoPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7]">
          <p className="font-bold">
            Carregando avaliação...
          </p>
        </main>
      }
    >
      <AvaliarPedidoContent />
    </Suspense>
  );
}