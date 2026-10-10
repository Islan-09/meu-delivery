"use client";

import Link from "next/link";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

type NotificationItem = {
  id: string;
  order_id: string;
  kind: string;
  title: string;
  message: string;
  read_at: string | null;
  created_at: string;
};

function dateTime(
  value: string
) {
  return new Date(
    value
  ).toLocaleString(
    "pt-BR",
    {
      dateStyle: "short",
      timeStyle: "short",
    }
  );
}

export default function NotificacoesPage() {
  const router = useRouter();

  const [loading, setLoading] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    notifications,
    setNotifications,
  ] =
    useState<
      NotificationItem[]
    >([]);

  const [error, setError] =
    useState("");

  const [
    browserPermission,
    setBrowserPermission,
  ] = useState("");

  const loadNotifications =
    useCallback(
      async (
        firstLoad = false
      ) => {
        if (firstLoad) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        const {
          data: { session },
        } =
          await supabase.auth.getSession();

        if (!session) {
          sessionStorage.setItem(
            "after-login",
            "/notificacoes"
          );

          router.replace(
            "/login"
          );

          return;
        }

        const {
          data,
          error:
            notificationsError,
        } =
          await supabase.rpc(
            "get_my_notifications",
            {
              p_limit: 50,
            }
          );

        if (
          notificationsError
        ) {
          console.error(
            "Erro notificações:",
            notificationsError
          );

          setError(
            "Não foi possível carregar suas notificações."
          );
        } else {
          setNotifications(
            (
              data ??
              []
            ) as NotificationItem[]
          );

          setError("");
        }

        setLoading(false);
        setRefreshing(false);
      },
      [router]
    );

  useEffect(() => {
    loadNotifications(true);
  }, [loadNotifications]);

  useEffect(() => {
    const interval =
      window.setInterval(
        () => {
          loadNotifications(
            false
          );
        },
        5000
      );

    return () => {
      window.clearInterval(
        interval
      );
    };
  }, [loadNotifications]);

  useEffect(() => {
    if (
      typeof window !==
        "undefined" &&
      "Notification" in
        window
    ) {
      setBrowserPermission(
        Notification.permission
      );
    }
  }, []);

  async function enableBrowserNotifications() {
    if (
      !(
        "Notification" in
        window
      )
    ) {
      setError(
        "Este navegador não oferece notificações."
      );

      return;
    }

    const permission =
      await Notification
        .requestPermission();

    setBrowserPermission(
      permission
    );

    if (
      permission ===
      "granted"
    ) {
      new Notification(
        "Entrega Paudalho",
        {
          body:
            "Avisos deste navegador foram ativados.",
        }
      );
    }
  }

  async function openNotification(
    notification:
      NotificationItem
  ) {
    if (
      !notification.read_at
    ) {
      await supabase.rpc(
        "mark_my_notification_read",
        {
          p_notification_id:
            notification.id,
        }
      );

      setNotifications(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              notification.id
                ? {
                    ...item,
                    read_at:
                      new Date()
                        .toISOString(),
                  }
                : item
          )
      );
    }

    router.push(
      `/pedido/${notification.order_id}`
    );
  }

  async function markAllRead() {
    const {
      error: markError,
    } =
      await supabase.rpc(
        "mark_all_my_notifications_read"
      );

    if (markError) {
      setError(
        "Não foi possível marcar as notificações como lidas."
      );

      return;
    }

    const now =
      new Date()
        .toISOString();

    setNotifications(
      (current) =>
        current.map(
          (item) => ({
            ...item,
            read_at:
              item.read_at ??
              now,
          })
        )
    );
  }

  const unreadCount =
    notifications.filter(
      (item) =>
        !item.read_at
    ).length;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7]">
        <p className="font-bold">
          Carregando notificações...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f7f7] text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link
            href="/minha-conta"
            className="font-bold text-red-600"
          >
            ← Voltar
          </Link>

          <p className="font-black text-red-600">
            Entrega Paudalho
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl">
              🔔
            </div>

            <h1 className="mt-4 text-3xl font-black">
              Notificações
            </h1>

            <p className="mt-2 text-zinc-500">
              Acompanhe as mudanças dos seus pedidos.
            </p>
          </div>

          <button
            type="button"
            disabled={
              unreadCount ===
              0
            }
            onClick={markAllRead}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-black transition hover:bg-zinc-50 disabled:opacity-40"
          >
            Marcar todas como lidas
          </button>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">
            ⚠️ {error}
          </div>
        )}

        <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-black">
                🔔 Avisos no navegador
              </p>

              <p className="mt-1 text-sm leading-5 text-zinc-500">
                Você pode permitir avisos enquanto estiver usando o site neste navegador.
              </p>
            </div>

            <button
              type="button"
              onClick={
                enableBrowserNotifications
              }
              className="shrink-0 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-black text-white"
            >
              {browserPermission ===
              "granted"
                ? "✅ Ativado"
                : browserPermission ===
                    "denied"
                  ? "Bloqueado no navegador"
                  : "Ativar avisos"}
            </button>
          </div>
        </section>

        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="font-black">
            {unreadCount > 0
              ? `${unreadCount} não lida${unreadCount > 1 ? "s" : ""}`
              : "Tudo lido"}
          </p>

          {refreshing && (
            <p className="text-xs font-bold text-zinc-400">
              Atualizando...
            </p>
          )}
        </div>

        {notifications.length ===
        0 ? (
          <section className="mt-4 rounded-3xl bg-white p-8 text-center shadow-sm">
            <div className="text-5xl">
              🔕
            </div>

            <h2 className="mt-4 text-xl font-black">
              Nenhuma notificação ainda
            </h2>

            <p className="mt-2 text-sm text-zinc-500">
              Os avisos de pagamento e andamento dos próximos pedidos aparecerão aqui.
            </p>
          </section>
        ) : (
          <div className="mt-4 space-y-3">
            {notifications.map(
              (notification) => {
                const unread =
                  !notification.read_at;

                return (
                  <button
                    key={
                      notification.id
                    }
                    type="button"
                    onClick={() =>
                      openNotification(
                        notification
                      )
                    }
                    className={`block w-full rounded-2xl border p-5 text-left shadow-sm transition hover:border-red-200 ${
                      unread
                        ? "border-red-200 bg-white ring-2 ring-red-50"
                        : "border-zinc-200 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-black">
                            {
                              notification.title
                            }
                          </p>

                          {unread && (
                            <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black text-white">
                              NOVA
                            </span>
                          )}
                        </div>

                        <p className="mt-2 text-sm leading-6 text-zinc-600">
                          {
                            notification.message
                          }
                        </p>

                        <p className="mt-3 text-xs font-bold text-zinc-400">
                          {dateTime(
                            notification.created_at
                          )}
                        </p>
                      </div>

                      <span className="text-red-600">
                        →
                      </span>
                    </div>
                  </button>
                );
              }
            )}
          </div>
        )}
      </div>
    </main>
  );
}
