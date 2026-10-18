"use client";

import {
  FormEvent,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

type Mode =
  | "login"
  | "register";

type RegisterStep =
  | "email"
  | "code"
  | "password";

const OTP_LENGTH = 8;

export default function EntregadorPage() {
  const router =
    useRouter();

  const [
    mode,
    setMode,
  ] =
    useState<Mode>(
      "login"
    );

  const [
    registerStep,
    setRegisterStep,
  ] =
    useState<RegisterStep>(
      "email"
    );

  const [
    email,
    setEmail,
  ] =
    useState("");

  const [
    password,
    setPassword,
  ] =
    useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] =
    useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [
    code,
    setCode,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    message,
    setMessage,
  ] =
    useState("");

  // ==========================================
  // LIMPAR AVISOS
  // ==========================================

  function clearMessages() {
    setError("");
    setMessage("");
  }

  // ==========================================
  // TROCAR ENTRAR / CADASTRAR
  // ==========================================

  function changeMode(
    newMode: Mode
  ) {
    setMode(
      newMode
    );

    setRegisterStep(
      "email"
    );

    setCode("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);

    clearMessages();
  }

  // ==========================================
  // LOGIN
  // ==========================================

  async function handleLogin(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (loading) {
      return;
    }

    clearMessages();

    const cleanEmail =
      email
        .trim()
        .toLowerCase();

    if (!cleanEmail) {
      setError(
        "Digite seu e-mail."
      );

      return;
    }

    if (!password) {
      setError(
        "Digite sua senha."
      );

      return;
    }

    setLoading(true);

    const {
      data,
      error:
        loginError,
    } =
      await supabase.auth
        .signInWithPassword({
          email:
            cleanEmail,

          password,
        });

    if (
      loginError ||
      !data.user
    ) {
      console.error(
        "Erro login entregador:",
        loginError
      );

      setError(
        "E-mail ou senha incorretos."
      );

      setLoading(false);

      return;
    }

    router.replace(
      "/entregador-painel"
    );

    router.refresh();
  }

  // ==========================================
  // ENVIAR CÓDIGO
  // ==========================================

  async function sendEmailCode(
    event?:
      FormEvent<HTMLFormElement>
  ) {
    if (event) {
      event.preventDefault();
    }

    if (loading) {
      return;
    }

    clearMessages();

    const cleanEmail =
      email
        .trim()
        .toLowerCase();

    if (!cleanEmail) {
      setError(
        "Digite seu e-mail."
      );

      return;
    }

    setLoading(true);

    const {
      error:
        otpError,
    } =
      await supabase.auth
        .signInWithOtp({
          email:
            cleanEmail,

          options: {
            shouldCreateUser:
              true,
          },
        });

    if (otpError) {
      console.error(
        "Erro código entregador:",
        otpError
      );

      const lowerMessage =
        otpError.message
          .toLowerCase();

      if (
        lowerMessage.includes(
          "rate"
        ) ||
        lowerMessage.includes(
          "seconds"
        )
      ) {
        setError(
          "Aguarde um pouco antes de pedir outro código."
        );
      } else {
        setError(
          "Não foi possível enviar o código para este e-mail."
        );
      }

      setLoading(false);

      return;
    }

    setEmail(
      cleanEmail
    );

    setCode("");

    setRegisterStep(
      "code"
    );

    setMessage(
      "Código enviado! Confira sua caixa de entrada."
    );

    setLoading(false);
  }

  // ==========================================
  // CONFIRMAR CÓDIGO
  // ==========================================

  async function verifyEmailCode(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (loading) {
      return;
    }

    clearMessages();

    const cleanEmail =
      email
        .trim()
        .toLowerCase();

    const cleanCode =
      code
        .replace(
          /\D/g,
          ""
        )
        .slice(
          0,
          OTP_LENGTH
        );

    if (!cleanEmail) {
      setError(
        "Informe seu e-mail novamente."
      );

      setRegisterStep(
        "email"
      );

      return;
    }

    if (
      cleanCode.length !==
      OTP_LENGTH
    ) {
      setError(
        `Digite os ${OTP_LENGTH} números enviados para seu e-mail.`
      );

      return;
    }

    setLoading(true);

    const {
      data,
      error:
        verifyError,
    } =
      await supabase.auth
        .verifyOtp({
          email:
            cleanEmail,

          token:
            cleanCode,

          type:
            "email",
        });

    if (
      verifyError ||
      !data.user
    ) {
      console.error(
        "Erro confirmação:",
        verifyError
      );

      setError(
        "Código incorreto ou expirado. Confira o e-mail e tente novamente."
      );

      setLoading(false);

      return;
    }

    setCode("");

    setRegisterStep(
      "password"
    );

    setMessage(
      "E-mail confirmado com sucesso."
    );

    setLoading(false);
  }

  // ==========================================
  // CRIAR SENHA
  // ==========================================

  async function createPassword(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (loading) {
      return;
    }

    clearMessages();

    if (
      password.length <
      6
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

    setLoading(true);

    const {
      data: {
        session,
      },
    } =
      await supabase.auth
        .getSession();

    if (!session) {
      setError(
        "Sua confirmação expirou. Confirme o e-mail novamente."
      );

      setRegisterStep(
        "email"
      );

      setLoading(false);

      return;
    }

    const {
      error:
        passwordError,
    } =
      await supabase.auth
        .updateUser({
          password,
        });

    if (passwordError) {
      console.error(
        "Erro senha entregador:",
        passwordError
      );

      setError(
        "Não foi possível criar sua senha."
      );

      setLoading(false);

      return;
    }

    router.replace(
      "/seja-entregador"
    );

    router.refresh();
  }

  // ==========================================
  // ALTERAR E-MAIL
  // ==========================================

  function changeEmail() {
    setRegisterStep(
      "email"
    );

    setCode("");

    clearMessages();
  }

  return (
    <main className="min-h-screen bg-[#f6f6f6] text-zinc-900">
      {/* ======================================
          CABEÇALHO
      ====================================== */}

      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-red-600">
              Entrega Paudalho
            </p>

            <h1 className="mt-1 text-lg font-black">
              Portal do Entregador
            </h1>
          </div>
        </div>
      </header>

      {/* ======================================
          CONTEÚDO
      ====================================== */}

      <div className="mx-auto grid min-h-[calc(100vh-73px)] max-w-7xl items-center gap-12 px-5 py-10 lg:grid-cols-[1fr_470px]">
        {/* ==================================
            LADO ESQUERDO
        ================================== */}

        <section className="hidden lg:block">
          <div className="inline-flex items-center rounded-full bg-red-100 px-4 py-2 text-sm font-black text-red-700">
            🛵 Área exclusiva para entregadores
          </div>

          <h2 className="mt-6 max-w-2xl text-5xl font-black leading-[1.05]">
            Faça entregas com o
            Entrega Paudalho.
          </h2>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-500">
            Receba oportunidades de entrega,
            acompanhe suas corridas e organize
            seu trabalho em um só lugar.
          </p>

          <div className="mt-10 grid max-w-2xl grid-cols-2 gap-4">
            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <div className="text-3xl">
                📦
              </div>

              <h3 className="mt-3 font-black">
                Entregas
              </h3>

              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Veja pedidos disponíveis
                para retirada e entrega.
              </p>
            </div>

            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <div className="text-3xl">
                🗺️
              </div>

              <h3 className="mt-3 font-black">
                Rotas
              </h3>

              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Veja os dados necessários
                para buscar e entregar pedidos.
              </p>
            </div>

            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <div className="text-3xl">
                💰
              </div>

              <h3 className="mt-3 font-black">
                Ganhos
              </h3>

              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Acompanhe suas entregas
                e seus ganhos.
              </p>
            </div>

            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <div className="text-3xl">
                🛵
              </div>

              <h3 className="mt-3 font-black">
                Operação
              </h3>

              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Controle sua disponibilidade
                para receber entregas.
              </p>
            </div>
          </div>
        </section>

        {/* ==================================
            CARD DIREITO
        ================================== */}

        <section className="w-full">
          <div className="rounded-[32px] bg-white p-6 shadow-sm sm:p-8">
            {/* CABEÇALHO */}

            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-600 text-3xl">
                🛵
              </div>

              <p className="mt-5 text-xs font-black uppercase tracking-wide text-red-600">
                Portal do Entregador
              </p>

              <h2 className="mt-2 text-3xl font-black">
                {mode ===
                "login"
                  ? "Acesse sua conta"
                  : registerStep ===
                      "email"
                    ? "Comece seu cadastro"
                    : registerStep ===
                        "code"
                      ? "Confirme seu e-mail"
                      : "Crie sua senha"}
              </h2>

              <p className="mt-2 text-sm leading-6 text-zinc-500">
                {mode ===
                "login"
                  ? "Entre para acessar seu painel de entregador."
                  : registerStep ===
                      "email"
                    ? "Informe seu e-mail para começar seu cadastro."
                    : registerStep ===
                        "code"
                      ? `Digite o código de ${OTP_LENGTH} números enviado para seu e-mail.`
                      : "Crie a senha que você usará para entrar no painel."}
              </p>
            </div>

            {/* ENTRAR / CADASTRAR */}

            <div className="mt-7 grid grid-cols-2 rounded-2xl bg-zinc-100 p-1">
              <button
                type="button"
                onClick={() =>
                  changeMode(
                    "login"
                  )
                }
                className={`rounded-xl px-4 py-3 text-sm font-black transition ${
                  mode ===
                  "login"
                    ? "bg-white text-red-600 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                Entrar
              </button>

              <button
                type="button"
                onClick={() =>
                  changeMode(
                    "register"
                  )
                }
                className={`rounded-xl px-4 py-3 text-sm font-black transition ${
                  mode ===
                  "register"
                    ? "bg-white text-red-600 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                Cadastrar
              </button>
            </div>

            {/* ==================================
                LOGIN
            ================================== */}

            {mode ===
              "login" && (
              <form
                onSubmit={
                  handleLogin
                }
                className="mt-6 space-y-4"
              >
                <div>
                  <label className="mb-2 block text-sm font-black">
                    E-mail
                  </label>

                  <input
                    type="email"
                    required
                    value={
                      email
                    }
                    onChange={(
                      event
                    ) =>
                      setEmail(
                        event.target.value
                      )
                    }
                    autoComplete="email"
                    placeholder="seuemail@gmail.com"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3.5 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-black">
                    Senha
                  </label>

                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3.5 pr-14 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      className="absolute inset-y-0 right-3 flex items-center justify-center text-zinc-500 transition hover:text-red-600"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
                        {showPassword ? (
                          <>
                            <path d="M3 3l18 18" />
                            <path d="M10.6 10.6a2 2 0 002.8 2.8" />
                            <path d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.5 9.5 7-.4 1-1.2 2.2-2.3 3.3" />
                            <path d="M6.2 6.2C4.2 7.4 2.9 9.4 2.5 12c.8 2.1 4.2 7 9.5 7 1.2 0 2.3-.2 3.3-.7" />
                          </>
                        ) : (
                          <>
                            <path d="M2.5 12s3.2-7 9.5-7 9.5 7 9.5 7-3.2 7-9.5 7-9.5-7-9.5-7Z" />
                            <circle cx="12" cy="12" r="3" />
                          </>
                        )}
                      </svg>
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="rounded-xl bg-red-50 p-4 text-sm font-bold leading-6 text-red-700">
                    ⚠️ {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={
                    loading
                  }
                  className="w-full rounded-xl bg-red-600 px-5 py-4 font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
                >
                  {loading
                    ? "Entrando..."
                    : "Entrar no painel"}
                </button>
              </form>
            )}

            {/* ==================================
                CADASTRO - EMAIL
            ================================== */}

            {mode ===
              "register" &&
              registerStep ===
                "email" && (
                <form
                  onSubmit={
                    sendEmailCode
                  }
                  className="mt-6 space-y-5"
                >
                  <div>
                    <label className="mb-2 block text-sm font-black">
                      E-mail
                    </label>

                    <input
                      type="email"
                      required
                      value={
                        email
                      }
                      onChange={(
                        event
                      ) =>
                        setEmail(
                          event.target.value
                        )
                      }
                      autoComplete="email"
                      placeholder="seuemail@gmail.com"
                      className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-4 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                    />

                    <p className="mt-2 text-xs leading-5 text-zinc-400">
                      Vamos enviar um código
                      de confirmação para este
                      endereço.
                    </p>
                  </div>

                  {error && (
                    <div className="rounded-xl bg-red-50 p-4 text-sm font-bold leading-6 text-red-700">
                      ⚠️ {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={
                      loading
                    }
                    className="w-full rounded-xl bg-red-600 px-5 py-4 font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
                  >
                    {loading
                      ? "Enviando código..."
                      : "Confirmar e-mail"}
                  </button>

                  <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                    <p className="font-black">
                      🔒 Cadastro seguro
                    </p>

                    <p className="mt-2 text-sm leading-6 text-zinc-500">
                      Você só continuará para
                      os seus dados depois de
                      confirmar que este e-mail
                      pertence a você.
                    </p>
                  </div>
                </form>
              )}

            {/* ==================================
                CADASTRO - CÓDIGO
            ================================== */}

            {mode ===
              "register" &&
              registerStep ===
                "code" && (
                <form
                  onSubmit={
                    verifyEmailCode
                  }
                  className="mt-6"
                >
                  <div className="rounded-2xl bg-zinc-50 p-4 text-center">
                    <p className="text-xs font-bold text-zinc-400">
                      Código enviado para
                    </p>

                    <p className="mt-1 font-black">
                      {email}
                    </p>

                    <button
                      type="button"
                      onClick={
                        changeEmail
                      }
                      className="mt-2 text-xs font-black text-red-600 hover:underline"
                    >
                      Alterar e-mail
                    </button>
                  </div>

                  <div className="mt-6">
                    <label className="mb-3 block text-center text-sm font-black">
                      Código de confirmação
                    </label>

                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={
                        code
                      }
                      onChange={(
                        event
                      ) =>
                        setCode(
                          event.target.value
                            .replace(
                              /\D/g,
                              ""
                            )
                            .slice(
                              0,
                              OTP_LENGTH
                            )
                        )
                      }
                      maxLength={
                        OTP_LENGTH
                      }
                      placeholder="00000000"
                      className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-4 text-center text-3xl font-black tracking-[0.35em] outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                    />

                    <p className="mt-2 text-center text-xs text-zinc-400">
                      Digite os {OTP_LENGTH} números
                      recebidos no e-mail.
                    </p>
                  </div>

                  {message && (
                    <div className="mt-4 rounded-xl bg-green-50 p-4 text-sm font-bold leading-6 text-green-700">
                      ✅ {message}
                    </div>
                  )}

                  {error && (
                    <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-bold leading-6 text-red-700">
                      ⚠️ {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={
                      loading ||
                      code.length !==
                        OTP_LENGTH
                    }
                    className="mt-5 w-full rounded-xl bg-red-600 px-5 py-4 font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
                  >
                    {loading
                      ? "Confirmando..."
                      : "Confirmar código"}
                  </button>

                  <button
                    type="button"
                    disabled={
                      loading
                    }
                    onClick={() =>
                      sendEmailCode()
                    }
                    className="mt-3 w-full rounded-xl border border-zinc-200 bg-white px-5 py-3.5 text-sm font-black transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-300"
                  >
                    Reenviar código
                  </button>
                </form>
              )}

            {/* ==================================
                CADASTRO - SENHA
            ================================== */}

            {mode ===
              "register" &&
              registerStep ===
                "password" && (
                <form
                  onSubmit={
                    createPassword
                  }
                  className="mt-6 space-y-4"
                >
                  <div className="rounded-2xl bg-green-50 p-4 text-center">
                    <p className="font-black text-green-700">
                      ✅ E-mail confirmado
                    </p>

                    <p className="mt-1 text-sm text-green-600">
                      {email}
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-black">
                      Criar senha
                    </label>

                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete="new-password"
                        placeholder="••••••••"
                        className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3.5 pr-14 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((visible) => !visible)}
                        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                        title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                        className="absolute inset-y-0 right-3 flex items-center justify-center text-zinc-500 transition hover:text-red-600"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
                          {showPassword ? (
                            <>
                              <path d="M3 3l18 18" />
                              <path d="M10.6 10.6a2 2 0 002.8 2.8" />
                              <path d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.5 9.5 7-.4 1-1.2 2.2-2.3 3.3" />
                              <path d="M6.2 6.2C4.2 7.4 2.9 9.4 2.5 12c.8 2.1 4.2 7 9.5 7 1.2 0 2.3-.2 3.3-.7" />
                            </>
                          ) : (
                            <>
                              <path d="M2.5 12s3.2-7 9.5-7 9.5 7 9.5 7-3.2 7-9.5 7-9.5-7-9.5-7Z" />
                              <circle cx="12" cy="12" r="3" />
                            </>
                          )}
                        </svg>
                      </button>
                    </div>

                    <p className="mt-2 text-xs text-zinc-400">
                      Use pelo menos 6 caracteres.
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-black">
                      Confirmar senha
                    </label>

                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        autoComplete="new-password"
                        placeholder="••••••••"
                        className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3.5 pr-14 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((visible) => !visible)}
                        aria-label={showConfirmPassword ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"}
                        title={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
                        className="absolute inset-y-0 right-3 flex items-center justify-center text-zinc-500 transition hover:text-red-600"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
                          {showConfirmPassword ? (
                            <>
                              <path d="M3 3l18 18" />
                              <path d="M10.6 10.6a2 2 0 002.8 2.8" />
                              <path d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.5 9.5 7-.4 1-1.2 2.2-2.3 3.3" />
                              <path d="M6.2 6.2C4.2 7.4 2.9 9.4 2.5 12c.8 2.1 4.2 7 9.5 7 1.2 0 2.3-.2 3.3-.7" />
                            </>
                          ) : (
                            <>
                              <path d="M2.5 12s3.2-7 9.5-7 9.5 7 9.5 7-3.2 7-9.5 7-9.5-7-9.5-7Z" />
                              <circle cx="12" cy="12" r="3" />
                            </>
                          )}
                        </svg>
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-xl bg-red-50 p-4 text-sm font-bold leading-6 text-red-700">
                      ⚠️ {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={
                      loading
                    }
                    className="w-full rounded-xl bg-red-600 px-5 py-4 font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
                  >
                    {loading
                      ? "Criando conta..."
                      : "Continuar cadastro"}
                  </button>
                </form>
              )}

            {/* RODAPÉ */}

            <div className="mt-6 border-t border-zinc-100 pt-5">
              <p className="text-center text-xs leading-5 text-zinc-400">
                🔒 Área exclusiva para
                entregadores parceiros do
                Entrega Paudalho.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}