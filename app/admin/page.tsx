"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type RestaurantApplication = {
  id: string;
  user_id: string;
  business_name: string;
  phone: string;
  category: string;
  description: string | null;
  street: string;
  number: string | null;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  status: string;
  created_at: string;
};

type DriverApplication = {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  vehicle_type: string;
  plate: string | null;
  status: string;
  created_at: string;
};

type WithdrawalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "paid";

type WithdrawalRequest = {
  id: string;
  restaurant_id: string;
  restaurant_name: string;
  amount: number | string;
  pix_key_type: string;
  pix_key: string;
  holder_name: string | null;
  status: WithdrawalStatus;
  requested_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
  paid_at: string | null;
  request_type: "standard" | "emergency";
  processing_hours: number;
  due_at: string | null;
};

type RestaurantFinanceSetting = {
  restaurant_id: string;
  restaurant_name: string;
  commission_percent: number | string;
  include_delivery_fee: boolean;
};

type AdminTab =
  | "overview"
  | "restaurants"
  | "drivers"
  | "withdrawals"
  | "commissions";

type WithdrawalFilter =
  | WithdrawalStatus
  | "all";

function money(value: number | string | null) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function dateTime(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function pixTypeName(type: string) {
  const labels: Record<string, string> = {
    cpf: "CPF",
    cnpj: "CNPJ",
    email: "E-mail",
    phone: "Telefone",
    random: "Chave aleatória",
  };

  return labels[type] || type;
}

function withdrawalStatusInfo(status: WithdrawalStatus) {
  if (status === "pending") {
    return {
      label: "Aguardando análise",
      className: "border-yellow-200 bg-yellow-50 text-yellow-700",
    };
  }

  if (status === "approved") {
    return {
      label: "Aprovado",
      className: "border-blue-200 bg-blue-50 text-blue-700",
    };
  }

  if (status === "paid") {
    return {
      label: "Pago",
      className: "border-green-200 bg-green-50 text-green-700",
    };
  }

  return {
    label: "Recusado",
    className: "border-red-200 bg-red-50 text-red-700",
  };
}

export default function AdminPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [processingId, setProcessingId] = useState("");

  const [restaurantApplications, setRestaurantApplications] =
    useState<RestaurantApplication[]>([]);

  const [driverApplications, setDriverApplications] =
    useState<DriverApplication[]>([]);

  const [withdrawals, setWithdrawals] =
    useState<WithdrawalRequest[]>([]);

  const [dashboardWithdrawals, setDashboardWithdrawals] =
    useState<WithdrawalRequest[]>([]);

  const [financeSettings, setFinanceSettings] =
    useState<RestaurantFinanceSetting[]>([]);

  const [tab, setTab] = useState<AdminTab>("overview");
  const [withdrawalFilter, setWithdrawalFilter] =
    useState<WithdrawalFilter>("pending");

  const loadApplications = useCallback(async () => {
    const [restaurantResult, driverResult] = await Promise.all([
      supabase
        .from("restaurant_applications")
        .select(`
          id,
          user_id,
          business_name,
          phone,
          category,
          description,
          street,
          number,
          complement,
          neighborhood,
          city,
          state,
          status,
          created_at
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: true }),

      supabase
        .from("driver_applications")
        .select(`
          id,
          user_id,
          full_name,
          phone,
          vehicle_type,
          plate,
          status,
          created_at
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: true }),
    ]);

    if (restaurantResult.error || driverResult.error) {
      console.error("Erro restaurantes:", restaurantResult.error);
      console.error("Erro entregadores:", driverResult.error);
      setError("Não foi possível carregar os cadastros.");
      return;
    }

    setRestaurantApplications(
      (restaurantResult.data ?? []) as RestaurantApplication[]
    );

    setDriverApplications(
      (driverResult.data ?? []) as DriverApplication[]
    );
  }, []);

  const loadWithdrawals = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc(
      "get_admin_withdrawal_requests_v2",
      {
        p_status: withdrawalFilter,
      }
    );

    if (rpcError) {
      console.error("Erro ao carregar resgates:", rpcError);
      setError("Não foi possível carregar os pedidos de resgate.");
      return;
    }

    setWithdrawals((data ?? []) as WithdrawalRequest[]);
  }, [withdrawalFilter]);


  const loadDashboardWithdrawals = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc(
      "get_admin_withdrawal_requests_v2",
      {
        p_status: "all",
      }
    );

    if (rpcError) {
      console.error("Erro ao carregar resumo de resgates:", rpcError);
      setError("Não foi possível carregar o resumo de resgates.");
      return;
    }

    setDashboardWithdrawals((data ?? []) as WithdrawalRequest[]);
  }, []);

  const loadFinanceSettings = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc(
      "get_admin_restaurant_finance_settings"
    );

    if (rpcError) {
      console.error("Erro ao carregar comissões:", rpcError);
      setError("Não foi possível carregar as comissões.");
      return;
    }

    setFinanceSettings((data ?? []) as RestaurantFinanceSetting[]);
  }, []);

  const loadAll = useCallback(async () => {
    setError("");

    await Promise.all([
      loadApplications(),
      loadWithdrawals(),
      loadDashboardWithdrawals(),
      loadFinanceSettings(),
    ]);
  }, [
    loadApplications,
    loadWithdrawals,
    loadDashboardWithdrawals,
    loadFinanceSettings,
  ]);

  useEffect(() => {
    async function loadAdmin() {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        sessionStorage.setItem("after-login", "/admin");
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();

      if (
        profileError ||
        !profile ||
        profile.role !== "admin"
      ) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      await loadAll();
      setLoading(false);
    }

    loadAdmin();
  }, [router, loadAll]);

  useEffect(() => {
    if (loading || accessDenied) return;

    const interval = window.setInterval(() => {
      if (tab === "overview") {
        loadApplications();
        loadDashboardWithdrawals();
        loadFinanceSettings();
      }

      if (tab === "restaurants" || tab === "drivers") {
        loadApplications();
      }

      if (tab === "withdrawals") {
        loadWithdrawals();
        loadDashboardWithdrawals();
      }
    }, 3000);

    return () => {
      window.clearInterval(interval);
    };
  }, [
    loading,
    accessDenied,
    tab,
    loadApplications,
    loadWithdrawals,
    loadDashboardWithdrawals,
    loadFinanceSettings,
  ]);

  async function approveRestaurant(applicationId: string) {
    const confirmed = window.confirm(
      "Deseja aprovar este restaurante?"
    );

    if (!confirmed) return;

    setProcessingId(applicationId);
    setError("");
    setSuccess("");

    const { error: rpcError } = await supabase.rpc(
      "approve_restaurant_application",
      {
        p_application_id: applicationId,
      }
    );

    if (rpcError) {
      console.error("Erro ao aprovar restaurante:", rpcError);
      setError("Não foi possível aprovar o restaurante.");
      setProcessingId("");
      return;
    }

    setSuccess("Restaurante aprovado com sucesso!");
    await loadApplications();
    await loadFinanceSettings();
    setProcessingId("");
  }

  async function rejectRestaurant(applicationId: string) {
    const reason = window.prompt("Informe o motivo da recusa:");

    if (reason === null) return;

    if (!reason.trim()) {
      alert("Informe um motivo para a recusa.");
      return;
    }

    setProcessingId(applicationId);
    setError("");
    setSuccess("");

    const { error: rpcError } = await supabase.rpc(
      "reject_restaurant_application",
      {
        p_application_id: applicationId,
        p_reason: reason.trim(),
      }
    );

    if (rpcError) {
      console.error("Erro ao recusar restaurante:", rpcError);
      setError("Não foi possível recusar o restaurante.");
      setProcessingId("");
      return;
    }

    setSuccess("Solicitação de restaurante recusada.");
    await loadApplications();
    setProcessingId("");
  }

  async function approveDriver(applicationId: string) {
    const confirmed = window.confirm(
      "Deseja aprovar este entregador?"
    );

    if (!confirmed) return;

    setProcessingId(applicationId);
    setError("");
    setSuccess("");

    const { error: rpcError } = await supabase.rpc(
      "approve_driver_application",
      {
        p_application_id: applicationId,
      }
    );

    if (rpcError) {
      console.error("Erro ao aprovar entregador:", rpcError);
      setError("Não foi possível aprovar o entregador.");
      setProcessingId("");
      return;
    }

    setSuccess("Entregador aprovado com sucesso!");
    await loadApplications();
    setProcessingId("");
  }

  async function rejectDriver(applicationId: string) {
    const reason = window.prompt("Informe o motivo da recusa:");

    if (reason === null) return;

    if (!reason.trim()) {
      alert("Informe um motivo para a recusa.");
      return;
    }

    setProcessingId(applicationId);
    setError("");
    setSuccess("");

    const { error: rpcError } = await supabase.rpc(
      "reject_driver_application",
      {
        p_application_id: applicationId,
        p_reason: reason.trim(),
      }
    );

    if (rpcError) {
      console.error("Erro ao recusar entregador:", rpcError);
      setError("Não foi possível recusar o entregador.");
      setProcessingId("");
      return;
    }

    setSuccess("Solicitação de entregador recusada.");
    await loadApplications();
    setProcessingId("");
  }

  async function reviewWithdrawal(
    requestId: string,
    action: "approve" | "reject"
  ) {
    let reason: string | null = null;

    if (action === "reject") {
      reason = window.prompt(
        "Informe o motivo da recusa do resgate:"
      );

      if (reason === null) return;

      if (reason.trim().length < 3) {
        alert("Informe um motivo para a recusa.");
        return;
      }
    } else {
      const confirmed = window.confirm(
        "Deseja aprovar este pedido de resgate?"
      );

      if (!confirmed) return;
    }

    setProcessingId(requestId);
    setError("");
    setSuccess("");

    const { error: rpcError } = await supabase.rpc(
      "admin_review_withdrawal_request",
      {
        p_request_id: requestId,
        p_action: action,
        p_rejection_reason: reason,
      }
    );

    if (rpcError) {
      console.error("Erro resgate:", rpcError);
      setError("Não foi possível atualizar este resgate.");
      setProcessingId("");
      return;
    }

    setSuccess(
      action === "approve"
        ? "Resgate aprovado. Agora faça o PIX e marque como pago."
        : "Resgate recusado."
    );

    await Promise.all([loadWithdrawals(), loadDashboardWithdrawals()]);
    setProcessingId("");
  }

  async function markWithdrawalPaid(requestId: string) {
    const confirmed = window.confirm(
      "Confirma que você JÁ ENVIOU o PIX para a loja?"
    );

    if (!confirmed) return;

    setProcessingId(requestId);
    setError("");
    setSuccess("");

    const { error: rpcError } = await supabase.rpc(
      "admin_mark_withdrawal_paid",
      {
        p_request_id: requestId,
      }
    );

    if (rpcError) {
      console.error("Erro marcar pago:", rpcError);
      setError("Não foi possível marcar este resgate como pago.");
      setProcessingId("");
      return;
    }

    setSuccess("Resgate marcado como pago.");
    await Promise.all([loadWithdrawals(), loadDashboardWithdrawals()]);
    setProcessingId("");
  }

  async function updateCommission(
    restaurantId: string,
    commission: string,
    includeDeliveryFee: boolean
  ) {
    const percentage = Number(
      commission.replace(",", ".")
    );

    if (
      !Number.isFinite(percentage) ||
      percentage < 0 ||
      percentage > 100
    ) {
      setError("A comissão precisa estar entre 0% e 100%.");
      return;
    }

    setProcessingId(restaurantId);
    setError("");
    setSuccess("");

    const { error: rpcError } = await supabase.rpc(
      "admin_update_restaurant_financial_settings",
      {
        p_restaurant_id: restaurantId,
        p_commission_percent: percentage,
        p_include_delivery_fee: includeDeliveryFee,
      }
    );

    if (rpcError) {
      console.error("Erro comissão:", rpcError);
      setError("Não foi possível alterar a comissão.");
      setProcessingId("");
      return;
    }

    setSuccess("Comissão atualizada com sucesso.");
    await loadFinanceSettings();
    setProcessingId("");
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7]">
        <p className="font-bold">Carregando painel...</p>
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7] px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
          <div className="text-6xl">🔒</div>

          <h1 className="mt-5 text-2xl font-black">
            Acesso negado
          </h1>

          <p className="mt-2 text-zinc-500">
            Somente administradores do Entrega Paudalho podem acessar esta área.
          </p>

          <Link
            href="/"
            className="mt-6 block rounded-xl bg-red-600 px-5 py-4 font-bold text-white"
          >
            Voltar ao início
          </Link>
        </div>
      </main>
    );
  }

  const pendingWithdrawals = dashboardWithdrawals.filter(
    (item) => item.status === "pending"
  ).length;

  const approvedWithdrawals = dashboardWithdrawals.filter(
    (item) => item.status === "approved"
  );

  const approvedWithdrawalAmount = approvedWithdrawals.reduce(
    (sum, item) => sum + Number(item.amount ?? 0),
    0
  );

  const pendingWithdrawalAmount = dashboardWithdrawals
    .filter((item) => item.status === "pending")
    .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);

  const paidWithdrawalAmount = dashboardWithdrawals
    .filter((item) => item.status === "paid")
    .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);

  const averageCommission = financeSettings.length
    ? financeSettings.reduce(
        (sum, item) => sum + Number(item.commission_percent ?? 0),
        0
      ) / financeSettings.length
    : 0;

  const totalPendingActions =
    restaurantApplications.length +
    driverApplications.length +
    pendingWithdrawals +
    approvedWithdrawals.length;

  return (
    <main className="min-h-screen bg-[#f7f7f7] text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <p className="font-black text-red-600">
              Entrega Paudalho
            </p>

            <p className="text-xs text-zinc-500">
              Painel administrativo
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-bold"
            >
              Ver início
            </Link>

            <button
              type="button"
              onClick={logout}
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-bold text-white"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-red-600">
              ADMINISTRAÇÃO
            </p>

            <h1 className="mt-1 text-3xl font-black">
              Painel administrativo
            </h1>

            <p className="mt-2 text-zinc-500">
              Gerencie cadastros, resgates e comissões da plataforma.
            </p>
          </div>

          <button
            type="button"
            onClick={loadAll}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-black shadow-sm"
          >
            ↻ Atualizar tudo
          </button>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <button
            type="button"
            onClick={() => setTab("restaurants")}
            className="rounded-3xl bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-sm font-bold text-zinc-500">🏪 Restaurantes aguardando</p>
            <p className="mt-2 text-4xl font-black">{restaurantApplications.length}</p>
            <p className="mt-2 text-xs font-bold text-red-600">Abrir análise →</p>
          </button>

          <button
            type="button"
            onClick={() => setTab("drivers")}
            className="rounded-3xl bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-sm font-bold text-zinc-500">🛵 Entregadores aguardando</p>
            <p className="mt-2 text-4xl font-black">{driverApplications.length}</p>
            <p className="mt-2 text-xs font-bold text-red-600">Abrir análise →</p>
          </button>

          <button
            type="button"
            onClick={() => {
              setTab("withdrawals");
              setWithdrawalFilter("pending");
            }}
            className="rounded-3xl bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-sm font-bold text-zinc-500">💸 Resgates aguardando</p>
            <p className="mt-2 text-4xl font-black text-red-600">{pendingWithdrawals}</p>
            <p className="mt-2 text-xs font-bold text-red-600">Abrir resgates →</p>
          </button>

          <div className="rounded-3xl bg-zinc-900 p-6 text-white shadow-sm">
            <p className="text-sm font-bold text-zinc-300">⚠️ Ações pendentes</p>
            <p className="mt-2 text-4xl font-black">{totalPendingActions}</p>
            <p className="mt-2 text-xs font-semibold text-zinc-400">Inclui cadastros e resgates a concluir.</p>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl bg-red-50 p-4 font-semibold text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-6 rounded-2xl bg-green-50 p-4 font-semibold text-green-700">
            {success}
          </div>
        )}

        <div className="mt-8 flex gap-2 overflow-x-auto border-b border-zinc-200">
          <button
            type="button"
            onClick={() => setTab("overview")}
            className={`whitespace-nowrap border-b-2 px-5 py-3 font-bold ${
              tab === "overview"
                ? "border-red-600 text-red-600"
                : "border-transparent text-zinc-500"
            }`}
          >
            📊 Visão geral
          </button>

          <button
            type="button"
            onClick={() => setTab("restaurants")}
            className={`whitespace-nowrap border-b-2 px-5 py-3 font-bold ${
              tab === "restaurants"
                ? "border-red-600 text-red-600"
                : "border-transparent text-zinc-500"
            }`}
          >
            🏪 Restaurantes ({restaurantApplications.length})
          </button>

          <button
            type="button"
            onClick={() => setTab("drivers")}
            className={`whitespace-nowrap border-b-2 px-5 py-3 font-bold ${
              tab === "drivers"
                ? "border-red-600 text-red-600"
                : "border-transparent text-zinc-500"
            }`}
          >
            🛵 Entregadores ({driverApplications.length})
          </button>

          <button
            type="button"
            onClick={() => {
              setTab("withdrawals");
              setWithdrawalFilter("pending");
            }}
            className={`whitespace-nowrap border-b-2 px-5 py-3 font-bold ${
              tab === "withdrawals"
                ? "border-red-600 text-red-600"
                : "border-transparent text-zinc-500"
            }`}
          >
            💸 Resgates
          </button>

          <button
            type="button"
            onClick={() => setTab("commissions")}
            className={`whitespace-nowrap border-b-2 px-5 py-3 font-bold ${
              tab === "commissions"
                ? "border-red-600 text-red-600"
                : "border-transparent text-zinc-500"
            }`}
          >
            % Comissões
          </button>
        </div>

        {tab === "overview" && (
          <div className="mt-6 space-y-6">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <p className="text-xs font-black uppercase text-zinc-400">Plataforma</p>
                <h2 className="mt-2 text-xl font-black">Operação geral</h2>
                <div className="mt-5 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-zinc-500">Lojas cadastradas</span>
                    <strong>{financeSettings.length}</strong>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-zinc-500">Comissão média configurada</span>
                    <strong>{averageCommission.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</strong>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-zinc-500">Ações pendentes</span>
                    <strong className={totalPendingActions > 0 ? "text-red-600" : "text-green-600"}>
                      {totalPendingActions}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <p className="text-xs font-black uppercase text-zinc-400">Resgates</p>
                <h2 className="mt-2 text-xl font-black">Dinheiro para processar</h2>
                <div className="mt-5 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-zinc-500">Aguardando análise</span>
                    <strong className="text-yellow-700">{money(pendingWithdrawalAmount)}</strong>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-zinc-500">Aprovado aguardando PIX</span>
                    <strong className="text-blue-700">{money(approvedWithdrawalAmount)}</strong>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-zinc-100 pt-3">
                    <span className="text-zinc-500">Total já marcado como pago</span>
                    <strong className="text-green-700">{money(paidWithdrawalAmount)}</strong>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <p className="text-xs font-black uppercase text-zinc-400">Fila de análise</p>
                <h2 className="mt-2 text-xl font-black">O que precisa de você</h2>
                <div className="mt-5 space-y-3">
                  <button
                    type="button"
                    onClick={() => setTab("restaurants")}
                    className="flex w-full items-center justify-between rounded-2xl bg-zinc-50 px-4 py-3 text-left text-sm font-bold hover:bg-zinc-100"
                  >
                    <span>🏪 Novas lojas</span>
                    <span>{restaurantApplications.length}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("drivers")}
                    className="flex w-full items-center justify-between rounded-2xl bg-zinc-50 px-4 py-3 text-left text-sm font-bold hover:bg-zinc-100"
                  >
                    <span>🛵 Novos entregadores</span>
                    <span>{driverApplications.length}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTab("withdrawals"); setWithdrawalFilter("pending"); }}
                    className="flex w-full items-center justify-between rounded-2xl bg-zinc-50 px-4 py-3 text-left text-sm font-bold hover:bg-zinc-100"
                  >
                    <span>💸 Resgates para analisar</span>
                    <span>{pendingWithdrawals}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTab("withdrawals"); setWithdrawalFilter("approved"); }}
                    className="flex w-full items-center justify-between rounded-2xl bg-blue-50 px-4 py-3 text-left text-sm font-bold text-blue-800 hover:bg-blue-100"
                  >
                    <span>✅ PIX aprovados para enviar</span>
                    <span>{approvedWithdrawals.length}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase text-red-600">Atalhos</p>
                  <h2 className="mt-1 text-xl font-black">Administração rápida</h2>
                </div>
                <p className="text-sm text-zinc-500">Use os atalhos sem sair da visão geral.</p>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <button type="button" onClick={() => setTab("restaurants")} className="rounded-2xl border border-zinc-200 p-4 text-left font-black hover:bg-zinc-50">🏪 Analisar restaurantes</button>
                <button type="button" onClick={() => setTab("drivers")} className="rounded-2xl border border-zinc-200 p-4 text-left font-black hover:bg-zinc-50">🛵 Analisar entregadores</button>
                <button type="button" onClick={() => { setTab("withdrawals"); setWithdrawalFilter("pending"); }} className="rounded-2xl border border-zinc-200 p-4 text-left font-black hover:bg-zinc-50">💸 Processar resgates</button>
                <button type="button" onClick={() => setTab("commissions")} className="rounded-2xl border border-zinc-200 p-4 text-left font-black hover:bg-zinc-50">% Ajustar comissões</button>
              </div>
            </div>
          </div>
        )}

        {tab === "restaurants" && (
          <div className="mt-6 space-y-4">
            {restaurantApplications.length === 0 && (
              <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
                <div className="text-5xl">✅</div>
                <h2 className="mt-4 text-xl font-black">Tudo certo</h2>
                <p className="mt-2 text-zinc-500">
                  Nenhum restaurante aguardando aprovação.
                </p>
              </div>
            )}

            {restaurantApplications.map((application) => (
              <div
                key={application.id}
                className="rounded-3xl bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col justify-between gap-5 md:flex-row">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-black">
                        {application.business_name}
                      </h2>
                      <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-800">
                        Aguardando
                      </span>
                    </div>

                    <p className="mt-1 text-sm font-semibold text-red-600">
                      {application.category}
                    </p>

                    {application.description && (
                      <p className="mt-3 max-w-2xl text-sm text-zinc-500">
                        {application.description}
                      </p>
                    )}

                    <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-bold text-zinc-400">
                          TELEFONE
                        </p>
                        <p className="font-semibold">
                          {application.phone}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-bold text-zinc-400">
                          ENDEREÇO
                        </p>
                        <p className="font-semibold">
                          {application.street}
                          {application.number
                            ? `, ${application.number}`
                            : ""}
                        </p>
                        <p className="text-zinc-500">
                          {application.neighborhood} • {application.city} - {application.state}
                        </p>
                        {application.complement && (
                          <p className="text-zinc-500">
                            {application.complement}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col gap-2 md:w-44">
                    <button
                      type="button"
                      disabled={processingId === application.id}
                      onClick={() => approveRestaurant(application.id)}
                      className="rounded-xl bg-green-600 px-5 py-3 font-bold text-white disabled:bg-zinc-300"
                    >
                      {processingId === application.id
                        ? "Processando..."
                        : "✓ Aprovar"}
                    </button>

                    <button
                      type="button"
                      disabled={processingId === application.id}
                      onClick={() => rejectRestaurant(application.id)}
                      className="rounded-xl border border-red-200 px-5 py-3 font-bold text-red-600 disabled:text-zinc-300"
                    >
                      Recusar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "drivers" && (
          <div className="mt-6 space-y-4">
            {driverApplications.length === 0 && (
              <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
                <div className="text-5xl">✅</div>
                <h2 className="mt-4 text-xl font-black">Tudo certo</h2>
                <p className="mt-2 text-zinc-500">
                  Nenhum entregador aguardando aprovação.
                </p>
              </div>
            )}

            {driverApplications.map((application) => (
              <div
                key={application.id}
                className="rounded-3xl bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col justify-between gap-5 md:flex-row">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-black">
                        {application.full_name}
                      </h2>
                      <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-800">
                        Aguardando
                      </span>
                    </div>

                    <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
                      <div>
                        <p className="text-xs font-bold text-zinc-400">TELEFONE</p>
                        <p className="font-semibold">{application.phone}</p>
                      </div>

                      <div>
                        <p className="text-xs font-bold text-zinc-400">VEÍCULO</p>
                        <p className="font-semibold">
                          {application.vehicle_type === "Moto" ? "🏍️ " : "🚲 "}
                          {application.vehicle_type}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-bold text-zinc-400">PLACA</p>
                        <p className="font-semibold">
                          {application.plate ?? "Não possui"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col gap-2 md:w-44">
                    <button
                      type="button"
                      disabled={processingId === application.id}
                      onClick={() => approveDriver(application.id)}
                      className="rounded-xl bg-green-600 px-5 py-3 font-bold text-white disabled:bg-zinc-300"
                    >
                      {processingId === application.id
                        ? "Processando..."
                        : "✓ Aprovar"}
                    </button>

                    <button
                      type="button"
                      disabled={processingId === application.id}
                      onClick={() => rejectDriver(application.id)}
                      className="rounded-xl border border-red-200 px-5 py-3 font-bold text-red-600 disabled:text-zinc-300"
                    >
                      Recusar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "withdrawals" && (
          <div className="mt-6">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  "pending",
                  "approved",
                  "paid",
                  "rejected",
                  "all",
                ] as WithdrawalFilter[]
              ).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setWithdrawalFilter(value)}
                  className={`rounded-xl px-4 py-2.5 text-sm font-black ${
                    withdrawalFilter === value
                      ? "bg-zinc-900 text-white"
                      : "bg-white text-zinc-600 shadow-sm"
                  }`}
                >
                  {value === "pending"
                    ? "Pendentes"
                    : value === "approved"
                      ? "Aprovados"
                      : value === "paid"
                        ? "Pagos"
                        : value === "rejected"
                          ? "Recusados"
                          : "Todos"}
                </button>
              ))}
            </div>

            {withdrawals.length === 0 ? (
              <div className="mt-5 rounded-3xl bg-white p-10 text-center shadow-sm">
                <div className="text-5xl">💸</div>
                <h2 className="mt-4 text-xl font-black">Nenhum resgate</h2>
                <p className="mt-2 text-zinc-500">
                  Não existe solicitação nesta situação.
                </p>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {withdrawals.map((withdrawal) => {
                  const status = withdrawalStatusInfo(withdrawal.status);

                  return (
                    <div
                      key={withdrawal.id}
                      className="rounded-3xl bg-white p-6 shadow-sm"
                    >
                      <div className="flex flex-col justify-between gap-5 lg:flex-row">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-xl font-black">
                              {withdrawal.restaurant_name}
                            </h2>
                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-black ${status.className}`}
                            >
                              {status.label}
                            </span>

                            {withdrawal.request_type === "emergency" ? (
                              <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-black text-orange-700">
                                🚨 EMERGÊNCIA • 24H
                              </span>
                            ) : (
                              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-black text-zinc-600">
                                NORMAL • 72H
                              </span>
                            )}
                          </div>

                          <p className="mt-1 text-sm text-zinc-400">
                            Solicitado em {dateTime(withdrawal.requested_at)}
                          </p>

                          {withdrawal.status !== "paid" && withdrawal.status !== "rejected" && (
                            <p
                              className={`mt-1 text-sm font-bold ${
                                withdrawal.request_type === "emergency"
                                  ? "text-orange-600"
                                  : "text-zinc-500"
                              }`}
                            >
                              {withdrawal.request_type === "emergency"
                                ? "🚨 Prazo de emergência"
                                : "⏱️ Prazo normal"}
                              {withdrawal.due_at
                                ? `: até ${dateTime(withdrawal.due_at)}`
                                : `: até ${withdrawal.processing_hours} horas`}
                            </p>
                          )}

                          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="rounded-2xl bg-zinc-50 p-4">
                              <p className="text-xs font-black uppercase text-zinc-400">Valor</p>
                              <p className="mt-1 text-2xl font-black text-green-600">
                                {money(withdrawal.amount)}
                              </p>
                            </div>

                            <div className="rounded-2xl bg-zinc-50 p-4">
                              <p className="text-xs font-black uppercase text-zinc-400">Tipo PIX</p>
                              <p className="mt-1 font-black">
                                {pixTypeName(withdrawal.pix_key_type)}
                              </p>
                            </div>

                            <div className="rounded-2xl bg-zinc-50 p-4 sm:col-span-2">
                              <p className="text-xs font-black uppercase text-zinc-400">Chave PIX</p>
                              <p className="mt-1 break-all font-black">
                                {withdrawal.pix_key}
                              </p>
                              {withdrawal.holder_name && (
                                <p className="mt-1 text-xs text-zinc-500">
                                  Titular: {withdrawal.holder_name}
                                </p>
                              )}
                            </div>
                          </div>

                          {withdrawal.rejection_reason && (
                            <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">
                              Motivo da recusa: {withdrawal.rejection_reason}
                            </div>
                          )}

                          {withdrawal.status === "paid" && (
                            <p className="mt-4 text-sm font-bold text-green-600">
                              ✅ Pago em {dateTime(withdrawal.paid_at)}
                            </p>
                          )}
                        </div>

                        <div className="flex shrink-0 flex-col gap-2 lg:w-52">
                          {withdrawal.status === "pending" && (
                            <>
                              <button
                                type="button"
                                disabled={processingId === withdrawal.id}
                                onClick={() =>
                                  reviewWithdrawal(withdrawal.id, "approve")
                                }
                                className="rounded-xl bg-green-600 px-5 py-3 font-bold text-white disabled:bg-zinc-300"
                              >
                                ✓ Aprovar resgate
                              </button>

                              <button
                                type="button"
                                disabled={processingId === withdrawal.id}
                                onClick={() =>
                                  reviewWithdrawal(withdrawal.id, "reject")
                                }
                                className="rounded-xl border border-red-200 px-5 py-3 font-bold text-red-600 disabled:text-zinc-300"
                              >
                                Recusar
                              </button>
                            </>
                          )}

                          {withdrawal.status === "approved" && (
                            <>
                              <div
                                className={`rounded-xl border p-3 text-xs font-semibold leading-5 ${
                                  withdrawal.request_type === "emergency"
                                    ? "border-orange-200 bg-orange-50 text-orange-700"
                                    : "border-blue-200 bg-blue-50 text-blue-700"
                                }`}
                              >
                                {withdrawal.request_type === "emergency" ? (
                                  <>
                                    🚨 Resgate de emergência. Priorize este PIX para cumprir o prazo de até 24 horas.
                                  </>
                                ) : (
                                  <>
                                    Faça o PIX pela sua conta bancária para a chave mostrada.
                                  </>
                                )}
                              </div>

                              <button
                                type="button"
                                disabled={processingId === withdrawal.id}
                                onClick={() => markWithdrawalPaid(withdrawal.id)}
                                className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white disabled:bg-zinc-300"
                              >
                                ✅ Marcar como pago
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "commissions" && (
          <div className="mt-6">
            <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm font-semibold leading-6 text-yellow-800">
              A comissão definida aqui é usada quando um pedido pago é concluído e vira saldo disponível para a loja. Pedidos já liquidados continuam com a comissão antiga.
            </div>

            {financeSettings.length === 0 ? (
              <div className="mt-5 rounded-3xl bg-white p-10 text-center shadow-sm">
                <p className="font-black">Nenhuma loja encontrada.</p>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {financeSettings.map((item) => (
                  <CommissionCard
                    key={item.restaurant_id}
                    item={item}
                    processing={processingId === item.restaurant_id}
                    onSave={updateCommission}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function CommissionCard({
  item,
  processing,
  onSave,
}: {
  item: RestaurantFinanceSetting;
  processing: boolean;
  onSave: (
    restaurantId: string,
    commission: string,
    includeDeliveryFee: boolean
  ) => Promise<void>;
}) {
  const [commission, setCommission] = useState(
    String(item.commission_percent).replace(".", ",")
  );

  const [includeDeliveryFee, setIncludeDeliveryFee] = useState(
    item.include_delivery_fee
  );

  useEffect(() => {
    setCommission(
      String(item.commission_percent).replace(".", ",")
    );
    setIncludeDeliveryFee(item.include_delivery_fee);
  }, [item.commission_percent, item.include_delivery_fee]);

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <p className="text-xs font-black uppercase text-red-600">
            RESTAURANTE
          </p>
          <h2 className="mt-1 text-xl font-black">
            {item.restaurant_name}
          </h2>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label>
            <span className="block text-xs font-black uppercase text-zinc-400">
              Comissão %
            </span>
            <input
              value={commission}
              onChange={(event) => setCommission(event.target.value)}
              className="mt-1 h-11 w-28 rounded-xl border border-zinc-200 px-3 font-black outline-none focus:border-zinc-400"
              placeholder="10"
            />
          </label>

          <label className="flex h-11 items-center gap-2 rounded-xl border border-zinc-200 px-4">
            <input
              type="checkbox"
              checked={includeDeliveryFee}
              onChange={(event) =>
                setIncludeDeliveryFee(event.target.checked)
              }
            />
            <span className="text-sm font-bold">
              Cobrar também sobre entrega
            </span>
          </label>

          <button
            type="button"
            disabled={processing}
            onClick={() =>
              onSave(
                item.restaurant_id,
                commission,
                includeDeliveryFee
              )
            }
            className="h-11 rounded-xl bg-zinc-900 px-6 font-black text-white disabled:bg-zinc-300"
          >
            {processing ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
