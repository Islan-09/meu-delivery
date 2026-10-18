"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import ChatPedido from "@/app/components/ChatPedido";

type Order = {
  order_id: string;
  restaurant_id: string;
  restaurant_name: string;
  created_at?: string | null;
};

type PreviewMessage = {
  id: string;
  sender_id: string;
  message: string;
  created_at: string;
  order_id?: string;
  conversation_id?: string;
};

type DirectConversationRow = {
  id: string;
  restaurant_id: string;
  customer_id: string;
  created_at: string;
  updated_at: string;
};

type DirectMessageRow = PreviewMessage & {
  conversation_id: string;
};

type RestaurantConversation = {
  key: string;
  mode: "orders" | "direct";
  restaurantId: string;
  restaurantName: string;
  restaurantLogoUrl: string | null;
  orders: Order[];
  orderIds: string[];
  directConversationId: string | null;
  lastMessage: PreviewMessage | null;
  lastActivity: string;
};

function normalizeSearchText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const CHAT_REPLY_PREFIX = "[[ENTREGA_PAUDALHO_REPLY]]";
const CHAT_REPLY_SUFFIX = "[[/ENTREGA_PAUDALHO_REPLY]]";

function conversationPreview(message: PreviewMessage | null) {
  const raw = message?.message?.trim() ?? "";
  if (!raw) return "";

  // Mensagens respondidas guardam um bloco interno com a mensagem citada.
  // Na lista de conversas, mostramos somente o texto real da resposta.
  if (!raw.startsWith(CHAT_REPLY_PREFIX)) return raw;

  const suffixIndex = raw.indexOf(CHAT_REPLY_SUFFIX, CHAT_REPLY_PREFIX.length);
  if (suffixIndex < 0) return "Mensagem respondida";

  const body = raw.slice(suffixIndex + CHAT_REPLY_SUFFIX.length).replace(/^\s*\n?/, "").trim();
  if (body) return body;

  // Caso a mensagem antiga não tenha corpo após o marcador, usamos o texto citado.
  try {
    const payload = JSON.parse(raw.slice(CHAT_REPLY_PREFIX.length, suffixIndex)) as { text?: unknown };
    if (typeof payload.text === "string" && payload.text.trim()) return payload.text.trim();
  } catch {
    // Evita expor o marcador técnico na prévia.
  }

  return "Mensagem respondida";
}

function getUuidFromRpc(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  if (value && typeof value === "object" && "id" in value && typeof value.id === "string") {
    return value.id;
  }
  return "";
}

