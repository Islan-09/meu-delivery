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
      const init:Record<string,EditFee>={};
      f.forEach((x:any)=>{init[x.restaurant_id]={type:x.fee_type||"percent", percent:Number(x.commission_percent||0), amount:Number(x.fixed_fee_amount||0), period:x.fixed_fee_period||"month"}});
      setEditFees(init);
    }
  },[filter]);

  useEffect(()=>{(async()=>{
    const {data:{session}}=await supabase.auth.getSession();
    if(!session){router.replace("/admin/login");return;}
    const {data:p}=await supabase.from("profiles").select("role").eq("id",session.user.id).maybeSingle();
    if(!p||p.role!=="admin"){router.replace("/admin/login");return;}
    await load(); setLoading(false);
  })()},[router,load]);
  useEffect(()=>{load()},[filter,load]);

  const saveFee = async (id:string) => {
    setSavingId(id); const e=editFees[id];
    const {error}=await supabase.rpc("set_admin_restaurant_fee",{
      p_restaurant_id:id, p_fee_type:e.type, p_percent:e.percent, p_fixed_amount:e.amount, p_period:e.period, p_include_delivery:false
    } as any);
    if(error) alert("Erro: "+error.message); else { alert("Taxa salva!"); }
    setSavingId(null); await load();
  };

  if(loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center font-black">Carregando...</div>;
  const pending=allW.filter((x:any)=>x.status==="pending");
  const approved=allW.filter((x:any)=>x.status==="approved");
  const paidTotal=allW.filter((x:any)=>x.status==="paid").reduce((s:number,i:any)=>s+Number(i.amount),0);

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
          <button onClick={()=>setTab("commissions")} className={`w-full h-11 rounded-xl px-4 text-left font-black text-[13px] flex items-center gap-2 ${tab==="commissions"?"bg-white text-black":"bg-[#151515] border border-white/10 text-white"}`}>% Taxas / Comissões</button>
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
            <div><h2 className="text-2xl font-black text-white mb-6">Lojas Confirmadas ({finance.length}) - Clique para ver detalhes</h2><div className="grid grid-cols-3 gap-4">{finance.map((f:any)=>{const e=editFees[f.restaurant_id]; return (<button key={f.restaurant_id} onClick={()=>setSelectedStore(f)} className="bg-[#151515] border border-white/10 rounded-[20px] p-6 text-left hover:bg-[#1f1f1f]"><div className="w-10 h-10 bg-white text-black rounded-xl flex items-center justify-center font-black mb-4">{f.restaurant_name?.[0]?.toUpperCase()}</div><p className="font-black text-white text-[15px]">{f.restaurant_name}</p><p className="text-[11px] font-bold text-zinc-400 mt-2">{e?.type==="fixed"?`${money(e.amount)} / ${e.period==="day"?"dia":e.period==="week"?"semana":e.period==="month"?"mês":"ano"}`:`${e?.percent||0}% por pedido`}</p><p className="text-[11px] font-black text-green-400 mt-3">● Ver detalhes →</p></button>)})}</div></div>
          )}

          {tab==="commissions" && (
            <div className="space-y-3">
              <h2 className="text-2xl font-black text-white">Configurar Taxas</h2><p className="text-sm font-bold text-zinc-400 mb-6">Agora cada loja salva separado (bug corrigido)</p>
              {finance.map((f:any)=>{
                const e=editFees[f.restaurant_id]; if(!e) return null;
                return (
                  <div key={f.restaurant_id} className="bg-[#151515] border border-white/10 rounded-[20px] p-6">
                    <div className="flex justify-between items-center mb-5"><div className="flex gap-3 items-center"><div className="w-10 h-10 bg-white text-black rounded-xl flex items-center justify-center font-black">{f.restaurant_name?.[0]?.toUpperCase()}</div><p className="font-black text-white">{f.restaurant_name}</p></div><div className="flex gap-2"><button onClick={()=>setEditFees({...editFees,[f.restaurant_id]:{...e,type:"percent"}})} className={`h-9 px-4 rounded-full font-black text-xs ${e.type==="percent"?"bg-white text-black":"bg-black border border-white/20 text-white"}`}>% Porcentagem</button><button onClick={()=>setEditFees({...editFees,[f.restaurant_id]:{...e,type:"fixed"}})} className={`h-9 px-4 rounded-full font-black text-xs ${e.type==="fixed"?"bg-white text-black":"bg-black border border-white/20 text-white"}`}>R$ Valor Fixo</button></div></div>
                    {e.type==="percent"? (
                      <div className="flex gap-3 items-end"><div className="bg-black border border-white/10 rounded-xl p-4 flex-1"><p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">PORCENTAGEM POR PEDIDO</p><div className="flex gap-2 mt-2 items-center"><input type="number" value={e.percent} onChange={v=>setEditFees({...editFees,[f.restaurant_id]:{...e,percent:Number(v.target.value)}})} className="w-24 bg-[#1f1f1f] border border-white/20 rounded-lg h-10 text-center font-black text-white"/><span className="font-black">%</span></div></div><button onClick={()=>saveFee(f.restaurant_id)} disabled={savingId===f.restaurant_id} className="h-[68px] px-8 rounded-xl bg-white text-black font-black text-sm">{savingId===f.restaurant_id?"Salvando...":"Salvar %"}</button></div>
                    ) : (
                      <div className="grid grid-cols-3 gap-3"><div className="bg-black border border-white/10 rounded-xl p-4"><p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">VALOR FIXO</p><div className="flex gap-1 mt-2 items-center"><span className="font-black text-sm">R$</span><input type="number" value={e.amount} onChange={v=>setEditFees({...editFees,[f.restaurant_id]:{...e,amount:Number(v.target.value)}})} className="flex-1 bg-[#1f1f1f] border border-white/20 rounded-lg h-10 text-center font-black text-white"/></div></div><div className="bg-black border border-white/10 rounded-xl p-4"><p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">COBRAR A CADA</p><select value={e.period} onChange={v=>setEditFees({...editFees,[f.restaurant_id]:{...e,period:v.target.value as any}})} className="w-full mt-2 bg-[#1f1f1f] border border-white/20 rounded-lg h-10 font-black text-white text-sm px-2"><option value="day">Dia</option><option value="week">Semana</option><option value="month">Mês</option><option value="year">Ano</option></select></div><button onClick={()=>saveFee(f.restaurant_id)} disabled={savingId===f.restaurant_id} className="h-[68px] rounded-xl bg-white text-black font-black text-sm">{savingId===f.restaurant_id?"Salvando...":`Salvar ${money(e.amount)} / ${e.period==="day"?"dia":e.period==="week"?"semana":e.period==="month"?"mês":"ano"}`}</button></div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {selectedStore && (
            <FullDetailsModal store={selectedStore} editFee={editFees[selectedStore.restaurant_id]} onClose={()=>setSelectedStore(null)} onGoToFee={()=>{setTab("commissions"); setSelectedStore(null);}} />
          )}
        </div>
      </div>
    </main>
  );
}

function FullDetailsModal({store, editFee, onClose, onGoToFee}:{store:any, editFee:any, onClose:()=>void, onGoToFee:()=>void}){
  const [data,setData]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    (async()=>{
      const {data:res} = await supabase.rpc("get_admin_restaurant_full_details",{p_restaurant_id: store.restaurant_id});
      setData(res); setLoading(false);
    })();
  },[store.restaurant_id]);

  if(loading) return <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center text-white font-black">Carregando dados completos...</div>;

  const r = data?.restaurant || {};
  const a = data?.application || {};
  const f = data?.finance || {};
  const p = data?.profile || {};

  const Field = ({label, value}:{label:string, value:any}) => (
    <div><p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{label}</p><p className="font-bold text-white text-[13px] mt-1 break-all">{value || '-'}</p></div>
  );

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-[#151515] border border-white/20 rounded-[24px] w-full max-w-4xl my-8 max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="p-8 border-b border-white/10 flex justify-between items-start sticky top-0 bg-[#151515] z-10 rounded-t-[24px]">
          <div className="flex gap-4">
            <div className="w-16 h-16 bg-white text-black rounded-2xl flex items-center justify-center font-black text-3xl">{r.name?.[0]?.toUpperCase() || store.restaurant_name?.[0]}</div>
            <div>
              <p className="font-black text-white text-2xl">{r.name || store.restaurant_name}</p>
              <p className="text-xs text-zinc-500 mt-1 font-mono">ID: {r.id || store.restaurant_id}</p>
              <div className="flex gap-2 mt-2">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black ${r.is_open?'bg-green-500 text-black':'bg-zinc-700 text-white'}`}>{r.is_open?'● ABERTA':'● FECHADA'}</span>
                <span className="px-3 py-1 rounded-full text-[10px] font-black bg-white text-black">{editFee?.type==="fixed"? `${money(editFee.amount)} / ${editFee.period}` : `${editFee?.percent||0}% por pedido`}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 text-white font-black hover:bg-white hover:text-black">X</button>
        </div>

        <div className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-black border border-white/10 rounded-xl p-5">
              <p className="text-[11px] font-black text-zinc-500 uppercase tracking-widest mb-4">👤 Dono / Responsável Legal</p>
              <div className="space-y-3">
                <Field label="Nome completo" value={a.full_name || a.business_name || p.full_name} />
                <Field label="Email" value={p.email || a.email} />
                <Field label="Telefone / Whats" value={a.phone || r.phone || p.phone} />
                <Field label="CPF / CNPJ" value={a.cnpj || a.cpf || a.document || r.cnpj} />
                <Field label="ID Usuário (dono)" value={r.user_id} />
              </div>
            </div>

            <div className="bg-black border border-white/10 rounded-xl p-5">
              <p className="text-[11px] font-black text-zinc-500 uppercase tracking-widest mb-4">🏪 Dados da Loja</p>
              <div className="space-y-3">
                <Field label="Nome fantasia" value={r.name} />
                <Field label="Razão social" value={a.business_name} />
                <Field label="Categoria" value={r.category || a.category} />
                <Field label="Endereço completo" value={a.address || r.address || `${r.street || ''} ${r.number || ''} - ${r.neighborhood || ''} - ${r.city || ''}`} />
                <Field label="Criada em" value={r.created_at? new Date(r.created_at).toLocaleString('pt-BR') : '-'} />
                <Field label="Status aprovação" value={a.status} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-black border border-white/10 rounded-xl p-5">
              <p className="text-[11px] font-black text-zinc-500 uppercase tracking-widest mb-4">💰 Financeiro / Repasse</p>
              <div className="space-y-3">
                <Field label="Modelo de cobrança" value={f.fee_type === 'fixed'? 'Fixo' : 'Porcentagem'} />
                <Field label="Taxa atual" value={f.fee_type === 'fixed'? `R$ ${f.fixed_fee_amount} / ${f.fixed_fee_period}` : `${f.commission_percent || 0}% por pedido`} />
                <Field label="Inclui taxa de entrega?" value={f.include_delivery_fee? 'Sim' : 'Não'} />
                <Field label="Chave PIX" value={a.pix_key || r.pix_key || a.pix || '-'} />
                <Field label="Banco / Agência / Conta" value={a.bank_info || a.bank_account || `${a.bank_name || ''} ${a.agency || ''} ${a.account || ''}`.trim() || '-'} />
              </div>
            </div>

            <div className="bg-black border border-white/10 rounded-xl p-5">
              <p className="text-[11px] font-black text-zinc-500 uppercase tracking-widest mb-4">📄 Documentos & Outros</p>
              <div className="space-y-3">
                <Field label="Documento foto / CNH" value={a.document_url || a.photo_url? 'Enviado (ver JSON)' : 'Não enviado'} />
                <Field label="Foto da loja / Logo" value={r.logo_url || r.image_url || '-'} />
                <Field label="Horário funcionamento" value={r.opening_hours? JSON.stringify(r.opening_hours) : a.opening_hours || '-'} />
                <Field label="Observações" value={a.notes || r.description || '-'} />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={onGoToFee} className="flex-1 h-12 rounded-xl bg-white text-black font-black">% Editar taxa dessa loja</button>
            <button onClick={onClose} className="flex-1 h-12 rounded-xl bg-white/10 border border-white/20 text-white font-black">Fechar</button>
          </div>

          <details className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4">
            <summary className="text-xs font-black text-zinc-400 cursor-pointer">VER JSON COMPLETO (prova jurídica - todos os campos brutos)</summary>
            <pre className="mt-3 text-[10px] text-zinc-300 overflow-auto max-h-96 whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
          </details>
        </div>
      </div>
    </div>
  );
}