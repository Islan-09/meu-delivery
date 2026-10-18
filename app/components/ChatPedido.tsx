"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

import { createPortal } from "react-dom";

import { supabase } from "@/lib/supabase";

type AttachmentType = "image" | "audio";

type ChatAttachment = {
  id: string;
  message_id?: string;
  order_id: string;
  storage_path: string;
  attachment_type: AttachmentType;
  attachment_name: string | null;
  attachmentUrl?: string | null;
};

type ChatMessage = {
  id: string;
  order_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  attachment_path?: string | null;
  attachment_type?: AttachmentType | null;
  attachment_name?: string | null;
  attachments?: ChatAttachment[];
  source?: "order" | "direct";
  directConversationId?: string;
};

type ChatRole = "cliente" | "restaurante" | "desconhecido";

type CustomerOrderSummary = {
  order_id: string;
  status?: string | null;
  created_at?: string | null;
  total?: number | string | null;
};

type ReplyPreview = {
  senderName: string;
  text: string;
};

const CHAT_REPLY_PREFIX = "[[ENTREGA_PAUDALHO_REPLY]]";
const CHAT_REPLY_SUFFIX = "[[/ENTREGA_PAUDALHO_REPLY]]";

function parseReplyPayload(raw: string): { reply: ReplyPreview | null; body: string } {
  if (!raw.startsWith(CHAT_REPLY_PREFIX)) return { reply: null, body: raw };
  const end = raw.indexOf(CHAT_REPLY_SUFFIX, CHAT_REPLY_PREFIX.length);
  if (end < 0) return { reply: null, body: raw };
  try {
    const payload = JSON.parse(raw.slice(CHAT_REPLY_PREFIX.length, end)) as ReplyPreview;
    const body = raw.slice(end + CHAT_REPLY_SUFFIX.length).replace(/^\n/, "");
    if (typeof payload.senderName !== "string" || typeof payload.text !== "string") {
      return { reply: null, body: raw };
    }
    return { reply: payload, body };
  } catch {
    return { reply: null, body: raw };
  }
}

