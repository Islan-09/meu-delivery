"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function money(v:any){ return Number(v??0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }
function dt(v:string){ return new Date(v).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"}); }

export default function AdminPage(){
  const router=useRouter();
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState("overview");
  const [apps,setApps]=useState<any[]>([]);
  const [drivers,setDrivers]=useState<any[]>([]);
  const [allW,setAllW]=useState<any[]>([]);
  const [filteredW,setFilteredW]=useState<any[]>([]);
  const [finance,setFinance]=useState<any[]>([]);
  const [filter,setFilter]=useState("pending");

  const load=useCallback(async()=>{
    const [r,d]=await Promise.all([
      supabase.from("restaurant_applications").select("*").eq("status","pending"),
      supabase.from("driver_applications").select("*").eq("status","pending"),
    ]);
    if(r.data) setApps(r.data); if(d.data) setDrivers(d.data);
    const {data:w1}=await supabase.rpc("get_admin_withdrawal_requests_v2",{p_status:filter});
    const {data:w2}=await supabase.rpc("get_admin_withdrawal_requests_v2",{p_status:"all"});
    const {data:f}=await supabase.rpc("get_admin_restaurant_finance_settings");
    if(w1) setFilteredW(w1); if(w2) setAllW(w2); if(f) setFinance(f);
  },[filter]);

  useEffect(()=>{(async()=>{
    const {data:{session}}=await supabase.auth.getSession();
    if(!session){router.replace("/admin/login");return;}
    const {data:p}=await supabase.from("profiles").select("role").eq("id",session.user.id).maybeSingle();
    if(!p||p.role!=="admin"){router.replace("/admin/login");return;}
    await load(); setLoading(false);
  })()},[router,load]);

  useEffect(()=>{load()},[filter,load]);

  if(loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center font-black text-xl">Carregando...</div>;

  const pending=allW.filter((x:any)=>x.status==="pending");
  const approved=allW.filter((x:any)=>x.status==="approved");
  const paidTotal=allW.filter((x:any)=>x.status==="paid").reduce((s:number,i:any)=>s+Number(i.amount),0);

  return (
    <main className="min-h-screen bg-black text-white flex">
      <aside className="w-[280px] bg-[#0a0a0a] border-r border-white/10 fixed h-screen p-5 flex flex-col">
        <div className="flex items-center gap-3"><div className="w-10 h-10 bg-white text-black font-black rounded-xl flex items-center justify-center text-lg">P</div><div><p className="font-black text-sm tracking-widest leading-none">PAUDALHO</p><p className="text-[10px] font-bold text-zinc-500 tracking-[0.2em] mt-1">ADMIN PANEL</p></div></div>
        <nav className="mt-10 space-y-2">
          <button onClick={()=>setTab("overview")} className={`w-full h-12 rounded-xl px-4 text-left font-black text-sm ${tab==="overview"?"bg-white text-black":"bg-[#151515] border border-white/10 text-white"}`}>📊 Visão Geral</button>
          <button onClick={()=>setTab("restaurants")} className={`w-full h-12 rounded-xl px-4 text-left font-black text-sm flex justify-between items-center ${tab==="restaurants"?"bg-white text-black":"bg-[#151515] border border-white/10 text-white"}`}>🏪 Restaurantes <span className="bg-red-600 text-white text-xs px-2 py-1 rounded-full">{apps.length}</span></button>
          <button onClick={()=>setTab("drivers")} className={`w-full h-12 rounded-xl px-4 text-left font-black text-sm flex justify-between items-center ${tab==="drivers"?"bg-white text-black":"bg-[#151515] border border-white/10 text-white"}`}>🛵 Entregadores <span className="bg-red-600 text-white text-xs px-2 py-1 rounded-full">{drivers.length}</span></button>
          <button onClick={()=>setTab("withdrawals")} className={`w-full h-12 rounded-xl px-4 text-left font-black text-sm flex justify-between items-center ${tab==="withdrawals"?"bg-white text-black":"bg-[#151515] border border-white/10 text-white"}`}>💸 Resgates <span className="bg-yellow-400 text-black text-xs px-2 py-1 rounded-full">{pending.length+approved.length}</span></button>
          <button onClick={()=>setTab("commissions")} className={`w-full h-12 rounded-xl px-4 text-left font-black text-sm ${tab==="commissions"?"bg-white text-black":"bg-[#151515] border border-white/10 text-white"}`}>% Comissões</button>
        </nav>
        <div className="mt-auto bg-[#151515] border border-white/10 rounded-2xl p-4"><p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Faturamento já pago</p><p className="text-2xl font-black text-white mt-1">{money(paidTotal)}</p></div>
      </aside>

      <div className="flex-1 ml-[280px]">
        <header className="h-[68px] bg-[#0a0a0a] border-b border-white/10 flex items-center justify-between px-8 sticky top-0 z-10"><div><p className="text-[10px] font-black tracking-[0.2em] text-red-500 uppercase">ADMINISTRAÇÃO</p><h1 className="text-xl font-black text-white">Painel Administrativo</h1></div><div className="flex gap-2"><button onClick={load} className="h-10 px-5 rounded-full bg-white text-black font-black text-sm">Atualizar</button><button onClick={async()=>{await supabase.auth.signOut(); router.replace("/admin/login");}} className="h-10 px-5 rounded-full bg-white/10 border border-white/20 text-white font-black text-sm">Sair →</button></div></header>

        <div className="p-8">
          {tab==="overview" && (
            <>
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-[#151515] border border-white/10 rounded-[20px] p-6"><p className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Lojas Ativas</p><p className="text-5xl font-black text-white mt-3">{finance.length}</p><p className="mt-3 text-xs font-black text-green-400">● Operando agora</p></div>
                <div className="bg-[#151515] border border-white/10 rounded-[20px] p-6"><p className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Pendências</p><p className="text-5xl font-black text-white mt-3">{apps.length+drivers.length}</p><p className="mt-3 text-xs font-black text-red-400">Precisa aprovar</p></div>
                <div className="bg-[#151515] border border-white/10 rounded-[20px] p-6"><p className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Resgates na fila</p><p className="text-5xl font-black text-white mt-3">{pending.length}</p><p className="mt-3 text-xs font-black text-white">{money(pending.reduce((s:number,i:any)=>s+Number(i.amount),0))} pra analisar</p></div>
                <div className="bg-white text-black rounded-[20px] p-6"><p className="text-[11px] font-black uppercase tracking-widest opacity-60">Pix pra enviar</p><p className="text-5xl font-black mt-3">{approved.length}</p><p className="mt-3 text-xs font-black">{money(approved.reduce((s:number,i:any)=>s+Number(i.amount),0))} aprovado</p></div>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-4">
                <div className="col-span-2 bg-[#151515] border border-white/10 rounded-[20px] p-7"><h2 className="font-black text-white">Fluxo de caixa da plataforma</h2><div className="mt-6 grid grid-cols-3 gap-4"><div className="bg-black border border-white/10 rounded-2xl p-5"><p className="text-[11px] font-black text-zinc-400 uppercase">Aguardando</p><p className="text-lg font-black text-white mt-2">{money(pending.reduce((s:number,i:any)=>s+Number(i.amount),0))}</p></div><div className="bg-black border border-white/10 rounded-2xl p-5"><p className="text-[11px] font-black text-zinc-400 uppercase">Aprovado</p><p className="text-lg font-black text-white mt-2">{money(approved.reduce((s:number,i:any)=>s+Number(i.amount),0))}</p></div><div className="bg-black border border-white/10 rounded-2xl p-5"><p className="text-[11px] font-black text-zinc-400 uppercase">Já pago</p><p className="text-lg font-black text-white mt-2">{money(paidTotal)}</p></div></div></div>
                <div className="bg-[#151515] border border-white/10 rounded-[20px] p-7"><h2 className="font-black text-white">Ação necessária</h2><div className="mt-5 space-y-3"><button onClick={()=>setTab("restaurants")} className="w-full h-12 rounded-xl bg-white text-black font-black text-sm px-4 flex justify-between items-center">🏪 Novas lojas <span className="bg-black text-white px-2.5 py-1 rounded-full text-xs">{apps.length}</span></button><button onClick={()=>setTab("withdrawals")} className="w-full h-12 rounded-xl bg-white/10 border border-white/20 text-white font-black text-sm px-4 flex justify-between items-center">💸 Resgates <span className="bg-red-600 text-white px-2.5 py-1 rounded-full text-xs">{pending.length}</span></button></div></div>
              </div>
            </>
          )}

          {tab==="restaurants" && <div className="space-y-3">{apps.length===0?<p className="font-black text-zinc-400">Nenhum restaurante pendente</p>:apps.map((a:any)=><div key={a.id} className="bg-[#151515] border border-white/10 rounded-2xl p-6 flex justify-between items-center"><div><p className="font-black text-white text-lg">{a.business_name}</p><p className="text-sm font-bold text-zinc-400">{a.category} • {a.phone} • {a.city}</p></div><button onClick={async()=>{await supabase.rpc("approve_restaurant_application",{p_application_id:a.id}); load();}} className="h-11 px-6 rounded-full bg-white text-black font-black">Aprovar</button></div>)}</div>}

          {tab==="drivers" && <div className="space-y-3">{drivers.length===0?<p className="font-black text-zinc-400">Nenhum entregador pendente</p>:drivers.map((d:any)=><div key={d.id} className="bg-[#151515] border border-white/10 rounded-2xl p-6 flex justify-between items-center"><div><p className="font-black text-white text-lg">{d.full_name}</p><p className="text-sm font-bold text-zinc-400">{d.vehicle_type} • {d.phone}</p></div><button onClick={async()=>{await supabase.rpc("approve_driver_application",{p_application_id:d.id}); load();}} className="h-11 px-6 rounded-full bg-white text-black font-black">Aprovar</button></div>)}</div>}

          {tab==="withdrawals" && (
            <div className="space-y-4">
              <div className="flex gap-2"><button onClick={()=>setFilter("pending")} className={`h-10 px-5 rounded-full font-black text-sm ${filter==="pending"?"bg-white text-black":"bg-[#151515] border border-white/10 text-white"}`}>Pendentes</button><button onClick={()=>setFilter("approved")} className={`h-10 px-5 rounded-full font-black text-sm ${filter==="approved"?"bg-white text-black":"bg-[#151515] border border-white/10 text-white"}`}>Aprovados</button><button onClick={()=>setFilter("all")} className={`h-10 px-5 rounded-full font-black text-sm ${filter==="all"?"bg-white text-black":"bg-[#151515] border border-white/10 text-white"}`}>Todos</button></div>
              {filteredW.map((w:any)=><div key={w.id} className="bg-[#151515] border border-white/10 rounded-2xl p-6"><div className="flex justify-between"><p className="font-black text-white text-lg">{w.restaurant_name}</p><p className="font-black text-green-400 text-xl">{money(w.amount)}</p></div><p className="text-sm font-bold text-zinc-300 mt-1">PIX {w.pix_key_type}: {w.pix_key}</p><p className="text-xs font-bold text-zinc-500 mt-1">{dt(w.requested_at)} • {w.status}</p></div>)}
            </div>
          )}

          {tab==="commissions" && <div className="grid gap-3">{finance.map((f:any)=><div key={f.restaurant_id} className="bg-[#151515] border border-white/10 rounded-2xl p-6 flex justify-between"><p className="font-black text-white">{f.restaurant_name}</p><p className="font-black text-white">{Number(f.commission_percent)}% {f.include_delivery_fee?"com entrega":"sem entrega"}</p></div>)}</div>}
        </div>
      </div>
    </main>
  );
}