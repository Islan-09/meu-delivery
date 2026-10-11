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
  const [filteredW,setFilteredW]=useState<any[]>([]);
  const [finance,setFinance]=useState<any[]>([]);
  const [filter,setFilter]=useState("pending");
  const [selectedStore,setSelectedStore]=useState<any>(null);
  const [editFees,setEditFees]=useState<Record<string,EditFee>>({});
  const [savingId,setSavingId]=useState<string|null>(null);
  const load=useCallback(async()=>{
    const [r,d]=await Promise.all([supabase.from("restaurant_applications").select("*").eq("status","pending"),supabase.from("driver_applications").select("*").eq("status","pending")]);
    if(r.data) setApps(r.data); if(d.data) setDrivers(d.data);
    const {data:w1}=await supabase.rpc("get_admin_withdrawal_requests_v2",{p_status:filter});
    const {data:w2}=await supabase.rpc("get_admin_withdrawal_requests_v2",{p_status:"all"});
    const {data:f}=await supabase.rpc("get_admin_restaurant_finance_settings");
    if(w1) setFilteredW(w1); if(w2) setAllW(w2);
    if(f){ setFinance(f); const init:Record<string,EditFee>={}; f.forEach((x:any)=>{init[x.restaurant_id]={type:x.fee_type||"percent", percent:Number(x.commission_percent||0), amount:Number(x.fixed_fee_amount||0), period:x.fixed_fee_period||"month"}}); setEditFees(init); }
  },[filter]);
  useEffect(()=>{(async()=>{const {data:{session}}=await supabase.auth.getSession(); if(!session){router.replace("/admin/login");return;} const {data:p}=await supabase.from("profiles").select("role").eq("id",session.user.id).maybeSingle(); if(!p||p.role!=="admin"){router.replace("/admin/login");return;} await load(); setLoading(false);})()},[router,load]);
  useEffect(()=>{load()},[filter,load]);
  const saveFee=async(id:string)=>{setSavingId(id); const e=editFees[id]; const {error}=await supabase.rpc("set_admin_restaurant_fee",{p_restaurant_id:id,p_fee_type:e.type,p_percent:e.percent,p_fixed_amount:e.amount,p_period:e.period,p_include_delivery:false} as any); if(error) alert("Erro: "+error.message); else alert("Taxa salva!"); setSavingId(null); await load();};
  if(loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center font-black">Carregando...</div>;
  const pending=allW.filter((x:any)=>x.status==="pending"); const approved=allW.filter((x:any)=>x.status==="approved"); const paidTotal=allW.filter((x:any)=>x.status==="paid").reduce((s:number,i:any)=>s+Number(i.amount),0);
  return (
    <main className="min-h-screen bg-black text-white flex">
      <aside className="w-[280px] bg-[#0a0a0a] border-r border-white/10 fixed h-screen p-5 flex flex-col">
        <div className="flex items-center gap-3"><div className="w-10 h-10 bg-white text-black font-black rounded-xl flex items-center justify-center">P</div><div><p className="font-black text-sm leading-none tracking-widest">PAUDALHO</p><p className="text-[10px] font-bold text-zinc-500 mt-1 tracking-[0.2em]">ADMIN</p></div></div>
        <nav className="mt-10 space-y-2">
          <button onClick={()=>setTab("overview")} className={`w-full h-11 rounded-xl px-4 text-left font-black text-[13px] flex items-center gap-2 ${tab==="overview"?"bg-white text-black":"bg-[#151515] border border-white/10 text-white"}`}>📊 Visão Geral</button>
          <button onClick={()=>setTab("active")} className={`w-full h-11 rounded-xl px-4 text-left font-black text-[13px] flex justify-between items-center ${tab==="active"?"bg-white text-black":"bg-[#151515] border border-white/10 text-white"}`}><span className="flex items-center gap-2">🏪 Lojas Ativas</span><span className="w-5 h-5 rounded-full bg-white text-black text-[10px] font-black flex items-center justify-center">{finance.length}</span></button>
          <button onClick={()=>setTab("commissions")} className={`w-full h-11 rounded-xl px-4 text-left font-black text-[13px] flex items-center gap-2 ${tab==="commissions"?"bg-white text-black":"bg-[#151515] border border-white/10 text-white"}`}>% Taxas / Comissões</button>
        </nav>
        <div className="mt-auto bg-[#151515] border border-white/10 rounded-2xl p-4"><p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Faturamento já pago</p><p className="text-2xl font-black text-white mt-1">{money(paidTotal)}</p></div>
      </aside>
      <div className="flex-1 ml-[280px]">
        <header className="h-[68px] bg-[#0a0a0a] border-b border-white/10 flex items-center justify-between px-8 sticky top-0 z-10"><h1 className="text-xl font-black text-white">Painel Administrativo</h1><div className="flex gap-2"><button onClick={load} className="h-10 px-5 rounded-full bg-white text-black font-black text-sm">Atualizar</button><button onClick={async()=>{await supabase.auth.signOut(); router.replace("/admin/login");}} className="h-10 px-5 rounded-full bg-white/10 border border-white/20 text-white font-black text-sm">Sair →</button></div></header>
        <div className="p-8">
          {tab==="active" && (<div><h2 className="text-2xl font-black text-white mb-6">Lojas Confirmadas ({finance.length}) - Clique para ver detalhes</h2><div className="grid grid-cols-3 gap-4">{finance.map((f:any)=>{const e=editFees[f.restaurant_id]; return (<button key={f.restaurant_id} onClick={()=>setSelectedStore(f)} className="bg-[#151515] border border-white/10 rounded-[20px] p-6 text-left hover:bg-[#1f1f1f]"><div className="w-10 h-10 bg-white text-black rounded-xl flex items-center justify-center font-black mb-4">{f.restaurant_name?.[0]?.toUpperCase()}</div><p className="font-black text-white text-[15px]">{f.restaurant_name}</p><p className="text-[11px] font-bold text-zinc-400 mt-2">{e?.percent||0}% por pedido</p><p className="text-[11px] font-black text-green-400 mt-3">● Ver detalhes →</p></button>)})}</div></div>)}
          {selectedStore && (<FullDetailsModal store={selectedStore} editFee={editFees[selectedStore.restaurant_id]} onClose={()=>setSelectedStore(null)} />)}
        </div>
      </div>
    </main>
  );
}
function FullDetailsModal({store, editFee, onClose}:{store:any, editFee:any, onClose:()=>void}){
  const [data,setData]=useState<any>(null); const [loading,setLoading]=useState(true);
  useEffect(()=>{(async()=>{const {data:res}=await supabase.rpc("get_admin_restaurant_full_details_v2",{p_restaurant_id:store.restaurant_id}); setData(res); setLoading(false);})()},[store.restaurant_id]);
  if(loading) return <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center text-white font-black text-xl">Carregando...</div>;
  const r=data?.restaurant||{}; const a=data?.application||{}; const f=data?.finance||{}; const p=data?.profile||{};
  const Field=({label,value}:{label:string,value:any})=>(<div className="bg-[#1a1a1a] rounded-xl p-5"><p className="text-[13px] font-black text-zinc-400 uppercase tracking-widest">{label}</p><p className="font-bold text-white text-[19px] mt-2 break-all leading-tight">{value||'Não informado'}</p></div>);
  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-[#151515] border border-white/20 rounded-[28px] w-full max-w-5xl my-8 max-h-[95vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="p-10 border-b border-white/10 flex justify-between items-start sticky top-0 bg-[#151515] z-10 rounded-t-[28px]">
          <div className="flex gap-5"><div className="w-20 h-20 bg-white text-black rounded-2xl flex items-center justify-center font-black text-4xl">{(r.name||store.restaurant_name)?.[0]?.toUpperCase()}</div><div><p className="font-black text-white text-3xl">{r.name||store.restaurant_name}</p><p className="text-sm text-zinc-400 mt-2 font-mono">ID: {(r.id||store.restaurant_id)?.slice(0,8)}...</p><div className="flex gap-2 mt-3"><span className={`px-4 py-1.5 rounded-full text-sm font-black ${r.is_open?'bg-green-500 text-black':'bg-zinc-700 text-white'}`}>{r.is_open?'● ABERTA':'● FECHADA'}</span><span className="px-4 py-1.5 rounded-full text-sm font-black bg-white text-black">{editFee?.percent||0}% por pedido</span></div></div></div><button onClick={onClose} className="w-12 h-12 rounded-full bg-white text-black font-black text-xl">X</button>
        </div>
        <div className="p-10 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-black border border-white/10 rounded-2xl p-6"><p className="text-sm font-black text-white uppercase tracking-widest mb-5">👤 DONO / RESPONSÁVEL LEGAL</p><div className="space-y-4"><Field label="Nome Completo" value={a.full_name||p.full_name||r.owner_name||r.name} /><Field label="E-mail" value={p.email||a.email} /><Field label="Telefone / WhatsApp" value={a.phone||r.phone||p.phone} /><Field label="CPF / CNPJ" value={a.cnpj||a.cpf||a.document||r.cnpj} /></div></div>
            <div className="bg-black border border-white/10 rounded-2xl p-6"><p className="text-sm font-black text-white uppercase tracking-widest mb-5">🏪 DADOS DA LOJA</p><div className="space-y-4"><Field label="Nome Fantasia" value={r.name} /><Field label="Endereço Completo" value={a.address||r.address||[r.street,r.number,r.neighborhood,r.city].filter(Boolean).join(', ')} /><Field label="Categoria" value={r.category||a.category} /><Field label="Criada em" value={r.created_at?new Date(r.created_at).toLocaleString('pt-BR'):'-'} /></div></div>
          </div>
          <div className="bg-black border border-white/10 rounded-2xl p-6"><p className="text-sm font-black text-white uppercase tracking-widest mb-5">💰 FINANCEIRO / REPASSE</p><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Field label="Taxa Atual" value={`${f.commission_percent||editFee?.percent||0}% por pedido`} /><Field label="Chave PIX" value={a.pix_key||a.pix||r.pix_key||'Não informado'} /><div className="md:col-span-2"><Field label="Dados Bancários" value={a.bank_info||[a.bank_name,a.agency,a.account].filter(Boolean).join(' - ')||'Não informado'} /></div></div></div>
          <button onClick={onClose} className="w-full h-16 rounded-2xl bg-white text-black font-black text-xl">Fechar</button>
        </div>
      </div>
    </div>
  );
}