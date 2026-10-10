"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function money(v:any){ return Number(v??0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }

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
  const [selectedStore,setSelectedStore]=useState<any>(null);

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

  if(loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center font-black">Carregando...</div>;

  const pending=allW.filter((x:any)=>x.status==="pending");
  const approved=allW.filter((x:any)=>x.status==="approved");
  const paidTotal=allW.filter((x:any)=>x.status==="paid").reduce((s:number,i:any)=>s+Number(i.amount),0);

  return (
    <main className="min-h-screen bg-black text-white flex">
      <aside className="w-[280px] bg-[#0a0a0a] border-r border-white/10 fixed h-screen p-5 flex flex-col">
        <div className="flex items-center gap-3"><div className="w-10 h-10 bg-white text-black font-black rounded-xl flex items-center justify-center">P</div><div><p className="font-black text-sm tracking-widest leading-none">PAUDALHO</p><p className="text-[10px] font-bold text-zinc-500 tracking-[0.2em] mt-1">ADMIN</p></div></div>
        <nav className="mt-10 space-y-2">
          <button onClick={()=>setTab("overview")} className={`w-full h-12 rounded-xl px-4 text-left font-black text-sm ${tab==="overview"?"bg-white text-black":"bg-[#151515] border border-white/10 text-white"}`}>📊 Visão Geral</button>
          <button onClick={()=>setTab("active")} className={`w-full h-12 rounded-xl px-4 text-left font-black text-sm flex justify-between ${tab==="active"?"bg-white text-black":"bg-[#151515] border border-white/10 text-white"}`}>🏪 Lojas Ativas <span className="bg-white text-black text-xs px-2 py-1 rounded-full">{finance.length}</span></button>
          <button onClick={()=>setTab("restaurants")} className={`w-full h-12 rounded-xl px-4 text-left font-black text-sm flex justify-between ${tab==="restaurants"?"bg-white text-black":"bg-[#151515] border border-white/10 text-white"}`}>⏳ Para Aprovar <span className="bg-red-600 text-white text-xs px-2 py-1 rounded-full">{apps.length}</span></button>
          <button onClick={()=>setTab("drivers")} className={`w-full h-12 rounded-xl px-4 text-left font-black text-sm flex justify-between ${tab==="drivers"?"bg-white text-black":"bg-[#151515] border border-white/10 text-white"}`}>🛵 Entregadores <span className="bg-red-600 text-white text-xs px-2 py-1 rounded-full">{drivers.length}</span></button>
          <button onClick={()=>setTab("withdrawals")} className={`w-full h-12 rounded-xl px-4 text-left font-black text-sm flex justify-between ${tab==="withdrawals"?"bg-white text-black":"bg-[#151515] border border-white/10 text-white"}`}>💸 Resgates <span className="bg-yellow-400 text-black text-xs px-2 py-1 rounded-full">{pending.length+approved.length}</span></button>
          <button onClick={()=>setTab("commissions")} className={`w-full h-12 rounded-xl px-4 text-left font-black text-sm ${tab==="commissions"?"bg-white text-black":"bg-[#151515] border border-white/10 text-white"}`}>% Comissões</button>
        </nav>
        <div className="mt-auto bg-[#151515] border border-white/10 rounded-2xl p-4"><p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Faturamento já pago</p><p className="text-2xl font-black text-white mt-1">{money(paidTotal)}</p></div>
      </aside>

      <div className="flex-1 ml-[280px]">
        <header className="h-[68px] bg-[#0a0a0a] border-b border-white/10 flex items-center justify-between px-8 sticky top-0 z-10"><h1 className="text-xl font-black text-white">Painel Administrativo</h1><div className="flex gap-2"><button onClick={load} className="h-10 px-5 rounded-full bg-white text-black font-black text-sm">Atualizar</button><button onClick={async()=>{await supabase.auth.signOut(); router.replace("/admin/login");}} className="h-10 px-5 rounded-full bg-white/10 border border-white/20 text-white font-black text-sm">Sair →</button></div></header>

        <div className="p-8">
          {tab==="overview" && (
            <>
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-[#151515] border border-white/10 rounded-[20px] p-6"><p className="text-[11px] font-black uppercase text-zinc-400">Lojas Ativas</p><p className="text-5xl font-black text-white mt-3">{finance.length}</p><p className="mt-3 text-xs font-black text-green-400">● Operando agora</p></div>
                <div className="bg-[#151515] border border-white/10 rounded-[20px] p-6"><p className="text-[11px] font-black uppercase text-zinc-400">Pendências</p><p className="text-5xl font-black text-white mt-3">{apps.length+drivers.length}</p><p className="mt-3 text-xs font-black text-red-400">Precisa aprovar</p></div>
                <div className="bg-[#151515] border border-white/10 rounded-[20px] p-6"><p className="text-[11px] font-black uppercase text-zinc-400">Resgates na fila</p><p className="text-5xl font-black text-white mt-3">{pending.length}</p><p className="mt-3 text-xs font-black text-white">{money(pending.reduce((s:number,i:any)=>s+Number(i.amount),0))}</p></div>
                <div className="bg-white text-black rounded-[20px] p-6"><p className="text-[11px] font-black uppercase opacity-60">Pix pra enviar</p><p className="text-5xl font-black mt-3">{approved.length}</p><p className="mt-3 text-xs font-black">{money(approved.reduce((s:number,i:any)=>s+Number(i.amount),0))}</p></div>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-4">
                <div className="col-span-2 bg-[#151515] border border-white/10 rounded-[20px] p-7"><h2 className="font-black text-white">Fluxo de caixa</h2><div className="mt-6 grid grid-cols-3 gap-4"><div className="bg-black border border-white/10 rounded-2xl p-5"><p className="text-[11px] font-black text-zinc-400 uppercase">Aguardando</p><p className="text-lg font-black text-white mt-2">{money(pending.reduce((s:number,i:any)=>s+Number(i.amount),0))}</p></div><div className="bg-black border border-white/10 rounded-2xl p-5"><p className="text-[11px] font-black text-zinc-400 uppercase">Aprovado</p><p className="text-lg font-black text-white mt-2">{money(approved.reduce((s:number,i:any)=>s+Number(i.amount),0))}</p></div><div className="bg-black border border-white/10 rounded-2xl p-5"><p className="text-[11px] font-black text-zinc-400 uppercase">Já pago</p><p className="text-lg font-black text-white mt-2">{money(paidTotal)}</p></div></div></div>
                <div className="bg-[#151515] border border-white/10 rounded-[20px] p-7"><h2 className="font-black text-white">Ação necessária</h2><div className="mt-5 space-y-3"><button onClick={()=>setTab("restaurants")} className="w-full h-12 rounded-xl bg-white text-black font-black text-sm px-4 flex justify-between items-center">🏪 Novas lojas <span className="bg-black text-white px-2.5 py-1 rounded-full text-xs">{apps.length}</span></button><button onClick={()=>setTab("active")} className="w-full h-12 rounded-xl bg-white/10 border border-white/20 text-white font-black text-sm px-4 flex justify-between items-center">👁️ Ver lojas ativas <span className="bg-white text-black px-2.5 py-1 rounded-full text-xs">{finance.length}</span></button></div></div>
              </div>
            </>
          )}

          {tab==="active" && (
            <div>
              <h2 className="text-2xl font-black text-white mb-6">Lojas Confirmadas ({finance.length}) - Clique para ver detalhes</h2>
              <div className="grid grid-cols-3 gap-4">
                {finance.map((f:any)=>(
                  <button key={f.restaurant_id} onClick={()=>setSelectedStore(f)} className="bg-[#151515] border border-white/10 rounded-[20px] p-6 text-left hover:bg-[#1f1f1f] hover:border-white/20 transition">
                    <div className="w-12 h-12 bg-white text-black rounded-xl flex items-center justify-center font-black text-xl mb-4">{f.restaurant_name?.[0]}</div>
                    <p className="font-black text-white text-lg leading-tight">{f.restaurant_name}</p>
                    <p className="text-xs font-bold text-zinc-400 mt-2">Comissão: {Number(f.commission_percent)}% {f.include_delivery_fee?"(c/ entrega)":"(s/ entrega)"}</p>
                    <p className="text-xs font-black text-green-400 mt-3">● Ativa agora</p>
                  </button>
                ))}
              </div>

              {selectedStore && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={()=>setSelectedStore(null)}>
                  <div className="bg-[#151515] border border-white/20 rounded-[24px] p-8 w-full max-w-lg" onClick={e=>e.stopPropagation()}>
                    <div className="flex justify-between items-start"><div className="flex gap-4 items-center"><div className="w-14 h-14 bg-white text-black rounded-2xl flex items-center justify-center font-black text-2xl">{selectedStore.restaurant_name?.[0]}</div><div><p className="font-black text-white text-xl">{selectedStore.restaurant_name}</p><p className="text-xs font-bold text-zinc-400 mt-1">ID: {selectedStore.restaurant_id.slice(0,8)}...</p></div></div><button onClick={()=>setSelectedStore(null)} className="w-10 h-10 rounded-full bg-white/10 text-white font-black">X</button></div>
                    <div className="mt-8 space-y-4">
                      <div className="bg-black border border-white/10 rounded-xl p-4"><p className="text-[11px] font-black text-zinc-500 uppercase">Nome da loja</p><p className="font-black text-white mt-1">{selectedStore.restaurant_name}</p></div>
                      <div className="grid grid-cols-2 gap-3"><div className="bg-black border border-white/10 rounded-xl p-4"><p className="text-[11px] font-black text-zinc-500 uppercase">Comissão atual</p><p className="font-black text-white text-lg mt-1">{Number(selectedStore.commission_percent)}%</p></div><div className="bg-black border border-white/10 rounded-xl p-4"><p className="text-[11px] font-black text-zinc-500 uppercase">Taxa entrega</p><p className="font-black text-white mt-1">{selectedStore.include_delivery_fee?"Você fica com a taxa":"Loja fica com a taxa"}</p></div></div>
                      <div className="bg-white text-black rounded-xl p-4"><p className="text-[11px] font-black uppercase opacity-60">Como dono da plataforma, você pode</p><p className="font-black text-sm mt-2">• Alterar comissão dessa loja na aba % Comissões<br/>• Ver resgates dessa loja na aba Resgates<br/>• Pausar loja se precisar (em breve)</p></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab==="restaurants" && <div className="space-y-3">{apps.length===0?<p className="font-black text-zinc-400">Nenhuma loja pendente</p>:apps.map((a:any)=><div key={a.id} className="bg-[#151515] border border-white/10 rounded-2xl p-6 flex justify-between items-center"><div><p className="font-black text-white text-lg">{a.business_name}</p><p className="text-sm font-bold text-zinc-400">{a.category} • {a.phone} • {a.city}</p></div><button onClick={async()=>{await supabase.rpc("approve_restaurant_application",{p_application_id:a.id}); load();}} className="h-11 px-6 rounded-full bg-white text-black font-black">Aprovar</button></div>)}</div>}
          {tab==="drivers" && <div className="space-y-3">{drivers.map((d:any)=><div key={d.id} className="bg-[#151515] border border-white/10 rounded-2xl p-6 flex justify-between"><div><p className="font-black text-white">{d.full_name}</p><p className="text-sm text-zinc-400">{d.phone}</p></div><button onClick={async()=>{await supabase.rpc("approve_driver_application",{p_application_id:d.id}); load();}} className="h-11 px-6 rounded-full bg-white text-black font-black">Aprovar</button></div>)}</div>}
        </div>
      </div>
    </main>
  );
}