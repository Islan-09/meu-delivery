
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { supabase } from "@/lib/supabase";

type ChatMessage = {
  id: string;
  order_id: string;
  sender_id: string;
  message: string;
  created_at: string;
};

type ChatRole = "cliente" | "restaurante" | "desconhecido";

type ChatPedidoProps = {
  orderId: string;
  conversationOrderIds?: string[];
};

export const CHAT_READ_STORAGE_PREFIX =
  "delivery-paudalho-chat-last-read:";

export default function ChatPedido({
  orderId,
  conversationOrderIds,
}: ChatPedidoProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<ChatRole>("desconhecido");
  const [customerName, setCustomerName] = useState("Cliente");
  const [restaurantName, setRestaurantName] = useState("Restaurante");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const conversationOrderIdsRef = useRef<string[]>([orderId]);

  const activeOrderIds =
    conversationOrderIds?.length
      ? conversationOrderIds
      : [orderId];

  conversationOrderIdsRef.current = activeOrderIds;

  const conversationOrderIdsKey = activeOrderIds.join("|");

  const loadMessages = useCallback(async () => {
    const ids = [...new Set(conversationOrderIdsRef.current)];

    if (ids.length === 0) {
      setMessages([]);
      return;
    }

    const {
      data,
      error: messagesError,
    } = await supabase
      .from("chat_messages")
      .select("id, order_id, sender_id, message, created_at")
      .in("order_id", ids)
      .order("created_at", { ascending: true });

    if (messagesError) {
      setError("Não foi possível carregar as mensagens.");
      console.error("Erro ao carregar chat:", messagesError);
      return;
    }

    setMessages(data ?? []);
    setError("");
  }, []);

  useEffect(() => {
    let active = true;

    async function initialize() {
      setLoading(true);
      setError("");

      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser();

      if (!active) return;

      if (authError || !authData.user) {
        setError("Entre na sua conta para acessar o chat.");
        setLoading(false);
        return;
      }

      const currentUserId = authData.user.id;
      setUserId(currentUserId);

      const {
        data: orderData,
        error: orderError,
      } = await supabase
        .from("orders")
        .select("customer_id, restaurant_id")
        .eq("id", orderId)
        .maybeSingle();

      let currentRole: ChatRole = "desconhecido";

      if (!orderError && orderData) {
        const [profileResult, restaurantResult] =
          await Promise.all([
            supabase
              .from("profiles")
              .select("full_name")
              .eq("id", orderData.customer_id)
              .maybeSingle(),

            supabase
              .from("restaurants")
              .select("name, owner_id")
              .eq("id", orderData.restaurant_id)
              .maybeSingle(),
          ]);

        if (!active) return;

        if (profileResult.error) {
          console.error(
            "Erro ao carregar nome do cliente:",
            profileResult.error
          );
        }

        if (restaurantResult.error) {
          console.error(
            "Erro ao carregar nome da loja:",
            restaurantResult.error
          );
        }

        if (profileResult.data?.full_name) {
          setCustomerName(profileResult.data.full_name);
        }

        if (restaurantResult.data?.name) {
          setRestaurantName(restaurantResult.data.name);
        }

        if (orderData.customer_id === currentUserId) {
          currentRole = "cliente";
        } else if (
          restaurantResult.data?.owner_id === currentUserId
        ) {
          currentRole = "restaurante";
        }
      } else if (orderError) {
        console.error(
          "Erro ao identificar o pedido:",
          orderError
        );
      }

      if (!active) return;

      setRole(currentRole);

      await loadMessages();

      if (active) {
        setLoading(false);
      }
    }

    initialize();

    const channel = supabase
      .channel(`chat-pedido-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        (payload) => {
          const newMessage = payload.new as ChatMessage;

          if (
            !conversationOrderIdsRef.current.includes(
              newMessage.order_id
            )
          ) {
            return;
          }

          setMessages((current) => {
            if (
              current.some((item) => item.id === newMessage.id)
            ) {
              return current;
            }

            return [...current, newMessage].sort(
              (a, b) =>
                new Date(a.created_at).getTime() -
                new Date(b.created_at).getTime()
            );
          });
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [orderId, loadMessages]);

  // Mantém a conversa posicionada na mensagem mais recente.
  useEffect(() => {
    if (!loading) {
      bottomRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  }, [messages, loading]);

  // Marca como lidas as mensagens recebidas em cada pedido
  // incluído na conversa unificada do restaurante.
  useEffect(() => {
    if (loading || role !== "restaurante" || !userId) {
      return;
    }

    const orderIds = [
      ...new Set(conversationOrderIdsRef.current),
    ];

    for (const conversationOrderId of orderIds) {
      const latestCustomerMessage = [...messages]
        .reverse()
        .find(
          (item) =>
            item.order_id === conversationOrderId &&
            item.sender_id !== userId
        );

      if (!latestCustomerMessage) continue;

      const lastReadAt = latestCustomerMessage.created_at;

      localStorage.setItem(
        `${CHAT_READ_STORAGE_PREFIX}${conversationOrderId}`,
        lastReadAt
      );

      window.dispatchEvent(
        new CustomEvent("delivery-chat-read-updated", {
          detail: {
            orderId: conversationOrderId,
            lastReadAt,
          },
        })
      );
    }
  }, [
    messages,
    loading,
    role,
    userId,
    orderId,
    conversationOrderIdsKey,
  ]);

  async function sendMessage(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    const text = message.trim();

    if (!text || !userId || sending) return;

    setSending(true);
    setError("");

    const { error: insertError } = await supabase
      .from("chat_messages")
      .insert({
        order_id: orderId,
        sender_id: userId,
        message: text,
      });

    if (insertError) {
      console.error(
        "Erro ao enviar mensagem:",
        insertError
      );

      setError(
        "Não foi possível enviar. Verifique sua conexão e tente novamente."
      );
    } else {
      setMessage("");
      await loadMessages();
    }

    setSending(false);
  }

  function getSenderName(senderId: string) {
    if (senderId === userId) {
      if (role === "cliente") return customerName;
      if (role === "restaurante") return restaurantName;
      return "Você";
    }

    if (role === "cliente") return restaurantName;
    if (role === "restaurante") return customerName;

    return "Outra pessoa";
  }

  return (
    <section className="flex h-full min-h-[400px] min-w-0 flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-[#111] text-white shadow-sm">
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-700 px-5 py-4">
        <div className="min-w-0">
          <h2 className="font-black text-white">
            💬 Conversa
          </h2>

          <p className="mt-1 truncate text-sm text-zinc-400">
            {role === "restaurante"
              ? customerName
              : role === "cliente"
                ? restaurantName
                : "Chat do pedido"}
          </p>
        </div>

        <span className="ml-3 shrink-0 rounded-full bg-green-900/40 px-3 py-1 text-xs font-bold text-green-300">
          Chat ativo
        </span>
      </header>

      <div
        aria-live="polite"
        className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#191919] p-4 sm:p-6"
      >
        {loading ? (
          <p className="text-sm text-zinc-400">
            Carregando mensagens...
          </p>
        ) : messages.length === 0 ? (
          <div className="flex h-full min-h-48 items-center justify-center">
            <div className="text-center">
              <div className="text-4xl">💬</div>

              <p className="mt-3 font-bold text-zinc-200">
                Inicie a conversa
              </p>

              <p className="mt-1 text-sm text-zinc-400">
                Envie uma mensagem para falar com o cliente.
              </p>
            </div>
          </div>
        ) : (
          messages.map((item) => {
            const ownMessage = item.sender_id === userId;

            return (
              <div
                key={item.id}
                className={`flex ${
                  ownMessage ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] min-w-20 overflow-hidden rounded-2xl px-4 py-3 sm:max-w-[75%] ${
                    ownMessage
                      ? "rounded-br-sm bg-blue-600 text-white"
                      : "rounded-bl-sm border border-zinc-700 bg-[#242424] text-zinc-100 shadow-sm"
                  }`}
                >
                  <p
                    className={`mb-1 text-xs font-bold ${
                      ownMessage
                        ? "text-blue-100"
                        : "text-zinc-400"
                    }`}
                  >
                    {getSenderName(item.sender_id)}
                  </p>

                  <p className="whitespace-pre-wrap break-words text-sm leading-6">
                    {item.message}
                  </p>

                  <p
                    className={`mt-2 text-right text-[10px] ${
                      ownMessage
                        ? "text-blue-100"
                        : "text-zinc-400"
                    }`}
                  >
                    {new Date(item.created_at).toLocaleString(
                      "pt-BR"
                    )}
                  </p>
                </div>
              </div>
            );
          })
        )}

        <div ref={bottomRef} />
      </div>

      {error && (
        <p
          role="alert"
          className="shrink-0 border-t border-red-900 bg-red-950 px-4 py-3 text-sm font-medium text-red-300"
        >
          {error}
        </p>
      )}

      <form
        onSubmit={sendMessage}
        className="flex shrink-0 items-end gap-3 border-t border-zinc-700 bg-[#111] p-3 sm:p-4"
      >
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Digite sua mensagem..."
          maxLength={2000}
          rows={1}
          disabled={loading || !userId || sending}
          className="max-h-32 min-h-12 min-w-0 flex-1 resize-y rounded-xl border border-zinc-700 bg-[#222] px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:bg-[#252525] focus:ring-2 focus:ring-blue-900 disabled:opacity-60"
        />

        <button
          type="submit"
          disabled={
            loading || !userId || sending || !message.trim()
          }
          className="h-12 shrink-0 rounded-xl bg-blue-600 px-5 font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? "Enviando..." : "Enviar"}
        </button>
      </form>
    </section>
  );
}