function formatMoney(value: number | string | null | undefined) {
  return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatOrderStatus(status?: string | null) {
  const names: Record<string, string> = {
    pending: "Novo pedido",
    accepted: "Pedido aceito",
    preparing: "Preparando",
    ready: "Pedido pronto",
    driver_assigned: "Entregador a caminho",
    picked_up: "Pedido coletado",
    delivering: "Em entrega",
    delivered: "Concluído",
    cancelled: "Cancelado",
  };
  return status ? (names[status] ?? status) : "Status indisponível";
}

type ChatPedidoProps = {
  orderId: string;
  conversationOrderIds?: string[];
  /** Nome do participante passado pela lista de conversas como alternativa segura. */
  counterpartName?: string;
  /** Identificador da conversa direta; quando presente, unifica o histórico com os pedidos anteriores. */
  directConversationId?: string | null;
  /** Pedidos conhecidos do cliente selecionado (usados no menu do chat da loja). */
  customerOrders?: CustomerOrderSummary[];
  /** Habilita "Ver pedidos do cliente" somente no painel do restaurante. */
  showCustomerOrdersAction?: boolean;
};

type UploadedAttachment = {
  file: File;
  path: string;
  type: AttachmentType;
};

export const CHAT_READ_STORAGE_PREFIX =
  "delivery-paudalho-chat-last-read:";
export const CHAT_DIRECT_READ_STORAGE_PREFIX =
  "delivery-paudalho-chat-direct-last-read:";

const ATTACHMENT_BUCKET = "chat-attachments";
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_AUDIO_SIZE = 15 * 1024 * 1024;
const MAX_IMAGES_PER_MESSAGE = 3;

function formatAudioTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

type AudioMessagePlayerProps = {
  src: string;
  ownMessage: boolean;
};

function AudioMessagePlayer({
  src,
  ownMessage,
}: AudioMessagePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const bars = [
    10, 16, 12, 22, 15, 25, 13, 19, 28, 17,
    11, 23, 15, 30, 18, 12, 24, 16, 27, 14,
    20, 11, 25, 17, 29, 13, 21, 16, 24, 12,
  ];

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      void audio.play().catch((playError) => {
        console.error("Não foi possível reproduzir o áudio:", playError);
        setPlaying(false);
      });
    } else {
      audio.pause();
    }
  }

  function seekAudio(event: ReactMouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    audio.currentTime = fraction * audio.duration;
    setCurrentTime(audio.currentTime);
  }

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const progressColor = ownMessage ? "bg-blue-100" : "bg-zinc-300";
  const remainingColor = ownMessage ? "bg-blue-300/50" : "bg-zinc-600";

  return (
    <div className="flex w-[min(280px,70vw)] max-w-full items-center gap-3 py-1">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        className="hidden"
        onLoadedMetadata={(event) => {
          const value = event.currentTarget.duration;
          setDuration(Number.isFinite(value) ? value : 0);
        }}
        onDurationChange={(event) => {
          const value = event.currentTarget.duration;
          setDuration(Number.isFinite(value) ? value : 0);
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(0);
          if (audioRef.current) audioRef.current.currentTime = 0;
        }}
      />

      <button
        type="button"
        onClick={togglePlayback}
        aria-label={playing ? "Pausar áudio" : "Reproduzir áudio"}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${
          ownMessage ? "bg-white/15 hover:bg-white/25" : "bg-zinc-700 hover:bg-zinc-600"
        }`}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5 fill-current" aria-hidden="true">
            <path d="M7 4.8c0-.8.9-1.3 1.6-.9l10.1 7.1c.6.4.6 1.3 0 1.8L8.6 19.9c-.7.5-1.6 0-1.6-.9V4.8Z" />
          </svg>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div
          role="slider"
          aria-label="Posição do áudio"
          aria-valuemin={0}
          aria-valuemax={Math.max(1, Math.round(duration))}
          aria-valuenow={Math.round(currentTime)}
          tabIndex={0}
          onClick={seekAudio}
          onKeyDown={(event) => {
            const audio = audioRef.current;
            if (!audio || !Number.isFinite(audio.duration)) return;
            if (event.key === "ArrowRight") audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
            if (event.key === "ArrowLeft") audio.currentTime = Math.max(0, audio.currentTime - 5);
          }}
          className="flex h-9 cursor-pointer items-center gap-[3px] outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          {bars.map((height, index) => {
            const isPlayed = index / bars.length <= progress;
            return (
              <span
                key={index}
                style={{ height: `${height}px` }}
                className={`min-w-[2px] flex-1 rounded-full ${isPlayed ? progressColor : remainingColor}`}
              />
            );
          })}
        </div>
        <div className={`flex justify-between text-[10px] ${ownMessage ? "text-blue-100" : "text-zinc-400"}`}>
          <span>{formatAudioTime(currentTime)}</span>
          <span>{formatAudioTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}

function ChatSenderAvatar({
  avatarUrl,
  senderName,
  isRestaurant,
}: {
  avatarUrl: string | null;
  senderName: string;
  isRestaurant: boolean;
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={`Foto de ${senderName}`}
        className="h-8 w-8 shrink-0 rounded-full border border-zinc-700 bg-zinc-800 object-cover"
        loading="lazy"
        onError={(event) => {
          event.currentTarget.style.visibility = "hidden";
        }}
      />
    );
  }

  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-sm"
      aria-label={isRestaurant ? "Restaurante" : "Cliente"}
    >
      {isRestaurant ? "🏪" : "👤"}
    </span>
  );
}

export default function ChatPedido({
  orderId,
  conversationOrderIds,
  counterpartName,
  directConversationId = null,
  customerOrders = [],
  showCustomerOrdersAction = false,
}: ChatPedidoProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<ChatRole>("desconhecido");
  const [customerName, setCustomerName] = useState(counterpartName || "Cliente");
  const [restaurantName, setRestaurantName] = useState("Restaurante");
  const [customerAvatarUrl, setCustomerAvatarUrl] = useState<string | null>(null);
  const [restaurantLogoUrl, setRestaurantLogoUrl] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingWaveform, setRecordingWaveform] = useState<number[]>([]);
  const [error, setError] = useState("");

  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [selectedImagePreviews, setSelectedImagePreviews] =
    useState<string[]>([]);
  const [selectedAudio, setSelectedAudio] = useState<File | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [openMessageMenuId, setOpenMessageMenuId] = useState<string | null>(null);
  const [messageMenuPosition, setMessageMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const openMessageMenuIdRef = useRef<string | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const hasAutoScrolledRef = useRef(false);
  const previousMessageKeysRef = useRef<string[]>([]);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [showCustomerOrders, setShowCustomerOrders] = useState(false);
  const [readMessageKeys, setReadMessageKeys] = useState<Set<string>>(new Set());
  const readReceiptAttemptedRef = useRef<Set<string>>(new Set());
  const messageTextareaRef = useRef<HTMLTextAreaElement>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const waveformStripRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastWaveSampleAtRef = useRef(0);
  const recordingStartedAtRef = useRef(0);
  const discardRecordingRef = useRef(false);
  const sendRecordingAfterStopRef = useRef(false);
  const conversationOrderIdsRef = useRef<string[]>([]);
  const directConversationIdRef = useRef<string | null>(directConversationId);

  const activeOrderIds = conversationOrderIds?.length
    ? [...new Set(conversationOrderIds.filter(Boolean))]
    : orderId
      ? [orderId]
      : [];
  conversationOrderIdsRef.current = activeOrderIds;
  directConversationIdRef.current = directConversationId || null;
  openMessageMenuIdRef.current = openMessageMenuId;
  const conversationOrderIdsKey = activeOrderIds.join("|");

  const prepareMessage = useCallback(
    async (item: ChatMessage): Promise<ChatMessage> => {
      // Mensagens diretas usam a mesma interface, mas ainda não têm anexos próprios.
      if (item.source === "direct") return { ...item, attachments: [] };

      const attachments: ChatAttachment[] = [];

      const {
        data: attachmentRows,
        error: attachmentError,
      } = await supabase
        .from("chat_message_attachments")
        .select(
          "id, message_id, order_id, storage_path, attachment_type, attachment_name, created_at"
        )
        .eq("message_id", item.id)
        .order("created_at", { ascending: true });

      if (attachmentError) {
        console.error(
          "Erro ao carregar anexos da mensagem:",
          attachmentError
        );
      }

      for (const attachment of attachmentRows ?? []) {
        const { data, error: signedUrlError } = await supabase.storage
          .from(ATTACHMENT_BUCKET)
          .createSignedUrl(attachment.storage_path, 60 * 60);

        attachments.push({
          id: attachment.id,
          message_id: attachment.message_id,
          order_id: attachment.order_id,
          storage_path: attachment.storage_path,
          attachment_type: attachment.attachment_type,
          attachment_name: attachment.attachment_name,
          attachmentUrl:
            !signedUrlError && data?.signedUrl
              ? data.signedUrl
              : null,
        });
      }

      // Compatibilidade com fotos/áudios enviados antes da tabela de anexos.
      if (item.attachment_path && item.attachment_type) {
        const { data, error: signedUrlError } = await supabase.storage
          .from(ATTACHMENT_BUCKET)
          .createSignedUrl(item.attachment_path, 60 * 60);

        attachments.push({
          id: `legacy-${item.id}`,
          message_id: item.id,
          order_id: item.order_id,
          storage_path: item.attachment_path,
          attachment_type: item.attachment_type,
          attachment_name: item.attachment_name ?? null,
          attachmentUrl:
            !signedUrlError && data?.signedUrl
              ? data.signedUrl
              : null,
        });
      }

      return { ...item, attachments };
    },
    []
  );

  const loadMessages = useCallback(async () => {
    const ids = [...new Set(conversationOrderIdsRef.current.filter(Boolean))];
    const activeDirectConversationId = directConversationIdRef.current;

    if (ids.length === 0 && !activeDirectConversationId) {
      setMessages([]);
      return;
    }

    const [orderResponse, directResponse] = await Promise.all([
      ids.length
        ? supabase
            .from("chat_messages")
            .select("id, order_id, sender_id, message, created_at, attachment_path, attachment_type, attachment_name")
            .in("order_id", ids)
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [], error: null } as any),
      activeDirectConversationId
        ? supabase
            .from("restaurant_direct_messages")
            .select("id, conversation_id, sender_id, message, created_at")
            .eq("conversation_id", activeDirectConversationId)
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    if (orderResponse.error) {
      setError("Não foi possível carregar o histórico de mensagens dos pedidos.");
      console.error("Erro ao carregar chat dos pedidos:", orderResponse.error);
      return;
    }
    if (directResponse.error) {
      setError("Não foi possível carregar as mensagens diretas.");
      console.error("Erro ao carregar chat direto:", directResponse.error);
      return;
    }

    const orderRows = ((orderResponse.data ?? []) as ChatMessage[]).map((item) => ({
      ...item,
      source: "order" as const,
    }));
    const directRows = ((directResponse.data ?? []) as Array<{
      id: string; conversation_id: string; sender_id: string; message: string; created_at: string;
    }>).map((item) => ({
      id: item.id,
      // O ID do pedido aqui é somente uma chave de exibição legada; mensagens diretas
      // são identificadas sempre por source + directConversationId.
      order_id: ids[0] ?? "",
      sender_id: item.sender_id,
      message: item.message,
      created_at: item.created_at,
      source: "direct" as const,
      directConversationId: item.conversation_id,
    }));

    const combined = [...orderRows, ...directRows].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const preparedMessages = await Promise.all(combined.map(prepareMessage));
    setMessages(preparedMessages);
    setError("");
  }, [prepareMessage, directConversationId]);

  useEffect(() => {
    let active = true;

    async function initialize() {
      setLoading(true);
      setError("");

      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (!active) return;

      if (authError || !authData.user) {
        setError("Entre na sua conta para acessar o chat.");
        setLoading(false);
        return;
      }

      const currentUserId = authData.user.id;
      setUserId(currentUserId);

      let currentRole: ChatRole = "desconhecido";

      if (directConversationId) {
        const { data: directInfo, error: directInfoError } = await supabase
          .from("restaurant_direct_conversations")
          .select("id, restaurant_id, customer_id")
          .eq("id", directConversationId)
          .maybeSingle();

        if (!active) return;
        if (directInfoError || !directInfo) {
          console.error("Erro ao identificar a conversa direta:", directInfoError);
          setError("Não foi possível identificar esta conversa.");
        } else {
          const { data: restaurantInfo, error: restaurantInfoError } = await supabase
            .from("restaurants")
            .select("name, owner_id, logo_url")
            .eq("id", directInfo.restaurant_id)
            .maybeSingle();

          if (restaurantInfoError) {
            console.error("Erro ao carregar dados da loja:", restaurantInfoError);
          }
          if (!active) return;

          if (restaurantInfo?.name) setRestaurantName(restaurantInfo.name);
          setRestaurantLogoUrl(restaurantInfo?.logo_url ?? null);

          if (directInfo.customer_id === currentUserId) {
            currentRole = "cliente";
            const { data: ownProfile } = await supabase
              .from("profiles")
              .select("full_name, avatar_path")
              .eq("id", currentUserId)
              .maybeSingle();
            const ownName = ownProfile?.full_name ||
              authData.user.user_metadata?.full_name ||
              authData.user.user_metadata?.name || "Você";
            setCustomerName(ownName);
            const avatarPath = String(ownProfile?.avatar_path ?? authData.user.user_metadata?.avatar_path ?? "").trim();
            if (avatarPath) {
              const { data: ownAvatar } = await supabase.storage.from("profile-photos").createSignedUrl(avatarPath, 60 * 60);
              setCustomerAvatarUrl(ownAvatar?.signedUrl ?? null);
            }
          } else if (restaurantInfo?.owner_id === currentUserId) {
            currentRole = "restaurante";
            const { data: profileRows, error: profileRowsError } = await supabase.rpc(
              "get_restaurant_direct_customer_profiles",
              { p_restaurant_id: directInfo.restaurant_id }
            );
            if (profileRowsError) {
              console.error("Erro ao identificar o cliente da conversa direta:", profileRowsError);
            }
            const counterpart = ((profileRows ?? []) as Array<{ conversation_id: string; customer_name: string }>).find(
              (item) => item.conversation_id === directConversationId
            );
            setCustomerName(counterpart?.customer_name || counterpartName || "Cliente");
          }
        }
      } else if (orderId) {
        const { data: orderData, error: orderError } = await supabase
          .from("orders")
          .select("customer_id, restaurant_id")
          .eq("id", orderId)
          .maybeSingle();
  
        if (!orderError && orderData) {
          // Busca os dados do participante por uma função SQL segura. A consulta
          // direta à tabela profiles pode ser bloqueada pelas políticas RLS para o restaurante.
          const [participantResult, restaurantResult] = await Promise.all([
            supabase.rpc("get_chat_participant_profile", {
              p_order_id: orderId,
            }),
            // Busca a logo diretamente como alternativa caso a função RPC
            // não retorne a URL por alguma diferença de permissões/configuração.
            supabase
              .from("restaurants")
              .select("name, owner_id, logo_url")
              .eq("id", orderData.restaurant_id)
              .maybeSingle(),
          ]);
  
          if (!active) return;
  
          const { data: participantData, error: participantError } = participantResult;
          const { data: restaurantInfo, error: restaurantInfoError } = restaurantResult;
  
          if (participantError) {
            console.error("Erro ao carregar dados do participante do chat:", participantError);
          }
          if (restaurantInfoError) {
            console.error("Erro ao carregar logo/nome da loja para o chat:", restaurantInfoError);
          }
  
          const participant = Array.isArray(participantData)
            ? participantData[0]
            : participantData;
  
          const resolvedCustomerName =
            participant?.customer_name || counterpartName || "Cliente";
          setCustomerName(resolvedCustomerName);
  
          const resolvedRestaurantName =
            participant?.restaurant_name || restaurantInfo?.name ||
            (orderData.customer_id === currentUserId ? counterpartName : null);
          if (resolvedRestaurantName) {
            setRestaurantName(resolvedRestaurantName);
          } else if (counterpartName && orderData.customer_id !== currentUserId) {
            setCustomerName(counterpartName);
          }
  
          const customerAvatarPath = String(
            participant?.avatar_path ??
              (orderData.customer_id === currentUserId
                ? authData.user.user_metadata?.avatar_path ?? ""
                : "")
          );
  
          if (customerAvatarPath) {
            const { data: customerAvatar, error: customerAvatarError } =
              await supabase.storage
                .from("profile-photos")
                .createSignedUrl(customerAvatarPath, 60 * 60);
  
            if (customerAvatarError) {
              console.error("Erro ao carregar foto do cliente no chat:", customerAvatarError);
              setCustomerAvatarUrl(null);
            } else {
              setCustomerAvatarUrl(customerAvatar.signedUrl);
            }
          } else {
            setCustomerAvatarUrl(null);
          }
  
          // Usa a URL da logo devolvida pela RPC e consulta restaurants.logo_url
          // como fallback para ela aparecer também no chat do cliente.
          const resolvedRestaurantLogo =
            participant?.restaurant_logo_url || restaurantInfo?.logo_url || null;
          setRestaurantLogoUrl(resolvedRestaurantLogo);
  
          if (orderData.customer_id === currentUserId) {
            currentRole = "cliente";
            const ownAvatarPath = String(authData.user.user_metadata?.avatar_path ?? "");
            if (ownAvatarPath) {
              const { data: ownAvatar, error: ownAvatarError } = await supabase.storage
                .from("profile-photos")
                .createSignedUrl(ownAvatarPath, 60 * 60);
              if (!ownAvatarError && ownAvatar?.signedUrl) {
                setCustomerAvatarUrl(ownAvatar.signedUrl);
              }
            }
          } else if (
            (participant?.restaurant_owner_id ?? restaurantInfo?.owner_id) === currentUserId
          ) {
            currentRole = "restaurante";
          }
        } else if (orderError) {
          console.error("Erro ao identificar o pedido:", orderError);
        }
      }

      if (!active) return;
      setRole(currentRole);
      await loadMessages();
      if (active) setLoading(false);
    }

    void initialize();

    const refreshTimer = window.setTimeout(() => {
      if (active) void loadMessages();
    }, 1200);
    const refreshInterval = window.setInterval(() => {
      if (active) void loadMessages();
    }, 4000);

    const channel = supabase
      .channel(`chat-unificado-${orderId || directConversationId || "sem-id"}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        async (payload) => {
          const newMessage = payload.new as ChatMessage;
          if (
            !conversationOrderIdsRef.current.includes(newMessage.order_id)
          ) {
            return;
          }

          const prepared = await prepareMessage(newMessage);
          if (!active) return;

          setMessages((current) => {
            if (current.some((item) => item.id === prepared.id)) {
              return current;
            }
            return [...current, prepared].sort(
              (a, b) =>
                new Date(a.created_at).getTime() -
                new Date(b.created_at).getTime()
            );
          });

          // As linhas dos anexos são inseridas logo após a mensagem-base.
          window.setTimeout(() => {
            if (active) void loadMessages();
          }, 900);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_message_attachments",
        },
        (payload) => {
          const attachment = payload.new as ChatAttachment;
          if (
            conversationOrderIdsRef.current.includes(attachment.order_id)
          ) {
            void loadMessages();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "restaurant_direct_messages" },
        (payload) => {
          const newMessage = payload.new as {
            id: string; conversation_id: string; sender_id: string; message: string; created_at: string;
          };
          if (!directConversationIdRef.current || newMessage.conversation_id !== directConversationIdRef.current) return;
          const normalized: ChatMessage = {
            id: newMessage.id,
            order_id: conversationOrderIdsRef.current[0] ?? "",
            sender_id: newMessage.sender_id,
            message: newMessage.message,
            created_at: newMessage.created_at,
            source: "direct",
            directConversationId: newMessage.conversation_id,
            attachments: [],
          };
          setMessages((current) => {
            if (current.some((item) => item.id === normalized.id)) return current;
            return [...current, normalized].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          });
        }
      )
      .subscribe();

    return () => {
      active = false;
      window.clearTimeout(refreshTimer);
      window.clearInterval(refreshInterval);
      supabase.removeChannel(channel);
    };
  }, [orderId, directConversationId, loadMessages, prepareMessage]);

  useEffect(() => {
    const previewUrls = selectedImages.map((file) =>
      URL.createObjectURL(file)
    );
    setSelectedImagePreviews(previewUrls);

    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [selectedImages]);

  useEffect(() => {
    if (loading) return;

    const currentKeys = messages.map((item) => `${item.source === "direct" ? "direct" : "order"}:${item.id}`);
    const previousKeys = previousMessageKeysRef.current;
    const firstPositioning = !hasAutoScrolledRef.current;
    const newestKey = currentKeys[currentKeys.length - 1] ?? null;
    const newestWasAdded = !!newestKey && !previousKeys.includes(newestKey);

    // Posiciona no fim apenas na primeira carga ou quando uma mensagem nova é
    // adicionada enquanto a pessoa já estava no fim. Polling/anexos não puxam o chat.
    if (firstPositioning) {
      bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
      hasAutoScrolledRef.current = true;
    } else if (
      newestWasAdded &&
      shouldAutoScrollRef.current &&
      !openMessageMenuIdRef.current
    ) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }

    previousMessageKeysRef.current = currentKeys;
  }, [messages, loading]);

  useEffect(() => {
    if (loading || role !== "restaurante" || !userId) return;

    const orderIds = [...new Set(conversationOrderIdsRef.current)];

    for (const conversationOrderId of orderIds) {
      const latestCustomerMessage = [...messages]
        .reverse()
        .find(
          (item) =>
            item.source !== "direct" &&
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
          detail: { orderId: conversationOrderId, lastReadAt },
        })
      );
    }

    if (directConversationId) {
      const latestDirectCustomerMessage = [...messages].reverse().find(
        (item) => item.source === "direct" && item.sender_id !== userId
      );
      if (latestDirectCustomerMessage) {
        const lastReadAt = latestDirectCustomerMessage.created_at;
        localStorage.setItem(`${CHAT_DIRECT_READ_STORAGE_PREFIX}${directConversationId}`, lastReadAt);
        window.dispatchEvent(new CustomEvent("delivery-chat-read-updated", { detail: { conversationId: directConversationId, lastReadAt } }));
      }
    }
  }, [
    messages,
    loading,
    role,
    userId,
    orderId,
    conversationOrderIdsKey,
    directConversationId,
  ]);

  // Registra no banco quando esta pessoa abriu mensagens recebidas. Isso permite
  // que o remetente veja o visto mesmo em outro navegador ou dispositivo.
  useEffect(() => {
    if (loading || !userId || messages.length === 0) return;

    let cancelled = false;
    async function syncReadReceipts() {
      const eligible = messages.filter((item) => {
        if (item.sender_id === userId) return false;
        const source = item.source === "direct" ? "direct" : "order";
        return !readReceiptAttemptedRef.current.has(`${source}:${item.id}`);
      });

      const receiptRows = eligible.map((item) => {
        const source = item.source === "direct" ? "direct" : "order";
        readReceiptAttemptedRef.current.add(`${source}:${item.id}`);
        return {
          message_source: source,
          message_id: item.id,
          reader_id: userId,
        };
      });

      if (receiptRows.length > 0) {
        const { error: receiptError } = await supabase
          .from("chat_message_read_receipts")
          .upsert(receiptRows, {
            onConflict: "message_source,message_id,reader_id",
            ignoreDuplicates: true,
          });
        if (receiptError) {
          console.error("Não foi possível registrar a visualização das mensagens:", receiptError);
          // Permite tentar novamente em uma próxima atualização.
          for (const row of receiptRows) {
            readReceiptAttemptedRef.current.delete(`${row.message_source}:${row.message_id}`);
          }
        }
      }

      const ids = [...new Set(messages.map((item) => item.id).filter(Boolean))];
      if (ids.length === 0 || cancelled) return;
      const { data, error: readsError } = await supabase
        .from("chat_message_read_receipts")
        .select("message_source, message_id, reader_id")
        .in("message_id", ids)
        .neq("reader_id", userId);

      if (cancelled) return;
      if (readsError) {
        console.error("Não foi possível consultar os vistos das mensagens:", readsError);
        return;
      }
      const next = new Set<string>();
      for (const row of data ?? []) {
        next.add(`${row.message_source}:${row.message_id}`);
      }
      setReadMessageKeys(next);
    }

    void syncReadReceipts();
    return () => { cancelled = true; };
  }, [messages, loading, userId]);

  function getMessageKey(item: ChatMessage) {
    return `${item.source === "direct" ? "direct" : "order"}:${item.id}`;
  }

  async function copyMessage(item: ChatMessage) {
    const visibleBody = parseReplyPayload(item.message ?? "").body.trim();
    const textToCopy = visibleBody && visibleBody !== "📎 Anexos"
      ? visibleBody
      : (item.attachments ?? []).some((attachment) => attachment.attachment_type === "image")
        ? "Foto enviada"
        : (item.attachments ?? []).some((attachment) => attachment.attachment_type === "audio")
          ? "Áudio enviado"
          : "";
    if (!textToCopy) {
      setOpenMessageMenuId(null);
      setMessageMenuPosition(null);
      setError("Esta mensagem não tem texto para copiar.");
      return;
    }
    try {
      await navigator.clipboard.writeText(textToCopy);
      setError("");
    } catch (copyError) {
      console.error("Não foi possível copiar a mensagem:", copyError);
      setError("Não foi possível copiar. Verifique a permissão de área de transferência do navegador.");
    } finally {
      setOpenMessageMenuId(null);
      setMessageMenuPosition(null);
    }
  }

  function startReply(item: ChatMessage) {
    setReplyingTo(item);
    setOpenMessageMenuId(null);
    setMessageMenuPosition(null);
    window.setTimeout(() => messageTextareaRef.current?.focus(), 0);
  }

  async function deleteMessage(item: ChatMessage) {
    setOpenMessageMenuId(null);
    setMessageMenuPosition(null);
    const confirmed = window.confirm("Apagar esta mensagem para você e para a outra pessoa? Essa ação não pode ser desfeita.");
    if (!confirmed || !userId || item.sender_id !== userId) return;

    setError("");
    try {
      if (item.source === "direct") {
        const { error: deleteError } = await supabase
          .from("restaurant_direct_messages")
          .delete()
          .eq("id", item.id)
          .eq("sender_id", userId);
        if (deleteError) throw deleteError;
      } else {
        const { data: attachmentRows, error: attachmentQueryError } = await supabase
          .from("chat_message_attachments")
          .select("id, storage_path")
          .eq("message_id", item.id);
        if (attachmentQueryError) throw attachmentQueryError;

        const storagePaths = [
          ...(attachmentRows ?? []).map((attachment) => attachment.storage_path).filter(Boolean),
          item.attachment_path,
          ...(item.attachments ?? []).map((attachment) => attachment.storage_path),
        ].filter((path): path is string => !!path);
        if (storagePaths.length > 0) {
          const uniquePaths = [...new Set(storagePaths)];
          const { error: storageError } = await supabase.storage.from(ATTACHMENT_BUCKET).remove(uniquePaths);
          if (storageError) console.warn("Não foi possível remover todos os arquivos anexados:", storageError);
        }

        const { error: deleteAttachmentsError } = await supabase
          .from("chat_message_attachments")
          .delete()
          .eq("message_id", item.id);
        if (deleteAttachmentsError) throw deleteAttachmentsError;

        const { error: deleteMessageError } = await supabase
          .from("chat_messages")
          .delete()
          .eq("id", item.id)
          .eq("sender_id", userId);
        if (deleteMessageError) throw deleteMessageError;
      }

      setMessages((current) => current.filter((candidate) => candidate.id !== item.id || candidate.source !== item.source));
      setReadMessageKeys((current) => {
        const next = new Set(current);
        next.delete(getMessageKey(item));
        return next;
      });
    } catch (deleteError) {
      console.error("Erro ao apagar mensagem:", deleteError);
      setError("Não foi possível apagar a mensagem. Confirme se o SQL de permissões do chat foi executado.");
    }
  }

  function messageTextForStorage(text: string) {
    const replyTarget = replyingTo;
    if (!replyTarget) return text;
    const quoted = parseReplyPayload(replyTarget.message ?? "").body.trim() ||
      ((replyTarget.attachments ?? []).some((attachment) => attachment.attachment_type === "image") ? "Foto enviada" : "Mensagem");
    const payload: ReplyPreview = {
      senderName: getSenderName(replyTarget.sender_id),
      text: quoted.slice(0, 240),
    };
    return `${CHAT_REPLY_PREFIX}${JSON.stringify(payload)}${CHAT_REPLY_SUFFIX}\n${text}`;
  }

  function addImagesToSelection(files: File[]) {
    if (files.length === 0) return;

    const validFiles: File[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        setError("Um dos arquivos selecionados não é uma imagem.");
        continue;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        setError("Cada foto deve ter no máximo 10 MB.");
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    const slotsLeft = MAX_IMAGES_PER_MESSAGE - selectedImages.length;
    if (slotsLeft <= 0) {
      setError("Você pode enviar no máximo 3 fotos por mensagem.");
      return;
    }

    const acceptedFiles = validFiles.slice(0, slotsLeft);
    setSelectedImages((current) => [
      ...current,
      ...acceptedFiles,
    ].slice(0, MAX_IMAGES_PER_MESSAGE));

    if (validFiles.length > slotsLeft) {
      setError("O limite é de 3 fotos por mensagem. Adicionei as primeiras disponíveis.");
    } else {
      setError("");
    }
  }

  function removeSelectedImage(indexToRemove: number) {
    setSelectedImages((current) =>
      current.filter((_, index) => index !== indexToRemove)
    );
    setError("");
  }

  function handleImageSelection(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);
    addImagesToSelection(files);
    input.value = "";
  }

  function handlePasteImage(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.items)
      .filter((item) => item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);

    if (files.length === 0) return;

    event.preventDefault();
    const namedFiles = files.map((file, index) => {
      const extension = file.type.split("/")[1] || "png";
      return new File(
        [file],
        `imagem-colada-${Date.now()}-${index + 1}.${extension}`,
        { type: file.type }
      );
    });
    addImagesToSelection(namedFiles);
  }

  async function sendMessage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = message.trim();

    // A conversa direta usa a mesma interface e soma o histórico dos pedidos,
    // mas novas mensagens textuais são gravadas na conversa permanente da loja.
    if (directConversationId) {
      if (selectedImages.length > 0 || selectedAudio) {
        setError("Nesta conversa, por enquanto, envie mensagens de texto. O histórico antigo com fotos e áudios continua visível.");
        return;
      }
      if (!text || !userId || sending || recording) return;
      setSending(true);
      setError("");
      try {
        const { error: directSendError } = await supabase
          .from("restaurant_direct_messages")
          .insert({
            conversation_id: directConversationId,
            sender_id: userId,
            message: messageTextForStorage(text),
          });
        if (directSendError) {
          console.error("Erro ao enviar mensagem direta:", directSendError);
          throw new Error("Não foi possível enviar a mensagem. Tente novamente.");
        }
        setMessage("");
        setReplyingTo(null);
        await loadMessages();
      } catch (sendError) {
        setError(sendError instanceof Error ? sendError.message : "Não foi possível enviar a mensagem.");
      } finally {
        setSending(false);
      }
      return;
    }

    // Fotos podem acompanhar texto ou áudio, mas texto e áudio são exclusivos.
    if (text && selectedAudio) {
      setError("Escolha enviar texto ou áudio. As fotos podem acompanhar os dois.");
      return;
    }

    const files: UploadedAttachment[] = [
      ...selectedImages.map((file) => ({ file, type: "image" as const })),
      ...(selectedAudio
        ? [{ file: selectedAudio, type: "audio" as const }]
        : []),
    ].map((item) => {
      const safeName = item.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      return {
        ...item,
        path: `${orderId}/${crypto.randomUUID()}-${safeName}`,
      };
    });

    if ((!text && files.length === 0) || !userId || sending || recording) {
      return;
    }

    setSending(true);
    setError("");

    const uploaded: UploadedAttachment[] = [];

    try {
      // Primeiro envia os arquivos ao Storage privado.
      for (const attachment of files) {
        const { error: uploadError } = await supabase.storage
          .from(ATTACHMENT_BUCKET)
          .upload(attachment.path, attachment.file, {
            contentType: attachment.file.type,
            upsert: false,
          });

        if (uploadError) {
          console.error("Erro ao enviar arquivo:", uploadError);
          throw new Error(`Falha no upload: ${uploadError.message}`);
        }
        uploaded.push(attachment);
      }

      // Cria uma mensagem com texto OU áudio e, opcionalmente, até 3 fotos.
      const { data: messageRow, error: messageError } = await supabase
        .from("chat_messages")
        .insert({
          order_id: orderId,
          sender_id: userId,
          // Use a non-empty internal marker for attachment-only messages.
          // The marker is hidden in the chat UI below.
          message: text ? messageTextForStorage(text) : "📎 Anexos",
        })
        .select("id, order_id, sender_id, message, created_at")
        .single();

      if (messageError || !messageRow) {
        console.error("Erro ao criar mensagem:", messageError);
        throw new Error(
          messageError?.message
            ? `Não foi possível salvar a mensagem: ${messageError.message}`
            : "Não foi possível salvar a mensagem na conversa."
        );
      }

      if (uploaded.length > 0) {
        const attachmentRows = uploaded.map((attachment) => ({
          message_id: messageRow.id,
          order_id: orderId,
          storage_path: attachment.path,
          attachment_type: attachment.type,
          attachment_name: attachment.file.name,
        }));

        const { error: attachmentsError } = await supabase
          .from("chat_message_attachments")
          .insert(attachmentRows);

        if (attachmentsError) {
          console.error(
            "Erro ao salvar anexos da mensagem:",
            attachmentsError
          );
          await supabase.storage
            .from(ATTACHMENT_BUCKET)
            .remove(uploaded.map((item) => item.path));
          throw new Error(
            "Os arquivos foram enviados, mas não foi possível anexá-los à mensagem."
          );
        }
      }

      setMessage("");
      setReplyingTo(null);
      setSelectedImages([]);
      setSelectedAudio(null);
      setRecordingWaveform([]);
      setRecordingSeconds(0);
      await loadMessages();
    } catch (sendError) {
      console.error("Erro ao enviar mensagem/anexos:", sendError);
      const textError =
        sendError instanceof Error
          ? sendError.message
          : "Não foi possível enviar a mensagem.";

      // Remove arquivos que possam ter sido enviados caso a mensagem falhe.
      if (uploaded.length > 0) {
        await supabase.storage
          .from(ATTACHMENT_BUCKET)
          .remove(uploaded.map((item) => item.path));
      }
      setError(textError);
    } finally {
      setSending(false);
    }
  }

  function cleanupRecordingVisualization() {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    analyserRef.current = null;
    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== "closed") {
      void audioContext.close().catch(() => undefined);
    }
  }

  function beginWaveformSampling(analyser: AnalyserNode) {
    const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    lastWaveSampleAtRef.current = 0;

    const sample = (now: number) => {
      if (mediaRecorderRef.current?.state !== "recording") return;

      analyser.getByteFrequencyData(frequencyData);
      // Focus on the lower and middle frequencies where voice energy is most visible.
      const firstBin = 2;
      const lastBin = Math.min(frequencyData.length, 34);
      const voiceBins = Array.from(frequencyData.slice(firstBin, lastBin)).sort(
        (a, b) => b - a
      );
      const strongestBins = voiceBins.slice(0, Math.max(1, Math.ceil(voiceBins.length * 0.2)));
      const average = strongestBins.reduce((sum, value) => sum + value, 0) / strongestBins.length;
      const height = Math.max(
        4,
        Math.min(28, Math.round(4 + Math.sqrt(Math.min(1, average / 150)) * 24))
      );

      if (now - lastWaveSampleAtRef.current >= 85) {
        setRecordingWaveform((current) => [...current, height].slice(-100));
        setRecordingSeconds(
          Math.max(0, Math.floor((Date.now() - recordingStartedAtRef.current) / 1000))
        );
        lastWaveSampleAtRef.current = now;
      }

      animationFrameRef.current = requestAnimationFrame(sample);
    };

    animationFrameRef.current = requestAnimationFrame(sample);
  }

  async function startRecording() {
    if (recording || sending || selectedAudio || message.trim()) return;

    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError(
        "Seu navegador não permite gravar áudio. Tente usar o Chrome com conexão segura."
      );
      return;
    }

    try {
      setError("");
      setRecordingWaveform([]);
      setRecordingSeconds(0);
      discardRecordingRef.current = false;
      sendRecordingAfterStopRef.current = false;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      audioChunksRef.current = [];

      const supportedTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ];
      const mimeType = supportedTypes.find((type) =>
        MediaRecorder.isTypeSupported(type)
      );
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      // The analyser reads microphone levels to form the waveform live without playing
      // the microphone through the speakers.
      const AudioContextConstructor = window.AudioContext;
      if (AudioContextConstructor) {
        const audioContext = new AudioContextConstructor();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.65;
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
      }

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setError("Ocorreu um erro durante a gravação.");
        setRecording(false);
        cleanupRecordingVisualization();
        recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        cleanupRecordingVisualization();
        stream.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        mediaRecorderRef.current = null;
        setRecording(false);

        if (discardRecordingRef.current) {
          discardRecordingRef.current = false;
          sendRecordingAfterStopRef.current = false;
          setSelectedAudio(null);
          setRecordingWaveform([]);
          setRecordingSeconds(0);
          return;
        }

        if (blob.size === 0) {
          sendRecordingAfterStopRef.current = false;
          setError("A gravação ficou vazia. Tente novamente.");
          setRecordingWaveform([]);
          setRecordingSeconds(0);
          return;
        }
        if (blob.size > MAX_AUDIO_SIZE) {
          sendRecordingAfterStopRef.current = false;
          setError("O áudio deve ter no máximo 15 MB.");
          setRecordingWaveform([]);
          setRecordingSeconds(0);
          return;
        }

        const extension = blob.type.includes("mp4")
          ? "m4a"
          : blob.type.includes("ogg")
            ? "ogg"
            : "webm";
        const file = new File(
          [blob],
          `audio-${Date.now()}.${extension}`,
          { type: blob.type || "audio/webm" }
        );
        setSelectedAudio(file);

        // Wait for React to render the prepared audio state before submitting the form.
        if (sendRecordingAfterStopRef.current) {
          sendRecordingAfterStopRef.current = false;
          window.setTimeout(() => formRef.current?.requestSubmit(), 50);
        }
      };

      recorder.start();
      recordingStartedAtRef.current = Date.now();
      setRecording(true);
      if (analyserRef.current) beginWaveformSampling(analyserRef.current);
    } catch (recordingError) {
      console.error("Erro ao iniciar gravação:", recordingError);
      setError(
        "Não foi possível acessar o microfone. Verifique a permissão do navegador."
      );
      cleanupRecordingVisualization();
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
      mediaRecorderRef.current = null;
      setRecording(false);
    }
  }

  function stopRecordingAndSend() {
    if (recording) {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") return;
      sendRecordingAfterStopRef.current = true;
      discardRecordingRef.current = false;
      recorder.stop();
      return;
    }

    // If a previous upload failed, the captured audio remains available to retry.
    if (selectedAudio) formRef.current?.requestSubmit();
  }

  function discardAudio() {
    sendRecordingAfterStopRef.current = false;
    setSelectedAudio(null);
    setRecordingWaveform([]);
    setRecordingSeconds(0);
    setError("");

    const recorder = mediaRecorderRef.current;
    if (recording && recorder && recorder.state !== "inactive") {
      discardRecordingRef.current = true;
      recorder.stop();
    } else {
      discardRecordingRef.current = false;
      setRecording(false);
      cleanupRecordingVisualization();
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
      mediaRecorderRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      cleanupRecordingVisualization();
    };
  }, []);

  useEffect(() => {
    if (!recording || !waveformStripRef.current) return;
    waveformStripRef.current.scrollLeft = waveformStripRef.current.scrollWidth;
  }, [recordingWaveform, recording]);

  useEffect(() => {
    if (!lightboxImage) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setLightboxImage(null);
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [lightboxImage]);

  useEffect(() => {
    if (!openMessageMenuId) return;

    function handleOutsidePointerDown(event: PointerEvent) {
      const target = event.target;
      if (
        target instanceof Element &&
        (target.closest("[data-chat-message-menu]") || target.closest("[data-chat-message-menu-trigger]"))
      ) {
        return;
      }
      setOpenMessageMenuId(null);
      setMessageMenuPosition(null);
    }

    function handleMenuEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMessageMenuId(null);
        setMessageMenuPosition(null);
      }
    }

    document.addEventListener("pointerdown", handleOutsidePointerDown);
    document.addEventListener("keydown", handleMenuEscape);
    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointerDown);
      document.removeEventListener("keydown", handleMenuEscape);
    };
  }, [openMessageMenuId]);

  function getSenderName(senderId: string) {
    if (senderId === userId) {
      if (role === "cliente") return customerName;
      if (role === "restaurante") return restaurantName;
      return "Você";
    }
    if (role === "cliente") return counterpartName || restaurantName;
    if (role === "restaurante") return counterpartName || customerName;
    return "Outra pessoa";
  }

  function getSenderAvatar(senderId: string) {
    if (role === "cliente") {
      return senderId === userId ? customerAvatarUrl : restaurantLogoUrl;
    }
    if (role === "restaurante") {
      return senderId === userId ? restaurantLogoUrl : customerAvatarUrl;
    }
    return null;
  }

  return (
    <section className="flex h-full min-h-[400px] min-w-0 flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-[#111] text-white shadow-sm">
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-700 px-5 py-4">
        <div className="min-w-0">
          <h2 className="font-black text-white">💬 Conversa</h2>
          <p className="mt-1 truncate text-sm text-zinc-400">
            {role === "restaurante"
              ? counterpartName || customerName
              : role === "cliente"
                ? counterpartName || restaurantName
                : counterpartName || "Chat"}
          </p>
        </div>
        <span className="ml-3 shrink-0 rounded-full bg-green-900/40 px-3 py-1 text-xs font-bold text-green-300">
          Chat ativo
        </span>
      </header>

      {showCustomerOrders && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Pedidos do cliente"
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowCustomerOrders(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-700 bg-[#171717] text-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-700 px-5 py-4">
              <div>
                <h3 className="text-lg font-black">Pedidos do cliente</h3>
                <p className="mt-1 text-sm text-zinc-400">{counterpartName || customerName}</p>
              </div>
              <button type="button" onClick={() => setShowCustomerOrders(false)} className="flex h-9 w-9 items-center justify-center rounded-full text-2xl text-zinc-300 hover:bg-zinc-800" aria-label="Fechar pedidos">×</button>
            </div>
            <div className="max-h-[65vh] space-y-3 overflow-y-auto p-4">
              {customerOrders.length === 0 ? (
                <p className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-300">Este cliente ainda não possui pedidos vinculados a esta loja.</p>
              ) : (
                [...customerOrders]
                  .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
                  .map((order) => (
                    <div key={order.order_id} className="rounded-xl border border-zinc-700 bg-zinc-900 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold">Pedido #{order.order_id.slice(0, 8).toUpperCase()}</p>
                          <p className="mt-1 text-xs text-zinc-400">{order.created_at ? new Date(order.created_at).toLocaleString("pt-BR") : "Data indisponível"}</p>
                        </div>
                        <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-semibold text-zinc-200">{formatOrderStatus(order.status)}</span>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-emerald-300">{formatMoney(order.total)}</p>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      <div
        aria-live="polite"
        data-chat-message-list="true"
        onScroll={(event) => {
          const element = event.currentTarget;
          shouldAutoScrollRef.current =
            element.scrollHeight - element.scrollTop - element.clientHeight < 100;
          if (openMessageMenuIdRef.current) {
            setOpenMessageMenuId(null);
            setMessageMenuPosition(null);
          }
        }}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#191919] p-4 sm:p-6"
      >
        {loading ? (
          <p className="text-sm text-zinc-400">Carregando mensagens...</p>
        ) : messages.length === 0 ? (
          <div className="flex h-full min-h-48 items-center justify-center">
            <div className="text-center">
              <div className="text-4xl">💬</div>
              <p className="mt-3 font-bold text-zinc-200">Inicie a conversa</p>
              <p className="mt-1 text-sm text-zinc-400">
                Envie uma mensagem para falar com a loja.
              </p>
            </div>
          </div>
        ) : (
          messages.map((item) => {
            const ownMessage = item.sender_id === userId;
            const senderAvatarUrl = getSenderAvatar(item.sender_id);
            const senderIsRestaurant =
              (item.sender_id === userId && role === "restaurante") ||
              (item.sender_id !== userId && role === "cliente");
            const attachments = item.attachments ?? [];
            const images = attachments.filter(
              (attachment) => attachment.attachment_type === "image"
            );
            const audios = attachments.filter(
              (attachment) => attachment.attachment_type === "audio"
            );
            const messageText = (item.message ?? "").trim();
            const parsedReply = parseReplyPayload(messageText);
            const visibleMessageText = parsedReply.body;
            const showMessageText =
              visibleMessageText.length > 0 &&
              visibleMessageText !== "📎 Anexos" &&
              !(
                attachments.length > 0 &&
                (visibleMessageText === "📷 Foto" || visibleMessageText === "🎤 Áudio")
              );

            return (
              <div
                key={item.id}
                className={`relative flex items-end gap-2 ${ownMessage ? "justify-end" : "justify-start"} ${openMessageMenuId === item.id ? "z-30" : "z-0"}`}
              >
                {!ownMessage && (
                  <ChatSenderAvatar
                    avatarUrl={senderAvatarUrl}
                    senderName={getSenderName(item.sender_id)}
                    isRestaurant={senderIsRestaurant}
                  />
                )}
                <div
                  className={`group relative max-w-[90%] min-w-20 overflow-visible rounded-2xl px-3 py-3 pr-10 sm:max-w-[78%] ${
                    ownMessage
                      ? "rounded-br-sm bg-blue-600 text-white"
                      : "rounded-bl-sm border border-zinc-700 bg-[#242424] text-zinc-100 shadow-sm"
                  }`}
                >
                  <p
                    className={`mb-1 text-xs font-bold ${
                      ownMessage ? "text-blue-100" : "text-zinc-400"
                    }`}
                  >
                    {getSenderName(item.sender_id)}
                  </p>

                  {images.length > 0 && (
                    <div
                      className={`grid gap-1.5 ${
                        images.length === 1
                          ? "grid-cols-1"
                          : images.length === 2
                            ? "grid-cols-2"
                            : "grid-cols-3"
                      }`}
                    >
                      {images.map((attachment) => (
                        <button
                          key={attachment.id}
                          type="button"
                          onClick={() => {
                            if (attachment.attachmentUrl) {
                              setLightboxImage(attachment.attachmentUrl);
                            }
                          }}
                          className="overflow-hidden rounded-lg bg-black/20 text-left"
                          title="Abrir foto"
                        >
                          {attachment.attachmentUrl ? (
                            <img
                              src={attachment.attachmentUrl}
                              alt={attachment.attachment_name || "Foto enviada"}
                              className="max-h-64 min-h-20 w-full cursor-zoom-in object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <span className="block p-3 text-xs text-amber-200">
                              Não foi possível abrir esta foto.
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {audios.map((attachment) => (
                    <div key={attachment.id} className="mt-2">
                      {attachment.attachmentUrl ? (
                        <AudioMessagePlayer
                          src={attachment.attachmentUrl}
                          ownMessage={ownMessage}
                        />
                      ) : (
                        <p className="text-xs text-amber-200">
                          Não foi possível abrir este áudio.
                        </p>
                      )}
                    </div>
                  ))}

                  {parsedReply.reply && (
                    <div className={`mb-2 rounded-md border-l-[3px] px-2.5 py-1.5 ${ownMessage ? "border-blue-200 bg-blue-700/70" : "border-zinc-400 bg-black/20"}`}>
                      <p className={`text-xs font-bold ${ownMessage ? "text-blue-100" : "text-zinc-300"}`}>{parsedReply.reply.senderName}</p>
                      <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap break-words text-xs opacity-90">{parsedReply.reply.text}</p>
                    </div>
                  )}

                  {showMessageText && (
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">
                      {visibleMessageText}
                    </p>
                  )}

                  {item.attachment_path &&
                    attachments.length === 0 && (
                      <p className="mt-1 text-xs text-amber-300">
                        Não foi possível abrir este arquivo.
                      </p>
                    )}

                  <div className={`mt-2 flex items-center justify-end gap-1.5 text-[10px] ${ownMessage ? "text-blue-100" : "text-zinc-400"}`}>
                    <span>{new Date(item.created_at).toLocaleString("pt-BR")}</span>
                    {ownMessage && (
                      <span
                        aria-label={readMessageKeys.has(getMessageKey(item)) ? "Mensagem visualizada" : "Mensagem enviada"}
                        title={readMessageKeys.has(getMessageKey(item)) ? "Visualizada" : "Enviada"}
                        className={`text-[13px] font-black leading-none ${readMessageKeys.has(getMessageKey(item)) ? "text-sky-300" : "text-zinc-400"}`}
                      >
                        ✓✓
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    aria-label="Opções da mensagem"
                    title="Opções da mensagem"
                    data-chat-message-menu-trigger="true"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (openMessageMenuId === item.id) {
                        setOpenMessageMenuId(null);
                        setMessageMenuPosition(null);
                        return;
                      }

                      const rect = event.currentTarget.getBoundingClientRect();
                      const menuRows =
                        (showCustomerOrdersAction ? 1 : 0) +
                        (ownMessage ? 1 : 0) +
                        ((showMessageText || parsedReply.reply) ? 1 : 0) +
                        1;
                      const estimatedMenuHeight = menuRows * 40 + 12;
                      const menuWidth = 224;
                      const margin = 10;
                      const gap = 22;
                      // Keep the menu to the right of the message for both incoming and outgoing bubbles.
                      // Push it farther right for a clearer diagonal placement, while staying inside the viewport.
                      let left = rect.right + gap;
                      left = Math.max(margin, Math.min(left, window.innerWidth - menuWidth - margin));

                      // Place the menu above and to the right of the message, not underneath it.
                      // The small overlap keeps the menu visually attached to the message's upper-right corner.
                      let top = rect.top - estimatedMenuHeight + 26;
                      top = Math.max(margin, Math.min(top, window.innerHeight - estimatedMenuHeight - margin));
                      setMessageMenuPosition({ top, left });
                      setOpenMessageMenuId(item.id);
                    }}
                    className={`absolute right-1 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full text-zinc-200 transition hover:bg-black/20 focus:bg-black/20 ${openMessageMenuId === item.id ? "bg-black/20 opacity-100" : "opacity-70 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"}`}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                      <circle cx="12" cy="5" r="1.8" />
                      <circle cx="12" cy="12" r="1.8" />
                      <circle cx="12" cy="19" r="1.8" />
                    </svg>
                  </button>

                  {openMessageMenuId === item.id &&
                    messageMenuPosition &&
                    typeof document !== "undefined" &&
                    createPortal(
                      <div
                        data-chat-message-menu="true"
                        style={{
                          position: "fixed",
                          top: `${messageMenuPosition.top}px`,
                          left: `${messageMenuPosition.left}px`,
                          width: "224px",
                          maxWidth: "calc(100vw - 20px)",
                          maxHeight: "min(65vh, 280px)",
                          zIndex: 10000,
                        }}
                        className="overflow-y-auto rounded-xl border border-zinc-700 bg-[#222] py-1 text-sm text-white shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {showCustomerOrdersAction && role === "restaurante" && !ownMessage && (
                          <button type="button" onClick={() => { setShowCustomerOrders(true); setOpenMessageMenuId(null); setMessageMenuPosition(null); }} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-zinc-700">
                            <span className="w-5 text-center">🧾</span><span>Ver pedidos do cliente</span>
                          </button>
                        )}
                        {ownMessage && (
                          <button type="button" onClick={() => void deleteMessage(item)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-red-300 hover:bg-red-950/60">
                            <span className="w-5 text-center">🗑</span><span>Apagar</span>
                          </button>
                        )}
                        {(showMessageText || parsedReply.reply) && (
                          <button type="button" onClick={() => void copyMessage(item)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-zinc-700">
                            <span className="w-5 text-center">▢</span><span>Copiar</span>
                          </button>
                        )}
                        <button type="button" onClick={() => startReply(item)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-zinc-700">
                          <span className="w-5 text-center">↩</span><span>Responder</span>
                        </button>
                      </div>,
                      document.body
                    )}
                </div>
                {ownMessage && (
                  <ChatSenderAvatar
                    avatarUrl={senderAvatarUrl}
                    senderName={getSenderName(item.sender_id)}
                    isRestaurant={senderIsRestaurant}
                  />
                )}
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
        ref={formRef}
        onSubmit={sendMessage}
        className="flex shrink-0 flex-col gap-2 border-t border-zinc-700 bg-[#111] p-3 sm:p-4"
      >
        {replyingTo && (
          <div className="mb-3 flex items-start justify-between gap-3 rounded-xl border-l-4 border-blue-500 bg-zinc-900 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-xs font-bold text-blue-300">Respondendo a {getSenderName(replyingTo.sender_id)}</p>
              <p className="mt-1 line-clamp-2 break-words text-xs text-zinc-300">{parseReplyPayload(replyingTo.message ?? "").body || "Mensagem com anexo"}</p>
            </div>
            <button type="button" onClick={() => setReplyingTo(null)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-lg text-zinc-400 hover:bg-zinc-800 hover:text-white" aria-label="Cancelar resposta">×</button>
          </div>
        )}
        {!directConversationId && selectedImages.length > 0 && (
          <div className="flex flex-wrap items-start gap-3 rounded-xl border border-zinc-700 bg-[#222] p-3">
            <div className="grid max-w-full grid-cols-3 gap-2">
              {selectedImages.map((file, index) => (
                <div key={`${file.name}-${index}`} className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      selectedImagePreviews[index] &&
                      setLightboxImage(selectedImagePreviews[index])
                    }
                    className="block overflow-hidden rounded-lg border border-zinc-600"
                    title="Ampliar foto"
                  >
                    {selectedImagePreviews[index] && (
                      <img
                        src={selectedImagePreviews[index]}
                        alt={`Prévia da foto ${index + 1}`}
                        className="h-24 w-24 cursor-zoom-in object-cover sm:h-28 sm:w-28"
                      />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSelectedImage(index)}
                    disabled={sending}
                    aria-label={`Remover foto ${index + 1}`}
                    title="Remover foto"
                    className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs font-black text-white shadow disabled:opacity-50"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <p className="w-full text-xs text-zinc-400">
              {selectedImages.length} de {MAX_IMAGES_PER_MESSAGE} fotos
            </p>
          </div>
        )}

        {!directConversationId && <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageSelection}
          disabled={loading || !userId || sending || recording}
          className="hidden"
        />}

        <div className="flex w-full min-w-0 items-center gap-2">
          {(recording || selectedAudio) ? (
            <>
              <button
                type="button"
                onClick={discardAudio}
                disabled={sending}
                aria-label="Apagar gravação"
                title="Apagar gravação"
                className="flex h-12 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-700 text-zinc-300 transition hover:border-red-500 hover:bg-red-950 hover:text-red-200 disabled:opacity-50"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5" />
                </svg>
              </button>

              <div className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-xl border border-zinc-700 bg-[#222] px-3">
                {recording && (
                  <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-red-500" aria-label="Gravando" />
                )}
                <div
                  ref={waveformStripRef}
                  className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  aria-label={recording ? "Forma de onda sendo gravada" : "Forma de onda do áudio"}
                >
                  <div className="flex h-9 min-w-max items-center gap-[3px]">
                    {(recordingWaveform.length > 0
                      ? recordingWaveform
                      : [5, 8, 6, 10, 5, 7, 12, 6]
                    ).map((height, index) => (
                      <span
                        key={`${index}-${height}`}
                        className={`w-[3px] shrink-0 rounded-full ${recording ? "bg-blue-400" : "bg-blue-300"}`}
                        style={{ height: `${height}px` }}
                      />
                    ))}
                  </div>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-zinc-300">
                  {formatAudioTime(recordingSeconds)}
                </span>
              </div>

              <button
                type="button"
                onClick={stopRecordingAndSend}
                disabled={loading || !userId || sending || (!recording && !selectedAudio)}
                aria-label="Enviar áudio"
                title="Enviar áudio"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? (
                  <span className="text-xs font-bold">...</span>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                    <path d="M3.4 20.1 21 12 3.4 3.9l.1 6.3 12.1 1.8-12.1 1.8z" />
                  </svg>
                )}
              </button>
            </>
          ) : (
            <>
              <textarea
                ref={messageTextareaRef}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onPaste={directConversationId ? undefined : handlePasteImage}
                placeholder={replyingTo ? "Escreva sua resposta..." : "Digite uma mensagem..."}
                maxLength={2000}
                rows={1}
                disabled={loading || !userId || sending}
                className="max-h-32 min-h-12 min-w-0 flex-1 resize-y rounded-xl border border-zinc-700 bg-[#222] px-3 py-3 text-sm text-white outline-none placeholder:text-zinc-400 focus:border-blue-500 disabled:opacity-60"
              />

              {!directConversationId && (
                <>
              <button
                type="button"
                title="Adicionar foto (até 3)"
                aria-label="Adicionar foto"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || !userId || sending}
                className="flex h-12 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-700 text-lg text-white transition hover:bg-zinc-800 disabled:opacity-50"
              >
                📷
              </button>

              <button
                type="button"
                title="Gravar áudio"
                aria-label="Gravar áudio"
                onClick={startRecording}
                disabled={loading || !userId || sending || !!message.trim()}
                className="flex h-12 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-700 text-lg text-white transition hover:bg-zinc-800 disabled:opacity-50"
              >
                🎤
              </button>
                </>
              )}

              <button
                type="submit"
                disabled={
                  loading ||
                  !userId ||
                  sending ||
                  (!message.trim() && selectedImages.length === 0)
                }
                className="h-12 shrink-0 rounded-xl bg-blue-600 px-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? "Enviando..." : "Enviar"}
              </button>
            </>
          )}
        </div>

      </form>

      {lightboxImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Visualização ampliada da foto"
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
        >
          <button
            type="button"
            onClick={() => setLightboxImage(null)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/20"
            aria-label="Fechar foto"
          >
            ×
          </button>
          <img
            src={lightboxImage}
            alt="Foto ampliada"
            onClick={(event) => event.stopPropagation()}
            className="max-h-[90vh] max-w-[95vw] rounded-lg object-contain shadow-2xl"
          />
        </div>
      )}
    </section>
  );
}
