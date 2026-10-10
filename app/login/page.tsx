"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<
    "login" | "register"
  >("login");

  const [name, setName] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  // ==========================================
  // ENTRAR
  // ==========================================

  async function handleLogin(
    event: FormEvent
  ) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setMessage("");

    const { error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (error) {
      setError(
        "E-mail ou senha incorretos."
      );

      setLoading(false);
      return;
    }

    const returnPath =
      sessionStorage.getItem(
        "after-login"
      );

    sessionStorage.removeItem(
      "after-login"
    );

    router.push(
      returnPath || "/"
    );

    router.refresh();
  }

  // ==========================================
  // CRIAR CONTA
  // ==========================================

  async function handleRegister(
    event: FormEvent
  ) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setMessage("");

    if (
      name.trim().length < 3
    ) {
      setError(
        "Digite seu nome completo."
      );

      setLoading(false);
      return;
    }

    if (
      password.length < 6
    ) {
      setError(
        "A senha precisa ter pelo menos 6 caracteres."
      );

      setLoading(false);
      return;
    }

    const { data, error } =
      await supabase.auth.signUp({
        email,
        password,

        options: {
          data: {
            full_name: name,
            phone,
          },
        },
      });

    if (error) {
      setError(
        error.message
      );

      setLoading(false);
      return;
    }

    // ========================================
    // CASO PRECISE CONFIRMAR E-MAIL
    // ========================================

    if (!data.session) {
      setMessage(
        "Conta criada! Confira seu e-mail para confirmar o cadastro."
      );

      setLoading(false);
      return;
    }

    // ========================================
    // VOLTAR PARA ONDE O CLIENTE ESTAVA
    // ========================================

    const returnPath =
      sessionStorage.getItem(
        "after-login"
      );

    sessionStorage.removeItem(
      "after-login"
    );

    router.push(
      returnPath || "/"
    );

    router.refresh();
  }

  // ==========================================
  // CONTINUAR SEM LOGIN
  // ==========================================

  function handleGuest() {
    // Se a pessoa entrou nessa tela
    // depois de tentar comprar e resolveu
    // apenas navegar, removemos o retorno
    // antigo para não redirecioná-la depois.

    sessionStorage.removeItem(
      "after-login"
    );

    router.push("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7] px-4 py-10">
      <div className="w-full max-w-md">
        {/* VOLTAR */}

        <Link
          href="/"
          className="mb-6 inline-block font-semibold text-red-600"
        >
          ← Voltar
        </Link>

        {/* CARD */}

        <div className="rounded-3xl bg-white p-7 shadow-sm">
          {/* LOGO */}

          <div className="text-center">
            <div className="text-5xl">
              🍕
            </div>

            <h1 className="mt-4 text-2xl font-black">
              Entrega Paudalho
            </h1>

            <p className="mt-2 text-sm text-zinc-500">
              {mode === "login"
                ? "Entre para continuar seu pedido"
                : "Crie sua conta gratuitamente"}
            </p>
          </div>

          {/* ENTRAR / CRIAR CONTA */}

          <div className="mt-7 grid grid-cols-2 rounded-xl bg-zinc-100 p-1">
            <button
              type="button"
              onClick={() => {
                setMode(
                  "login"
                );

                setError("");
                setMessage("");
              }}
              className={`rounded-lg px-4 py-2.5 text-sm font-bold transition ${
                mode === "login"
                  ? "bg-white text-red-600 shadow-sm"
                  : "text-zinc-500"
              }`}
            >
              Entrar
            </button>

            <button
              type="button"
              onClick={() => {
                setMode(
                  "register"
                );

                setError("");
                setMessage("");
              }}
              className={`rounded-lg px-4 py-2.5 text-sm font-bold transition ${
                mode ===
                "register"
                  ? "bg-white text-red-600 shadow-sm"
                  : "text-zinc-500"
              }`}
            >
              Criar conta
            </button>
          </div>

          {/* FORMULÁRIO */}

          <form
            onSubmit={
              mode === "login"
                ? handleLogin
                : handleRegister
            }
            className="mt-6 space-y-4"
          >
            {/* NOME + WHATSAPP */}

            {mode ===
              "register" && (
              <>
                <div>
                  <label className="mb-2 block text-sm font-bold">
                    Nome completo
                  </label>

                  <input
                    type="text"
                    value={name}
                    onChange={(
                      event
                    ) =>
                      setName(
                        event.target
                          .value
                      )
                    }
                    placeholder="Seu nome"
                    required
                    className="w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold">
                    WhatsApp
                  </label>

                  <input
                    type="tel"
                    value={phone}
                    onChange={(
                      event
                    ) =>
                      setPhone(
                        event.target
                          .value
                      )
                    }
                    placeholder="(81) 99999-9999"
                    className="w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition focus:border-red-500"
                  />
                </div>
              </>
            )}

            {/* E-MAIL */}

            <div>
              <label className="mb-2 block text-sm font-bold">
                E-mail
              </label>

              <input
                type="email"
                value={email}
                onChange={(
                  event
                ) =>
                  setEmail(
                    event.target
                      .value
                  )
                }
                placeholder="seuemail@gmail.com"
                required
                className="w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition focus:border-red-500"
              />
            </div>

            {/* SENHA */}

            <div>
              <label className="mb-2 block text-sm font-bold">
                Senha
              </label>

              <input
                type="password"
                value={
                  password
                }
                onChange={(
                  event
                ) =>
                  setPassword(
                    event.target
                      .value
                  )
                }
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition focus:border-red-500"
              />
            </div>

            {/* ERRO */}

            {error && (
              <div className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            {/* SUCESSO */}

            {message && (
              <div className="rounded-xl bg-green-50 p-3 text-sm font-medium text-green-700">
                {message}
              </div>
            )}

            {/* ENTRAR / CRIAR */}

            <button
              type="submit"
              disabled={
                loading
              }
              className="w-full rounded-xl bg-red-600 px-5 py-4 font-bold text-white transition hover:bg-red-700 disabled:bg-zinc-300"
            >
              {loading
                ? "Aguarde..."
                : mode ===
                    "login"
                  ? "Entrar"
                  : "Criar minha conta"}
            </button>
          </form>

          {/* ==================================
              CONTINUAR SEM LOGIN
          ================================== */}

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-zinc-200" />

            <span className="text-xs font-semibold text-zinc-400">
              OU
            </span>

            <div className="h-px flex-1 bg-zinc-200" />
          </div>

          <button
            type="button"
            onClick={
              handleGuest
            }
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-5 py-4 font-bold text-zinc-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            🍔 Ver cardápio sem entrar
          </button>

          <p className="mt-3 text-center text-xs leading-5 text-zinc-400">
            Você pode navegar e adicionar
            produtos ao carrinho sem criar
            uma conta.
          </p>
        </div>
      </div>
    </main>
  );
}