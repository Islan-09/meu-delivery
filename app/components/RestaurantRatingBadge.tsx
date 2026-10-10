"use client";

import {
  useEffect,
  useState,
} from "react";

import { supabase } from "@/lib/supabase";

type Props = {
  restaurantId: string;
  compact?: boolean;
};

type Summary = {
  average_rating: number | string;
  review_count: number | string;
};

export default function RestaurantRatingBadge({
  restaurantId,
  compact = false,
}: Props) {
  const [
    summary,
    setSummary,
  ] =
    useState<Summary | null>(
      null
    );

  useEffect(() => {
    let cancelled =
      false;

    async function load() {
      const {
        data,
        error,
      } =
        await supabase.rpc(
          "get_restaurant_review_summary",
          {
            p_restaurant_id:
              restaurantId,
          }
        );

      if (
        cancelled
      ) {
        return;
      }

      if (error) {
        console.error(
          "Erro média avaliações:",
          error
        );

        return;
      }

      const result =
        Array.isArray(data)
          ? data[0]
          : data;

      setSummary(
        result ??
          {
            average_rating:
              0,
            review_count:
              0,
          }
      );
    }

    load();

    return () => {
      cancelled =
        true;
    };
  }, [
    restaurantId,
  ]);

  if (!summary) {
    return null;
  }

  const average =
    Number(
      summary.average_rating ??
        0
    );

  const count =
    Number(
      summary.review_count ??
        0
    );

  if (
    count === 0
  ) {
    return (
      <span
        className={`inline-flex items-center rounded-full bg-zinc-100 font-bold text-zinc-500 ${
          compact
            ? "px-2 py-1 text-[11px]"
            : "px-3 py-1.5 text-xs"
        }`}
      >
        ☆ Novo
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-yellow-50 font-black text-yellow-800 ${
        compact
          ? "px-2 py-1 text-[11px]"
          : "px-3 py-1.5 text-xs"
      }`}
      title={`${count} ${
        count === 1
          ? "avaliação"
          : "avaliações"
      }`}
    >
      <span className="text-yellow-500">
        ★
      </span>

      <span>
        {average
          .toFixed(1)
          .replace(
            ".",
            ","
          )}
      </span>

      <span className="font-bold text-yellow-700">
        ({count})
      </span>
    </span>
  );
}