export default function MensagensPage() {
  const [conversations, setConversations] = useState<RestaurantConversation[]>([]);
  const [selectedConversationKey, setSelectedConversationKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [userId, setUserId] = useState("");
  const [requestedRestaurantId, setRequestedRestaurantId] = useState("");
  const handledRequestRef = useRef("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRequestedRestaurantId(params.get("restaurant") ?? "");
  }, []);

  const loadConversations = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError("");

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setUserId("");
      setConversations([]);
      setSelectedConversationKey(null);
      setError("Entre na sua conta para acessar suas mensagens.");
      setLoading(false);
      return;
    }

    const currentUserId = authData.user.id;
    setUserId(currentUserId);

    const [ordersResponse, directConversationsResponse] = await Promise.all([
      supabase.rpc("get_my_orders"),
      supabase
        .from("restaurant_direct_conversations")
        .select("id, restaurant_id, customer_id, created_at, updated_at")
        .eq("customer_id", currentUserId)
        .order("updated_at", { ascending: false }),
    ]);

    if (ordersResponse.error) {
      console.warn("Não foi possível carregar o histórico de pedidos:", ordersResponse.error);
    }
    if (directConversationsResponse.error) {
      console.error("Não foi possível carregar conversas diretas:", directConversationsResponse.error);
    }

    const orders = ((ordersResponse.data ?? []) as Order[]).filter(
      (order) => order.order_id && order.restaurant_id
    );
    const orderIds = [...new Set(orders.map((order) => order.order_id))];
    const directRows = (directConversationsResponse.data ?? []) as DirectConversationRow[];
    const directIds = [...new Set(directRows.map((item) => item.id))];

    const [restaurantAssetsResponse, orderMessagesResponse, directMessagesResponse] = await Promise.all([
      (() => {
        const ids = [...new Set([...orders.map((item) => item.restaurant_id), ...directRows.map((item) => item.restaurant_id)])];
        return ids.length
          ? supabase.from("restaurants").select("id, name, logo_url").in("id", ids)
          : Promise.resolve({ data: [], error: null } as any);
      })(),
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

    if (restaurantAssetsResponse.error) {
      console.warn("Não foi possível carregar os nomes e logos das lojas:", restaurantAssetsResponse.error);
    }
    if (orderMessagesResponse.error) {
      console.warn("Não foi possível carregar as mensagens ligadas aos pedidos:", orderMessagesResponse.error);
    }
    if (directMessagesResponse.error) {
      console.error("Não foi possível carregar as mensagens diretas:", directMessagesResponse.error);
    }

    const restaurantById = new Map<string, { name: string; logo: string | null }>();
    for (const row of (restaurantAssetsResponse.data ?? []) as Array<{ id: string; name: string; logo_url: string | null }>) {
      restaurantById.set(row.id, { name: row.name || "Restaurante", logo: row.logo_url ?? null });
    }
    for (const order of orders) {
      if (!restaurantById.has(order.restaurant_id)) {
        restaurantById.set(order.restaurant_id, { name: order.restaurant_name || "Restaurante", logo: null });
      }
    }

    const oldMessages = (orderMessagesResponse.data ?? []) as PreviewMessage[];
    const messagesByOrder = new Map<string, PreviewMessage[]>();
    for (const item of oldMessages) {
      if (!item.order_id) continue;
      const rows = messagesByOrder.get(item.order_id) ?? [];
      rows.push(item);
      messagesByOrder.set(item.order_id, rows);
    }

    const ordersGrouped = new Map<string, RestaurantConversation>();
    const sortedOrders = [...orders].sort(
      (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
    );

    for (const order of sortedOrders) {
      const orderMessages = messagesByOrder.get(order.order_id) ?? [];
      if (orderMessages.length === 0) continue;
      const restaurant = restaurantById.get(order.restaurant_id);
      const lastMessage = orderMessages[orderMessages.length - 1] ?? null;
      let row = ordersGrouped.get(order.restaurant_id);
      if (!row) {
        row = {
          key: `restaurant:${order.restaurant_id}`,
          mode: "orders",
          restaurantId: order.restaurant_id,
          restaurantName: restaurant?.name || order.restaurant_name || "Restaurante",
          restaurantLogoUrl: restaurant?.logo ?? null,
          orders: [],
          orderIds: [],
          directConversationId: null,
          lastMessage,
          lastActivity: lastMessage?.created_at ?? order.created_at ?? "",
        };
        ordersGrouped.set(order.restaurant_id, row);
      }
      row.orders.push(order);
      row.orderIds.push(order.order_id);
      if (lastMessage && (!row.lastMessage || new Date(lastMessage.created_at).getTime() > new Date(row.lastMessage.created_at).getTime())) {
        row.lastMessage = lastMessage;
        row.lastActivity = lastMessage.created_at;
      }
    }

    const directMessages = (directMessagesResponse.data ?? []) as DirectMessageRow[];
    const messagesByDirectConversation = new Map<string, DirectMessageRow[]>();
    for (const item of directMessages) {
      const rows = messagesByDirectConversation.get(item.conversation_id) ?? [];
      rows.push(item);
      messagesByDirectConversation.set(item.conversation_id, rows);
    }

    // Uma única conversa por loja: juntamos mensagens dos pedidos anteriores
    // com o canal direto, sem criar uma segunda linha na lista.
    const unifiedByRestaurant = new Map<string, RestaurantConversation>(ordersGrouped);

    for (const row of directRows) {
      const restaurant = restaurantById.get(row.restaurant_id);
      const threadMessages = messagesByDirectConversation.get(row.id) ?? [];
      const latestDirectMessage = threadMessages[threadMessages.length - 1] ?? null;
      let conversation = unifiedByRestaurant.get(row.restaurant_id);

      if (!conversation) {
        conversation = {
          key: `restaurant:${row.restaurant_id}`,
          mode: "direct",
          restaurantId: row.restaurant_id,
          restaurantName: restaurant?.name || "Restaurante",
          restaurantLogoUrl: restaurant?.logo ?? null,
          orders: [],
          orderIds: [],
          directConversationId: row.id,
          lastMessage: latestDirectMessage,
          lastActivity: latestDirectMessage?.created_at ?? row.updated_at ?? row.created_at,
        };
        unifiedByRestaurant.set(row.restaurant_id, conversation);
        continue;
      }

      conversation.directConversationId = row.id;
      conversation.mode = "direct";
      conversation.key = `restaurant:${row.restaurant_id}`;
      if (latestDirectMessage && (!conversation.lastMessage || new Date(latestDirectMessage.created_at).getTime() > new Date(conversation.lastMessage.created_at).getTime())) {
        conversation.lastMessage = latestDirectMessage;
        conversation.lastActivity = latestDirectMessage.created_at;
      }
    }

    const nextConversations = [...unifiedByRestaurant.values()].sort(
      (a, b) => new Date(b.lastActivity || 0).getTime() - new Date(a.lastActivity || 0).getTime()
    );

    setConversations(nextConversations);
    setSelectedConversationKey((current) =>
      current && nextConversations.some((item) => item.key === current) ? current : null
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadConversations();

    const channel = supabase
      .channel("mensagens-cliente-lista-com-chat-direto")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, () => void loadConversations(false))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "restaurant_direct_messages" }, () => void loadConversations(false))
      .subscribe();

    const interval = window.setInterval(() => void loadConversations(false), 5000);
    return () => {
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [loadConversations]);

  // Ao chegar do botão da loja, reabre uma conversa existente; se não houver,
  // cria a conversa direta e seleciona a mesma tela de mensagens.
  useEffect(() => {
    if (!requestedRestaurantId || loading || !userId) return;
    if (
      handledRequestRef.current === requestedRestaurantId ||
      handledRequestRef.current === `opening:${requestedRestaurantId}`
    ) return;
    handledRequestRef.current = `opening:${requestedRestaurantId}`;
    const requestId = requestedRestaurantId;

    async function openRequestedRestaurant() {
      try {
        const existingConversation = conversations.find(
          (item) => item.restaurantId === requestId
        );
        if (existingConversation?.directConversationId) {
          setSelectedConversationKey(existingConversation.key);
          handledRequestRef.current = requestId;
          return;
        }

        const { data, error: createError } = await supabase.rpc(
          "get_or_create_restaurant_direct_conversation",
          { p_restaurant_id: requestId }
        );
        const conversationId = getUuidFromRpc(data);

        if (createError || !conversationId) {
          console.error("Erro ao iniciar conversa direta:", createError);
          setError("Não foi possível abrir a conversa com esta loja. Tente novamente.");
          handledRequestRef.current = "";
          return;
        }

        const { data: restaurantData, error: restaurantError } = await supabase
          .from("restaurants")
          .select("id, name, logo_url")
          .eq("id", requestId)
          .maybeSingle();
        if (restaurantError) console.warn("Erro ao carregar dados da loja:", restaurantError);

        const stableKey = `restaurant:${requestId}`;
        setConversations((current) => {
          const existing = current.find((item) => item.restaurantId === requestId);
          if (existing) {
            const updated = {
              ...existing,
              key: stableKey,
              mode: "direct" as const,
              restaurantName: restaurantData?.name || existing.restaurantName || "Restaurante",
              restaurantLogoUrl: restaurantData?.logo_url ?? existing.restaurantLogoUrl,
              directConversationId: conversationId,
              lastActivity: existing.lastActivity || new Date().toISOString(),
            };
            return [updated, ...current.filter((item) => item.restaurantId !== requestId)].sort(
              (a, b) => new Date(b.lastActivity || 0).getTime() - new Date(a.lastActivity || 0).getTime()
            );
          }

          const newConversation: RestaurantConversation = {
            key: stableKey,
            mode: "direct",
            restaurantId: requestId,
            restaurantName: restaurantData?.name || "Restaurante",
            restaurantLogoUrl: restaurantData?.logo_url ?? null,
            orders: [],
            orderIds: [],
            directConversationId: conversationId,
            lastMessage: null,
            lastActivity: new Date().toISOString(),
          };
          return [newConversation, ...current].sort(
            (a, b) => new Date(b.lastActivity || 0).getTime() - new Date(a.lastActivity || 0).getTime()
          );
        });
        setSelectedConversationKey(stableKey);
        handledRequestRef.current = requestId;
      } catch (error) {
        console.error("Erro ao abrir conversa da loja:", error);
        setError("Não foi possível abrir a conversa com esta loja. Tente novamente.");
        handledRequestRef.current = "";
      }
    }
    void openRequestedRestaurant();
  }, [requestedRestaurantId, loading, userId, conversations]);

  const selectedConversation = conversations.find((item) => item.key === selectedConversationKey) ?? null;
  const normalizedSearch = normalizeSearchText(searchTerm);
  const filteredConversations = conversations.filter((item) =>
    !normalizedSearch || normalizeSearchText(item.restaurantName).includes(normalizedSearch)
  );

  return (
    <main className="min-h-screen overflow-x-hidden bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <Link href="/" className="font-black text-red-600">Entrega Paudalho</Link>
          <Link href="/meus-pedidos" className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-bold transition hover:bg-zinc-50">Meus pedidos</Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5">
          <p className="text-xs font-black uppercase tracking-wider text-red-600">Atendimento</p>
          <h1 className="mt-1 text-3xl font-black">Minhas mensagens</h1>
          <p className="mt-2 text-sm text-zinc-500">Converse com as lojas e acompanhe seu histórico de mensagens em um só lugar.</p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
            {error.startsWith("Entre") && <Link href="/login" className="ml-2 underline">Entrar</Link>}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-80 items-center justify-center rounded-2xl border border-zinc-200 bg-white">
            <p className="text-sm font-semibold text-zinc-500">Carregando mensagens...</p>
          </div>
        ) : (
          <div className="grid h-[calc(100vh-250px)] min-h-[560px] grid-rows-[minmax(0,1fr)] gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white">
              <div className="shrink-0 border-b border-zinc-100 px-4 py-3">
                <h2 className="font-black">Conversas</h2>
                <p className="mt-1 text-xs text-zinc-500">{conversations.length} {conversations.length === 1 ? "conversa" : "conversas"}</p>
              </div>
              <div className="shrink-0 border-b border-zinc-100 p-3">
                <label htmlFor="search-restaurants" className="sr-only">Pesquisar restaurante</label>
                <div className="relative">
                  <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">🔎</span>
                  <input id="search-restaurants" type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Pesquisar loja..." className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pl-10 pr-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-red-300 focus:bg-white focus:ring-2 focus:ring-red-100" />
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
                {conversations.length === 0 ? (
                  <div className="flex h-full min-h-40 flex-col items-center justify-center px-4 text-center">
                    <span className="text-3xl">💬</span>
                    <p className="mt-3 text-sm font-bold text-zinc-700">Nenhuma conversa ainda</p>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">Entre na página de uma loja e escolha “Falar com a loja” para iniciar uma conversa.</p>
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <div className="px-3 py-8 text-center"><p className="text-sm font-bold text-zinc-700">Nenhuma loja encontrada</p><p className="mt-1 text-xs text-zinc-500">Tente outro nome.</p></div>
                ) : (
                  filteredConversations.map((conversation) => {
                    const selected = conversation.key === selectedConversationKey;
                    return (
                      <button key={conversation.key} type="button" onClick={() => setSelectedConversationKey((current) => current === conversation.key ? null : conversation.key)} className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${selected ? "border-red-200 bg-red-50" : "border-transparent hover:bg-zinc-50"}`}>
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-200 bg-orange-100 text-xl">
                          {conversation.restaurantLogoUrl ? <img src={conversation.restaurantLogoUrl} alt={`Logo de ${conversation.restaurantName}`} className="h-full w-full object-cover" loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : "🏪"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-black">{conversation.restaurantName}</span>
                          {conversation.lastMessage &&
                            conversation.lastMessage.sender_id !== userId &&
                            conversationPreview(conversation.lastMessage) && (
                              <span className="mt-1 block truncate text-xs text-zinc-500">
                                {conversationPreview(conversation.lastMessage)}
                              </span>
                            )}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </aside>

            <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              {selectedConversation ? (
                <ChatPedido
                  key={selectedConversation.key}
                  orderId={selectedConversation.orderIds[0] ?? ""}
                  conversationOrderIds={selectedConversation.orderIds}
                  directConversationId={selectedConversation.directConversationId}
                  counterpartName={selectedConversation.restaurantName}
                />
              ) : (
                <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-white via-red-50/40 to-orange-50/70 p-8 text-center">
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-500 via-orange-400 to-red-500" />
                  <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-[2rem] border border-red-100 bg-white text-5xl shadow-sm">💬</div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-red-600">Entrega Paudalho</p>
                  <h2 className="mt-3 text-2xl font-black text-zinc-900 sm:text-3xl">Suas conversas, em um só lugar</h2>
                  <p className="mt-3 max-w-md text-sm leading-6 text-zinc-500">Escolha uma conversa à esquerda para enviar mensagens ou continuar o histórico com a loja.</p>
                  <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-zinc-400"><span className="rounded-full border border-zinc-200 bg-white/80 px-3 py-1.5">🔒 Conversas privadas</span><span className="rounded-full border border-zinc-200 bg-white/80 px-3 py-1.5">💬 Mensagens em tempo real</span></div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
