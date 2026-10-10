"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useSearchParams } from "next/navigation";

import { supabase } from "@/lib/supabase";

type FinanceOrder = {
  order_id: string;
  restaurant_id: string;
  status: string;
  fulfillment_method: "delivery" | "pickup";
  payment_method: string | null;
  payment_status: string | null;
  subtotal: number | string;
  delivery_fee: number | string;
  total: number | string;
  created_at: string;
};

type WalletSummary = {
  receivable_balance: number | string;
  available_balance: number | string;
  in_withdrawal_balance: number | string;
  withdrawn_balance: number | string;
  total_net_settled: number | string;
};

type PayoutPixAccount = {
  id: string;
  pix_key_type: string;
  pix_key: string;
  holder_name: string | null;
  is_primary: boolean;
};

type WithdrawalRequest = {
  id: string;
  amount: number | string;
  pix_key_type: string;
  pix_key: string;
  holder_name: string | null;
  status: "pending" | "approved" | "rejected" | "paid";
  requested_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
  paid_at: string | null;
  request_type: "standard" | "emergency";
  processing_hours: number;
  due_at: string | null;
};

type Period = "today" | "7days" | "30days" | "all";

function money(value: number | string | null | undefined) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function dateTime(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function periodName(period: Period) {
  if (period === "today") return "Hoje";
  if (period === "7days") return "Últimos 7 dias";
  if (period === "30days") return "Últimos 30 dias";
  return "Todo o período";
}

function paymentName(value: string | null) {
  if (value === "pix") return "PIX";
  if (value === "card") return "Cartão";
  return value || "Não informado";
}

function withdrawalStatus(status: WithdrawalRequest["status"]) {
  if (status === "pending") {
    return {
      label: "Aguardando análise",
      className: "bg-amber-50 text-amber-700 border-amber-200",
    };
  }

  if (status === "approved") {
    return {
      label: "Aprovado",
      className: "bg-blue-50 text-blue-700 border-blue-200",
    };
  }

  if (status === "paid") {
    return {
      label: "Pago",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  }

  return {
    label: "Recusado",
    className: "bg-red-50 text-red-700 border-red-200",
  };
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

export default function FinanceiroSection() {
  const searchParams = useSearchParams();
  const restaurantId = searchParams.get("restaurant") ?? "";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [period, setPeriod] = useState<Period>("today");
  const [orders, setOrders] = useState<FinanceOrder[]>([]);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [payoutPixAccounts, setPayoutPixAccounts] = useState<PayoutPixAccount[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);

  const [showPixForm, setShowPixForm] = useState(false);
  const [pixKeyType, setPixKeyType] = useState("cpf");
  const [pixKey, setPixKey] = useState("");
  const [holderName, setHolderName] = useState("");
  const [editingPixAccountId, setEditingPixAccountId] = useState("");

  const [showWithdrawalForm, setShowWithdrawalForm] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [selectedPixAccountId, setSelectedPixAccountId] = useState("");
  const [withdrawalType, setWithdrawalType] = useState<"standard" | "emergency">("standard");

  const loadFinance = useCallback(
    async (firstLoad = false) => {
      if (firstLoad) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError("");

      if (!restaurantId) {
        setError("Loja não informada.");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const [ordersResult, walletResult, pixResult, withdrawalsResult] =
        await Promise.all([
          supabase.rpc("get_my_restaurant_orders"),
          supabase.rpc("get_my_restaurant_wallet", {
            p_restaurant_id: restaurantId,
          }),
          supabase.rpc("get_my_payout_pix_accounts", {
            p_restaurant_id: restaurantId,
          }),
          supabase.rpc("get_my_withdrawal_requests_v2", {
            p_restaurant_id: restaurantId,
          }),
        ]);

      if (ordersResult.error) {
        console.error("Erro pedidos:", ordersResult.error);
        setError("Não foi possível carregar o financeiro.");
      } else {
        const storeOrders = ((ordersResult.data ?? []).filter(
          (order: { restaurant_id?: string }) => order.restaurant_id === restaurantId
        ) ?? []) as FinanceOrder[];

        setOrders(storeOrders);
      }

      if (walletResult.error) {
        console.error("Erro carteira:", walletResult.error);
        setError("Não foi possível carregar o saldo da loja.");
      } else {
        const summary =
          Array.isArray(walletResult.data) && walletResult.data.length > 0
            ? (walletResult.data[0] as WalletSummary)
            : null;

        setWallet(summary);
      }

      if (pixResult.error) {
        console.error("Erro PIX:", pixResult.error);
      } else {
        const accounts = (pixResult.data ?? []) as PayoutPixAccount[];
        setPayoutPixAccounts(accounts);
        setSelectedPixAccountId((current) => {
          if (current && accounts.some((account) => account.id === current)) {
            return current;
          }

          const primary = accounts.find((account) => account.is_primary);
          return primary?.id ?? accounts[0]?.id ?? "";
        });
      }

      if (withdrawalsResult.error) {
        console.error("Erro resgates:", withdrawalsResult.error);
      } else {
        setWithdrawals((withdrawalsResult.data ?? []) as WithdrawalRequest[]);
      }

      setLoading(false);
      setRefreshing(false);
    },
    [restaurantId]
  );

  useEffect(() => {
    loadFinance(true);
  }, [loadFinance]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      loadFinance(false);
    }, 15000);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadFinance]);

  function resetPixForm() {
    setPixKeyType("cpf");
    setPixKey("");
    setHolderName("");
    setEditingPixAccountId("");
  }

  function beginAddPix() {
    if (payoutPixAccounts.length >= 3) {
      setError("Esta loja já atingiu o limite de 3 chaves PIX.");
      return;
    }

    setError("");
    setSuccess("");
    resetPixForm();
    setShowPixForm(true);
  }

  function beginEditPix(account: PayoutPixAccount) {
    setError("");
    setSuccess("");
    setEditingPixAccountId(account.id);
    setPixKeyType(account.pix_key_type);
    setPixKey(account.pix_key);
    setHolderName(account.holder_name || "");
    setShowPixForm(true);
  }

  async function savePix(event: FormEvent) {
    event.preventDefault();

    if (processing) return;

    setError("");
    setSuccess("");

    if (!pixKey.trim()) {
      setError("Informe a chave PIX.");
      return;
    }

    setProcessing(true);

    const { error: rpcError } = editingPixAccountId
      ? await supabase.rpc("update_my_payout_pix_account", {
          p_restaurant_id: restaurantId,
          p_account_id: editingPixAccountId,
          p_pix_key_type: pixKeyType,
          p_pix_key: pixKey.trim(),
          p_holder_name: holderName.trim() || null,
        })
      : await supabase.rpc("add_my_payout_pix_account", {
          p_restaurant_id: restaurantId,
          p_pix_key_type: pixKeyType,
          p_pix_key: pixKey.trim(),
          p_holder_name: holderName.trim() || null,
        });

    if (rpcError) {
      console.error("Erro salvar PIX:", rpcError);

      if (rpcError.message.includes("PIX_KEY_ALREADY_EXISTS")) {
        setError("Essa chave PIX já foi cadastrada nesta loja.");
      } else if (rpcError.message.includes("PIX_ACCOUNT_LIMIT_REACHED")) {
        setError("Esta loja pode cadastrar no máximo 3 chaves PIX.");
      } else {
        setError("Não foi possível salvar a chave PIX.");
      }

      setProcessing(false);
      return;
    }

    setSuccess(
      editingPixAccountId
        ? "Chave PIX atualizada com sucesso."
        : "Chave PIX adicionada com sucesso."
    );
    setShowPixForm(false);
    resetPixForm();
    await loadFinance(false);
    setProcessing(false);
  }

  async function setPrimaryPixAccount(accountId: string) {
    if (processing) return;

    setProcessing(true);
    setError("");
    setSuccess("");

    const { error: rpcError } = await supabase.rpc(
      "set_my_primary_payout_pix_account",
      {
        p_restaurant_id: restaurantId,
        p_account_id: accountId,
      }
    );

    if (rpcError) {
      console.error("Erro definir PIX principal:", rpcError);
      setError("Não foi possível definir esta chave como principal.");
      setProcessing(false);
      return;
    }

    setSuccess("Chave PIX principal atualizada.");
    await loadFinance(false);
    setProcessing(false);
  }

  async function deletePixAccount(accountId: string) {
    const confirmed = window.confirm("Deseja apagar esta chave PIX?");
    if (!confirmed || processing) return;

    setProcessing(true);
    setError("");
    setSuccess("");

    const { error: rpcError } = await supabase.rpc("delete_my_payout_pix_account", {
      p_restaurant_id: restaurantId,
      p_account_id: accountId,
    });

    if (rpcError) {
      console.error("Erro apagar PIX:", rpcError);
      setError("Não foi possível apagar a chave PIX.");
      setProcessing(false);
      return;
    }

    setSuccess("Chave PIX removida com sucesso.");
    await loadFinance(false);
    setProcessing(false);
  }

  function parseAmount(value: string) {
    return Number(
      value.replace(/\./g, "").replace(",", ".").replace(/[^0-9.]/g, "")
    );
  }

  async function requestWithdrawal(event: FormEvent) {
    event.preventDefault();

    if (processing) return;

    setError("");
    setSuccess("");

    const amount = parseAmount(withdrawalAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Digite um valor válido para resgate.");
      return;
    }

    const available = Number(wallet?.available_balance ?? 0);
    const emergencyLimit = Math.floor((available / 2) * 100) / 100;

    if (amount > available) {
      setError("O valor solicitado é maior que o saldo disponível.");
      return;
    }

    if (withdrawalType === "emergency" && amount > emergencyLimit) {
      setError(
        `No resgate de emergência você pode pedir no máximo 50% do saldo disponível: ${money(emergencyLimit)}.`
      );
      return;
    }

    if (payoutPixAccounts.length === 0) {
      setError("Cadastre uma chave PIX antes de solicitar o resgate.");
      setShowPixForm(true);
      return;
    }

    if (!selectedPixAccountId) {
      setError("Escolha uma chave PIX para receber o resgate.");
      return;
    }

    setProcessing(true);

    const { error: rpcError } = await supabase.rpc("request_my_withdrawal", {
      p_restaurant_id: restaurantId,
      p_amount: amount,
      p_payout_account_id: selectedPixAccountId,
      p_request_type: withdrawalType,
    });

    if (rpcError) {
      console.error("Erro solicitar resgate:", rpcError);

      if (rpcError.message.includes("INSUFFICIENT_BALANCE")) {
        setError("Saldo insuficiente para esse resgate.");
      } else if (
        rpcError.message.includes("PIX_NOT_CONFIGURED") ||
        rpcError.message.includes("PIX_ACCOUNT_REQUIRED") ||
        rpcError.message.includes("PIX_ACCOUNT_NOT_FOUND")
      ) {
        setError("Escolha uma chave PIX válida antes de solicitar o resgate.");
      } else if (rpcError.message.includes("INVALID_WITHDRAWAL_TYPE")) {
        setError("Escolha um tipo de resgate válido.");
      } else if (rpcError.message.includes("EMERGENCY_LIMIT_EXCEEDED")) {
        setError(
          `No resgate de emergência você pode pedir no máximo 50% do saldo disponível: ${money(
            Math.floor((available / 2) * 100) / 100
          )}.`
        );
      } else if (rpcError.message.includes("EMERGENCY_BALANCE_TOO_LOW")) {
        setError("O saldo disponível é muito baixo para solicitar um resgate de emergência.");
      } else {
        setError("Não foi possível enviar a solicitação de resgate.");
      }

      setProcessing(false);
      return;
    }

    setWithdrawalAmount("");
    setShowWithdrawalForm(false);
    setSuccess(
      withdrawalType === "emergency"
        ? "Resgate de emergência enviado! O prazo de processamento é de até 24 horas."
        : "Solicitação enviada! Seu resgate será analisado e processado em até 72 horas."
    );
    setWithdrawalType("standard");
    await loadFinance(false);
    setProcessing(false);
  }

  const filteredOrders = useMemo(() => {
    if (period === "all") return orders;

    const now = new Date();
    let start = new Date();

    if (period === "today") {
      start.setHours(0, 0, 0, 0);
    } else if (period === "7days") {
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else {
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return orders.filter(
      (order) => new Date(order.created_at).getTime() >= start.getTime()
    );
  }, [orders, period]);

  const paidOrders = filteredOrders.filter(
    (order) => order.payment_status === "paid" && order.status !== "cancelled"
  );

  const paidTotal = paidOrders.reduce(
    (sum, order) => sum + Number(order.total ?? 0),
    0
  );

  const available = Number(wallet?.available_balance ?? 0);
  const emergencyLimit = Math.floor((available / 2) * 100) / 100;

  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
        <p className="font-bold">Carregando financeiro...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-black text-red-600">FINANCEIRO</p>
          <h2 className="mt-1 text-3xl font-black">Financeiro</h2>
          <p className="mt-1 text-zinc-500">
            Saldo, pedidos e resgates desta loja.
          </p>
        </div>

        <button
          type="button"
          disabled={refreshing}
          onClick={() => loadFinance(false)}
          className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-black transition hover:bg-zinc-50 disabled:opacity-50"
        >
          {refreshing ? "Atualizando..." : "↻ Atualizar"}
        </button>
      </div>

      {error && (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
          ✅ {success}
        </div>
      )}

      <section className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-red-600">
              CARTEIRA DA LOJA
            </p>
            <h3 className="mt-1 text-xl font-black">Saldo e resgates</h3>
            <p className="mt-1 text-sm text-zinc-500">
              Depois da entrega, o saldo fica em processamento por 24 horas antes de ser liberado para resgate.
            </p>
          </div>

          <button
            type="button"
            disabled={available <= 0}
            onClick={() => {
              setError("");
              setSuccess("");

              if (payoutPixAccounts.length === 0) {
                setError("Cadastre pelo menos uma chave PIX antes de solicitar resgate.");
                setShowPixForm(true);
                return;
              }

              const primary = payoutPixAccounts.find((account) => account.is_primary);
              setSelectedPixAccountId(
                primary?.id || selectedPixAccountId || payoutPixAccounts[0]?.id || ""
              );
              setShowWithdrawalForm(true);
            }}
            className="rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            💸 Resgatar dinheiro
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-zinc-200 p-5">
            <p className="text-sm font-bold text-zinc-500">A receber</p>
            <p className="mt-2 text-3xl font-black">{money(wallet?.receivable_balance)}</p>
            <p className="mt-2 text-xs text-zinc-400">Pedidos pagos ainda não entregues ou dentro das 24h após a entrega</p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-sm font-bold text-emerald-700">Disponível</p>
            <p className="mt-2 text-3xl font-black text-emerald-700">
              {money(wallet?.available_balance)}
            </p>
            <p className="mt-2 text-xs text-emerald-600">Liberado após 24h da entrega</p>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <p className="text-sm font-bold text-blue-700">Em resgate</p>
            <p className="mt-2 text-3xl font-black text-blue-700">
              {money(wallet?.in_withdrawal_balance)}
            </p>
            <p className="mt-2 text-xs text-blue-600">Aguardando ou já aprovado</p>
          </div>

          <div className="rounded-2xl border border-zinc-200 p-5">
            <p className="text-sm font-bold text-zinc-500">Já resgatado</p>
            <p className="mt-2 text-3xl font-black">{money(wallet?.withdrawn_balance)}</p>
            <p className="mt-2 text-xs text-zinc-400">Resgates marcados como pagos</p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl bg-zinc-50 p-4">
          <p className="text-xs font-black uppercase text-zinc-400">Líquido gerado</p>
          <p className="mt-1 text-lg font-black">{money(wallet?.total_net_settled)}</p>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-red-600">
              RECEBIMENTO
            </p>
            <h3 className="mt-1 text-xl font-black">Chaves PIX para resgates</h3>
            <p className="mt-1 text-sm text-zinc-500">
              Cadastre até 3 chaves e escolha qual usar na hora do resgate.
            </p>
            <p className="mt-1 text-xs font-bold text-zinc-400">
              {payoutPixAccounts.length}/3 chaves cadastradas
            </p>
          </div>

          <button
            type="button"
            disabled={payoutPixAccounts.length >= 3}
            onClick={beginAddPix}
            className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-black transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
          >
            {payoutPixAccounts.length >= 3
              ? "Limite de 3 chaves atingido"
              : "＋ Nova chave PIX"}
          </button>
        </div>

        {payoutPixAccounts.length > 0 ? (
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {payoutPixAccounts.map((account) => (
              <div
                key={account.id}
                className={`rounded-2xl border p-4 ${
                  account.is_primary
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-zinc-200 bg-zinc-50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-black uppercase text-zinc-400">
                        {pixTypeName(account.pix_key_type)}
                      </p>

                      {account.is_primary && (
                        <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-black uppercase text-white">
                          Principal
                        </span>
                      )}
                    </div>

                    <p className="mt-1 break-all font-black text-zinc-900">
                      {account.pix_key}
                    </p>

                    <p className="mt-1 text-sm text-zinc-500">
                      Titular: {account.holder_name || "Não informado"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={processing}
                    onClick={() => beginEditPix(account)}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-black text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50"
                  >
                    ✏️ Editar
                  </button>

                  {!account.is_primary && (
                    <button
                      type="button"
                      disabled={processing}
                      onClick={() => setPrimaryPixAccount(account.id)}
                      className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-black text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
                    >
                      ★ Tornar principal
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={processing}
                    onClick={() => deletePixAccount(account.id)}
                    className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-black text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    Apagar
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            Cadastre pelo menos uma chave PIX antes de solicitar seu primeiro resgate.
          </div>
        )}

        {showPixForm && (
          <form
            onSubmit={savePix}
            className="mt-5 grid gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 md:grid-cols-3"
          >
            <div className="md:col-span-3">
              <p className="font-black">
                {editingPixAccountId ? "Editar chave PIX" : "Adicionar chave PIX"}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {editingPixAccountId
                  ? "Altere os dados da chave selecionada."
                  : "Você pode manter até 3 chaves cadastradas por loja."}
              </p>
            </div>
            <label>
              <span className="text-xs font-black uppercase text-zinc-500">Tipo da chave</span>
              <select
                value={pixKeyType}
                onChange={(event) => setPixKeyType(event.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 font-bold outline-none"
              >
                <option value="cpf">CPF</option>
                <option value="cnpj">CNPJ</option>
                <option value="email">E-mail</option>
                <option value="phone">Telefone</option>
                <option value="random">Chave aleatória</option>
              </select>
            </label>

            <label>
              <span className="text-xs font-black uppercase text-zinc-500">Chave PIX</span>
              <input
                value={pixKey}
                onChange={(event) => setPixKey(event.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 font-bold outline-none"
                placeholder="Digite a chave"
              />
            </label>

            <label>
              <span className="text-xs font-black uppercase text-zinc-500">Nome do titular</span>
              <input
                value={holderName}
                onChange={(event) => setHolderName(event.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 font-bold outline-none"
                placeholder="Nome do titular"
              />
            </label>

            <div className="flex gap-2 md:col-span-3 md:justify-end">
              <button
                type="button"
                disabled={processing}
                onClick={() => {
                  setShowPixForm(false);
                  resetPixForm();
                }}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-black"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={processing}
                className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-black text-white disabled:opacity-50"
              >
                {processing
                  ? "Salvando..."
                  : editingPixAccountId
                  ? "Salvar alterações"
                  : "Salvar chave PIX"}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-red-600">RESGATES</p>
          <h3 className="mt-1 text-xl font-black">Solicitações de resgate</h3>
        </div>

        {withdrawals.length === 0 ? (
          <div className="mt-5 rounded-2xl bg-zinc-50 p-7 text-center">
            <p className="font-black">Nenhum resgate solicitado</p>
            <p className="mt-1 text-sm text-zinc-500">
              Quando houver saldo disponível, você poderá solicitar aqui.
            </p>
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-400">
                  <th className="px-3 py-3">Data</th>
                  <th className="px-3 py-3">Valor</th>
                  <th className="px-3 py-3">PIX escolhido</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Observação</th>
                </tr>
              </thead>

              <tbody>
                {withdrawals.map((withdrawal) => {
                  const info = withdrawalStatus(withdrawal.status);

                  return (
                    <tr
                      key={withdrawal.id}
                      className="border-b border-zinc-100 last:border-0"
                    >
                      <td className="px-3 py-4 text-zinc-500">
                        <p>{dateTime(withdrawal.requested_at)}</p>
                        <span
                          className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                            withdrawal.request_type === "emergency"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-zinc-100 text-zinc-600"
                          }`}
                        >
                          {withdrawal.request_type === "emergency"
                            ? "🚨 Emergência • 24h"
                            : "Normal • 72h"}
                        </span>
                      </td>

                      <td className="px-3 py-4 font-black">{money(withdrawal.amount)}</td>

                      <td className="px-3 py-4">
                        <p className="font-bold">{pixTypeName(withdrawal.pix_key_type)}</p>
                        <p className="max-w-[240px] truncate text-xs text-zinc-400">
                          {withdrawal.pix_key}
                        </p>
                      </td>

                      <td className="px-3 py-4">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${info.className}`}
                        >
                          {info.label}
                        </span>
                      </td>

                      <td className="px-3 py-4 text-zinc-500">
                        {withdrawal.status === "rejected"
                          ? withdrawal.rejection_reason || "Recusado pelo administrador"
                          : withdrawal.status === "paid"
                          ? `Pago em ${dateTime(withdrawal.paid_at)}`
                          : withdrawal.status === "pending"
                          ? withdrawal.request_type === "emergency"
                            ? `Prazo de emergência: até 24 horas${withdrawal.due_at ? ` • limite ${dateTime(withdrawal.due_at)}` : ""}`
                            : `Prazo normal: até 72 horas${withdrawal.due_at ? ` • limite ${dateTime(withdrawal.due_at)}` : ""}`
                          : withdrawal.request_type === "emergency"
                          ? "🚨 Emergência aprovada e aguardando pagamento"
                          : "Aprovado e aguardando pagamento"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mt-6 rounded-3xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {(["today", "7days", "30days", "all"] as Period[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setPeriod(value)}
              className={`rounded-xl px-4 py-2 text-sm font-black transition ${
                period === value
                  ? "bg-red-600 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {periodName(value)}
            </button>
          ))}
        </div>
      </div>

      <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-red-600">PEDIDOS PAGOS</p>
            <h3 className="mt-1 text-xl font-black">Movimentação no período</h3>
          </div>

          <div className="text-right">
            <p className="text-xs font-bold uppercase text-zinc-400">Volume pago</p>
            <p className="font-black">{money(paidTotal)}</p>
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="mt-6 rounded-2xl bg-zinc-50 p-8 text-center">
            <p className="font-black">Nenhum pedido neste período</p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-400">
                  <th className="px-3 py-3">Pedido</th>
                  <th className="px-3 py-3">Data</th>
                  <th className="px-3 py-3">Tipo</th>
                  <th className="px-3 py-3">Pagamento</th>
                  <th className="px-3 py-3">Situação</th>
                  <th className="px-3 py-3 text-right">Total</th>
                </tr>
              </thead>

              <tbody>
                {filteredOrders.map((order) => (
                  <tr
                    key={order.order_id}
                    className="border-b border-zinc-100 last:border-0"
                  >
                    <td className="px-3 py-4 font-black">
                      #{order.order_id.slice(0, 8).toUpperCase()}
                    </td>

                    <td className="px-3 py-4 text-zinc-500">{dateTime(order.created_at)}</td>

                    <td className="px-3 py-4">
                      {order.fulfillment_method === "pickup" ? "🏪 Retirada" : "🛵 Entrega"}
                    </td>

                    <td className="px-3 py-4">{paymentName(order.payment_method)}</td>

                    <td className="px-3 py-4 font-bold">
                      {order.status === "delivered"
                        ? "Entregue"
                        : order.status === "cancelled"
                        ? "Cancelado"
                        : "Em andamento"}
                    </td>

                    <td className="px-3 py-4 text-right font-black">{money(order.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showWithdrawalForm && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !processing) {
              setShowWithdrawalForm(false);
              setWithdrawalType("standard");
            }
          }}
        >
          <form
            onSubmit={requestWithdrawal}
            className="w-full max-w-xl rounded-3xl bg-white p-7 shadow-2xl"
          >
            <p className="text-xs font-black uppercase tracking-wide text-red-600">RESGATE</p>
            <h3 className="mt-1 text-2xl font-black">Resgatar dinheiro</h3>

            <div className="mt-5 rounded-2xl bg-emerald-50 p-4">
              <p className="text-xs font-black uppercase text-emerald-600">Saldo disponível</p>
              <p className="mt-1 text-3xl font-black text-emerald-700">{money(available)}</p>
            </div>

            <div className="mt-5">
              <p className="text-xs font-black uppercase text-zinc-500">
                Tipo de resgate
              </p>

              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setWithdrawalType("standard")}
                  className={`rounded-2xl border p-4 text-left transition ${
                    withdrawalType === "standard"
                      ? "border-blue-300 bg-blue-50 ring-2 ring-blue-100"
                      : "border-zinc-200 bg-white hover:bg-zinc-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black text-zinc-900">💸 Resgate normal</p>
                    <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-black uppercase text-blue-700">
                      até 72h
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-5 text-zinc-500">
                    Solicitação comum, processada em até 72 horas.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setWithdrawalType("emergency")}
                  className={`rounded-2xl border p-4 text-left transition ${
                    withdrawalType === "emergency"
                      ? "border-orange-300 bg-orange-50 ring-2 ring-orange-100"
                      : "border-zinc-200 bg-white hover:bg-zinc-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black text-zinc-900">🚨 Emergência</p>
                    <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[10px] font-black uppercase text-orange-700">
                      até 24h
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-5 text-zinc-500">
                    Prioridade maior para receber em até 24 horas. Máximo de 50% do saldo disponível.
                  </p>
                </button>
              </div>
            </div>

            <div
              className={`mt-4 rounded-2xl border p-4 ${
                withdrawalType === "emergency"
                  ? "border-orange-200 bg-orange-50"
                  : "border-blue-200 bg-blue-50"
              }`}
            >
              <p
                className={`font-black ${
                  withdrawalType === "emergency"
                    ? "text-orange-800"
                    : "text-blue-800"
                }`}
              >
                {withdrawalType === "emergency"
                  ? "🚨 Resgate de emergência: até 24 horas"
                  : "⏱️ Resgate normal: até 72 horas"}
              </p>
              <p
                className={`mt-1 text-sm leading-6 ${
                  withdrawalType === "emergency"
                    ? "text-orange-700"
                    : "text-blue-700"
                }`}
              >
                {withdrawalType === "emergency"
                  ? `Você só pode usar dinheiro que já está em Disponível e, no emergencial, o limite é metade desse saldo. Máximo agora: ${money(emergencyLimit)}.`
                  : "No resgate normal você pode usar até 100% do dinheiro que já aparece em Disponível. Valores em A receber não entram no resgate."}
              </p>
            </div>

            <label className="mt-5 block">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <span className="text-xs font-black uppercase text-zinc-500">Valor do resgate</span>
                <span className="text-xs font-black text-zinc-500">
                  {withdrawalType === "emergency"
                    ? `Máximo emergencial: ${money(emergencyLimit)}`
                    : `Máximo: ${money(available)}`}
                </span>
              </div>
              <div className="mt-1 flex gap-2">
                <input
                  autoFocus
                  value={withdrawalAmount}
                  onChange={(event) => setWithdrawalAmount(event.target.value)}
                  placeholder="Ex.: 150,00"
                  className="h-12 min-w-0 flex-1 rounded-xl border border-zinc-200 px-4 text-lg font-black outline-none focus:border-zinc-400"
                />
                <button
                  type="button"
                  onClick={() =>
                    setWithdrawalAmount(
                      (withdrawalType === "emergency" ? emergencyLimit : available)
                        .toFixed(2)
                        .replace(".", ",")
                    )
                  }
                  disabled={
                    withdrawalType === "emergency"
                      ? emergencyLimit <= 0
                      : available <= 0
                  }
                  className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-black text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-40"
                >
                  Máximo
                </button>
              </div>
            </label>

            <div className="mt-5">
              <p className="text-xs font-black uppercase text-zinc-500">Escolha a chave PIX</p>
              <div className="mt-2 space-y-2">
                {payoutPixAccounts.map((account) => {
                  const active = selectedPixAccountId === account.id;

                  return (
                    <label
                      key={account.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                        active
                          ? "border-red-300 bg-red-50"
                          : "border-zinc-200 bg-zinc-50 hover:border-zinc-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="withdrawal-pix-account"
                        checked={active}
                        onChange={() => setSelectedPixAccountId(account.id)}
                        className="mt-1"
                      />

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-black text-zinc-900">
                            {pixTypeName(account.pix_key_type)}
                          </p>
                          {account.is_primary && (
                            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-black uppercase text-white">
                              Principal
                            </span>
                          )}
                        </div>
                        <p className="mt-1 break-all text-sm text-zinc-600">{account.pix_key}</p>
                        <p className="mt-1 text-xs text-zinc-400">
                          Titular: {account.holder_name || "Não informado"}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <p className="mt-4 text-xs leading-5 text-zinc-400">
              Ao confirmar, o valor fica reservado e a solicitação aparece no painel do administrador.
            </p>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                disabled={processing}
                onClick={() => {
                  setShowWithdrawalForm(false);
                  setWithdrawalType("standard");
                }}
                className="flex-1 rounded-xl border border-zinc-200 px-4 py-3 font-black"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={processing}
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 font-black text-white disabled:opacity-50"
              >
                {processing ? "Enviando..." : "Solicitar resgate"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
