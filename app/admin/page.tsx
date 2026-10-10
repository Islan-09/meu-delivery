"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function money(v: any) { return Number(v??0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }
function dateTime(v: string | null) { if(!v) return "—"; return new Date(v).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"}); }

export default function AdminPage() {
  const router = useRouter();
  const [loading,setLoading]=useState(true);
  const [apps,setApps]=useState<any[]>([]);
  const [drivers,setDrivers]=useState<any[]>([]);
  const [withdrawals,setWithdrawals]=useState<any[]>([]);
  const [allWithdrawals,setAllWithdrawals]=useState<any[]>([]);
  const [finance,setFinance]=useState<any[]>([]);
  const [tab,setTab]=useState("overview");
  const [filter,setFilter]=useState("pending");

  const loadAll = useCallback(async()=>{
    const [r,d]=await Promise.all([
      supabase.from("restaurant_applications").select("*").eq("status","pending"),
      supabase.from("driver_applications").select("*").eq("status","pending"),
    ]);
    if(r.data) setApps(r.data); if(d.data) setDrivers(d.data);
    const {data:w1}=await supabase.rpc("get_admin_withdrawal_requests_v2",{p_status:filter});
    const {data:w2}=await supabase.rpc("get_admin_withdrawal_requests_v2",{p_status:"all"});
    const {data:f}=await supabase.rpc("get_admin_restaurant_finance_settings");
    if(w1) setWithdrawals(w1); if(w2) setAllWithdrawals(w2); if(f) setFinance(f);
  },[filter]);

  useEffect(()=>{
    (async()=>{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session){ router.replace("/admin/login"); return; }
      const {data:profile}=await supabase.from("profiles").select("role").eq("id",session.user.id).maybeSingle();
      if(!profile || profile.role!=="admin"){ router.replace("/admin/login"); return; }
      await loadAll(); setLoading(false);
    })();
  },[router,loadAll]);

  useEffect(()=>{ loadAll(); },[filter,loadAll]);

  if(loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center font-black">Carregando painel...</div>;

  const pendingW = allWithdrawals.filter((x:any)=>x.status==="pending");
  const approvedW = allWithdrawals.filter((x:any)=>x.status==="approved");
  const paidAmount = allWithdrawals.filter((x:any)=>x.status==="paid").reduce((s:number,i:any)=>s+Number(i.amount),0);

  return (
    <main className="min-h-screen bg-black text-white flex">
      <aside className="w-[280px] bg-[#0a0a0a] border-r border-white/10 flex flex-col fixed h-screen p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-black font-black">P</div>
          <div><p className="font-black text-[14px] leading-none tracking-widest">PAUDALHO</p><p className="text-[10px] font-bold text-zinc-400 tracking-[0.2em] mt-1">ADMIN PANEL</p></div>
        </div>
        <nav className="mt-10 space-y-2">
          <button onClick={()=>setTab("overview")} className={`w-full h-12 rounded-xl px-4 text-left font-black text-sm ${tab==="overview"?"bg-white text-black":"bg-white/[0.06] text-zinc-300 border border-white/10"}`}>📊 Visão Geral</button>
          <button onClick={()=>setTab("restaurants")} className={`w-full h-12 rounded-xl px-4 text-left font-black text-sm flex justify-between items-center ${tab==="restaurants"?"bg-white text-black":"bg-white/[0.06] text-zinc-300 border border-white/10"}`}>🏪 Restaurantes <span className="bg-red-600 text-white text-xs px-2 py-1 rounded-full">{apps.length}</span></button>
          <button onClick={()=>setTab("drivers")} className={`w-full h-12 rounded-xl px-4 text-left font-black text-sm flex justify-between items-center ${tab==="drivers"?"bg-white text-black":"bg-white/[0.06] text-zinc-300 border border-white/10"}`}>🛵 Entregadores <span className="bg-red-600 text-white text-xs px-2 py-1 rounded-full">{drivers.length}</span></button>
          <button onClick={()=>setTab("withdrawals")} className={`w-full h-12 rounded-xl px-4 text-left font-black text-sm flex justify-between items-center ${tab==="withdrawals"?"bg-white text-black":"bg-white/[0.06] text-zinc-300 border border-white/10"}`}>💸 Resgates <span className="bg-yellow-400 text-black text-xs px-2 py-1 rounded-full">{pendingW.length + approvedW.length}</span></button>
          <button onClick={()=>setTab("commissions")} className={`w-full h-12 rounded-xl px-4 text-left font-black text-sm ${tab==="commissions"?"bg-white text-black":"bg-white/[0.06] text-zinc-300 border border-white/10"}`}>% Comissões</button>
        </nav>
        <div className="mt-auto bg-white/[0.06] border border-white/10 rounded-2xl p-4"><p className="text-[10px] font-black tracking-widest text-zinc-400 uppercase">Faturamento já pago</p><p className="text-2xl font-black mt-1 text-white">R$ 65,00</p><p className="text-xl font-black mt-1 text-white">{money(paidAmount)}</p></div>
      </aside>

      <div className="flex-1 ml-[280px]">
        <header className="h-[68px] bg-[#0a0a0a] border-b border-white/10 flex items-center justify-between px-8 sticky top-0">
          <div><p className="text-[11px] font-black tracking-[0.2em] text-red-500 uppercase">Administração</p><h1 className="text-[20px] font-black text-white">Painel Administrativo</h1></div>
          <div className="flex gap-3"><button onClick={loadAll} className="h-10 px-5 rounded-full bg-white text-black font-black text-sm">Atualizar</button><button onClick={async()=>{await supabase.auth.signOut(); router.replace("/admin/login")}} className="h-10 px-5 rounded-full bg-white/10 border border-white/20 text-white font-black text-sm">Sair →</button></div>
        </header>

        <div className="p-8 bg-black">
          {tab==="overview" && (
            <>
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-[#151515] border border-white/10 rounded-[20px] p-6"><p className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Lojas Ativas</p><p className="text-[44px] font-black text-white leading-none mt-3">6</p><p className="text-[40px] font-black text-white leading-none mt-3">{finance.length}</p><p className="mt-3 text-[12px] font-black text-green-400">● Operando agora</p></div>
                <div className="bg-[#151515] border border-white/10 rounded-[20px] p-6"><p className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Pendências</p><p className="text-[44px] font-black text-white leading-none mt-3">{apps.length + drivers.length}</p><p className="mt-3 text-[12px] font-black text-red-400">Precisa aprovar</p></div>
                <div className="bg-[#151515] border border-white/10 rounded-[20px] p-6"><p className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Resgates na fila</p><p className="text-[44px] font-black text-white leading-none mt-3">{pendingW.length}</p><p className="mt-3 text-[12px] font-black text-white">{money(pendingW.reduce((s:number,i:any)=>s+Number(i.amount),0))} pra analisar</p></div>
                <div className="bg-white text-black rounded-[20px] p-6"><p className="text-[11px] font-black uppercase tracking-widest text-zinc-600">Pix pra enviar</p><p className="text-[44px] font-black leading-none mt-3">{approvedW.length}</p><p className="mt-3 text-[12px] font-black">{money(approvedW.reduce((s:number,i:any)=>s+Number(i.amount),0))} aprovado</p></div>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-4">
                <div className="col-span-2 bg-[#151515] border border-white/10 rounded-[20px] p-7">
                  <h2 className="text-[16px] font-black text-white">Fluxo de caixa da plataforma</h2>
                  <div className="mt-6 grid grid-cols-3 gap-4">
                    <div className="bg-black border border-white/10 rounded-2xl p-5"><p className="text-[11px] font-black uppercase text-zinc-400">Aguardando</p><p className="text-[18px] font-black mt-2 text-white">{money(pendingW.reduce((s:number,i:any)=>s+Number(i.amount),0))}</p></div>
                    <div className="bg-black border border-white/10 rounded-2xl p-5"><p className="text-[11px] font-black uppercase text-zinc-400">Aprovado</p><p className="text-[18px] font-black mt-2 text-white">{money(approvedW.reduce((s:number,i:any)=>s+Number(i.amount),0))}</p></div>
                    <div className="bg-black border border-white/10 rounded-2xl p-5"><p className="text-[11px] font-black uppercase text-zinc-400">Já pago</p><p className="text-[18px] font-black mt-2 text-white">{money(paidAmount)}</p></div>
                  </div>
                </div>
                <div className="bg-[#151515] border border-white/10 rounded-[20px] p-7">
                  <h2 className="text-[16px] font-black text-white">Ação necessária</h2>
                  <div className="mt-5 space-y-3">
                    <button onClick={()=>setTab("restaurants")} className="w-full h-12 rounded-xl bg-white text-black font-black text-sm px-4 flex justify-between items-center">🏪 Novas lojas <span className="bg-black text-white px-2.5 py-1 rounded-full text-xs">{apps.length}</span></button>
                    <button onClick={()=>setTab("withdrawals")} className="w-full h-12 rounded-xl bg-white/10 border border-white/20 text-white font-black text-sm px-4 flex justify-between items-center">💸 Resgates <span className="bg-red-600 text-white px-2.5 py-1 rounded-full text-xs">{pendingW.length}</span></button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}