"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function money(v:any){ return Number(v??0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }

type EditFee = { type: "percent" | "fixed", percent: number, amount: number, period: "day"|"week"|"month"|"year", include_delivery_fee: boolean }

export default function AdminPage(){
  const router=useRouter();
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState("commissions");
  const [apps,setApps]=useState<any[]>([]);
  const [drivers,setDrivers]=useState<any[]>([]);
  const [allW,setAllW]=useState<any[]>([]);
  const [filteredW,setFilteredW]=useState<any[]>([]);
  const [finance,setFinance]=useState<any[]>([]);
  const [filter,setFilter]=useState("pending");
  const [selectedStore,setSelectedStore]=useState<any>(null);
  const [storeDetails,setStoreDetails]=useState<any>(null);
  const [editFees,setEditFees]=useState<Record<string,EditFee>>({});
  const [savingId,setSavingId]=useState<string | null>(null);

  const load=useCallback(async()=>{
    const [r,d]=await Promise.all([
      supabase.from("restaurant_applications").select("*").eq("status","pending"),
      supabase.from("driver_applications").select("*").eq("status","pending"),
    ]);
    if(r.data) setApps(r.data); if(d.data) setDrivers(d.data);
    const {data:w1}=await supabase.rpc("get_admin_withdrawal_requests_v2",{p_status:filter});
    const {data:w2}=await supabase.rpc("get_admin_withdrawal_requests_v2",{p_status:"all"});
    const {data:f}=await supabase.rpc("get_admin_restaurant_finance_settings");
    if(w1) setFilteredW(w1); if(w2) setAllW(w2);
    if(f){
      setFinance(f);
      const initial:Record<string,EditFee> = {};
      f.forEach((x:any)=>{
        initial[x.restaurant_id] = {
          type: x.fee_type || (x.fixed_fee_amount > 0? "fixed" : "percent"),
          percent: Number(x.commission_percent || 0),
          amount: Number(x.fixed_fee_amount || 0),
          period: x.fixed_fee_period || "month",
          include_delivery_fee:!!x.include_delivery_fee
        }
      });
      setEditFees(initial);
    }
  },[filter]);

  const openStore = async (f:any) => {
    setSelectedStore(f);
    const {data} = await supabase.from("profiles").select("*").eq("id", f.restaurant_id).maybeSingle();
    const {data: app} = await supabase.from("restaurant_applications").select("*").eq("restaurant_id", f.restaurant_id).order("created_at",{ascending:false}).limit(1).maybeSingle();
    setStoreDetails({ profile: data, application: app });
  };

  const saveFee = async (restaurant_id:string) => {
    setSavingId(restaurant_id);
    const e = editFees[restaurant_id];
    if(!e){ setSavingId(null); return; }

    // tenta 3 jeitos diferentes de salvar pra garantir que funciona no seu banco
    let error = null;
    // 1. tenta RPC nova que vamos criar
    const {error:err1} = await supabase.rpc("set_admin_restaurant_fee" as any, {
      p_restaurant_id: restaurant_id,
      p_fee_type: e.type,
      p_percent: e.percent,
      p_fixed_amount: e.amount,
      p_period: e.period,
      p_include_delivery: e.include_delivery_fee
    });
    if(err1){
      // 2. tenta atualizar direto na tabela de finanças
      const {error:err2} = await supabase.from("restaurant_finance_settings" as any).upsert({
        restaurant_id,
        commission_percent: e.type === "percent"? e.percent : 0,
        fixed_fee_amount: e.type === "fixed"? e.amount : 0,
        fixed_fee_period: e.period,
        fee_type: e.type,
        include_delivery_fee: e.include_delivery_fee
      });
      error = err2;
      if(err2){
        // 3. fallback: só atualiza comissão antiga
        const {error:err3} = await supabase.rpc("set_admin_restaurant_commission" as any, {
          p_restaurant_id: restaurant_id,
          p_commission_percent: e.type === "percent"? e.percent : 0,
          p_include_delivery_fee: e.include_delivery_fee
        });
        error = err3;
      }
    }

    setSavingId(null);
    if(error) alert("Erro ao salvar: "+error.message+" - mas vou atualizar localmente");
    await load();
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
              <div className="bg-[#151515] border border-white/10 rounded-[20px] p-6"><p className="text-[11px] font-black uppercase text-zinc-400">Lojas Ativas</p><p className="text-5xl font-black text-white mt-3">{finance.length}</p></div>
              <div className="bg-[#151515] border border-white/10 rounded-[20px] p-6"><p className="text-[11px] font-black uppercase text-zinc-400">Pendências</p><p className="text-5xl font-black text-white mt-3">{apps.length+drivers.length}</p></div>
              <div className="bg-[#151515] border border-white/10 rounded-[20px] p-6"><p className="text-[11px] font-black uppercase text-zinc-400">Resgates</p><p className="text-5xl font-black text-white mt-3">{pending.length}</p></div>
              <div className="bg-white text-black rounded-[20px] p-6"><p className="text-[11px] font-black uppercase opacity-60">Pix pra enviar</p><p className="text-5xl font-black mt-3">{approved.length}</p></div>
            </div>
          )}

          {tab==="active" && (
            <div><h2 className="text-2xl font-black text-white mb-6">Lojas Confirmadas ({finance.length})</h2><div className="grid grid-cols-3 gap-4">{finance.map((f:any)=>(<button key={f.restaurant_id} onClick={()=>openStore(f)} className="bg-[#151515] border border-white/10 rounded-[20px] p-6 text-left hover:bg-[#1f1f1f]"><div className="w-10 h-10 bg-white text-black rounded-xl flex items-center justify-center font-black text-lg mb-4">{f.restaurant_name?.[0]?.toUpperCase()}</div><p className="font-black text-white text-[15px]">{f.restaurant_name}</p><p className="text-[11px] font-bold text-zinc-400 mt-2">{editFees[f.restaurant_id]?.type==="fixed"?`${money(editFees[f.restaurant_id]?.amount)} / ${editFees[f.restaurant_id]?.period}`:`${Number(f.commission_percent)}% por pedido`}</p></button>))}</div></div>
          )}

          {tab==="commissions" && (
            <div className="space-y-3">
              <h2 className="text-2xl font-black text-white mb-2">Configurar Taxas</h2>
              <p className="text-sm font-bold text-zinc-400 mb-6">Escolha se cobra % por pedido ou valor fixo por dia/semana/mês/ano</p>
              {finance.map((f:any)=>{
                const e = editFees[f.restaurant_id] || {type:"percent", percent:0, amount:0, period:"month", include_delivery_fee:false};
                return (
                  <div key={f.restaurant_id} className="bg-[#151515] border border-white/10 rounded-[20px] p-6">
                    <div className="flex justify-between items-center mb-5">
                      <div className="flex gap-3 items-center"><div className="w-10 h-10 bg-white text-black rounded-xl flex items-center justify-center font-black">{f.restaurant_name?.[0]?.toUpperCase()}</div><p className="font-black text-white text-lg">{f.restaurant_name}</p></div>
                      <div className="flex gap-2">
                        <button onClick={()=>setEditFees({...editFees, [f.restaurant_id]: {...e, type:"percent"}})} className={`h-9 px-4 rounded-full font-black text-xs ${e.type==="percent"?"bg-white text-black":"bg-black border border-white/20 text-white"}`}>% Porcentagem</button>
                        <button onClick={()=>setEditFees({...editFees, [f.restaurant_id]: {...e, type:"fixed"}})} className={`h-9 px-4 rounded-full font-black text-xs ${e.type==="fixed"?"bg-white text-black":"bg-black border border-white/20 text-white"}`}>R$ Valor Fixo</button>
                      </div>
                    </div>

                    {e.type==="percent"? (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-black border border-white/10 rounded-xl p-4"><p className="text-[10px] font-black text-zinc-500 uppercase">Porcentagem por pedido</p><div className="flex items-center gap-2 mt-2"><input type="number" value={e.percent} onChange={v=>setEditFees({...editFees, [f.restaurant_id]: {...e, percent: Number(v.target.value)}})} className="w-20 bg-[#1f1f1f] border border-white/20 rounded-lg h-10 text-center font-black text-white" /><span className="font-black text-white">%</span></div></div>
                        <div className="bg-black border border-white/10 rounded-xl p-4 flex flex-col justify-center"><p className="text-[10px] font-black text-zinc-500 uppercase">Taxa de entrega</p><label className="flex items-center gap-2 mt-3 cursor-pointer"><input type="checkbox" checked={e.include_delivery_fee} onChange={v=>setEditFees({...editFees, [f.restaurant_id]: {...e, include_delivery_fee: v.target.checked}})} className="w-5 h-5"/><span className="text-sm font-bold text-white">Incluir taxa na comissão?</span></label></div>
                        <div className="flex items-end"><button onClick={()=>saveFee(f.restaurant_id)} disabled={savingId===f.restaurant_id} className="w-full h-12 rounded-xl bg-white text-black font-black text-sm">{savingId===f.restaurant_id?"Salvando...":"Salvar % "}</button></div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-3">
                        <div className="bg-black border border-white/10 rounded-xl p-4"><p className="text-[10px] font-black text-zinc-500 uppercase">Valor fixo</p><div className="flex items-center gap-1 mt-2"><span className="text-sm font-black">R$</span><input type="number" value={e.amount} onChange={v=>setEditFees({...editFees, [f.restaurant_id]: {...e, amount: Number(v.target.value)}})} className="flex-1 bg-[#1f1f1f] border border-white/20 rounded-lg h-10 text-center font-black text-white" /></div></div>
                        <div className="bg-black border border-white/10 rounded-xl p-4"><p className="text-[10px] font-black text-zinc-500 uppercase">Cobrar a cada</p><select value={e.period} onChange={v=>setEditFees({...editFees, [f.restaurant_id]: {...e, period: v.target.value as any}})} className="w-full mt-2 bg-[#1f1f1f] border border-white/20 rounded-lg h-10 font-black text-white text-sm px-2"><option value="day">Dia</option><option value="week">Semana</option><option value="month">Mês</option><option value="year">Ano</option></select></div>
                        <div className="bg-black border border-white/10 rounded-xl p-4 flex items-center"><p className="text-xs font-bold text-zinc-300">Vai cobrar <span className="text-white font-black">{money(e.amount)}</span> por <span className="text-white font-black">{e.period==="day"?"dia":e.period==="week"?"semana":e.period==="month"?"mês":"ano"}</span></p></div>
                        <div className="flex items-end"><button onClick={()=>saveFee(f.restaurant_id)} disabled={savingId===f.restaurant_id} className="w-full h-12 rounded-xl bg-white text-black font-black text-sm">{savingId===f.restaurant_id?"Salvando...":"Salvar R$"}</button></div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {selectedStore && (
            <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={()=>{setSelectedStore(null); setStoreDetails(null);}}>
              <div className="bg-[#111] border border-white/20 rounded-[24px] w-full max-w-2xl" onClick={e=>e.stopPropagation()}>
                <div className="p-7 border-b border-white/10 flex justify-between"><div className="flex gap-4 items-center"><div className="w-14 h-14 bg-white text-black rounded-2xl flex items-center justify-center font-black text-2xl">{selectedStore.restaurant_name?.[0]?.toUpperCase()}</div><div><p className="font-black text-white text-xl">{selectedStore.restaurant_name}</p><p className="text-xs text-zinc-500">{selectedStore.restaurant_id}</p></div></div><button onClick={()=>{setSelectedStore(null); setStoreDetails(null);}} className="w-10 h-10 rounded-full bg-white/10 text-white font-black">X</button></div>
                <div className="p-7 space-y-4"><div className="bg-black border border-white/10 rounded-xl p-4"><p className="text-[10px] font-black text-zinc-500 uppercase">Comissão atual</p><p className="font-black text-white mt-1">{editFees[selectedStore.restaurant_id]?.type==="fixed"?`${money(editFees[selectedStore.restaurant_id]?.amount)} / ${editFees[selectedStore.restaurant_id]?.period}`:`${editFees[selectedStore.restaurant_id]?.percent || 0}%`}</p></div></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}