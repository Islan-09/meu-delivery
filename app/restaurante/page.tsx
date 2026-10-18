"use client";

import {
  FormEvent,
  useState,
} from "react";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Mode = "login" | "register";
type RegisterStep = "email" | "code";

const OTP_LENGTH = 8;

export default function RestaurantePage() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("login");
  const [registerStep, setRegisterStep] = useState<RegisterStep>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function clearMessages() {
    setError("");
    setMessage("");
  }

  function changeMode(newMode: Mode) {
    setMode(newMode);
    setRegisterStep("email");
    setPassword("");
    setShowPassword(false);
    setCode("");
    clearMessages();
  }

  async function redirectRestaurant(userId: string) {
    const { data: restaurant, error: restaurantError } = await supabase
      .from("restaurants")
      .select("id")
      .eq("owner_id", userId)
      .limit(1)
      .maybeSingle();

    if (restaurantError) {
      console.error("Erro ao verificar restaurante:", restaurantError);
      setError("Não foi possível verificar sua loja.");
      return;
    }

    if (restaurant) {
      router.replace("/restaurante-painel");
      router.refresh();
      return;
    }

    router.replace("/restaurante/inicio");
    router.refresh();
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    clearMessages();

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError("Digite seu e-mail.");
      return;
    }
    if (!password) {
      setError("Digite sua senha.");
      return;
    }

    setLoading(true);
    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (loginError || !data.user) {
        console.error("Erro no login:", loginError);
        setPassword("");
        setShowPassword(false);
        setError("E-mail ou senha incorretos. Tente novamente.");
        return;
      }

      await redirectRestaurant(data.user.id);
    } catch (err) {
      console.error("Erro inesperado no login:", err);
      setPassword("");
      setShowPassword(false);
      setError("Não foi possível entrar. Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function sendEmailCode(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (loading) return;
    clearMessages();

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError("Digite seu e-mail.");
      return;
    }

    setLoading(true);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: { shouldCreateUser: true },
      });

      if (otpError) {
        console.error("Erro ao enviar código:", otpError);
        const lowerMessage = otpError.message.toLowerCase();
        if (lowerMessage.includes("rate") || lowerMessage.includes("seconds")) {
          setError("Aguarde um pouco antes de pedir outro código.");
        } else {
          setError("Não foi possível enviar o código para este e-mail.");
        }
        return;
      }

      setEmail(cleanEmail);
      setCode("");
      setRegisterStep("code");
      setMessage("Código enviado! Confira sua caixa de entrada.");
    } catch (err) {
      console.error("Erro ao enviar código:", err);
      setError("Não foi possível enviar o código. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyEmailCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    clearMessages();

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.replace(/\D/g, "").slice(0, OTP_LENGTH);

    if (!cleanEmail) {
      setError("Informe seu e-mail novamente.");
      setRegisterStep("email");
      return;
    }
    if (cleanCode.length !== OTP_LENGTH) {
      setError(`Digite os ${OTP_LENGTH} números enviados para seu e-mail.`);
      return;
    }

    setLoading(true);
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanCode,
        type: "email",
      });

      if (verifyError || !data.user) {
        console.error("Erro ao confirmar código:", verifyError);
        setCode("");
        setError("Código incorreto ou expirado. Confira o e-mail e tente novamente.");
        return;
      }

      router.replace("/restaurante/inicio");
      router.refresh();
    } catch (err) {
      console.error("Erro ao confirmar código:", err);
      setCode("");
      setError("Não foi possível confirmar o código. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function changeEmail() {
    setRegisterStep("email");
    setCode("");
    clearMessages();
  }

  const isLogin = mode === "login";
  const isEmailStep = registerStep === "email";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f7f8fc] text-slate-900">
      {/* Fundo decorativo */}
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-40 h-[500px] w-[500px] rounded-full bg-red-100/60 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-48 -left-40 h-[500px] w-[500px] rounded-full bg-orange-100/50 blur-3xl" />

      {/* Cabeçalho */}
      <header className="relative z-10 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-600 text-white shadow-lg shadow-red-200">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" aria-hidden="true">
                <path d="M3 10h18l-2 10H5L3 10Z" strokeLinejoin="round" />
                <path d="M7 10 9 4h6l2 6M9 14v3m6-3v3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p className="text-base font-black tracking-tight">Entrega <span className="text-red-600">Paudalho</span></p>
              <p className="text-xs font-medium text-slate-500">Portal do Restaurante</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-slate-600">Área de parceiros</span>
          </div>
        </div>
      </header>

      {/* Conteúdo principal */}
      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-77px)] max-w-7xl items-center gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[1fr_460px] lg:gap-16 lg:py-14">
        {/* Apresentação */}
        <section className="mx-auto w-full max-w-2xl lg:mx-0">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-red-100 bg-white px-4 py-2 shadow-sm">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
                <path d="M3 21h18M5 21V7l7-4 7 4v14M9 11h.01M15 11h.01M9 15h.01M15 15h.01M10 21v-3h4v3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="text-xs font-bold text-red-700">Feito para quem empreende</span>
          </div>

          <h1 className="max-w-xl text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            Seu restaurante merece <span className="text-red-600">crescer.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            Gerencie sua loja no Entrega Paudalho com praticidade. Organize pedidos, atualize seu cardápio e acompanhe sua operação em um só lugar.
          </p>

          {/* Recursos */}
          <div className="mt-9 grid gap-3 sm:grid-cols-2">
            <div className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" aria-hidden="true"><path d="M7 3h8l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" strokeLinejoin="round" /><path d="M15 3v5h4M9 13h6m-6 4h6" strokeLinecap="round" /></svg>
              </div>
              <h3 className="mt-4 font-bold">Gestão de pedidos</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">Acompanhe os pedidos e organize cada etapa do preparo.</p>
            </div>

            <div className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" aria-hidden="true"><path d="M4 10h16M5 10a7 7 0 0 1 14 0M6 10v9h12v-9M9 14h6m-6 3h6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <h3 className="mt-4 font-bold">Seu cardápio</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">Organize produtos, preços e disponibilidade dos itens.</p>
            </div>

            <div className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" aria-hidden="true"><path d="M3 3v18h18M7 14l4-4 4 3 5-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <h3 className="mt-4 font-bold">Acompanhe sua loja</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">Tenha acesso às informações disponíveis da sua operação.</p>
            </div>

            <div className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <h3 className="mt-4 font-bold">Mais praticidade</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">Acesse as ferramentas da sua loja em um único ambiente.</p>
            </div>
          </div>

          <div className="mt-7 flex items-center gap-3 text-sm text-slate-500">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm ring-1 ring-slate-200">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true"><path d="m5 12 4 4L19 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <p>Um ambiente pensado para facilitar o dia a dia do seu restaurante.</p>
          </div>
        </section>

        {/* Card de acesso */}
        <section className="mx-auto w-full max-w-[460px]">
          <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-xl shadow-slate-200/70">
            <div className="h-1.5 bg-gradient-to-r from-red-700 via-red-600 to-orange-400" />
            <div className="p-6 sm:p-9">
              {/* Cabeçalho do formulário */}
              <div className="text-center">
                <div className="mx-auto flex h-[68px] w-[68px] items-center justify-center rounded-[22px] bg-red-600 text-white shadow-lg shadow-red-200">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-8 w-8" aria-hidden="true"><path d="M3 10h18l-2 10H5L3 10Z" strokeLinejoin="round" /><path d="M7 10 9 4h6l2 6M9 14v3m6-3v3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <p className="mt-5 text-[11px] font-extrabold uppercase tracking-[0.2em] text-red-600">Portal do Restaurante</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
                  {isLogin ? "Bem-vindo de volta!" : isEmailStep ? "Cadastre sua loja" : "Confirme seu e-mail"}
                </h2>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-500">
                  {isLogin
                    ? "Entre na sua conta para acessar o painel do restaurante."
                    : isEmailStep
                      ? "Comece informando o e-mail que você deseja usar."
                      : "Digite o código de confirmação que enviamos para seu e-mail."}
                </p>
              </div>

              {/* Abas */}
              <div className="mt-7 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
                <button type="button" onClick={() => changeMode("login")} aria-pressed={isLogin} className={`rounded-lg px-3 py-3 text-sm font-bold transition ${isLogin ? "bg-white text-red-600 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}>Entrar</button>
                <button type="button" onClick={() => changeMode("register")} aria-pressed={!isLogin} className={`rounded-lg px-3 py-3 text-sm font-bold transition ${!isLogin ? "bg-white text-red-600 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}>Cadastrar loja</button>
              </div>

              {/* Formulário de login */}
              {isLogin && (
                <form onSubmit={handleLogin} className="mt-6 space-y-5">
                  <div>
                    <label htmlFor="login-email" className="mb-2 block text-sm font-bold text-slate-700">E-mail</label>
                    <input id="login-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="seuemail@gmail.com" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-red-500 focus:ring-4 focus:ring-red-50" />
                  </div>

                  <div>
                    <label htmlFor="login-password" className="mb-2 block text-sm font-bold text-slate-700">Senha</label>
                    <div className="relative">
                      <input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete="current-password"
                        placeholder="Digite sua senha"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 pr-12 text-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-red-500 focus:ring-4 focus:ring-red-50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                        aria-pressed={showPassword}
                        className="absolute inset-y-0 right-0 flex items-center justify-center rounded-r-xl px-4 text-slate-500 transition hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                      >
                        {showPassword ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
                            <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M9.9 5.7A10.8 10.8 0 0 1 12 5.5c4.5 0 8.2 2.9 9.9 6.5a11.7 11.7 0 0 1-3.1 3.9M6.2 6.2A12.5 12.5 0 0 0 2.1 12c1.7 3.6 5.4 6.5 9.9 6.5 1.2 0 2.3-.2 3.3-.6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
                            <path d="M2.1 12C3.8 8.4 7.5 5.5 12 5.5s8.2 2.9 9.9 6.5c-1.7 3.6-5.4 6.5-9.9 6.5S3.8 15.6 2.1 12Z" strokeLinecap="round" strokeLinejoin="round" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div role="alert" className="flex gap-3 rounded-xl border border-red-100 bg-red-50 p-3.5 text-sm leading-6 text-red-700">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v5m0 3h.01" strokeLinecap="round" /></svg>
                      <p>{error}</p>
                    </div>
                  )}

                  <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-4 text-sm font-extrabold text-white shadow-md shadow-red-100 transition hover:bg-red-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none">
                    {loading ? (
                      <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Entrando...</>
                    ) : (
                      <>Entrar no painel<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg></>
                    )}
                  </button>
                </form>
              )}

              {/* Cadastro: e-mail */}
              {!isLogin && isEmailStep && (
                <form onSubmit={sendEmailCode} className="mt-6 space-y-5">
                  <div>
                    <label htmlFor="register-email" className="mb-2 block text-sm font-bold text-slate-700">E-mail</label>
                    <input id="register-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="seuemail@gmail.com" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-red-500 focus:ring-4 focus:ring-red-50" />
                    <p className="mt-2 text-xs leading-5 text-slate-500">Você receberá um código para confirmar que o e-mail pertence a você.</p>
                  </div>

                  {error && <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3.5 text-sm leading-6 text-red-700">{error}</div>}

                  <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-4 text-sm font-extrabold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                    {loading ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Enviando código...</> : "Continuar com e-mail"}
                  </button>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-600 shadow-sm ring-1 ring-slate-200">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" strokeLinecap="round" /></svg>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">Cadastro protegido</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">A confirmação do e-mail é a primeira etapa para iniciar seu cadastro.</p>
                      </div>
                    </div>
                  </div>
                </form>
              )}

              {/* Cadastro: código */}
              {!isLogin && !isEmailStep && (
                <form onSubmit={verifyEmailCode} className="mt-6">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white text-red-600 shadow-sm ring-1 ring-slate-200">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </div>
                    <p className="mt-3 text-xs font-medium text-slate-500">Código enviado para</p>
                    <p className="mt-1 break-all text-sm font-bold text-slate-800">{email}</p>
                    <button type="button" onClick={changeEmail} className="mt-2 text-xs font-bold text-red-600 hover:text-red-700 hover:underline">Alterar e-mail</button>
                  </div>

                  <div className="mt-6">
                    <label htmlFor="register-code" className="mb-3 block text-center text-sm font-bold text-slate-700">Código de confirmação</label>
                    <input id="register-code" type="text" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH))} maxLength={OTP_LENGTH} placeholder="00000000" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-4 text-center text-2xl font-extrabold tracking-[0.3em] outline-none transition placeholder:text-slate-300 focus:border-red-500 focus:ring-4 focus:ring-red-50 sm:text-3xl" />
                    <p className="mt-2 text-center text-xs text-slate-500">Digite os 8 números recebidos no seu e-mail.</p>
                  </div>

                  {message && <div role="status" className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3.5 text-sm leading-6 text-emerald-700">{message}</div>}
                  {error && <div role="alert" className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3.5 text-sm leading-6 text-red-700">{error}</div>}

                  <button type="submit" disabled={loading || code.length !== OTP_LENGTH} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-4 text-sm font-extrabold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                    {loading ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Confirmando...</> : "Confirmar código"}
                  </button>
                  <button type="button" disabled={loading} onClick={() => sendEmailCode()} className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-bold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Reenviar código</button>
                </form>
              )}

              {/* Rodapé do card */}
              <div className="mt-7 border-t border-slate-100 pt-5">
                <div className="flex items-center justify-center gap-2 text-slate-400">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4 shrink-0" aria-hidden="true"><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" strokeLinejoin="round" /><path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <p className="text-center text-xs leading-5">Acesso exclusivo para parceiros do Entrega Paudalho.</p>
                </div>
              </div>
            </div>
          </div>
          <p className="mt-5 text-center text-xs leading-5 text-slate-400">Entrega Paudalho · Portal do Restaurante</p>
        </section>
      </div>
    </main>
  );
}
