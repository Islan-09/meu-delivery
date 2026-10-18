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
  CHAT_DIRECT_READ_STORAGE_PREFIX,
} from "@/app/components/ChatPedido";

type Order = {
  order_id: string;
  restaurant_id: string;
  customer_name?: string | null;
  status?: string | null;
  created_at?: string | null;
  total?: number | string | null;
};

type ChatMessage = {
  id: string;
  order_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  conversation_id?: string;
};

type DirectConversation = {
  id: string;
  restaurant_id: string;
  customer_id: string;
  created_at: string;
  updated_at: string;
};

type DirectMessage = {
  id: string;
  conversation_id: string;
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
  accountCode: string | null;
  avatarUrl: string | null;
  orders: OrderConversation[];
  directConversationId: string | null;
  lastMessage: ChatMessage;
  unreadCount: number;
};

type MensagensSectionProps = {
  initialOrderId?: string | null;
};

function normalizeSearchText(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// Remove os metadados internos de resposta antes de mostrar a prévia na lista.
// No painel do restaurante, a prévia fica vazia quando a última mensagem foi enviada pela loja.
function getMessageListPreview(
  message: string | null | undefined,
  senderId: string | null | undefined,
  currentUserId: string | null | undefined,
): string {
  if (!message || !senderId || senderId === currentUserId) return "";

  const prefix = "[[ENTREGA_PAUDALHO_REPLY]]";
  const suffix = "[[/ENTREGA_PAUDALHO_REPLY]]";
  let visibleMessage = message;

  if (visibleMessage.startsWith(prefix)) {
    const suffixIndex = visibleMessage.indexOf(suffix, prefix.length);
    if (suffixIndex !== -1) {
      visibleMessage = visibleMessage.slice(suffixIndex + suffix.length).replace(/^\r?\n/, "");
    }
  }

  // Não exibe um marcador interno caso a mensagem antiga tenha sido gravada de forma incompleta.
  if (visibleMessage.startsWith("[[ENTREGA_PAUDALHO_REPLY")) return "";
  return visibleMessage.trim();
}

function getRpcUuid(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    if (typeof id === "string") return id;
  }
  return "";
}

const MESSAGE_SOUND_STORAGE_PREFIX =
  "delivery-paudalho-sound-new-messages:";

let messageAudioContext: AudioContext | null = null;

function getMessageAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  const AudioContextConstructor = window.AudioContext;
  if (!AudioContextConstructor) return null;

  if (!messageAudioContext) {
    messageAudioContext = new AudioContextConstructor();
  }

  return messageAudioContext;
}

