"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const PROFILE_PHOTO_BUCKET = "profile-photos";
const PROFILE_PHOTO_URL_SECONDS = 60 * 60;

type UserInfo = {
  name: string;
  email: string;
  phone: string | null;
  role: string;
  hasRestaurant: boolean;
  avatarUrl: string | null;
};

function ProfileAvatar({
  name,
  avatarUrl,
  className,
}: {
  name: string;
  avatarUrl: string | null;
  className: string;
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={`Foto de perfil de ${name}`}
        className={`${className} object-cover`}
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
      />
    );
  }

  return (
    <span className={`${className} flex items-center justify-center bg-red-100`} aria-hidden="true">
      👤
    </span>
  );
}

export default function UserMenu() {
  const router = useRouter();

  const [user, setUser] = useState<UserInfo | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.error("Erro ao carregar sessão do usuário:", sessionError);
    }

    if (!session) {
      setUser(null);
      setOpen(false);
      setLoading(false);
      return;
    }

    const [{ data: profile, error: profileError }, { data: restaurant, error: restaurantError }] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, phone, role")
        .eq("id", session.user.id)
        .maybeSingle(),
      supabase
        .from("restaurants")
        .select("id")
        .eq("owner_id", session.user.id)
        .limit(1)
        .maybeSingle(),
    ]);

    if (profileError) {
      console.error("Erro ao carregar perfil:", profileError);
    }
    if (restaurantError) {
      console.error("Erro ao verificar restaurante:", restaurantError);
    }

    const avatarPath = String(session.user.user_metadata?.avatar_path ?? "");
    let avatarUrl: string | null = null;

    if (avatarPath) {
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from(PROFILE_PHOTO_BUCKET)
        .createSignedUrl(avatarPath, PROFILE_PHOTO_URL_SECONDS);

      if (signedUrlError) {
        console.error("Erro ao carregar foto de perfil:", signedUrlError);
      } else {
        avatarUrl = signedUrlData.signedUrl;
      }
    }

    setUser({
      name:
        profile?.full_name ||
        String(session.user.user_metadata?.full_name ?? "") ||
        session.user.email?.split("@")[0] ||
        "Minha conta",
      email: session.user.email || "",
      phone: profile?.phone || (session.user.user_metadata?.phone as string | undefined) || null,
      role: profile?.role || "customer",
      hasRestaurant: Boolean(restaurant),
      avatarUrl,
    });

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadUser();
    });

    // Caso a foto seja atualizada em outra tela da mesma aba, recarrega os dados ao voltar.
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadUser();
      }
    };
    window.addEventListener("focus", handleVisibility);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("focus", handleVisibility);
    };
  }, [loadUser]);

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Erro ao sair da conta:", error);
      return;
    }

    setUser(null);
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  if (loading) {
    return <div className="h-11 w-28 animate-pulse rounded-xl bg-zinc-100" />;
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="flex h-11 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 font-semibold text-zinc-800 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-100" aria-hidden="true">👤</span>
        <span>Entrar</span>
      </Link>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex h-11 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 font-semibold transition hover:bg-zinc-50"
      >
        <ProfileAvatar
          name={user.name}
          avatarUrl={user.avatarUrl}
          className="h-8 w-8 shrink-0 rounded-full"
        />
        <span className="hidden max-w-40 truncate sm:block">{user.name}</span>
        <span className="text-xs" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
          <div className="flex items-center gap-3 border-b border-zinc-100 p-4">
            <ProfileAvatar
              name={user.name}
              avatarUrl={user.avatarUrl}
              className="h-11 w-11 shrink-0 rounded-full"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{user.name}</p>
              <p className="mt-1 truncate text-sm text-zinc-500">{user.email}</p>
              {user.phone && <p className="mt-1 text-sm text-zinc-500">📱 {user.phone}</p>}
            </div>
          </div>

          <div className="p-2">
            <Link href="/minha-conta" onClick={() => setOpen(false)} className="block rounded-xl px-4 py-3 text-sm font-semibold transition hover:bg-zinc-100">
              👤 Minha conta
            </Link>
            <Link href="/meus-enderecos" onClick={() => setOpen(false)} className="block rounded-xl px-4 py-3 text-sm font-semibold transition hover:bg-zinc-100">
              📍 Meus endereços
            </Link>
            <Link href="/meus-pedidos" onClick={() => setOpen(false)} className="block rounded-xl px-4 py-3 text-sm font-semibold transition hover:bg-zinc-100">
              🧾 Meus pedidos
            </Link>
            <Link href="/mensagens" onClick={() => setOpen(false)} className="block rounded-xl px-4 py-3 text-sm font-semibold transition hover:bg-zinc-100">
              💬 Mensagens
            </Link>
            <Link href="/favoritos" onClick={() => setOpen(false)} className="block rounded-xl px-4 py-3 text-sm font-semibold transition hover:bg-zinc-100">
              ❤️ Favoritos
            </Link>
            <Link href="/ajuda" onClick={() => setOpen(false)} className="block rounded-xl px-4 py-3 text-sm font-semibold transition hover:bg-zinc-100">
              💬 Ajuda e suporte
            </Link>

            {user.hasRestaurant && (
              <>
                <div className="my-2 border-t border-zinc-100" />
                <Link href="/restaurante-painel" onClick={() => setOpen(false)} className="block rounded-xl bg-orange-50 px-4 py-3 text-sm font-bold text-orange-700 transition hover:bg-orange-100">
                  🏪 Painel do restaurante
                </Link>
              </>
            )}

            <div className="my-2 border-t border-zinc-100" />
            <button type="button" onClick={logout} className="w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50">
              🚪 Sair
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
