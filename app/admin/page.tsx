"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type RestaurantApplication = { id: string; business_name: string; phone: string; category: string; street: string; number: string | null; neighborhood: string; city: string; state: string; };
type DriverApplication = { id: string; full_name: string; phone: string; vehicle_type: string; plate: string | null; };
type WithdrawalRequest = { id: string; restaurant_name: string; amount: any; pix_key_type: string; pix_key: string; status: any; requested_at: string; request_type: string; };
type RestaurantFinanceSetting = { restaurant_id: string; restaurant_name: string; commission_percent: any; include_delivery_fee: boolean; };

function money(v: any) { return Number(v?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function dateTime(v: string | null) { if (!v) return "—"; return new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); }

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [restaurantApplications, setRestaurantApplications] = useState<RestaurantApplication[]>([]);
  const [driverApplications, setDriverApplications] = useState<DriverApplication[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [dashboardWithdrawals, setDashboardWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [financeSettings, setFinanceSettings] = useState<RestaurantFinanceSetting[]>([]);
  const [tab, setTab] = useState("overview");
  const [withdrawalFilter, setWithdrawalFilter] = useState("pending");
  const [processingId, setProcessingId] = useState("");

  const loadAll = useCallback(async () => {
    const [r, d] = await Promise.all([
      supabase.from("restaurant_applications").select("*").eq("status", "pending"),
      supabase.from("driver_applications").select("*").eq("status", "pending"),
    ]);
    if (r.data) setRestaurantApplications(r.data as any);
    if (d.data) setDriverApplications(d.data as any);
    const { data: w1 } = await supabase.rpc("get_admin_withdrawal_requests_v2", { p_status: withdrawalFilter });
    const { data: w2 } = await supabase.rpc("get_admin_withdrawal_requests_v2", { p_status: "all" });
    const { data: f } = await supabase.rpc("get_admin_restaurant_finance_settings");
    if (w1) setWithdrawals(w1 as any); if (w2) setDashboardWithdrawals(w2 as any); if (f) setFinanceSettings(f as any);
  }, [withdrawalFilter]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/admin/login"); return; } // CORRIGIDO: agora vai pro login de admin
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
      if (!profile || profile.role!== "admin") { setAccessDenied(true); setLoading(false); return; }
      await loadAll(); setLoading(false);
    })();
  }, [router, loadAll]);

  useEffect(()=>{ loadAll(); }, [withdrawalFilter, loadAll]);

  if (loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center font-black text-xl">Carregando...</div>;

  const pendingW = dashboardWithdrawals.filter(x => x.status === "pending");
  const approvedW = dashboardWithdrawals.filter(x => x.status === "approved");
  const paidAmount = dashboardWithdrawals.filter(x => x.status === "paid").reduce((s, i) => s + Number(i.amount), 0);

  return (
    <main className="min-h-screen bg-[#F5F5F7] flex">
      {/* SIDEBAR PRETA PROFISSIONAL */}
      <aside className="w-[300px] bg-[#111111] text-white flex flex-col fixed h-screen p-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-white rounded-[12px] flex items-center justify-center text-black font-black text-[20px]">P</div>
          <div><p className="font-black text-[15px] tracking-wide leading-none">ENTREGA PAUDALHO</p><p className="text-[11px] font-bold text-zinc-400 tracking-[0.2em] mt-1">ADMIN PANEL</p></div>
        </div>

        <nav className="mt-10 space-y-2">
          <button onClick={()=>setTab("overview")} className={`w-full h-[48px] rounded-[12px] px-4 text-left font-black text-[14px] ${tab==="overview"? "bg-white text-black" : "bg-white/5 text-zinc-300 hover:bg-white/10"}`}>📊 Visão Geral</button>
          <button onClick={()=>setTab("restaurants")} className={`w-full h-[48px] rounded-[12px] px-4 text-left font-black text-[14px] flex justify-between items-center ${tab==="restaurants"? "bg-white text-black" : "bg-white/5 text-zinc-300"}`}>🏪 Restaurantes <span className="bg-red-600 text-white text-xs px-2.5 py-1 rounded-full">{restaurantApplications.length}</span></button>
          <button onClick={()=>setTab("drivers")} className={`w-full h-[48px] rounded-[12px] px-4 text-left font-black text-[14px] flex justify-between items-center ${tab==="drivers"? "bg-white text-black" : "bg-white/5 text-zinc-300"}`}>🛵 Entregadores <span className="bg-red-600 text-white text-xs px-2.5 py-1 rounded-full">{driverApplications.length}</span></button>
          <button onClick={()=>setTab("withdrawals")} className={`w-full h-[48px] rounded-[12px] px-4 text-left font-black text-[14px] flex justify-between items-center ${tab==="withdrawals"? "bg-white text-black" : "bg-white/5 text-zinc-300"}`}>💸 Resgates <span className="bg-yellow-400 text-black text-xs px-2.5 py-1 rounded-full">{pendingW.length + approvedW.length}</span></button>
          <button onClick={()=>setTab("commissions")} className={`w-full h-[48px] rounded-[12px] px-4 text-left font-black text-[14px] ${tab==="commissions"? "bg-white text-black" : "bg-white/5 text-zinc-300"}`}>% Comissões</button>
        </nav>

        <div className="mt-auto bg-[#1C1C1C] border border-white/10 rounded-[16px] p-5">
          <p className="text-[10px] font-black tracking-widest text-zinc-400 uppercase">Faturamento já pago</p>
          <p className="text-[24px] font-black text-white mt-1">{money(paidAmount)}</p>
        </div>
      </aside>

      {/* CONTEÚDO COM CONTRASTE ALTO */}
      <div className="flex-1 ml-[300px]">
        <header className="h-[72px] bg-white border-b-2 border-zinc-900 flex items-center justify-between px-8 sticky top-0 z-10">
          <div><p className="text-[12px] font-black tracking-[0.2em] text-red-600 uppercase">ADMINISTRAÇÃO</p><h1 className="text-[22px] font-black text-zinc-900 tracking-tight">Painel Administrativo</h1></div>
          <div className="flex gap-3">
            <button onClick={loadAll} className="h-11 px-6 rounded-full border-2 border-zinc-900 bg-white text-zinc-900 font-black text-sm">Atualizar</button>
            <button onClick={async()=>{ await supabase.auth.signOut(); router.replace("/admin/login"); }} className="h-11 px-6 rounded-full bg-zinc-900 text-white font-black text-sm">Sair → Admin Login</button>
          </div>
        </header>

        <div className="p-8">
          {tab==="overview" && (
            <>
              <div className="grid grid-cols-4 gap-5">
                <div className="bg-white border-2 border-zinc-900 rounded-[20px] p-6 shadow-[4px_4px_0px_0px_#111]"><p className="text-[11px] font-black uppercase tracking-widest text-zinc-500">Lojas Ativas</p><p className="text-[42px] font-black text-zinc-900 leading-none mt-3">{financeSettings.length}</p><p className="mt-3 text-[13px] font-black text-green-600">● Operando agora</p></div>
                <div className="bg-white border-2 border-zinc-900 rounded-[20px] p-6 shadow-[4px_4px_0px_0px_#111]"><p className="text-[11px] font-black uppercase tracking-widest text-zinc-500">Pendências</p><p className="text-[42px] font-black text-zinc-900 leading-none mt-3">{restaurantApplications.length + driverApplications.length}</p><p className="mt-3 text-[13px] font-black text-red-600">Precisa aprovar</p></div>
                <div className="bg-white border-2 border-zinc-900 rounded-[20px] p-6 shadow-[4px_4px_0px_0px_#111]"><p className="text-[11px] font-black uppercase tracking-widest text-zinc-500">Resgates na fila</p><p className="text-[42px] font-black text-red-600 leading-none mt-3">{pendingW.length}</p><p className="mt-3 text-[13px] font-black text-zinc-900">{money(pendingW.reduce((s,i)=>s+Number(i.amount),0))} pra analisar</p></div>
                <div className="bg-zinc-900 border-2 border-zinc-900 rounded-[20px] p-6 shadow-[4px_4px_0px_0px_#111]"><p className="text-[11px] font-black uppercase tracking-widest text-zinc-400">PIX PRA ENVIAR</p><p className="text-[42px] font-black text-white leading-none mt-3">{approvedW.length}</p><p className="mt-3 text-[13px] font-black text-yellow-400">{money(approvedW.reduce((s,i)=>s+Number(i.amount),0))} aprovado</p></div>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-5">
                <div className="col-span-2 bg-white border-2 border-zinc-900 rounded-[20px] p-8">
                  <h2 className="text-[18px] font-black text-zinc-900">Fluxo de caixa da plataforma</h2>
                  <div className="mt-6 grid grid-cols-3 gap-4">
                    <div className="bg-[#FFF8E1] border-2 border-zinc-900 rounded-[16px] p-5"><p className="text-[11px] font-black uppercase">Aguardando</p><p className="text-[20px] font-black mt-2">{money(pendingW.reduce((s,i)=>s+Number(i.amount),0))}</p></div>
                    <div className="bg-[#E3F2FD] border-2 border-zinc-900 rounded-[16px] p-5"><p className="text-[11px] font-black uppercase">Aprovado</p><p className="text-[20px] font-black mt-2">{money(approvedW.reduce((s,i)=>s+Number(i.amount),0))}</p></div>
                    <div className="bg-[#E8F5E9] border-2 border-zinc-900 rounded-[16px] p-5"><p className="text-[11px] font-black uppercase">Já pago</p><p className="text-[20px] font-black mt-2">{money(paidAmount)}</p></div>
                  </div>
                </div>
                <div className="bg-white border-2 border-zinc-900 rounded-[20px] p-8">
                  <h2 className="text-[18px] font-black text-zinc-900">Ação necessária</h2>
                  <div className="mt-5 space-y-3">
                    <button onClick={()=>setTab("restaurants")} className="w-full h-14 rounded-xl border-2 border-zinc-900 bg-white font-black text-left px-4 flex justify-between items-center hover:bg-zinc-50">🏪 Novas lojas <span className="bg-zinc-900 text-white px-3 py-1 rounded-full text-sm">{restaurantApplications.length}</span></button>
                    <button onClick={()=>setTab("withdrawals")} className="w-full h-14 rounded-xl border-2 border-red-600 bg-red-50 font-black text-left px-4 flex justify-between items-center text-red-700">💸 Resgates <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm">{pendingW.length}</span></button>
                  </div>
                </div>
              </div>
            </>
          )}

          {tab==="restaurants" && <div className="space-y-4">{restaurantApplications.map(a=><div key={a.id} className="bg-white border-2 border-zinc-900 rounded-[20px] p-6 flex justify-between items-center"><div><p className="font-black text-xl text-zinc-900">{a.business_name}</p><p className="font-bold text-sm text-zinc-600">{a.category} • {a.phone}</p></div><button onClick={async()=>{ setProcessingId(a.id); await supabase.rpc("approve_restaurant_application", { p_application_id: a.id }); await loadAll(); setProcessingId(""); }} className="h-12 px-8 rounded-full bg-green-600 text-white font-black">Aprovar</button></div>)}</div>}
          {tab==="withdrawals" && <div className="space-y-4">{withdrawals.map(w=><div key={w.id} className="bg-white border-2 border-zinc-900 rounded-[20px] p-6"><div className="flex justify-between"><p className="font-black text-lg text-zinc-900">{w.restaurant_name}</p><p className="font-black text-xl text-green-600">{money(w.amount)}</p></div><p className="text-sm font-bold text-zinc-700 mt-1">{w.pix_key_type}: {w.pix_key}</p><p className="text-xs font-bold text-zinc-500 mt-1">{dateTime(w.requested_at)}</p></div>)}</div>}
        </div>
      </div>
    </main>
  );
}