function playMessageNotificationSound() {
  const context = getMessageAudioContext();
  if (!context) return;

  const play = () => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.3);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.3);
  };

  if (context.state === "suspended") {
    void context.resume().then(play).catch((error) => {
      console.error("Não foi possível reproduzir o som da mensagem:", error);
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

  if (!lastReadAt) return incomingMessages.length;

  const lastReadTime = new Date(lastReadAt).getTime();
  return incomingMessages.filter(
    (item) => new Date(item.created_at).getTime() > lastReadTime
  ).length;
}

function countDirectUnread(
  conversationId: string,
  incomingMessages: DirectMessage[]
) {
  const lastReadAt = localStorage.getItem(
    `${CHAT_DIRECT_READ_STORAGE_PREFIX}${conversationId}`
  );
  if (!lastReadAt) return incomingMessages.length;
  const lastReadTime = new Date(lastReadAt).getTime();
  return incomingMessages.filter(
    (item) => new Date(item.created_at).getTime() > lastReadTime
  ).length;
}

export default function MensagensSection({
  initialOrderId = null,
}: MensagensSectionProps) {
  const searchParams = useSearchParams();
  const restaurantId = searchParams.get("restaurant") ?? "";

  const [conversations, setConversations] =
    useState<CustomerConversation[]>([]);
  const [selectedOrderId, setSelectedOrderId] =
    useState<string | null>(initialOrderId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [soundNewMessages, setSoundNewMessages] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);

  // Guarda IDs vistos para não repetir o som em cada atualização automática.
  const seenMessageIdsRef = useRef<Set<string> | null>(null);
  // Evita gerar links assinados para os avatares a cada atualização automática da lista.
  const customerAvatarCacheRef = useRef<
    Map<string, { avatarUrl: string | null; customerName: string; expiresAt: number }>
  >(new Map());
  // Impede que atualizações periódicas criem novamente a conversa para o mesmo pedido.
  const handledOrderOpenRef = useRef("");

  useEffect(() => {
    if (!restaurantId) {
      setSoundNewMessages(false);
      return;
    }

    const savedPreference = localStorage.getItem(
      `${MESSAGE_SOUND_STORAGE_PREFIX}${restaurantId}`
    );
    setSoundNewMessages(savedPreference === "on");
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

    if (nextValue) {
      const context = getMessageAudioContext();
      if (context?.state === "suspended") {
        void context.resume().catch(console.error);
      }
    }
  }

  const loadConversations = useCallback(
    async (showLoading = true) => {
      if (showLoading) setLoading(true);
      setError("");

      if (!restaurantId) {
        setConversations([]);
        setSelectedOrderId(null);
        setError("Não foi possível identificar a loja.");
        setLoading(false);
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        setConversations([]);
        setSelectedOrderId(null);
        setError("Entre na sua conta para acessar as mensagens.");
        setLoading(false);
        return;
      }

      const currentUserId = authData.user.id;
      setViewerUserId(currentUserId);
      const [ordersResponse, directConversationsResponse, directProfilesResponse] = await Promise.all([
        supabase.rpc("get_my_restaurant_orders"),
        supabase
          .from("restaurant_direct_conversations")
          .select("id, restaurant_id, customer_id, created_at, updated_at")
          .eq("restaurant_id", restaurantId)
          .order("updated_at", { ascending: false }),
        supabase.rpc("get_restaurant_direct_customer_profiles", {
          p_restaurant_id: restaurantId,
        }),
      ]);

      if (ordersResponse.error) {
        console.error("Erro ao carregar pedidos para as mensagens:", ordersResponse.error);
      }
      if (directConversationsResponse.error) {
        console.error("Erro ao carregar conversas diretas:", directConversationsResponse.error);
      }
      if (directProfilesResponse.error) {
        console.error("Erro ao carregar nomes de clientes das conversas diretas:", directProfilesResponse.error);
      }

      const restaurantOrders = ((ordersResponse.data ?? []) as Order[]).filter(
        (order) => order.restaurant_id === restaurantId && Boolean(order.order_id)
      );
      const orderIds = [...new Set(restaurantOrders.map((order) => order.order_id))];
      const directRows = ((directConversationsResponse.data ?? []) as DirectConversation[]).filter(
        (row) => row.restaurant_id === restaurantId
      );
      const directIds = [...new Set(directRows.map((row) => row.id))];

      const [accountCodeResponse, ownersResponse, orderMessagesResponse, directMessagesResponse] = await Promise.all([
        orderIds.length
          ? supabase.rpc("get_restaurant_customer_account_codes", { p_restaurant_id: restaurantId })
          : Promise.resolve({ data: [], error: null } as any),
        orderIds.length
          ? supabase.from("orders").select("id, customer_id").in("id", orderIds)
          : Promise.resolve({ data: [], error: null } as any),
        orderIds.length
          ? supabase
              .from("chat_messages")
              .select("id, order_id, sender_id, message, created_at")
              .in("order_id", orderIds)
              .order("created_at", { ascending: true })
          : Promise.resolve({ data: [], error: null } as any),
        directIds.length
          ? supabase
              .from("restaurant_direct_messages")
              .select("id, conversation_id, sender_id, message, created_at")
              .in("conversation_id", directIds)
              .order("created_at", { ascending: true })
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      for (const [label, response] of [
        ["códigos de conta", accountCodeResponse],
        ["clientes dos pedidos", ownersResponse],
        ["mensagens dos pedidos", orderMessagesResponse],
        ["mensagens diretas", directMessagesResponse],
      ] as const) {
        if (response.error) console.error(`Erro ao carregar ${label}:`, response.error);
      }

      const accountCodeByOrder = new Map<string, string | null>(
        ((accountCodeResponse.data ?? []) as Array<{ order_id: string; account_code: string | null }>).map(
          (row) => [row.order_id, row.account_code ?? null] as const
        )
      );
      const customerByOrder = new Map<string, string>();
      for (const row of (ownersResponse.data ?? []) as Array<{ id: string; customer_id: string | null }>) {
        if (row.customer_id) customerByOrder.set(row.id, row.customer_id);
      }

      const orderMessages = (orderMessagesResponse.data ?? []) as ChatMessage[];
      const directMessages = (directMessagesResponse.data ?? []) as DirectMessage[];
      const directProfileByConversation = new Map<string, { customer_id: string; customer_name: string | null }>();
      for (const row of (directProfilesResponse.data ?? []) as Array<{ conversation_id: string; customer_id: string; customer_name: string | null }>) {
        directProfileByConversation.set(row.conversation_id, {
          customer_id: row.customer_id,
          customer_name: row.customer_name,
        });
      }

      const previouslySeenIds = seenMessageIdsRef.current;
      const currentMessageKeys = new Set<string>();
      for (const item of orderMessages) currentMessageKeys.add(`order:${item.id}`);
      for (const item of directMessages) currentMessageKeys.add(`direct:${item.id}`);
      if (previouslySeenIds !== null && soundNewMessages) {
        const hasNewIncoming =
          orderMessages.some((item) => item.sender_id !== currentUserId && !previouslySeenIds.has(`order:${item.id}`)) ||
          directMessages.some((item) => item.sender_id !== currentUserId && !previouslySeenIds.has(`direct:${item.id}`));
        if (hasNewIncoming) playMessageNotificationSound();
      }
      seenMessageIdsRef.current = currentMessageKeys;

      const messagesByOrder = new Map<string, ChatMessage[]>();
      for (const item of orderMessages) {
        const current = messagesByOrder.get(item.order_id) ?? [];
        current.push(item);
        messagesByOrder.set(item.order_id, current);
      }
      const messagesByDirectConversation = new Map<string, DirectMessage[]>();
      for (const item of directMessages) {
        const current = messagesByDirectConversation.get(item.conversation_id) ?? [];
        current.push(item);
        messagesByDirectConversation.set(item.conversation_id, current);
      }

      const grouped = new Map<string, CustomerConversation>();
      // Primeiro, mantém as conversas antigas vinculadas aos pedidos.
      for (const order of restaurantOrders) {
        const orderMessagesForThread = messagesByOrder.get(order.order_id) ?? [];
        const incomingMessages = orderMessagesForThread.filter((item) => item.sender_id !== currentUserId);
        if (incomingMessages.length === 0) continue;

        const customerId = customerByOrder.get(order.order_id);
        if (!customerId) continue;

        const lastMessage = orderMessagesForThread[orderMessagesForThread.length - 1];
        if (!lastMessage) continue;

        const orderConversation: OrderConversation = {
          order,
          messages: orderMessagesForThread,
          incomingMessages,
          lastMessage,
          unreadCount: countUnread(order.order_id, incomingMessages),
        };

        let customer = grouped.get(customerId);
        if (!customer) {
          customer = {
            customerId,
            customerName: order.customer_name || "Cliente",
            accountCode: accountCodeByOrder.get(order.order_id) ?? null,
            avatarUrl: null,
            orders: [],
            directConversationId: null,
            lastMessage,
            unreadCount: 0,
          };
          grouped.set(customerId, customer);
        }

        if (!customer.orders.some((thread) => thread.order.order_id === order.order_id)) {
          customer.orders.push(orderConversation);
        }
        if (!customer.accountCode) customer.accountCode = accountCodeByOrder.get(order.order_id) ?? null;
        customer.unreadCount += orderConversation.unreadCount;
        if (new Date(lastMessage.created_at).getTime() > new Date(customer.lastMessage.created_at).getTime()) {
          customer.lastMessage = lastMessage;
        }
      }

      // Depois, incorpora conversas diretas sem criar uma segunda linha para clientes já existentes.
      for (const direct of directRows) {
        const profile = directProfileByConversation.get(direct.id);
        const customerId = profile?.customer_id || direct.customer_id;
        const threadMessages = messagesByDirectConversation.get(direct.id) ?? [];
        const incomingDirectMessages = threadMessages.filter((item) => item.sender_id !== currentUserId);
        const latestDirectMessage = threadMessages[threadMessages.length - 1];
        const fallbackPreview: ChatMessage = {
          id: `direct-preview-${direct.id}`,
          order_id: "",
          sender_id: customerId,
          message: "Nova conversa — envie uma mensagem",
          created_at: direct.updated_at || direct.created_at,
        };
        const directLastMessage: ChatMessage = latestDirectMessage
          ? {
              id: latestDirectMessage.id,
              order_id: "",
              sender_id: latestDirectMessage.sender_id,
              message: latestDirectMessage.message,
              created_at: latestDirectMessage.created_at,
              conversation_id: direct.id,
            }
          : fallbackPreview;

        let customer = grouped.get(customerId);
        if (!customer) {
          customer = {
            customerId,
            customerName: profile?.customer_name || "Cliente",
            accountCode: null,
            avatarUrl: null,
            orders: [],
            directConversationId: direct.id,
            lastMessage: directLastMessage,
            unreadCount: 0,
          };
          grouped.set(customerId, customer);
        }

        customer.directConversationId = direct.id;
        if (profile?.customer_name) customer.customerName = profile.customer_name;
        customer.unreadCount += countDirectUnread(direct.id, incomingDirectMessages);
        if (new Date(directLastMessage.created_at).getTime() >= new Date(customer.lastMessage.created_at).getTime()) {
          customer.lastMessage = directLastMessage;
        }

        // Inclui os pedidos anteriores desse cliente para mostrar um único histórico combinado.
        for (const order of restaurantOrders) {
          if (customerByOrder.get(order.order_id) !== customerId) continue;
          if (customer.orders.some((thread) => thread.order.order_id === order.order_id)) continue;
          const relatedMessages = messagesByOrder.get(order.order_id) ?? [];
          const incoming = relatedMessages.filter((item) => item.sender_id !== currentUserId);
          customer.orders.push({
            order,
            messages: relatedMessages,
            incomingMessages: incoming,
            lastMessage: relatedMessages[relatedMessages.length - 1] ?? {
              id: `order-preview-${order.order_id}`,
              order_id: order.order_id,
              sender_id: customerId,
              message: "",
              created_at: order.created_at || direct.created_at,
            },
            unreadCount: countUnread(order.order_id, incoming),
          });
        }
      }

      const groupedConversations = Array.from(grouped.values());
      for (const customer of groupedConversations) {
        customer.orders.sort((a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime());
      }

      // Preserva o nome/foto do cliente no histórico antigo, quando há um pedido de referência.
      const nextConversations = await Promise.all(groupedConversations.map(async (customer) => {
        const cached = customerAvatarCacheRef.current.get(customer.customerId);
        if (cached && cached.expiresAt > Date.now()) {
          return { ...customer, customerName: cached.customerName || customer.customerName, avatarUrl: cached.avatarUrl };
        }
        const representativeOrderId = customer.orders.find((thread) => thread.order.order_id)?.order.order_id;
        if (!representativeOrderId) return customer;
        const { data: participantData, error: participantError } = await supabase.rpc("get_chat_participant_profile", { p_order_id: representativeOrderId });
        if (participantError) {
          console.error("Erro ao carregar foto do cliente na lista de mensagens:", participantError);
          customerAvatarCacheRef.current.set(customer.customerId, { avatarUrl: null, customerName: customer.customerName, expiresAt: Date.now() + 60_000 });
          return customer;
        }
        const participant = Array.isArray(participantData) ? participantData[0] : participantData;
        const resolvedName = participant?.customer_name || customer.customerName;
        const avatarPath = String(participant?.avatar_path ?? "").trim();
        let avatarUrl: string | null = null;
        if (avatarPath) {
          const { data: signedAvatar, error: signedAvatarError } = await supabase.storage.from("profile-photos").createSignedUrl(avatarPath, 60 * 60);
          if (signedAvatarError) console.error("Erro ao gerar link da foto do cliente na lista:", signedAvatarError);
          else avatarUrl = signedAvatar?.signedUrl ?? null;
        }
        customerAvatarCacheRef.current.set(customer.customerId, { avatarUrl, customerName: resolvedName, expiresAt: Date.now() + 5 * 60 * 1000 });
        return { ...customer, customerName: resolvedName, avatarUrl };
      }));

      nextConversations.sort((a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime());
      setConversations(nextConversations);

      setSelectedOrderId((current) => {
        const currentDirectId = current?.startsWith("direct:")
          ? current.slice("direct:".length)
          : null;

        // Preserva uma conversa que a pessoa escolheu manualmente.
        if (
          currentDirectId &&
          nextConversations.some((customer) => customer.directConversationId === currentDirectId)
        ) {
          return current;
        }
        if (
          current &&
          current !== initialOrderId &&
          nextConversations.some((customer) => customer.orders.some((thread) => thread.order.order_id === current))
        ) {
          return current;
        }

        // Quando a navegação veio do botão "Falar com cliente", prioriza a
        // conversa direta criada para o cliente daquele pedido.
        const requestedOrderCustomer = initialOrderId
          ? nextConversations.find((customer) => customer.orders.some((thread) => thread.order.order_id === initialOrderId))
          : null;
        if (requestedOrderCustomer?.directConversationId) {
          return `direct:${requestedOrderCustomer.directConversationId}`;
        }
        if (initialOrderId && requestedOrderCustomer) return initialOrderId;

        if (current && nextConversations.some((customer) => customer.orders.some((thread) => thread.order.order_id === current))) {
          return current;
        }
        return null;
      });
      setLoading(false);
    },
    [restaurantId, initialOrderId, soundNewMessages]
  );

  useEffect(() => {
    setSelectedOrderId(initialOrderId);
    // Um novo pedido clicado pode indicar um cliente com quem ainda não existe
    // conversa direta. A criação é feita por RPC seguro que valida o dono da loja.
    if (!initialOrderId) handledOrderOpenRef.current = "";
  }, [initialOrderId]);

  useEffect(() => {
    if (!initialOrderId || loading || !restaurantId) return;

    const handled = handledOrderOpenRef.current;
    if (handled === initialOrderId || handled === `opening:${initialOrderId}`) return;

    handledOrderOpenRef.current = `opening:${initialOrderId}`;
    let cancelled = false;

    async function openOrCreateOrderCustomerConversation() {
      const { data, error: createError } = await supabase.rpc(
        "get_or_create_restaurant_direct_conversation_for_order",
        { p_order_id: initialOrderId }
      );
      const conversationId = getRpcUuid(data);

      if (createError || !conversationId) {
        console.error("Erro ao criar conversa com o cliente do pedido:", createError);
        if (!cancelled) {
          setError("Não foi possível iniciar a conversa com este cliente. Confira se o pedido pertence à sua loja e tente novamente.");
          handledOrderOpenRef.current = "";
        }
        return;
      }

      await loadConversations(false);
      if (cancelled) return;

      setSelectedOrderId(`direct:${conversationId}`);
      handledOrderOpenRef.current = initialOrderId ?? "";
      setError("");
    }

    void openOrCreateOrderCustomerConversation();

    return () => {
      cancelled = true;
    };
  }, [initialOrderId, loading, restaurantId, loadConversations]);

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
        () => void loadConversations(false)
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "restaurant_direct_messages" },
        () => void loadConversations(false)
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "restaurant_direct_conversations" },
        () => void loadConversations(false)
      )
      .subscribe();

    const refresh = () => void loadConversations(false);
    window.addEventListener("delivery-chat-read-updated", refresh);
    window.addEventListener("storage", refresh);
    const interval = window.setInterval(refresh, 5000);

    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(interval);
      window.removeEventListener("delivery-chat-read-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [loadConversations, restaurantId]);

  const selectedDirectConversationId = selectedOrderId?.startsWith("direct:")
    ? selectedOrderId.slice("direct:".length)
    : null;

  const selectedCustomer = conversations.find((customer) =>
    selectedDirectConversationId
      ? customer.directConversationId === selectedDirectConversationId
      : customer.orders.some((thread) => thread.order.order_id === selectedOrderId)
  );

  const selectedThread = selectedCustomer?.orders.find(
    (thread) => thread.order.order_id === selectedOrderId
  );

  const totalUnread = conversations.reduce(
    (total, customer) => total + customer.unreadCount,
    0
  );

  const normalizedConversationSearch = normalizeSearchText(searchTerm);
  const filteredConversations = conversations.filter((customer) =>
    !normalizedConversationSearch ||
    normalizeSearchText(customer.customerName).includes(normalizedConversationSearch) ||
    normalizeSearchText(customer.accountCode).includes(normalizedConversationSearch)
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-red-600">
            Atendimento
          </p>
          <h2 className="mt-1 text-2xl font-black text-zinc-900">
            Mensagens
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Conversas por pedido e mensagens diretas com clientes, no mesmo lugar.
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
            🔔 Som de mensagens: {soundNewMessages ? "Ligado" : "Desligado"}
          </button>

          {totalUnread > 0 && (
            <span className="rounded-full bg-red-600 px-3 py-1.5 text-sm font-black text-white">
              {totalUnread} {totalUnread === 1 ? "mensagem não lida" : "mensagens não lidas"}
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
          <p className="text-sm font-semibold text-zinc-500">Carregando conversas...</p>
        </div>
      ) : (
        <div className="grid h-[calc(100vh-225px)] min-h-[500px] min-w-0 gap-4 lg:grid-cols-[230px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-4 py-4">
              <h3 className="font-black text-zinc-900">Clientes</h3>
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-600">
                {conversations.length}
              </span>
            </div>

            <div className="shrink-0 border-b border-zinc-100 p-3">
              <label htmlFor="search-chat-customers" className="sr-only">
                Pesquisar cliente ou ID da conta
              </label>
              <div className="relative">
                <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                  🔎
                </span>
                <input
                  id="search-chat-customers"
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Pesquisar nome ou ID da conta..."
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pl-10 pr-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
              {conversations.length === 0 ? (
                <div className="flex h-full min-h-48 flex-col items-center justify-center px-4 text-center">
                  <span className="text-3xl">💬</span>
                  <p className="mt-3 font-bold text-zinc-700">Nenhuma conversa ainda</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    As conversas iniciadas pela loja ou por pedidos aparecerão aqui.
                  </p>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="px-3 py-8 text-center">
                  <p className="text-sm font-bold text-zinc-700">Nenhum cliente encontrado</p>
                  <p className="mt-1 text-xs text-zinc-500">Tente outro nome.</p>
                </div>
              ) : (
                filteredConversations.map((customer) => {
                  const selected = customer.customerId === selectedCustomer?.customerId;
                  return (
                    <button
                      key={customer.customerId}
                      type="button"
                      onClick={() => {
                        const conversationTarget = customer.directConversationId
                          ? `direct:${customer.directConversationId}`
                          : customer.orders[0]?.order.order_id ?? null;
                        setSelectedOrderId((current) =>
                          selected && current === conversationTarget
                            ? null
                            : conversationTarget
                        );
                      }}
                      className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
                        selected
                          ? "border-blue-200 bg-blue-50"
                          : "border-transparent hover:bg-zinc-50"
                      }`}
                    >
                      {customer.avatarUrl ? (
                        <img
                          src={customer.avatarUrl}
                          alt={`Foto de ${customer.customerName}`}
                          loading="lazy"
                          className="h-10 w-10 shrink-0 rounded-full border border-zinc-200 bg-zinc-100 object-cover"
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-lg">
                          👤
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className={`truncate text-sm ${customer.unreadCount > 0 ? "font-black text-zinc-900" : "font-bold text-zinc-700"}`}>
                            {customer.customerName}
                          </span>
                          {customer.unreadCount > 0 && (
                            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-black text-white">
                              {customer.unreadCount > 99 ? "99+" : customer.unreadCount}
                            </span>
                          )}
                        </span>
                        {getMessageListPreview(
                          customer.lastMessage.message,
                          customer.lastMessage.sender_id,
                          viewerUserId,
                        ) ? (
                          <span className="mt-1 block truncate text-xs text-zinc-500">
                            {getMessageListPreview(
                              customer.lastMessage.message,
                              customer.lastMessage.sender_id,
                              viewerUserId,
                            )}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl">
            {selectedCustomer && (selectedThread || selectedCustomer.directConversationId) ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <ChatPedido
                  key={`${selectedCustomer.customerId}:${selectedCustomer.directConversationId ?? selectedThread?.order.order_id ?? "legacy"}`}
                  orderId={selectedThread?.order.order_id ?? selectedCustomer.orders[0]?.order.order_id ?? ""}
                  conversationOrderIds={selectedCustomer.orders.map(
                    (thread) => thread.order.order_id
                  )}
                  directConversationId={selectedCustomer.directConversationId}
                  counterpartName={selectedCustomer.customerName}
                  customerOrders={selectedCustomer.orders.map(({ order }) => ({
                    order_id: order.order_id,
                    status: order.status,
                    created_at: order.created_at,
                    total: order.total ?? null,
                  }))}
                  showCustomerOrdersAction={true}
                />
              </div>
            ) : (
              <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
                  <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-red-50" />
                  <div className="absolute -bottom-28 -left-20 h-64 w-64 rounded-full bg-orange-50" />
                </div>

                <div className="relative z-10 flex max-w-md flex-col items-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-red-600 text-4xl text-white shadow-lg shadow-red-200">
                    💬
                  </div>
                  <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-red-600">
                    Delivery Paudalho
                  </p>
                  <h3 className="mt-2 text-2xl font-black tracking-tight text-zinc-900">
                    Atendimento em um só lugar
                  </h3>
                  <p className="mt-3 max-w-sm text-sm leading-6 text-zinc-500">
                    Selecione um cliente à esquerda para continuar a conversa e ver o histórico de mensagens de todos os pedidos dele.
                  </p>
                  <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-500">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    Suas conversas ficam organizadas aqui
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
