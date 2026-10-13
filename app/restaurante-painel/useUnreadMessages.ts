
"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { CHAT_READ_STORAGE_PREFIX } from "@/app/components/ChatPedido";

export default function useUnreadMessages() {
  const searchParams = useSearchParams();
  const restaurantId = searchParams.get("restaurant") ?? "";

  const [unreadCounts, setUnreadCounts] =
    useState<Record<string, number>>({});

  const loadUnreadMessages = useCallback(async () => {
    if (!restaurantId) {
      setUnreadCounts({});
      return;
    }

    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) return;

    const { data: ordersData, error: ordersError } =
      await supabase.rpc("get_my_restaurant_orders");

    if (ordersError) {
      console.error("Erro ao buscar pedidos:", ordersError);
      return;
    }

    const orderIds = (ordersData ?? [])
      .filter(
        (order: { restaurant_id: string; order_id: string }) =>
          order.restaurant_id === restaurantId
      )
      .map((order: { order_id: string }) => order.order_id);

    if (orderIds.length === 0) {
      setUnreadCounts({});
      return;
    }

    const { data: messages, error: messagesError } =
      await supabase
        .from("chat_messages")
        .select("order_id, sender_id, created_at")
        .in("order_id", orderIds)
        .order("created_at", { ascending: true });

    if (messagesError) {
      console.error("Erro ao buscar mensagens:", messagesError);
      return;
    }

    const counts: Record<string, number> = {};

    for (const item of messages ?? []) {
      // Não conta as mensagens enviadas pelo próprio restaurante.
      if (item.sender_id === authData.user.id) continue;

      const lastReadAt = localStorage.getItem(
        `${CHAT_READ_STORAGE_PREFIX}${item.order_id}`
      );

      const isUnread =
        !lastReadAt ||
        new Date(item.created_at).getTime() >
          new Date(lastReadAt).getTime();

      if (isUnread) {
        counts[item.order_id] =
          (counts[item.order_id] ?? 0) + 1;
      }
    }

    setUnreadCounts(counts);
  }, [restaurantId]);

  useEffect(() => {
    void loadUnreadMessages();

    const channel = supabase
      .channel(`unread-messages-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        () => {
          void loadUnreadMessages();
        }
      )
      .subscribe();

    const refresh = () => {
      void loadUnreadMessages();
    };

    window.addEventListener(
      "delivery-chat-read-updated",
      refresh
    );

    window.addEventListener("storage", refresh);

    const interval = window.setInterval(refresh, 5000);

    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(interval);

      window.removeEventListener(
        "delivery-chat-read-updated",
        refresh
      );

      window.removeEventListener("storage", refresh);
    };
  }, [loadUnreadMessages, restaurantId]);

  const totalUnread = Object.values(unreadCounts).reduce(
    (total, count) => total + count,
    0
  );

  return { unreadCounts, totalUnread };
}