
"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { useSearchParams } from "next/navigation";

import { supabase } from "@/lib/supabase";

import {
  CHAT_READ_STORAGE_PREFIX,
} from "@/app/components/ChatPedido";

type RestaurantOrder = {
  order_id: string;
  restaurant_id: string;
};

type OrderOwner = {
  id: string;
  customer_id: string | null;
};

type ChatRow = {
  order_id: string;
  sender_id: string;
  created_at: string;
};

export default function useUnreadMessages() {
  const searchParams = useSearchParams();

  const restaurantId =
    searchParams.get("restaurant") ?? "";

  const [unreadCounts, setUnreadCounts] =
    useState<Record<string, number>>({});

  const [totalUnread, setTotalUnread] =
    useState(0);

  const loadUnreadMessages = useCallback(async () => {
    if (!restaurantId) {
      setUnreadCounts({});
      setTotalUnread(0);
      return;
    }

    const {
      data: authData,
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      setUnreadCounts({});
      setTotalUnread(0);
      return;
    }

    const {
      data: ordersData,
      error: ordersError,
    } = await supabase.rpc(
      "get_my_restaurant_orders"
    );

    if (ordersError) {
      console.error(
        "Erro ao buscar pedidos:",
        ordersError
      );
      return;
    }

    const restaurantOrders = (
      (ordersData ?? []) as RestaurantOrder[]
    ).filter(
      (order) =>
        order.restaurant_id === restaurantId
    );

    const orderIds = restaurantOrders.map(
      (order) => order.order_id
    );

    if (orderIds.length === 0) {
      setUnreadCounts({});
      setTotalUnread(0);
      return;
    }

    // Descobre quais pedidos pertencem ao mesmo cliente.
    const {
      data: ownersData,
      error: ownersError,
    } = await supabase
      .from("orders")
      .select("id, customer_id")
      .in("id", orderIds);

    if (ownersError) {
      console.error(
        "Erro ao identificar os clientes dos pedidos:",
        ownersError
      );
      return;
    }

    const customerByOrder = new Map<string, string>();

    for (const owner of (ownersData ?? []) as OrderOwner[]) {
      if (owner.customer_id) {
        customerByOrder.set(
          owner.id,
          owner.customer_id
        );
      }
    }

    // Busca as mensagens de todos os pedidos da loja.
    const {
      data: messagesData,
      error: messagesError,
    } = await supabase
      .from("chat_messages")
      .select("order_id, sender_id, created_at")
      .in("order_id", orderIds)
      .order("created_at", { ascending: true });

    if (messagesError) {
      console.error(
        "Erro ao buscar mensagens:",
        messagesError
      );
      return;
    }

    // Soma as mensagens não lidas por cliente,
    // em vez de somar somente por pedido.
    const unreadByCustomer: Record<string, number> = {};

    for (const item of (messagesData ?? []) as ChatRow[]) {
      // Não conta mensagens enviadas pelo restaurante.
      if (item.sender_id === authData.user.id) {
        continue;
      }

      const lastReadAt = localStorage.getItem(
        `${CHAT_READ_STORAGE_PREFIX}${item.order_id}`
      );

      const isUnread =
        !lastReadAt ||
        new Date(item.created_at).getTime() >
          new Date(lastReadAt).getTime();

      if (!isUnread) {
        continue;
      }

      // Se algum pedido não tiver cliente identificado,
      // mantém a contagem separada para não misturar pessoas.
      const customerKey =
        customerByOrder.get(item.order_id) ??
        `order:${item.order_id}`;

      unreadByCustomer[customerKey] =
        (unreadByCustomer[customerKey] ?? 0) + 1;
    }

    // Cada pedido da mesma pessoa recebe o mesmo contador.
    const counts: Record<string, number> = {};

    for (const order of restaurantOrders) {
      const customerKey =
        customerByOrder.get(order.order_id) ??
        `order:${order.order_id}`;

      counts[order.order_id] =
        unreadByCustomer[customerKey] ?? 0;
    }

    setUnreadCounts(counts);

    // O total do painel conta cada cliente uma única vez,
    // sem duplicar mensagens por existirem vários pedidos.
    setTotalUnread(
      Object.values(unreadByCustomer).reduce(
        (total, count) => total + count,
        0
      )
    );
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

    const interval = window.setInterval(
      refresh,
      5000
    );

    return () => {
      supabase.removeChannel(channel);

      window.clearInterval(interval);

      window.removeEventListener(
        "delivery-chat-read-updated",
        refresh
      );

      window.removeEventListener(
        "storage",
        refresh
      );
    };
  }, [loadUnreadMessages, restaurantId]);

  return {
    unreadCounts,
    totalUnread,
  };
}
