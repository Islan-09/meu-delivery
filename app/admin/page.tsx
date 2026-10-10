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
  const [storeDetails,setStoreDetails]=useState<any>(null);

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

  const openStore = async (f:any) => {
    setSelectedStore(f);
    // tenta buscar dados extras da loja
    const {data} = await supabase.from("profiles").select("*").eq("id", f.restaurant_id).maybeSingle();
    const {data: app} = await supabase.from("restaurant_applications").select("*").eq("restaurant_id", f.restaurant_id).order("created_at",{ascending:false}).limit(1).maybeSingle();
    setStoreDetails({ profile: data, application: app });
  };

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
          <button onClick={()=>setTab("overview")} className={`w-full h-11 rounded-xl px-4 text-left font-black text-[13px] flex items-center gap-2 ${tab==="overview"?"bg-white text-black":"bg-[#151515] border border-white/10 text-white"}`}>📊 Visão Geral</button>
          <button onClick={()=>setTab("active")} className={`w-full h-11 rounded-xl px-4 text-left font-black text-[13px] flex justify-between ${tab==="active"?"bg-white text-black":"bg-[#151515] border border-white/10 text-white"}`}><span>🏪 Lojas Ativas</span><span className="w-5 h-5 rounded-full bg-white text-black text-[10px] font-black flex items-center justify-center">{finance.length}</span></button>
          <button onClick={()=>setTab("restaurants")} className={`w-full h-11 rounded-xl px-4 text-left font-black text-[13px] flex justify-between ${tab==="restaurants"?"bg-white text-black":"bg-[#151515] border border-white/10 text-white"}`}><span>⏳ Para Aprovar</span><span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center ${apps.length>0?"bg-red-600 text-white":"bg-white/10 text-zinc-400"}`}>{apps.length}</span></button>
          <button onClick={()=>setTab("drivers")} className={`w-full h-11 rounded-xl px-4 text-left font-black text-[13px] flex justify-between ${tab==="drivers"?"bg-white text-black":"bg-[#151515] border border-white/10 text-white"}`}><span>🛵 Entregadores</span><span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center ${drivers.length>0?"bg-red-600 text-white":"bg-white/10 text-zinc-400"}`}>{drivers.length}</span></button>
          <button onClick={()=>setTab("withdrawals")} className={`w-full h-11 rounded-xl px-4 text-left font-black text-[13px] flex justify-between ${tab==="withdrawals"?"bg-white text-black":"bg-[#151515] border border-white/10 text-white"}`}><span>💸 Resgates</span><span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center ${pending.length+approved.length>0?"bg-yellow-400 text-black":"bg-white/10 text-zinc-400"}`}>{pending.length+approved.length}</span></button>
          <button onClick={()=>setTab("commissions")} className={`w-full h-11 rounded-xl px-4 text-left font-black text-[13px] ${tab==="commissions"?"bg-white text-black":"bg-[#151515] border border-white/10 text-white"}`}>% Comissões</button>
        </nav>
        <div className="mt-auto bg-[#151515] border border-white/10 rounded-2xl p-4"><p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Faturamento já pago</p><p className="text-2xl font-black text-white mt-1">{money(paidTotal)}</p></div>
      </aside>

      <div className="flex-1 ml-[280px]">
        <header className="h-[68px] bg-[#0a0a0a] border-b border-white/10 flex items-center justify-between px-8 sticky top-0 z-10"><h1 className="text-xl font-black text-white">Painel Administrativo</h1><div className="flex gap-2"><button onClick={load} className="h-10 px-5 rounded-full bg-white text-black font-black text-sm">Atualizar</button><button onClick={async()=>{await supabase.auth.signOut(); router.replace("/admin/login");}} className="h-10 px-5 rounded-full bg-white/10 border border-white/20 text-white font-black text-sm">Sair →</button></div></header>

        <div className="p-8">
          {tab==="overview" && (
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-[#151515] border border-white/10 rounded-[20px] p-6"><p className="text-[11px] font-black uppercase text-zinc-400">Lojas Ativas</p><p className="text-5xl font-black text-white mt-3">{finance.length}</p><p className="mt-3 text-xs font-black text-green-400">● Operando</p></div>
              <div className="bg-[#151515] border border-white/10 rounded-[20px] p-6"><p className="text-[11px] font-black uppercase text-zinc-400">Pendências</p><p className="text-5xl font-black text-white mt-3">{apps.length+drivers.length}</p><p className="mt-3 text-xs font-black text-red-400">Para aprovar</p></div>
              <div className="bg-[#151515] border border-white/10 rounded-[20px] p-6"><p className="text-[11px] font-black uppercase text-zinc-400">Resgates</p><p className="text-5xl font-black text-white mt-3">{pending.length}</p><p className="mt-3 text-xs font-black text-white">{money(pending.reduce((s:number,i:any)=>s+Number(i.amount),0))}</p></div>
              <div className="bg-white text-black rounded-[20px] p-6"><p className="text-[11px] font-black uppercase opacity-60">Pix pra enviar</p><p className="text-5xl font-black mt-3">{approved.length}</p><p className="mt-3 text-xs font-black">{money(approved.reduce((s:number,i:any)=>s+Number(i.amount),0))}</p></div>
            </div>
          )}

          {tab==="active" && (
            <div>
              <h2 className="text-2xl font-black text-white mb-6">Lojas Confirmadas ({finance.length})</h2>
              <div className="grid grid-cols-3 gap-4">
                {finance.map((f:any)=>(
                  <button key={f.restaurant_id} onClick={()=>openStore(f)} className="bg-[#151515] border border-white/10 rounded-[20px] p-6 text-left hover:bg-[#1f1f1f] hover:border-white/20 transition">
                    <div className="w-10 h-10 bg-white text-black rounded-xl flex items-center justify-center font-black text-lg mb-4">{f.restaurant_name?.[0]?.toUpperCase()}</div>
                    <p className="font-black text-white text-[15px]">{f.restaurant_name}</p>
                    <p className="text-[11px] font-bold text-zinc-400 mt-2">Comissão: {Number(f.commission_percent)}% {f.include_delivery_fee?"(c/ entrega)":"(s/ entrega)"}</p>
                    <p className="text-[11px] font-black text-green-400 mt-3">● Clique para gerenciar →</p>
                  </button>
                ))}
              </div>

              {selectedStore && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={()=>{setSelectedStore(null); setStoreDetails(null);}}>
                  <div className="bg-[#111] border border-white/20 rounded-[24px] w-full max-w-2xl my-8" onClick={e=>e.stopPropagation()}>
                    {/* HEADER */}
                    <div className="p-7 border-b border-white/10 flex justify-between items-start">
                      <div className="flex gap-4 items-center">
                        <div className="w-16 h-16 bg-white text-black rounded-2xl flex items-center justify-center font-black text-3xl">{selectedStore.restaurant_name?.[0]?.toUpperCase()}</div>
                        <div><p className="font-black text-white text-2xl leading-none">{selectedStore.restaurant_name}</p><p className="text-xs font-bold text-zinc-500 mt-2">ID: {selectedStore.restaurant_id}</p><span className="mt-2 inline-flex bg-green-500/20 text-green-400 border border-green-500/30 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest">● Loja Ativa</span></div>
                      </div>
                      <button onClick={()=>{setSelectedStore(null); setStoreDetails(null);}} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white text-white hover:text-black font-black transition">X</button>
                    </div>

                    <div className="p-7 space-y-6 max-h-[70vh] overflow-y-auto">
                      {/* FINANCEIRO */}
                      <div>
                        <h3 className="font-black text-white text-sm uppercase tracking-widest mb-3">💰 Financeiro da Plataforma</h3>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-black border border-white/10 rounded-xl p-4"><p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Comissão que você ganha</p><p className="font-black text-white text-2xl mt-1">{Number(selectedStore.commission_percent)}%</p><p className="text-[10px] font-bold text-zinc-400 mt-1">por pedido</p></div>
                          <div className="bg-black border border-white/10 rounded-xl p-4"><p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Taxa de entrega</p><p className="font-black text-white text-sm mt-1 leading-tight">{selectedStore.include_delivery_fee?"Você fica com 100% da taxa":"Loja fica com a taxa"}</p></div>
                          <div className="bg-white text-black rounded-xl p-4"><p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Saldo a receber</p><p className="font-black text-lg mt-1">{money(allW.filter((w:any)=>w.restaurant_id===selectedStore.restaurant_id && w.status==="pending").reduce((s:number,i:any)=>s+Number(i.amount),0))}</p><p className="text-[10px] font-bold mt-1 opacity-60">em resgates</p></div>
                        </div>
                      </div>

                      {/* DADOS */}
                      <div>
                        <h3 className="font-black text-white text-sm uppercase tracking-widest mb-3">📋 Dados da Loja</h3>
                        <div className="bg-black border border-white/10 rounded-xl p-4 space-y-3">
                          <div className="flex justify-between"><span className="text-xs font-bold text-zinc-500">Nome Fantasia</span><span className="text-sm font-black text-white">{selectedStore.restaurant_name}</span></div>
                          <div className="h-[1px] bg-white/10"></div>
                          <div className="flex justify-between"><span className="text-xs font-bold text-zinc-500">Dono / Responsável</span><span className="text-sm font-black text-white">{storeDetails?.application?.owner_name || storeDetails?.profile?.full_name || "Não informado"}</span></div>
                          <div className="h-[1px] bg-white/10"></div>
                          <div className="flex justify-between"><span className="text-xs font-bold text-zinc-500">Telefone</span><span className="text-sm font-black text-white">{storeDetails?.application?.phone || "( ) ____-____"}</span></div>
                          <div className="h-[1px] bg-white/10"></div>
                          <div className="flex justify-between"><span className="text-xs font-bold text-zinc-500">Cidade</span><span className="text-sm font-black text-white">{storeDetails?.application?.city || "Paudalho"}</span></div>
                          <div className="h-[1px] bg-white/10"></div>
                          <div className="flex justify-between"><span className="text-xs font-bold text-zinc-500">Categoria</span><span className="text-sm font-black text-white">{storeDetails?.application?.category || "Restaurante"}</span></div>
                        </div>
                      </div>

                      {/* AÇÕES DE DONO */}
                      <div>
                        <h3 className="font-black text-white text-sm uppercase tracking-widest mb-3">⚙️ Ações de Dono</h3>
                        <div className="grid grid-cols-2 gap-3">
                          <button onClick={()=>{setTab("commissions"); setSelectedStore(null);}} className="h-12 rounded-xl bg-white text-black font-black text-sm">% Editar Comissão</button>
                          <button onClick={()=>{setTab("withdrawals"); setSelectedStore(null);}} className="h-12 rounded-xl bg-[#1f1f1f] border border-white/20 text-white font-black text-sm">💸 Ver Resgates</button>
                          <button className="h-12 rounded-xl bg-[#1f1f1f] border border-white/10 text-zinc-400 font-black text-sm opacity-50" disabled>⏸️ Pausar Loja (em breve)</button>
                          <button className="h-12 rounded-xl bg-red-600/20 border border-red-600/30 text-red-400 font-black text-sm">🚫 Bloquear Loja</button>
                        </div>
                      </div>

                      <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-xl p-4">
                        <p className="text-[11px] font-black text-yellow-400 uppercase tracking-widest">Dica de dono</p>
                        <p className="text-xs font-bold text-white mt-2 leading-relaxed">Essa é a visão completa da loja. Você vê quanto ganha de comissão, dados do dono e pode tomar ações. Se a comissão estiver 0%, você não ganha nada nos pedidos dela, vai na aba % Comissões e muda.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab==="restaurants" && <div className="space-y-3">{apps.map((a:any)=><div key={a.id} className="bg-[#151515] border border-white/10 rounded-2xl p-6 flex justify-between items-center"><div><p className="font-black text-white text-lg">{a.business_name}</p><p className="text-sm font-bold text-zinc-400">{a.phone}</p></div><button onClick={async()=>{await supabase.rpc("approve_restaurant_application",{p_application_id:a.id}); load();}} className="h-11 px-6 rounded-full bg-white text-black font-black">Aprovar</button></div>)}</div>}
          {tab==="withdrawals" && <div className="space-y-3">{filteredW.map((w:any)=><div key={w.id} className="bg-[#151515] border border-white/10 rounded-2xl p-6 flex justify-between"><div><p className="font-black text-white">{w.restaurant_name}</p><p className="text-sm text-zinc-400">PIX: {w.pix_key}</p></div><p className="font-black text-green-400">{money(w.amount)}</p></div>)}</div>}
          {tab==="commissions" && <div className="grid gap-3">{finance.map((f:any)=><div key={f.restaurant_id} className="bg-[#151515] border border-white/10 rounded-2xl p-6 flex justify-between"><p className="font-black text-white">{f.restaurant_name}</p><p className="font-black text-white">{Number(f.commission_percent)}%</p></div>)}</div>}
        </div>
      </div>
    </main>
  );
}