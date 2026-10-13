
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

import ChatPedido, {
  CHAT_READ_STORAGE_PREFIX,
} from "@/app/components/ChatPedido";

type Order = {
  order_id: string;
  restaurant_id: string;
  customer_name?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type ChatMessage = {
  id: string;
  order_id: string;
  sender_id: string;
  message: string;
  created_at: string;
};

type OrderConversation = {
  order: Order;
  messages: ChatMessage[];
  incomingMessages: ChatMessage[];
  lastMessage: ChatMessage;
  unreadCount: number;
};

type CustomerConversation = {
  customerId: string;
  customerName: string;
  orders: OrderConversation[];
  lastMessage: ChatMessage;
  unreadCount: number;
};

type MensagensSectionProps = {
  initialOrderId?: string | null;
};

const MESSAGE_SOUND_STORAGE_PREFIX =
  "delivery-paudalho-sound-new-messages:";

let messageAudioContext: AudioContext | null = null;

function getMessageAudioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  const AudioContextConstructor = window.AudioContext;

  if (!AudioContextConstructor) {
    return null;
  }

  if (!messageAudioContext) {
    messageAudioContext =
      new AudioContextConstructor();
  }

  return messageAudioContext;
}

function playMessageNotificationSound() {
  const context = getMessageAudioContext();

  if (!context) {
    return;
  }

  const play = () => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";

    oscillator.frequency.setValueAtTime(
      880,
      context.currentTime
    );

    gain.gain.setValueAtTime(
      0.0001,
      context.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
      0.15,
      context.currentTime + 0.02
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      context.currentTime + 0.3
    );

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start();
    oscillator.stop(context.currentTime + 0.3);
  };

  if (context.state === "suspended") {
    void context.resume().then(play).catch((error) => {
      console.error(
        "Não foi possível reproduzir o som da mensagem:",
        error
      );
    });

    return;
  }

  play();
}

function countUnread(
  orderId: string,
  incomingMessages: ChatMessage[]
) {
  const lastReadAt = localStorage.getItem(
    `${CHAT_READ_STORAGE_PREFIX}${orderId}`
  );

  if (!lastReadAt) {
    return incomingMessages.length;
  }

  const lastReadTime = new Date(lastReadAt).getTime();

  return incomingMessages.filter(
    (item) =>
      new Date(item.created_at).getTime() > lastReadTime
  ).length;
}

