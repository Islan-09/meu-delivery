"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type RestaurantApplication = { id: string; user_id: string; business_name: string; phone: string; category: string; description: string | null; street: string; number: string | null; complement: string | null; neighborhood: string; city: string; state: string; status: string; created_at: string; };
type DriverApplication = { id: string; user_id: string; full_name: string; phone: string; vehicle_type: string; plate: string | null; status: string; created_at: string; };
type WithdrawalStatus = "pending" | "approved" | "rejected" | "paid";
type WithdrawalRequest = { id: string; restaurant_id: string; restaurant_name: string; amount: number | string; pix_key_type: string; pix_key: string; holder_name: string | null; status: WithdrawalStatus; requested_at: string; reviewed_at: string | null; rejection_reason: string | null; paid_at: string | null; request_type: "standard" | "emergency"; processing_hours: number; due_at: string | null; };
type RestaurantFinanceSetting = { restaurant_id: string; restaurant_name: string; commission_percent: number | string; include_delivery_fee: boolean; };
type AdminTab = "overview" | "restaurants" | "drivers" | "withdrawals" | "commissions";
type WithdrawalFilter = WithdrawalStatus | "all";

function money(v: any) { return Number(v?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function dateTime(v: string | null) { if (!v) return "—"; return new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); }

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [processingId, setProcessingId] = useState("");
  const [restaurantApplications, setRestaurantApplications] = useState<RestaurantApplication[]>([]);
  const [driverApplications, setDriverApplications] = useState<DriverApplication[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [dashboardWithdrawals, setDashboardWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [financeSettings, setFinanceSettings] = useState<RestaurantFinanceSetting[]>([]);
  const [tab, setTab] = useState<AdminTab>("overview");
  const [withdrawalFilter, setWithdrawalFilter] = useState<WithdrawalFilter>("pending");

  const loadApplications = useCallback(async () => {
    const [r, d] = await Promise.all([
      supabase.from("restaurant_applications").select("*").eq("status", "pending").order("created_at", { ascending: true }),
      supabase.from("driver_applications").select("*").eq("status", "pending").order("created_at", { ascending: true }),
    ]);
    if (!r.error) setRestaurantApplications(r.data as any); if (!d.error) setDriverApplications(d.data as any);
  }, []);
  const loadWithdrawals = useCallback(async () => {
    const { data } = await supabase.rpc("get_admin_withdrawal_requests_v2", { p_status: withdrawalFilter });
    setWithdrawals((data?? []) as any);
  }, [withdrawalFilter]);
  const loadDashboardWithdrawals = useCallback(async () => {
    const { data } = await supabase.rpc("get_admin_withdrawal_requests_v2", { p_status: "all" });
    setDashboardWithdrawals((data?? []) as any);
  }, []);
  const loadFinanceSettings = useCallback(async () => {
    const { data } = await supabase.rpc("get_admin_restaurant_finance_settings");
    setFinanceSettings((data?? []) as any);
  }, []);
  const loadAll = useCallback(async () => { await Promise.all([loadApplications(), loadWithdrawals(), loadDashboardWithdrawals(), loadFinanceSettings()]); }, [loadApplications, loadWithdrawals, loadDashboardWithdrawals, loadFinanceSettings]);

  useEffect(() => {
    async function loadAdmin() {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { sessionStorage.setItem("after-login", "/admin"); router.replace("/login"); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
      if (!profile || profile.role!== "admin") { setAccessDenied(true); setLoading(false); return; }
      await loadAll(); setLoading(false);
    }
    loadAdmin();
  }, [router, loadAll]);

  async function approveRestaurant(id: string) { if (!confirm("Aprovar este restaurante?")) return; setProcessingId(id); await supabase.rpc("approve_restaurant_application", { p_application_id: id }); setSuccess("Restaurante aprovado!"); await loadApplications(); await loadFinanceSettings(); setProcessingId(""); }
  async function rejectRestaurant(id: string) { const reason = prompt("Motivo da recusa:"); if (!reason) return; setProcessingId(id); await supabase.rpc("reject_restaurant_application", { p_application_id: id, p_reason: reason }); await loadApplications(); setProcessingId(""); }
  async function approveDriver(id: string) { if (!confirm("Aprovar entregador?")) return; setProcessingId(id); await supabase.rpc("approve_driver_application", { p_application_id: id }); await loadApplications(); setProcessingId(""); }
  async function rejectDriver(id: string) { const reason = prompt("Motivo da recusa:"); if (!reason) return; setProcessingId(id); await supabase.rpc("reject_driver_application", { p_application_id: id, p_reason: reason }); await loadApplications(); setProcessingId(""); }
  async function reviewWithdrawal(id: string, action: "approve" | "reject") { let reason = null; if (action === "reject") { reason = prompt("Motivo da recusa:"); if (!reason) return; } else if (!confirm("Aprovar resgate?")) return; setProcessingId(id); await supabase.rpc("admin_review_withdrawal_request", { p_request_id: id, p_action: action, p_rejection_reason: reason }); await loadWithdrawals(); await loadDashboardWithdrawals(); setProcessingId(""); }
  async function markPaid(id: string) { if (!confirm("Confirma que JÁ ENVIOU o PIX?")) return; setProcessingId(id); await supabase.rpc("admin_mark_withdrawal_paid", { p_request_id: id }); await loadWithdrawals(); await loadDashboardWithdrawals(); setProcessingId(""); }
  async function updateCommission(rid: string, comm: string, inc: boolean) { const p = Number(comm.replace(",", ".")); if (p < 0 || p > 100) { setError("Comissão 0 a 100%"); return; } setProcessingId(rid); await supabase.rpc("admin_update_restaurant_financial_settings", { p_restaurant_id: rid, p_commission_percent: p, p_include_delivery_fee: inc }); await loadFinanceSettings(); setProcessingId(""); setSuccess("Comissão atualizada"); }

  if (loading) return <main className="min-h-screen bg-zinc-950 flex items-center justify-center text-white font-black">Carregando painel...</main>;
  if (accessDenied) return <main className="min-h-screen flex items-center justify-center bg-zinc-100"><div className="bg-white p-10 rounded-3xl text-center"><h1 className="text-2xl font-black">Acesso negado</h1><Link href="/" className="mt-4 block bg-red-600 text-white rounded-xl py-3 font-bold">Voltar</Link></div></main>;

  const pendingW = dashboardWithdrawals.filter(x => x.status === "pending");
  const approvedW = dashboardWithdrawals.filter(x => x.status === "approved");
  const paidAmount = dashboardWithdrawals.filter(x => x.status === "paid").reduce((s, i) => s + Number(i.amount), 0);
  const pendingAmount = pendingW.reduce((s, i) => s + Number(i.amount), 0);
  const approvedAmount = approvedW.reduce((s, i) => s + Number(i.amount), 0);
  const avgComm = financeSettings.length? financeSettings.reduce((s, i) => s + Number(i.commission_percent), 0) / financeSettings.length : 0;

  return (
    <main className="min-h-screen bg-[#f6f6f7] flex">
      {/* SIDEBAR */}
      <aside className="hidden lg:flex w-[280px] bg-[#0f0f0f] text-white flex-col p-6 fixed h-screen">
        <div className="flex items-center gap-3"><div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-black font-black text-xl">P</div><div><p className="font-black leading-none">PAUDALHO</p><p className="text-[10px] tracking-[0.2em] text-zinc-400 font-bold">ADMIN • v2</p></div></div>
        <nav className="mt-10 space-y-2">
          <button onClick={() => setTab("overview")} className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-3 ${tab === "overview"? "bg-white text-black" : "text-zinc-400 hover:bg-white/10 hover:text-white"}`}>📊 Visão Geral</button>
          <button onClick={() => setTab("restaurants")} className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-3 ${tab === "restaurants"? "bg-white text-black" : "text-zinc-400 hover:bg-white/10"}`}>🏪 Restaurantes <span className="ml-auto bg-red-600 text-white text-[11px] px-2 py-0.5 rounded-full">{restaurantApplications.length}</span></button>
          <button onClick={() => setTab("drivers")} className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-3 ${tab === "drivers"? "bg-white text-black" : "text-zinc-400 hover:bg-white/10"}`}>🛵 Entregadores <span className="ml-auto bg-red-600 text-white text-[11px] px-2 py-0.5 rounded-full">{driverApplications.length}</span></button>
          <button onClick={() => setTab("withdrawals")} className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-3 ${tab === "withdrawals"? "bg-white text-black" : "text-zinc-400 hover:bg-white/10"}`}>💸 Resgates <span className="ml-auto bg-yellow-500 text-black text-[11px] px-2 py-0.5 rounded-full">{pendingW.length + approvedW.length}</span></button>
          <button onClick={() => setTab("commissions")} className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-3 ${tab === "commissions"? "bg-white text-black" : "text-zinc-400 hover:bg-white/10"}`}>% Comissões</button>
        </nav>
        <div className="mt-auto"><div className="bg-white/10 rounded-2xl p-4 border border-white/10"><p className="text-xs font-black uppercase text-zinc-400">Faturamento retido</p><p className="text-2xl font-black mt-1">{money(paidAmount)}</p><p className="text-xs text-zinc-500 mt-1">Total já pago às lojas</p></div><Link href="/" className="mt-4 block text-center text-xs font-bold text-zinc-500 hover:text-white">← Ver site</Link></div>
      </aside>

      {/* CONTEUDO */}
      <div className="flex-1 lg:ml-[280px]">
        <header className="h-[64px] bg-white border-b border-zinc-200 flex items-center justify-between px-6 lg:px-8 sticky top-0 z-10">
          <div><p className="text-[11px] font-black tracking-widest text-red-600 uppercase">Administração</p><h1 className="text-[20px] font-black leading-none">Painel Administrativo</h1></div>
          <div className="flex items-center gap-3"><button onClick={loadAll} className="h-9 px-4 rounded-full border border-zinc-200 bg-white text-sm font-bold hover:bg-zinc-50">↻ Atualizar</button><button onClick={async()=>{await supabase.auth.signOut(); router.replace("/login")}} className="h-9 px-4 rounded-full bg-zinc-900 text-white text-sm font-bold">Sair</button></div>
        </header>

        <div className="p-6 lg:p-8">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl font-bold mb-6">{error}</div>}
          {success && <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-2xl font-bold mb-6">{success}</div>}

          {tab === "overview" && (
            <>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-white rounded-[20px] p-6 border border-zinc-200 shadow-sm"><p className="text-[11px] font-black uppercase text-zinc-400 tracking-widest">Lojas ativas</p><p className="text-4xl font-black mt-2">{financeSettings.length}</p><p className="text-xs font-bold text-green-600 mt-2">● Operando</p></div>
                <div className="bg-white rounded-[20px] p-6 border border-zinc-200 shadow-sm"><p className="text-[11px] font-black uppercase text-zinc-400 tracking-widest">Pendências</p><p className="text-4xl font-black mt-2">{restaurantApplications.length + driverApplications.length}</p><p className="text-xs font-bold text-red-600 mt-2">Precisa aprovar</p></div>
                <div className="bg-white rounded-[20px] p-6 border border-zinc-200 shadow-sm"><p className="text-[11px] font-black uppercase text-zinc-400 tracking-widest">Resgates na fila</p><p className="text-4xl font-black mt-2 text-red-600">{pendingW.length}</p><p className="text-xs font-bold text-zinc-500 mt-2">{money(pendingAmount)} pra analisar</p></div>
                <div className="bg-zinc-900 rounded-[20px] p-6 text-white shadow-sm"><p className="text-[11px] font-black uppercase text-zinc-400 tracking-widest">PIX pra enviar agora</p><p className="text-4xl font-black mt-2">{approvedW.length}</p><p className="text-xs font-bold text-yellow-400 mt-2">{money(approvedAmount)} aprovado</p></div>
              </div>

              <div className="grid lg:grid-cols-3 gap-6 mt-6">
                <div className="lg:col-span-2 bg-white rounded-[20px] border border-zinc-200 p-7"><h3 className="font-black text-[16px]">Fluxo de caixa da plataforma</h3><div className="mt-6 grid grid-cols-3 gap-4"><div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5"><p className="text-xs font-black uppercase text-yellow-700">Aguardando</p><p className="text-xl font-black mt-2 text-yellow-800">{money(pendingAmount)}</p></div><div className="bg-blue-50 border border-blue-200 rounded-2xl p-5"><p className="text-xs font-black uppercase text-blue-700">Aprovado</p><p className="text-xl font-black mt-2 text-blue-800">{money(approvedAmount)}</p></div><div className="bg-green-50 border border-green-200 rounded-2xl p-5"><p className="text-xs font-black uppercase text-green-700">Já pago</p><p className="text-xl font-black mt-2 text-green-800">{money(paidAmount)}</p></div></div>
                  <div className="mt-6 pt-6 border-t border-zinc-100 flex justify-between text-sm"><span className="text-zinc-500 font-medium">Comissão média configurada</span><strong className="font-black">{avgComm.toFixed(2)}%</strong></div>
                </div>
                <div className="bg-white rounded-[20px] border border-zinc-200 p-7"><h3 className="font-black">O que precisa de você agora</h3><div className="mt-5 space-y-3">
                  <button onClick={()=>setTab("restaurants")} className="w-full flex justify-between items-center p-4 rounded-xl bg-zinc-50 hover:bg-zinc-100 font-bold text-sm">🏪 Novas lojas <span className="bg-white border px-2.5 py-1 rounded-full text-xs">{restaurantApplications.length}</span></button>
                  <button onClick={()=>setTab("drivers")} className="w-full flex justify-between items-center p-4 rounded-xl bg-zinc-50 hover:bg-zinc-100 font-bold text-sm">🛵 Novos entregadores <span className="bg-white border px-2.5 py-1 rounded-full text-xs">{driverApplications.length}</span></button>
                  <button onClick={()=>{setTab("withdrawals"); setWithdrawalFilter("pending")}} className="w-full flex justify-between items-center p-4 rounded-xl bg-red-50 hover:bg-red-100 font-bold text-sm text-red-700">💸 Resgates pendentes <span className="bg-white border px-2.5 py-1 rounded-full text-xs">{pendingW.length}</span></button>
                  <button onClick={()=>{setTab("withdrawals"); setWithdrawalFilter("approved")}} className="w-full flex justify-between items-center p-4 rounded-xl bg-blue-50 hover:bg-blue-100 font-bold text-sm text-blue-700">✅ PIX pra enviar <span className="bg-white border px-2.5 py-1 rounded-full text-xs">{approvedW.length}</span></button>
                </div></div>
              </div>
            </>
          )}

          {tab === "restaurants" && (
            <div className="space-y-4">{restaurantApplications.length===0? <div className="bg-white rounded-[20px] p-16 text-center border"><p className="text-5xl">✅</p><p className="font-black mt-4">Nenhum restaurante pendente</p></div> : restaurantApplications.map(a=>(
              <div key={a.id} className="bg-white rounded-[20px] p-6 border flex flex-col lg:flex-row justify-between gap-6"><div><div className="flex items-center gap-3"><h2 className="text-xl font-black">{a.business_name}</h2><span className="bg-yellow-100 text-yellow-800 text-xs font-black px-3 py-1 rounded-full">PENDENTE</span></div><p className="text-sm font-bold text-red-600 mt-1">{a.category} • {a.phone}</p><p className="text-sm text-zinc-500 mt-3">{a.street}, {a.number} - {a.neighborhood} - {a.city}/{a.state}</p></div><div className="flex lg:flex-col gap-2"><button disabled={processingId===a.id} onClick={()=>approveRestaurant(a.id)} className="flex-1 lg:w-40 h-11 rounded-xl bg-green-600 text-white font-black">Aprovar</button><button disabled={processingId===a.id} onClick={()=>rejectRestaurant(a.id)} className="flex-1 lg:w-40 h-11 rounded-xl border-2 border-red-200 text-red-600 font-black">Recusar</button></div></div>
            ))}</div>
          )}

          {tab === "drivers" && (
            <div className="space-y-4">{driverApplications.length===0? <div className="bg-white rounded-[20px] p-16 text-center border"><p className="text-5xl">✅</p><p className="font-black mt-4">Nenhum entregador pendente</p></div> : driverApplications.map(a=>(
              <div key={a.id} className="bg-white rounded-[20px] p-6 border flex flex-col lg:flex-row justify-between gap-6"><div><h2 className="text-xl font-black">{a.full_name}</h2><p className="text-sm font-bold text-zinc-500 mt-1">{a.phone} • {a.vehicle_type} {a.plate? `• ${a.plate}`:""}</p></div><div className="flex lg:flex-col gap-2"><button disabled={processingId===a.id} onClick={()=>approveDriver(a.id)} className="flex-1 lg:w-40 h-11 rounded-xl bg-green-600 text-white font-black">Aprovar</button><button disabled={processingId===a.id} onClick={()=>rejectDriver(a.id)} className="flex-1 lg:w-40 h-11 rounded-xl border-2 border-red-200 text-red-600 font-black">Recusar</button></div></div>
            ))}</div>
          )}

          {tab === "withdrawals" && (
            <div><div className="flex gap-2 overflow-x-auto pb-2">{["pending","approved","paid","rejected","all"].map(v=><button key={v} onClick={()=>setWithdrawalFilter(v as any)} className={`px-5 h-10 rounded-full text-sm font-black whitespace-nowrap ${withdrawalFilter===v? "bg-zinc-900 text-white":"bg-white border"}`}>{v==="pending"?"Pendentes":v==="approved"?"Aprovados":v==="paid"?"Pagos":v==="rejected"?"Recusados":"Todos"}</button>)}</div>
              <div className="mt-6 space-y-4">{withdrawals.map(w=>(
                <div key={w.id} className="bg-white rounded-[20px] p-6 border"><div className="flex justify-between"><div><h3 className="font-black text-lg">{w.restaurant_name}</h3><p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">{w.request_type==="emergency"?"🚨 EMERGÊNCIA 24H":"NORMAL 72H"} • {dateTime(w.requested_at)}</p></div><div className="text-right"><p className="text-2xl font-black text-green-600">{money(w.amount)}</p><p className="text-xs font-bold text-zinc-500">{w.pix_key_type} - {w.pix_key}</p></div></div><div className="mt-4 flex gap-2">{w.status==="pending" && <><button disabled={processingId===w.id} onClick={()=>reviewWithdrawal(w.id,"approve")} className="h-10 px-5 rounded-xl bg-green-600 text-white font-black text-sm">Aprovar</button><button disabled={processingId===w.id} onClick={()=>reviewWithdrawal(w.id,"reject")} className="h-10 px-5 rounded-xl border-2 border-red-200 text-red-600 font-black text-sm">Recusar</button></>}{w.status==="approved" && <button disabled={processingId===w.id} onClick={()=>markPaid(w.id)} className="h-11 px-6 rounded-xl bg-blue-600 text-white font-black">✅ Já enviei o PIX - Marcar como pago</button>}</div></div>
              ))}</div>
            </div>
          )}

          {tab === "commissions" && (
            <div className="space-y-4">{financeSettings.map(item=>(
              <CommissionCard key={item.restaurant_id} item={item} processing={processingId===item.restaurant_id} onSave={updateCommission} />
            ))}</div>
          )}
        </div>
      </div>
    </main>
  );
}

function CommissionCard({ item, processing, onSave }: { item: RestaurantFinanceSetting; processing: boolean; onSave: (id: string, c: string, inc: boolean)=>Promise<void> }) {
  const [comm, setComm] = useState(String(item.commission_percent).replace(".", ","));
  const [inc, setInc] = useState(item.include_delivery_fee);
  return (
    <div className="bg-white rounded-[20px] p-6 border flex flex-col lg:flex-row justify-between lg:items-center gap-4">
      <div><p className="text-[11px] font-black tracking-widest text-red-600 uppercase">Restaurante</p><p className="font-black text-lg">{item.restaurant_name}</p></div>
      <div className="flex items-end gap-3"><div><p className="text-[11px] font-black uppercase text-zinc-400">Comissão %</p><input value={comm} onChange={e=>setComm(e.target.value)} className="mt-1 h-11 w-24 rounded-xl border-2 border-zinc-200 px-3 font-black" /></div><label className="h-11 flex items-center gap-2 px-4 rounded-xl border-2 border-zinc-200 font-bold text-sm"><input type="checkbox" checked={inc} onChange={e=>setInc(e.target.checked)} /> Sobre entrega</label><button disabled={processing} onClick={()=>onSave(item.restaurant_id, comm, inc)} className="h-11 px-6 rounded-xl bg-zinc-900 text-white font-black">{processing?"...":"Salvar"}</button></div>
    </div>
  );
}