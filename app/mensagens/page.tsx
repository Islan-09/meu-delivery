
"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import { supabase } from "@/lib/supabase";

import ChatPedido from "@/app/components/ChatPedido";

type Order = {
  order_id: string;
  restaurant_id: string;
  restaurant_name: string;
  created_at?: string | null;
};

type ChatMessage = {
  id: string;
  order_id: string;
  sender_id: string;
  message: string;
  created_at: string;
};

type RestaurantConversation = {
  restaurantId: string;
  restaurantName: string;
  orders: Order[];
  orderIds: string[];
  lastMessage: ChatMessage | null;
  lastActivity: string;
};

export default function MensagensPage() {
  const [conversations, setConversations] =
    useState<RestaurantConversation[]>([]);

  const [selectedRestaurantId, setSelectedRestaurantId] =
    useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadConversations = useCallback(
    async (showLoading = true) => {
      if (showLoading) {
        setLoading(true);
      }

      setError("");

      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !authData.user) {
        setConversations([]);
        setSelectedRestaurantId(null);
        setError(
          "Entre na sua conta para acessar suas mensagens."
        );
        setLoading(false);
        return;
      }

      const {
        data: ordersData,
        error: ordersError,
      } = await supabase.rpc("get_my_orders");

      if (ordersError) {
        console.error(
          "Erro ao buscar pedidos do cliente:",
          ordersError
        );

        setError(
          "Não foi possível carregar seus pedidos."
        );
        setLoading(false);
        return;
      }

      const orders = (
        (ordersData ?? []) as Order[]
      ).filter(
        (order) =>
          order.order_id &&
          order.restaurant_id
      );

      if (orders.length === 0) {
        setConversations([]);
        setSelectedRestaurantId(null);
        setLoading(false);
        return;
      }

      const orderIds = [
        ...new Set(
          orders.map((order) => order.order_id)
        ),
      ];

      const {
        data: messagesData,
        error: messagesError,
      } = await supabase
        .from("chat_messages")
        .select(
          "id, order_id, sender_id, message, created_at"
        )
        .in("order_id", orderIds)
        .order("created_at", { ascending: true });

      if (messagesError) {
        console.error(
          "Erro ao buscar mensagens do cliente:",
          messagesError
        );

        setError(
          "Não foi possível carregar o histórico das conversas."
        );
        setLoading(false);
        return;
      }

      const allMessages =
        (messagesData ?? []) as ChatMessage[];

      const restaurantByOrder =
        new Map<string, string>();

      const grouped =
        new Map<string, RestaurantConversation>();

      const sortedOrders = [...orders].sort(
        (a, b) =>
          new Date(b.created_at ?? 0).getTime() -
          new Date(a.created_at ?? 0).getTime()
      );

      // Agrupa os pedidos pela loja.
      for (const order of sortedOrders) {
        restaurantByOrder.set(
          order.order_id,
          order.restaurant_id
        );

        let conversation = grouped.get(
          order.restaurant_id
        );

        if (!conversation) {
          conversation = {
            restaurantId: order.restaurant_id,
            restaurantName:
              order.restaurant_name || "Restaurante",
            orders: [],
            orderIds: [],
            lastMessage: null,
            lastActivity: order.created_at ?? "",
          };

          grouped.set(
            order.restaurant_id,
            conversation
          );
        }

        conversation.orders.push(order);
        conversation.orderIds.push(order.order_id);
      }

      // Registra as lojas para as quais o cliente
      // já enviou pelo menos uma mensagem.
      const restaurantsWithCustomerMessages =
        new Set<string>();

      // Reúne as mensagens dos pedidos de cada loja.
      for (const item of allMessages) {
        const restaurantId =
          restaurantByOrder.get(item.order_id);

        if (!restaurantId) continue;

        if (item.sender_id === authData.user.id) {
          restaurantsWithCustomerMessages.add(
            restaurantId
          );
        }

        const conversation =
          grouped.get(restaurantId);

        if (!conversation) continue;

        if (
          !conversation.lastMessage ||
          new Date(item.created_at).getTime() >
            new Date(
              conversation.lastMessage.created_at
            ).getTime()
        ) {
          conversation.lastMessage = item;
          conversation.lastActivity =
            item.created_at;
        }
      }

      // Só mostra lojas em que o cliente já enviou
      // uma mensagem, mesmo que tenha vários pedidos.
      const nextConversations =
        [...grouped.values()]
          .filter((conversation) =>
            restaurantsWithCustomerMessages.has(
              conversation.restaurantId
            )
          )
          .sort(
            (a, b) =>
              new Date(b.lastActivity || 0).getTime() -
              new Date(a.lastActivity || 0).getTime()
          );

      setConversations(nextConversations);

      setSelectedRestaurantId((current) => {
        if (
          current &&
          nextConversations.some(
            (conversation) =>
              conversation.restaurantId === current
          )
        ) {
          return current;
        }

        return (
          nextConversations[0]?.restaurantId ?? null
        );
      });

      setLoading(false);
    },
    []
  );

  useEffect(() => {
    void loadConversations();

    // Atualiza a lista quando chega uma mensagem.
    const channel = supabase
      .channel("mensagens-cliente-lista")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        () => {
          void loadConversations(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadConversations]);

  const selectedConversation =
    conversations.find(
      (conversation) =>
        conversation.restaurantId ===
        selectedRestaurantId
    ) ?? null;

  return (
    <main className="min-h-screen overflow-x-hidden bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <Link
            href="/"
            className="font-black text-red-600"
          >
            Delivery Paudalho
          </Link>

          <Link
            href="/meus-pedidos"
            className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-bold transition hover:bg-zinc-50"
          >
            Meus pedidos
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5">
          <p className="text-xs font-black uppercase tracking-wider text-red-600">
            Atendimento
          </p>

          <h1 className="mt-1 text-3xl font-black">
            Minhas mensagens
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            Converse com as lojas e acompanhe o histórico
            das mensagens dos seus pedidos em um só lugar.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}

            {error.startsWith("Entre") && (
              <Link
                href="/login"
                className="ml-2 underline"
              >
                Entrar
              </Link>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-80 items-center justify-center rounded-2xl border border-zinc-200 bg-white">
            <p className="text-sm font-semibold text-zinc-500">
              Carregando mensagens...
            </p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-white p-8 text-center">
            <span className="text-5xl">💬</span>

            <h2 className="mt-4 text-xl font-black">
              Nenhuma conversa iniciada
            </h2>

            <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">
              As lojas aparecerão aqui depois que você
              enviar a primeira mensagem para elas.
            </p>

            <Link
              href="/meus-pedidos"
              className="mt-5 rounded-xl bg-red-600 px-5 py-3 font-bold text-white transition hover:bg-red-700"
            >
              Ver meus pedidos
            </Link>
          </div>
        ) : (
          <div className="grid h-[calc(100vh-250px)] min-h-[560px] grid-rows-[150px_minmax(0,1fr)] gap-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:grid-rows-1">
            <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white">
              <div className="shrink-0 border-b border-zinc-100 px-4 py-3">
                <h2 className="font-black">
                  Restaurantes
                </h2>

                <p className="mt-1 text-xs text-zinc-500">
                  {conversations.length}{" "}
                  {conversations.length === 1
                    ? "loja"
                    : "lojas"}
                </p>
              </div>

              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
                {conversations.map((conversation) => {
                  const selected =
                    conversation.restaurantId ===
                    selectedRestaurantId;

                  return (
                    <button
                      key={conversation.restaurantId}
                      type="button"
                      onClick={() =>
                        setSelectedRestaurantId(
                          conversation.restaurantId
                        )
                      }
                      className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
                        selected
                          ? "border-red-200 bg-red-50"
                          : "border-transparent hover:bg-zinc-50"
                      }`}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xl">
                        🏪
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-black">
                          {conversation.restaurantName}
                        </span>

                        <span className="mt-1 block truncate text-xs text-zinc-500">
                          {conversation.lastMessage?.message ??
                            "Conversa iniciada"}
                        </span>

                        <span className="mt-1 block text-[11px] text-zinc-400">
                          {conversation.orders.length}{" "}
                          {conversation.orders.length === 1
                            ? "pedido"
                            : "pedidos"}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="h-full min-h-0 min-w-0 overflow-hidden rounded-2xl">
              {selectedConversation ? (
                <ChatPedido
                  key={selectedConversation.restaurantId}
                  orderId={
                    selectedConversation.lastMessage
                      ?.order_id ??
                    selectedConversation.orders[0].order_id
                  }
                  conversationOrderIds={
                    selectedConversation.orderIds
                  }
                />
              ) : (
                <div className="flex h-full items-center justify-center rounded-2xl border border-zinc-200 bg-white p-8 text-center">
                  <p className="text-sm text-zinc-500">
                    Selecione uma loja para abrir a conversa.
                  </p>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
