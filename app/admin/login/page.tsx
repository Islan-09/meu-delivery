"use client";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Acesso negado. Verifique suas credenciais de administrador.");
      setPassword(""); // LIMPA SENHA
      setLoading(false);
      return;
    }

    // Aqui você pode verificar se é admin no banco se quiser
    router.push("/admin");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-4xl grid md:grid-cols-[1.1fr_0.9fr] bg-[#141414] rounded-[24px] border border-white/10 overflow-hidden shadow-2xl">

        <div className="p-10 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-black">P</div>
              <span className="font-black text-white tracking-widest text-sm">PAUDALHO • ADMIN</span>
            </div>
            <h1 className="mt-10 text-3xl font-black text-white leading-tight">Painel Administrativo</h1>
            <p className="mt-3 text-zinc-400 text-sm leading-6">Acesso restrito. Gerencie pedidos, cardápio, entregadores e financeiro.</p>
          </div>
          <div className="mt-10 rounded-xl bg-white/[0.06] border border-white/10 p-4">
            <p className="text-xs text-zinc-500 font-bold tracking-widest uppercase">Segurança</p>
            <p className="mt-2 text-sm text-zinc-300">Esse login é só pra você e gerentes. Não compartilhe.</p>
          </div>
        </div>

        <div className="bg-white rounded-[20px] m-2 p-8 flex flex-col justify-center">
          <h2 className="text-xl font-black text-zinc-900">Entrar como admin</h2>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label className="text-[12px] font-black text-zinc-900 uppercase tracking-widest">E-mail admin</label>
              <input value={email} onChange={e=>setEmail(e.target.value)} type="email" required placeholder="admin@entregapaudalho.com" className="mt-2 w-full h-12 rounded-xl bg-zinc-100 border border-zinc-200 px-4 font-bold text-zinc-900 outline-none focus:bg-white focus:border-zinc-900" />
            </div>
            <div>
              <label className="text-[12px] font-black text-zinc-900 uppercase tracking-widest">Senha</label>
              <input value={password} onChange={e=>setPassword(e.target.value)} type="password" required placeholder="••••••••" className="mt-2 w-full h-12 rounded-xl bg-zinc-100 border border-zinc-200 px-4 font-bold text-zinc-900 outline-none focus:bg-white focus:border-zinc-900" />
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm font-bold">{error}</div>}

            <button disabled={loading} className="w-full h-12 bg-zinc-900 text-white rounded-xl font-black hover:bg-black transition disabled:opacity-50">
              {loading? "Verificando..." : "Acessar painel →"}
            </button>
          </form>

          <p className="mt-6 text-center text-[11px] text-zinc-500">© 2026 Entrega Paudalho • Acesso interno</p>
        </div>

      </div>
    </main>
  );
}