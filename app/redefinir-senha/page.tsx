"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

export default function RedefinirSenhaPage() {
  const router = useRouter();

  const [checking, setChecking] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [allowed, setAllowed] =
    useState(false);

  const [password, setPassword] =
    useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  useEffect(() => {
    async function checkSession() {
      // O link enviado pelo Supabase
      // cria uma sessão temporária
      // para permitir trocar a senha.

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            500
          )
      );

      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      if (session) {
        setAllowed(true);
      }

      setChecking(false);
    }

    checkSession();

    const {
      data: { subscription },
    } =
      supabase.auth.onAuthStateChange(
        (event) => {
          if (
            event ===
              "PASSWORD_RECOVERY" ||
            event === "SIGNED_IN"
          ) {
            setAllowed(true);
            setChecking(false);
          }
        }
      );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function changePassword(
    event: FormEvent
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (
      password.length < 6
    ) {
      setError(
        "A senha precisa ter pelo menos 6 caracteres."
      );

      return;
    }

    if (
      password !==
      confirmPassword
    ) {
      setError(
        "As senhas não são iguais."
      );

      return;
    }

    setSaving(true);

    const {
      error: updateError,
    } =
      await supabase.auth.updateUser(
        {
          password,
        }
      );

    if (updateError) {
      console.error(
        "Erro nova senha:",
        updateError
      );

      setError(
        "Não foi possível alterar a senha."
      );

      setSaving(false);

      return;
    }

    setSuccess(
      "Senha alterada com sucesso!"
    );

    setPassword("");
    setConfirmPassword("");

    setSaving(false);

    window.setTimeout(() => {
      router.replace("/");
    }, 2500);
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7]">
        <p className="font-bold">
          Verificando link...
        </p>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7] px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
          <div className="text-5xl">
            ⚠️
          </div>

          <h1 className="mt-4 text-2xl font-black">
            Link inválido ou expirado
          </h1>

          <p className="mt-2 text-zinc-500">
            Solicite um novo link de
            redefinição de senha.
          </p>

          <button
            type="button"
            onClick={() =>
              router.replace(
                "/minha-conta"
              )
            }
            className="mt-6 w-full rounded-xl bg-red-600 px-5 py-4 font-black text-white"
          >
            Voltar
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7] px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm">
        <div className="text-5xl">
          🔐
        </div>

        <h1 className="mt-4 text-3xl font-black">
          Criar nova senha
        </h1>

        <p className="mt-2 text-zinc-500">
          Digite abaixo a nova senha
          da sua conta.
        </p>

        <form
          onSubmit={changePassword}
          className="mt-6"
        >
          <div>
            <label className="mb-2 block text-sm font-bold">
              Nova senha
            </label>

            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value
                )
              }
              placeholder="••••••••"
              className="w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-red-500"
            />
          </div>

          <div className="mt-4">
            <label className="mb-2 block text-sm font-bold">
              Confirmar nova senha
            </label>

            <input
              type="password"
              value={
                confirmPassword
              }
              onChange={(event) =>
                setConfirmPassword(
                  event.target.value
                )
              }
              placeholder="••••••••"
              className="w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-red-500"
            />
          </div>

          {error && (
            <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-5 rounded-xl bg-green-50 p-4 text-sm font-semibold text-green-700">
              ✅ {success}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="mt-6 w-full rounded-xl bg-red-600 px-5 py-4 font-black text-white disabled:bg-zinc-300"
          >
            {saving
              ? "Alterando senha..."
              : "Salvar nova senha"}
          </button>
        </form>
      </div>
    </main>
  );
}