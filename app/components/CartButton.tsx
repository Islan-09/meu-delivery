"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SavedCartItem = {
  quantity?: number;
};

export default function CartButton() {
  const [itemCount, setItemCount] =
    useState(0);

  function updateCount() {
    let total = 0;

    try {
      for (
        let index = 0;
        index < localStorage.length;
        index++
      ) {
        const key =
          localStorage.key(index);

        if (
          !key ||
          !key.startsWith("cart-")
        ) {
          continue;
        }

        const saved =
          localStorage.getItem(key);

        if (!saved) continue;

        const parsed =
          JSON.parse(saved);

        if (!Array.isArray(parsed)) {
          continue;
        }

        total += parsed.reduce(
          (
            sum: number,
            item: SavedCartItem
          ) =>
            sum +
            Number(
              item.quantity ?? 0
            ),
          0
        );
      }
    } catch (error) {
      console.error(
        "Erro ao contar carrinhos:",
        error
      );
    }

    setItemCount(total);
  }

  useEffect(() => {
    updateCount();

    window.addEventListener(
      "focus",
      updateCount
    );

    window.addEventListener(
      "cart-updated",
      updateCount
    );

    function handleVisibility() {
      if (
        document.visibilityState ===
        "visible"
      ) {
        updateCount();
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    return () => {
      window.removeEventListener(
        "focus",
        updateCount
      );

      window.removeEventListener(
        "cart-updated",
        updateCount
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );
    };
  }, []);

  return (
    <Link
      href="/carrinho"
      className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200 bg-white text-xl transition hover:border-red-200 hover:bg-red-50"
      title="Meu carrinho"
    >
      🛒

      {itemCount > 0 && (
        <span className="absolute -right-2 -top-2 flex min-h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-black text-white">
          {itemCount > 99
            ? "99+"
            : itemCount}
        </span>
      )}
    </Link>
  );
}