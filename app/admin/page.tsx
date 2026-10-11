"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
function money(v:any){ return Number(v??0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }
type EditFee = { type: "percent" | "fixed", percent: number, amount: number, period: "day"|"week"|"month"|"year" }

export default function AdminPage(){
  const router=useRouter();
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState("overview");
  const [apps,setApps]=useState<any[]>([]);
  const [drivers,setDrivers]=useState<any[]>([]);
  const [allW,setAllW]=useState<any[]>([]);
  const [finance,setFinance]=useState<any[]>([]);
  const [filter,setFilter]=useState("pending");
  const [selectedStore,setSelectedStore]=useState<any>(null);
  const [editFees,setEditFees]=useState<Record<string,EditFee>>({});
  const [savingId,setSavingId]=useState<string|null>(null);

  const load=useCallback(async()=>{
    const [r,d]=await Promise.all([
      supabase.from("restaurant_applications").select("*").eq("status","pending"),
      supabase.from("driver_applications").select("*").eq("status","pending"),
    ]);
    if(r.data) setApps(r.data); if(d.data) setDrivers(d.data);
    const {data:w2}=await supabase.rpc("get_admin_withdrawal_requests_v2",{p_status:"all"});
    const {data:f}=await supabase.rpc("get_admin_restaurant_finance_settings");
    if(w2) setAllW(w2);
    if(f){
      setFinance(f);
      const init:Record<string,EditFee>={};
      f.forEach((x:any)=>{init[x.restaurant_id]={type:x.fee_type||"percent", percent:Number(x.commission_percent||0), amount:Number(x.fixed_fee_amount||0), period:x.fixed_fee_period||"month"}});
      setEditFees(init);
    }
  },[]);

  useEffect(()=>{(async()=>{
    const {data:{session}}=await supabase.auth.getSession();
    if(!session){router.replace("/admin/login");return;}
    const {data:p}=await supabase.from("profiles").select("role").eq("id",session.user.id).maybeSingle();
    if(!p||p.role!=="admin"){router.replace("/admin/login");return;}
    await load(); setLoading(false);
  })()},[router,load]);

  const saveFee = async (id:string) => {
    setSavingId(id); const e=editFees[id];
    const {error}=await supabase.from("restaurant_finance_settings").upsert({
      restaurant_id:id, fee_type:e.type,
      commission_percent:e.type==='percent'?e.percent:0,
      fixed_fee_amount:e.type==='fixed'?e.amount:0,
      fixed_fee_period:e.period, include_delivery_fee:false
    },{onConflict:'restaurant_id'});
    if(error) alert("Erro: "+error.message); else alert("Salvo! "+(e.type==='fixed'?`R$${e.amount}/${e.period}`:`${e.percent}%`));
    setSavingId(null); await load();
  };

  if(loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center font-black">Carregando...</div>;
  const pending=allW.filter((x:any)=>x.status==="pending");
  const approved=allW.filter((x:any)=>x.status==="approved");
  const paidTotal=allW.filter((x:any)=>x.status==="paid").reduce((s:number,i:any)=>s+Number(i.amount),0);
  const taxaReal = (f:any) =>!f? '0% por pedido' : f.fee_type==='fixed'? `R$ ${f.fixed_fee_amount} / ${f.fixed_fee_period==='day'?'dia':f.fixed_fee_period==='week'?'semana':f.fixed_fee_period==='year'?'ano':'mês'}` : `${f.commission_percent||0}% por pedido`;

  return (
    <main className="min-h-screen bg-black text-white flex">
      <aside className="w-[280px] bg-[#0a0a0a] border-r border-white/10 fixed h-screen p-5 flex flex-col">
        <div className="flex items-center gap-3"><div className="w-10 h-10 bg-white text-black font-black rounded-xl flex items-center justify-center">P</div><div><p className="font-black text-sm leading-none tracking-widest">PAUDALHO</p><p className="text-[10px] font-bold text-zinc-500 mt-1 tracking-[0.2em]">ADMIN</p></div></div>
        <nav className="mt-10 space-y-2">
          <button onClick={()=>setTab("overview")} className={`w-full h-11 rounded-xl px-4 text-left font-black text-[13px] flex items-center gap-2 ${tab==="overview"?"bg-white text-black":"bg-[#151515] border border-white/10 text-white"}`}>📊 Visão Geral</button>
          <button onClick={()=>setTab("active")} className={`w-full h-11 rounded-xl px-4 text-left font-black text-[13px] flex justify-between items-center ${tab==="active"?"bg-white text-black":"bg-[#151515] border border-white/10 text-white"}`}><span className="flex items-center gap-2">🏪 Lojas Ativas</span><span className="w-5 h-5 rounded-full bg-white text-black text-[10px] font-black flex items-center justify-center">{finance.length}</span></button>
          <button onClick={()=>setTab("restaurants")} className={`w-full h-11 rounded-xl px-4 text-left font-black text-[13px] flex justify-between items-center ${tab==="restaurants"?"bg-white text-black":"bg-[#151515] border border-white/10 text-white"}`}><span className="flex items-center gap-2">⏳ Para Aprovar</span><span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center ${apps.length>0?"bg-red-600 text-white":"bg-white/10 text-zinc-400"}`}>{apps.length}</span></button>
          <button onClick={()=>setTab("drivers")} className={`w-full h-11 rounded-xl px-4 text-left font-black text-[13px] flex justify-between items-center ${tab==="drivers"?"bg-white text-black":"bg-[#151515] border border-white/10 text-white"}`}><span className="flex items-center gap-2">🛵 Entregadores</span><span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center ${drivers.length>0?"bg-red-600 text-white":"bg-white/10 text-zinc-400"}`}>{drivers.length}</span></button>
          <button onClick={()=>setTab("withdrawals")} className={`w-full h-11 rounded-xl px-4 text-left font-black text-[13px] flex justify-between items-center ${tab==="withdrawals"?"bg-white text-black":"bg-[#151515] border border-white/10 text-white"}`}><span className="flex items-center gap-2">💸 Resgates</span><span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center ${pending.length+approved.length>0?"bg-yellow-400 text-black":"bg-white/10 text-zinc-400"}`}>{pending.length+approved.length}</span></button>
          <button onClick={()=>setTab("commissions")} className={`w-full h-11 rounded-xl px-4 text-left font-black text-[13px] flex items-center gap-2 ${tab==="commissions"?"bg-white text-black":"bg-[#151515] border border-white/10 text-white"}`}>% Impostos / Comissões</button>
        </nav>
        <div className="mt-auto bg-[#151515] border border-white/10 rounded-2xl p-4"><p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Faturamento já pago</p><p className="text-2xl font-black text-white mt-1">{money(paidTotal)}</p></div>
      </aside>

      <div className="flex-1 ml-[280px]">
        <header className="h-[68px] bg-[#0a0a0a] border-b border-white/10 flex items-center justify-between px-8 sticky top-0 z-10"><h1 className="text-xl font-black text-white">Painel Administrativo</h1><div className="flex gap-2"><button onClick={load} className="h-10 px-5 rounded-full bg-white text-black font-black text-sm">Atualizar</button><button onClick={async()=>{await supabase.auth.signOut(); router.replace("/admin/login");}} className="h-10 px-5 rounded-full bg-white/10 border border-white/20 text-white font-black text-sm">Sair →</button></div></header>
        <div className="p-8">
          {tab==="overview" && (
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-[#151515] border border-white/10 rounded-[20px] p-6"><p className="text-[11px] font-black uppercase text-zinc-400 tracking-widest">Lojas Ativas</p><p className="text-5xl font-black text-white mt-3">{finance.length}</p><p className="mt-3 text-xs font-black text-green-400">● Operando agora</p></div>
              <div className="bg-[#151515] border border-white/10 rounded-[20px] p-6"><p className="text-[11px] font-black uppercase text-zinc-400 tracking-widest">Pendências</p><p className="text-5xl font-black text-white mt-3">{apps.length+drivers.length}</p></div>
              <div className="bg-[#151515] border border-white/10 rounded-[20px] p-6"><p className="text-[11px] font-black uppercase text-zinc-400 tracking-widest">Resgates na fila</p><p className="text-5xl font-black text-white mt-3">{pending.length}</p><p className="mt-3 text-xs font-black text-white">{money(pending.reduce((s:number,i:any)=>s+Number(i.amount),0))}</p></div>
              <div className="bg-white text-black rounded-[20px] p-6"><p className="text-[11px] font-black uppercase opacity-60 tracking-widest">Pix pra enviar</p><p className="text-5xl font-black mt-3">{approved.length}</p><p className="mt-3 text-xs font-black">{money(approved.reduce((s:number,i:any)=>s+Number(i.amount),0))}</p></div>
            </div>
          )}

          {tab==="active" && (
            <div><h2 className="text-2xl font-black text-white mb-6">Lojas Confirmadas ({finance.length})</h2><div className="grid grid-cols-3 gap-4">{finance.map((f:any)=>(<button key={f.restaurant_id} onClick={()=>setSelectedStore(f)} className="bg-[#151515] border border-white/10 rounded-[20px] p-6 text-left hover:bg-[#1f1f1f]"><div className="w-10 h-10 bg-white text-black rounded-xl flex items-center justify-center font-black mb-4">{f.restaurant_name?.[0]?.toUpperCase()}</div><p className="font-black text-white text-[15px]">{f.restaurant_name}</p><p className="text-[13px] font-black text-green-400 mt-2">{taxaReal(f)}</p><p className="text-[11px] font-bold text-zinc-500 mt-3">● Ver detalhes →</p></button>))}</div></div>
          )}

          {tab==="restaurants" && (<div><h2 className="text-2xl font-black mb-6">Para Aprovar ({apps.length})</h2>{apps.length===0?<p className="text-zinc-500 font-bold">Nenhuma pendência</p>:<div className="space-y-3">{apps.map((a:any)=><div key={a.id} className="bg-[#151515] border border-white/10 rounded-xl p-5 flex justify-between"><div><p className="font-black">{a.business_name||a.full_name}</p><p className="text-xs text-zinc-400 mt-1">{a.email} - {a.phone}</p></div><span className="text-xs font-black bg-yellow-400 text-black px-3 py-1 rounded-full h-fit">PENDENTE</span></div>)}</div>}</div>)}
          {tab==="drivers" && (<div><h2 className="text-2xl font-black mb-6">Entregadores ({drivers.length})</h2>{drivers.length===0?<p className="text-zinc-500 font-bold">Nenhuma pendência</p>:<div className="space-y-3">{drivers.map((d:any)=><div key={d.id} className="bg-[#151515] border border-white/10 rounded-xl p-5"><p className="font-black">{d.full_name}</p><p className="text-xs text-zinc-400">{d.phone}</p></div>)}</div>}</div>)}
          {tab==="withdrawals" && (<div><h2 className="text-2xl font-black mb-6">Resgates</h2><div className="flex gap-2 mb-4"><button onClick={()=>setFilter("pending")} className={`px-4 py-2 rounded-full font-black text-xs ${filter==="pending"?"bg-white text-black":"bg-[#151515] border border-white/10"}`}>Pendentes ({pending.length})</button><button onClick={()=>setFilter("approved")} className={`px-4 py-2 rounded-full font-black text-xs ${filter==="approved"?"bg-white text-black":"bg-[#151515] border border-white/10"}`}>Aprovados ({approved.length})</button><button onClick={()=>setFilter("all")} className={`px-4 py-2 rounded-full font-black text-xs ${filter==="all"?"bg-white text-black":"bg-[#151515] border border-white/10"}`}>Todos</button></div><div className="space-y-2">{allW.slice(0,50).map((w:any)=><div key={w.id} className="bg-[#151515] border border-white/10 rounded-xl p-4 flex justify-between"><p className="font-bold text-sm">{w.restaurant_name||w.id.slice(0,8)} - {money(w.amount)}</p><span className="text-[10px] font-black px-2 py-1 rounded-full bg-white/10">{w.status}</span></div>)}</div></div>)}

          {tab==="commissions" && (
            <div className="space-y-3"><h2 className="text-2xl font-black text-white">Configurar Taxas - Só 1 vale</h2>{finance.map((f:any)=>{const e=editFees[f.restaurant_id]; if(!e) return null; return (<div key={f.restaurant_id} className="bg-[#151515] border border-white/10 rounded-[20px] p-6"><div className="flex justify-between items-center mb-5"><div className="flex gap-3 items-center"><div className="w-10 h-10 bg-white text-black rounded-xl flex items-center justify-center font-black">{f.restaurant_name?.[0]?.toUpperCase()}</div><p className="font-black text-white">{f.restaurant_name}</p><span className="ml-2 px-3 py-1 rounded-full bg-white text-black text-[10px] font-black">ATUAL: {taxaReal(f)}</span></div><div className="flex gap-2"><button onClick={()=>setEditFees({...editFees,[f.restaurant_id]:{...e,type:"percent"}})} className={`h-9 px-4 rounded-full font-black text-xs ${e.type==="percent"?"bg-white text-black":"bg-black border border-white/20 text-white"}`}>% Porcentagem</button><button onClick={()=>setEditFees({...editFees,[f.restaurant_id]:{...e,type:"fixed"}})} className={`h-9 px-4 rounded-full font-black text-xs ${e.type==="fixed"?"bg-white text-black":"bg-black border border-white/20 text-white"}`}>R$ Fixo</button></div></div>{e.type==="percent"? (<div className="flex gap-3 items-end"><div className="bg-black border border-white/10 rounded-xl p-4 flex-1"><p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">PORCENTAGEM</p><div className="flex gap-2 mt-2 items-center"><input type="number" value={e.percent} onChange={v=>setEditFees({...editFees,[f.restaurant_id]:{...e,percent:Number(v.target.value)}})} className="w-24 bg-[#1f1f1f] border border-white/20 rounded-lg h-10 text-center font-black text-white"/><span className="font-black">%</span></div></div><button onClick={()=>saveFee(f.restaurant_id)} disabled={savingId===f.restaurant_id} className="h-[68px] px-8 rounded-xl bg-white text-black font-black text-sm">{savingId===f.restaurant_id?"Salvando...":"Salvar"}</button></div>) : (<div className="grid grid-cols-3 gap-3"><div className="bg-black border border-white/10 rounded-xl p-4"><p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">VALOR FIXO</p><div className="flex gap-1 mt-2 items-center"><span className="font-black text-sm">R$</span><input type="number" value={e.amount} onChange={v=>setEditFees({...editFees,[f.restaurant_id]:{...e,amount:Number(v.target.value)}})} className="flex-1 bg-[#1f1f1f] border border-white/20 rounded-lg h-10 text-center font-black text-white"/></div></div><div className="bg-black border border-white/10 rounded-xl p-4"><p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">COBRAR A CADA</p><select value={e.period} onChange={v=>setEditFees({...editFees,[f.restaurant_id]:{...e,period:v.target.value as any}})} className="w-full mt-2 bg-[#1f1f1f] border border-white/20 rounded-lg h-10 font-black text-white text-sm px-2"><option value="day">Dia</option><option value="week">Semana</option><option value="month">Mês</option><option value="year">Ano</option></select></div><button onClick={()=>saveFee(f.restaurant_id)} disabled={savingId===f.restaurant_id} className="h-[68px] rounded-xl bg-white text-black font-black text-sm">Salvar</button></div>)}</div>)})}</div>
          )}

          {selectedStore && (<FullDetailsModal store={selectedStore} onClose={()=>setSelectedStore(null)} />)}
        </div>
      </div>
    </main>
  );
}

function FullDetailsModal({store, onClose}:{store:any, onClose:()=>void}){
  const [extra,setExtra]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{(async()=>{
    const {data:r}=await supabase.from("restaurants").select("*").eq("id", store.restaurant_id).maybeSingle();
    let app=null;
    if(r?.user_id){
      const {data:a}=await supabase.from("restaurant_applications").select("*").eq("user_id", r.user_id).order("created_at",{ascending:false}).limit(1).maybeSingle();
      app=a;
    }
    setExtra({restaurant:r, application:app});
    setLoading(false);
  })()},[store.restaurant_id]);
  if(loading) return <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center text-white font-black text-xl">Carregando...</div>;
  const r=extra?.restaurant||{}; const a=extra?.application||{};
  const Field=({label,value}:{label:string,value:any})=>(<div className="bg-[#1a1a1a] rounded-xl p-5"><p className="text-[13px] font-black text-zinc-400 uppercase tracking-widest">{label}</p><p className="font-bold text-white text-[19px] mt-2 break-all leading-tight">{value||'Não informado'}</p></div>);
  const taxaReal = store.fee_type==='fixed'? `R$ ${store.fixed_fee_amount} por ${store.fixed_fee_period==='day'?'dia':'mês'}` : `${store.commission_percent||0}% por pedido`;
  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-[#151515] border border-white/20 rounded-[28px] w-full max-w-5xl my-8 max-h-[95vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="p-10 border-b border-white/10 flex justify-between items-start sticky top-0 bg-[#151515] z-10 rounded-t-[28px]">
          <div className="flex gap-5"><div className="w-20 h-20 bg-white text-black rounded-2xl flex items-center justify-center font-black text-4xl">{store.restaurant_name?.[0]?.toUpperCase()}</div><div><p className="font-black text-white text-3xl">{store.restaurant_name}</p><div className="flex gap-2 mt-3"><span className="px-4 py-1.5 rounded-full text-sm font-black bg-white text-black">{taxaReal}</span></div></div></div><button onClick={onClose} className="w-12 h-12 rounded-full bg-white text-black font-black text-xl">X</button>
        </div>
        <div className="p-10 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-black border border-white/10 rounded-2xl p-6"><p className="text-sm font-black text-white uppercase tracking-widest mb-5">👤 DONO</p><div className="space-y-4"><Field label="Nome" value={a.full_name||r.name} /><Field label="Telefone" value={a.phone||r.phone} /></div></div>
            <div className="bg-black border border-white/10 rounded-2xl p-6"><p className="text-sm font-black text-white uppercase tracking-widest mb-5">🏪 LOJA</p><div className="space-y-4"><Field label="Nome" value={r.name||store.restaurant_name} /><Field label="Endereço" value={a.address||r.address} /></div></div>
          </div>
          <div className="bg-black border border-white/10 rounded-2xl p-6"><p className="text-sm font-black text-white uppercase tracking-widest mb-5">💰 TAXA REAL - SÓ ESSA VALE</p><Field label="IMPOSTO COBRADO" value={taxaReal} /></div>
          <button onClick={onClose} className="w-full h-16 rounded-2xl bg-white text-black font-black text-xl">Fechar</button>
        </div>
      </div>
    </div>
  );
}