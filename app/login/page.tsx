"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("E-mail ou senha incorretos.");
      setPassword("");
      setShowPassword(false);
      setLoading(false);
      return;
    }

    const returnPath = sessionStorage.getItem("after-login");
    sessionStorage.removeItem("after-login");
    router.push(returnPath || "/");
    router.refresh();
  }

  async function handleRegister(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    if (name.trim().length < 3) {
      setError("Digite seu nome completo.");
      setLoading(false);
      return;
    }
    if (password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      setPassword("");
      setShowPassword(false);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name, phone } },
    });

    if (error) {
      setError(error.message);
      setPassword("");
      setShowPassword(false);
      setLoading(false);
      return;
    }

    if (!data.session) {
      setMessage("Conta criada! Confira seu e-mail para confirmar o cadastro.");
      setPassword("");
      setShowPassword(false);
      setLoading(false);
      return;
    }

    const returnPath = sessionStorage.getItem("after-login");
    sessionStorage.removeItem("after-login");
    router.push(returnPath || "/");
    router.refresh();
  }

  function handleGuest() {
    sessionStorage.removeItem("after-login");
    router.push("/");
  }

  return (
    <main className="min-h-screen bg-zinc-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-5xl grid md:grid-cols-2 bg-white rounded-[28px] shadow-[0_20px_80px_rgba(0,0,0,0.12)] overflow-hidden">
        {/* LADO ESQUERDO - BRANDING PROFISSIONAL */}
        <div className="hidden md:flex flex-col justify-between bg-[#E30613] p-10 text-white">
          <div>
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-3xl">🍕</div>
            <h1 className="mt-8 text-4xl font-black leading-[0.9]">Entrega<br />Paudalho</h1>
            <p className="mt-4 text-white/90 font-medium leading-6">Peça em segundos. Entrega rápida, comida quente e atendimento de verdade.</p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold"><span className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">✓</span> Entrega em até 40 min</div>
            <div className="flex items-center gap-2 text-sm font-bold"><span className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">✓</span> Pagamento online e na entrega</div>
            <div className="flex items-center gap-2 text-sm font-bold"><span className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">✓</span> Acompanhe seu pedido</div>
          </div>
        </div>

        {/* LADO DIREITO - FORM */}
        <div className="p-8 md:p-10">
          <Link href="/" className="mb-6 inline-block text-sm font-black text-[#E30613]">← Voltar</Link>

          <div className="md:hidden text-center mb-6">
            <div className="text-5xl">🍕</div>
            <h1 className="mt-2 text-2xl font-black text-zinc-900">Entrega Paudalho</h1>
          </div>

          <h2 className="text-[26px] font-black text-zinc-900 tracking-tight">{mode === "login" ? "Entrar na sua conta" : "Crie sua conta"}</h2>
          <p className="mt-1 text-[14px] font-medium text-zinc-500">{mode === "login" ? "Entre para continuar seu pedido" : "É rápido e gratuito"}</p>

          <div className="mt-6 grid grid-cols-2 rounded-full bg-zinc-100 p-1">
            <button type="button" onClick={() => { setMode("login"); setError(""); setMessage(""); }} className={`rounded-full px-4 py-2.5 text-sm font-black transition ${mode === "login" ? "bg-zinc-900 text-white shadow" : "text-zinc-500"}`}>Entrar</button>
            <button type="button" onClick={() => { setMode("register"); setError(""); setMessage(""); }} className={`rounded-full px-4 py-2.5 text-sm font-black transition ${mode === "register" ? "bg-zinc-900 text-white shadow" : "text-zinc-500"}`}>Criar conta</button>
          </div>

          <form onSubmit={mode === "login" ? handleLogin : handleRegister} className="mt-6 space-y-4">
            {mode === "register" && (
              <>
                <div>
                  <label className="mb-2 block text-[13px] font-black text-zinc-900">Nome completo</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" required className="w-full h-[48px] rounded-xl border border-zinc-300 px-4 text-[15px] font-semibold text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10" />
                </div>
                <div>
                  <label className="mb-2 block text-[13px] font-black text-zinc-900">WhatsApp</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(81) 99999-9999" className="w-full h-[48px] rounded-xl border border-zinc-300 px-4 text-[15px] font-semibold text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10" />
                </div>
              </>
            )}

            <div>
              <label className="mb-2 block text-[13px] font-black text-zinc-900">E-mail</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seuemail@gmail.com" required className="w-full h-[48px] rounded-xl border border-zinc-300 px-4 text-[15px] font-semibold text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10" />
            </div>

            <div>
              <label className="mb-2 block text-[13px] font-black text-zinc-900">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className="w-full h-[48px] rounded-xl border border-zinc-300 pl-4 pr-14 text-[15px] font-semibold text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(value => !value)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-zinc-900/20"
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 3l18 18" />
                      <path d="M10.6 10.6a2 2 0 002.8 2.8" />
                      <path d="M9.9 5.2A10.8 10.8 0 0112 5c5.2 0 9 5.4 9 7a10.9 10.9 0 01-3.1 4.2" />
                      <path d="M6.2 6.2C3.9 7.7 2 10.1 2 12c0 1.6 3.8 7 10 7 1.1 0 2.1-.2 3-.5" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-[13px] font-bold text-red-700">{error}</div>}
            {message && <div className="rounded-xl bg-green-50 border border-green-200 p-3 text-[13px] font-bold text-green-700">{message}</div>}

            <button type="submit" disabled={loading} className="w-full h-[50px] rounded-xl bg-[#E30613] font-black text-white text-[15px] hover:bg-[#c00511] transition disabled:bg-zinc-300">
              {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar minha conta"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-zinc-200" />
            <span className="text-[11px] font-black tracking-widest text-zinc-400">OU</span>
            <div className="h-px flex-1 bg-zinc-200" />
          </div>

          <button type="button" onClick={handleGuest} className="flex w-full h-[50px] items-center justify-center gap-2 rounded-xl border-2 border-zinc-200 bg-white font-black text-zinc-900 hover:bg-zinc-50 transition">🍔 Ver cardápio sem entrar</button>
          <p className="mt-3 text-center text-[12px] font-medium text-zinc-500">Você pode navegar e adicionar produtos ao carrinho sem criar uma conta.</p>
        </div>
      </div>
    </main>
  );
}