export default function MensagensSection({
  initialOrderId = null,
}: MensagensSectionProps) {
  const searchParams = useSearchParams();

  const restaurantId =
    searchParams.get("restaurant") ?? "";

  const [conversations, setConversations] =
    useState<CustomerConversation[]>([]);

  const [selectedOrderId, setSelectedOrderId] =
    useState<string | null>(initialOrderId);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [soundNewMessages, setSoundNewMessages] =
    useState(false);

  // Guarda os IDs vistos para não repetir o som
  // a cada atualização automática da lista.
  const seenMessageIdsRef =
    useRef<Set<string> | null>(null);

  // Carrega a preferência salva para esta loja.
  useEffect(() => {
    if (!restaurantId) {
      setSoundNewMessages(false);
      return;
    }

    const savedPreference = localStorage.getItem(
      `${MESSAGE_SOUND_STORAGE_PREFIX}${restaurantId}`
    );

    setSoundNewMessages(savedPreference === "on");

    // Uma nova loja representa outra lista de mensagens.
    seenMessageIdsRef.current = null;
  }, [restaurantId]);

  function toggleMessageSound() {
    const nextValue = !soundNewMessages;

    setSoundNewMessages(nextValue);

    if (restaurantId) {
      localStorage.setItem(
        `${MESSAGE_SOUND_STORAGE_PREFIX}${restaurantId}`,
        nextValue ? "on" : "off"
      );
    }

    // A interação do usuário permite preparar o áudio
    // para as próximas notificações no navegador.
    if (nextValue) {
      const context = getMessageAudioContext();

      if (context?.state === "suspended") {
        void context.resume().catch(console.error);
      }
    }
  }

  const loadConversations = useCallback(
    async (showLoading = true) => {
      if (showLoading) {
        setLoading(true);
      }

      setError("");

      if (!restaurantId) {
        setConversations([]);
        setSelectedOrderId(null);
        setError("Não foi possível identificar a loja.");
        setLoading(false);
        return;
      }

      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !authData.user) {
        setConversations([]);
        setError(
          "Entre na sua conta para acessar as mensagens."
        );
        setLoading(false);
        return;
      }

      const currentUserId = authData.user.id;

      const {
        data: ordersData,
        error: ordersError,
      } = await supabase.rpc("get_my_restaurant_orders");

      if (ordersError) {
        console.error(
          "Erro ao carregar pedidos:",
          ordersError
        );

        setConversations([]);
        setError("Não foi possível carregar os pedidos.");
        setLoading(false);
        return;
      }

      const restaurantOrders = (
        (ordersData ?? []) as Order[]
      ).filter(
        (order) => order.restaurant_id === restaurantId
      );

      const orderIds = restaurantOrders.map(
        (order) => order.order_id
      );

      if (orderIds.length === 0) {
        setConversations([]);
        setSelectedOrderId(null);
        setLoading(false);
        return;
      }

      const {
        data: orderOwners,
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

        setConversations([]);
        setError(
          "Não foi possível identificar os clientes. Tente atualizar a página."
        );
        setLoading(false);
        return;
      }

      const customerByOrder = new Map<string, string>();

      for (const row of orderOwners ?? []) {
        if (row.customer_id) {
          customerByOrder.set(
            row.id,
            row.customer_id
          );
        }
      }

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
          "Erro ao carregar mensagens:",
          messagesError
        );

        setConversations([]);
        setError("Não foi possível carregar as conversas.");
        setLoading(false);
        return;
      }

      const allMessages =
        (messagesData ?? []) as ChatMessage[];

      // Na primeira carga, registra o histórico existente
      // sem tocar som para mensagens antigas.
      const previouslySeenIds =
        seenMessageIdsRef.current;

      if (previouslySeenIds !== null) {
        const hasNewCustomerMessage = allMessages.some(
          (item) =>
            item.sender_id !== currentUserId &&
            !previouslySeenIds.has(item.id)
        );

        if (soundNewMessages && hasNewCustomerMessage) {
          playMessageNotificationSound();
        }
      }

      // Atualiza a lista de IDs antes que outra atualização
      // possa tratar a mesma mensagem como nova novamente.
      seenMessageIdsRef.current = new Set(
        allMessages.map((item) => item.id)
      );

      const messagesByOrder = new Map<
        string,
        ChatMessage[]
      >();

      for (const item of allMessages) {
        const current =
          messagesByOrder.get(item.order_id) ?? [];

        current.push(item);
        messagesByOrder.set(item.order_id, current);
      }

      // Agrupa os pedidos pelo cliente.
      const grouped = new Map<
        string,
        CustomerConversation
      >();

      for (const order of restaurantOrders) {
        const orderMessages =
          messagesByOrder.get(order.order_id) ?? [];

        const incomingMessages = orderMessages.filter(
          (item) => item.sender_id !== currentUserId
        );

        // Só lista clientes que já enviaram mensagens.
        if (incomingMessages.length === 0) {
          continue;
        }

        const customerId = customerByOrder.get(
          order.order_id
        );

        if (!customerId) {
          console.warn(
            "Pedido sem customer_id disponível:",
            order.order_id
          );
          continue;
        }

        const lastMessage =
          orderMessages[orderMessages.length - 1];

        if (!lastMessage) {
          continue;
        }

        const orderConversation: OrderConversation = {
          order,
          messages: orderMessages,
          incomingMessages,
          lastMessage,
          unreadCount: countUnread(
            order.order_id,
            incomingMessages
          ),
        };

        let customer = grouped.get(customerId);

        if (!customer) {
          customer = {
            customerId,
            customerName: order.customer_name || "Cliente",
            orders: [],
            lastMessage,
            unreadCount: 0,
          };

          grouped.set(customerId, customer);
        }

        customer.orders.push(orderConversation);

        customer.unreadCount +=
          orderConversation.unreadCount;

        if (
          new Date(lastMessage.created_at).getTime() >
          new Date(customer.lastMessage.created_at).getTime()
        ) {
          customer.lastMessage = lastMessage;
        }
      }

      const nextConversations =
        Array.from(grouped.values());

      // Coloca primeiro o pedido com a mensagem mais recente.
      for (const customer of nextConversations) {
        customer.orders.sort(
          (a, b) =>
            new Date(b.lastMessage.created_at).getTime() -
            new Date(a.lastMessage.created_at).getTime()
        );
      }

      nextConversations.sort(
        (a, b) =>
          new Date(b.lastMessage.created_at).getTime() -
          new Date(a.lastMessage.created_at).getTime()
      );

      setConversations(nextConversations);

      setSelectedOrderId((current) => {
        const preferredId = initialOrderId ?? current;

        if (preferredId) {
          const exists = nextConversations.some(
            (customer) =>
              customer.orders.some(
                (thread) =>
                  thread.order.order_id === preferredId
              )
          );

          if (exists) {
            return preferredId;
          }

          if (initialOrderId) {
            return null;
          }
        }

        return (
          nextConversations[0]?.orders[0]?.order.order_id ??
          null
        );
      });

      setLoading(false);
    },
    [
      restaurantId,
      initialOrderId,
      soundNewMessages,
    ]
  );

  useEffect(() => {
    void loadConversations();

    const channel = supabase
      .channel(`lista-mensagens-${restaurantId}`)
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

    const refresh = () => {
      void loadConversations(false);
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

      window.removeEventListener("storage", refresh);
    };
  }, [loadConversations, restaurantId]);

  const selectedCustomer = conversations.find(
    (customer) =>
      customer.orders.some(
        (thread) =>
          thread.order.order_id === selectedOrderId
      )
  );

  const selectedThread = selectedCustomer?.orders.find(
    (thread) =>
      thread.order.order_id === selectedOrderId
  );

  const totalUnread = conversations.reduce(
    (total, customer) =>
      total + customer.unreadCount,
    0
  );

  return (
    <div className="flex min-h-0 flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-red-600">
            Atendimento
          </p>

          <h2 className="mt-1 text-2xl font-black text-zinc-900">
            Mensagens
          </h2>

          <p className="mt-1 text-sm text-zinc-500">
            Histórico unificado de mensagens por cliente.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={toggleMessageSound}
            aria-pressed={soundNewMessages}
            className={`rounded-xl border px-4 py-2.5 text-sm font-bold shadow-sm transition ${
              soundNewMessages
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            🔔 Som de mensagens:{" "}
            {soundNewMessages ? "Ligado" : "Desligado"}
          </button>

          {totalUnread > 0 && (
            <span className="rounded-full bg-red-600 px-3 py-1.5 text-sm font-black text-white">
              {totalUnread}{" "}
              {totalUnread === 1
                ? "mensagem não lida"
                : "mensagens não lidas"}
            </span>
          )}
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-80 items-center justify-center rounded-2xl border border-zinc-200 bg-white">
          <p className="text-sm font-semibold text-zinc-500">
            Carregando conversas...
          </p>
        </div>
      ) : (
        <div className="grid h-[calc(100vh-225px)] min-h-[500px] gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-4 py-4">
              <h3 className="font-black text-zinc-900">
                Clientes
              </h3>

              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-600">
                {conversations.length}
              </span>
            </div>

            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
              {conversations.length === 0 ? (
                <div className="flex h-full min-h-48 flex-col items-center justify-center px-4 text-center">
                  <span className="text-3xl">💬</span>

                  <p className="mt-3 font-bold text-zinc-700">
                    Nenhuma conversa ainda
                  </p>

                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    Os clientes aparecerão aqui quando enviarem a primeira mensagem.
                  </p>
                </div>
              ) : (
                conversations.map((customer) => {
                  const selected =
                    customer.customerId ===
                    selectedCustomer?.customerId;

                  return (
                    <button
                      key={customer.customerId}
                      type="button"
                      onClick={() =>
                        setSelectedOrderId(
                          customer.orders[0].order.order_id
                        )
                      }
                      className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
                        selected
                          ? "border-blue-200 bg-blue-50"
                          : "border-transparent hover:bg-zinc-50"
                      }`}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-lg">
                        👤
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span
                            className={`truncate text-sm ${
                              customer.unreadCount > 0
                                ? "font-black text-zinc-900"
                                : "font-bold text-zinc-700"
                            }`}
                          >
                            {customer.customerName}
                          </span>

                          {customer.unreadCount > 0 && (
                            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-black text-white">
                              {customer.unreadCount > 99
                                ? "99+"
                                : customer.unreadCount}
                            </span>
                          )}
                        </span>

                        <span className="mt-1 block truncate text-xs text-zinc-500">
                          {customer.lastMessage.message}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl">
            {selectedCustomer && selectedThread ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <ChatPedido
                  key={selectedCustomer.customerId}
                  orderId={selectedThread.order.order_id}
                  conversationOrderIds={selectedCustomer.orders.map(
                    (thread) => thread.order.order_id
                  )}
                />
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
                <span className="text-5xl">💬</span>

                <h3 className="mt-4 text-lg font-black text-zinc-900">
                  Escolha uma conversa
                </h3>

                <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">
                  Selecione o perfil de um cliente à esquerda para abrir o histórico completo de mensagens.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
