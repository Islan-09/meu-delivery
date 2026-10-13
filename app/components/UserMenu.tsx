
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type UserInfo = {
  name: string;
  email: string;
  phone: string | null;
  role: string;
  hasRestaurant: boolean;
};

export default function UserMenu() {
  const router = useRouter();

  const [user, setUser] =
    useState<UserInfo | null>(null);

  const [open, setOpen] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  // ==========================================
  // CARREGAR USUÁRIO
  // ==========================================

  async function loadUser() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // NÃO LOGADO
    if (!session) {
      setUser(null);
      setOpen(false);
      setLoading(false);
      return;
    }

    // PERFIL
    const { data: profile } =
      await supabase
        .from("profiles")
        .select(`
          full_name,
          phone,
          role
        `)
        .eq(
          "id",
          session.user.id
        )
        .maybeSingle();

    // VERIFICAR SE ESSA CONTA
    // POSSUI RESTAURANTE
    const { data: restaurant } =
      await supabase
        .from("restaurants")
        .select("id")
        .eq(
          "owner_id",
          session.user.id
        )
        .limit(1)
        .maybeSingle();

    setUser({
      name:
        profile?.full_name ||
        session.user.email?.split("@")[0] ||
        "Minha conta",

      email:
        session.user.email || "",

      phone:
        profile?.phone || null,

      role:
        profile?.role || "customer",

      hasRestaurant:
        Boolean(restaurant),
    });

    setLoading(false);
  }

  // ==========================================
  // ACOMPANHAR LOGIN / LOGOUT
  // ==========================================

  useEffect(() => {
    loadUser();

    const {
      data: { subscription },
    } =
      supabase.auth.onAuthStateChange(
        () => {
          loadUser();
        }
      );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // ==========================================
  // SAIR
  // ==========================================

  async function logout() {
    await supabase.auth.signOut();

    setUser(null);
    setOpen(false);

    router.push("/");
    router.refresh();
  }

  // ==========================================
  // CARREGANDO
  // ==========================================

  if (loading) {
    return (
      <div className="h-11 w-28 animate-pulse rounded-xl bg-zinc-100" />
    );
  }

  // ==========================================
  // NÃO LOGADO
  // ==========================================

  if (!user) {
    return (
      <Link
        href="/login"
        className="flex h-11 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 font-semibold text-zinc-800 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-100">
          👤
        </span>

        <span>
          Entrar
        </span>
      </Link>
    );
  }

  // ==========================================
  // LOGADO
  // ==========================================

  return (
    <div className="relative">
      {/* BOTÃO DO PERFIL */}

      <button
        type="button"
        onClick={() =>
          setOpen(
            (current) => !current
          )
        }
        className="flex h-11 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 font-semibold transition hover:bg-zinc-50"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
          👤
        </span>

        <span className="hidden max-w-40 truncate sm:block">
          {user.name}
        </span>

        <span className="text-xs">
          ▾
        </span>
      </button>

      {/* MENU */}

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
          {/* DADOS DA CONTA */}

          <div className="border-b border-zinc-100 p-4">
            <p className="font-bold">
              {user.name}
            </p>

            <p className="mt-1 truncate text-sm text-zinc-500">
              {user.email}
            </p>

            {user.phone && (
              <p className="mt-1 text-sm text-zinc-500">
                📱 {user.phone}
              </p>
            )}
          </div>

          {/* OPÇÕES */}

          <div className="p-2">
            <Link
              href="/minha-conta"
              onClick={() =>
                setOpen(false)
              }
              className="block rounded-xl px-4 py-3 text-sm font-semibold transition hover:bg-zinc-100"
            >
              👤 Minha conta
            </Link>

            <Link
              href="/meus-enderecos"
              onClick={() =>
                setOpen(false)
              }
              className="block rounded-xl px-4 py-3 text-sm font-semibold transition hover:bg-zinc-100"
            >
              📍 Meus endereços
            </Link>

            <Link
              href="/meus-pedidos"
              onClick={() =>
                setOpen(false)
              }
              className="block rounded-xl px-4 py-3 text-sm font-semibold transition hover:bg-zinc-100"
            >
              🧾 Meus pedidos
            </Link>

            <Link
              href="/mensagens"
              onClick={() =>
                setOpen(false)
              }
              className="block rounded-xl px-4 py-3 text-sm font-semibold transition hover:bg-zinc-100"
            >
              💬 Mensagens
            </Link>

            <Link
              href="/favoritos"
              onClick={() =>
                setOpen(false)
              }
              className="block rounded-xl px-4 py-3 text-sm font-semibold transition hover:bg-zinc-100"
            >
              ❤️ Favoritos
            </Link>

            <Link
              href="/ajuda"
              onClick={() =>
                setOpen(false)
              }
              className="block rounded-xl px-4 py-3 text-sm font-semibold transition hover:bg-zinc-100"
            >
              💬 Ajuda e suporte
            </Link>

            {/* RESTAURANTE */}

            {user.hasRestaurant && (
              <>
                <div className="my-2 border-t border-zinc-100" />

                <Link
                  href="/restaurante-painel"
                  onClick={() =>
                    setOpen(false)
                  }
                  className="block rounded-xl bg-orange-50 px-4 py-3 text-sm font-bold text-orange-700 transition hover:bg-orange-100"
                >
                  🏪 Painel do restaurante
                </Link>
              </>
            )}

            <div className="my-2 border-t border-zinc-100" />

            {/* SAIR */}

            <button
              type="button"
              onClick={logout}
              className="w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50"
            >
              🚪 Sair
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
