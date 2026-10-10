"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { useSearchParams } from "next/navigation";

import { supabase } from "@/lib/supabase";

type Payout = {
  id: string;

  net_amount:
    | number
    | string;

  status: string;

  scheduled_for:
    | string
    | null;

  paid_at:
    | string
    | null;

  external_reference:
    | string
    | null;

  created_at: string;
};

type Debt = {
  id: string;

  description: string;

  remaining_amount:
    | number
    | string;

  due_at:
    | string
    | null;

  created_at: string;
};

type FinancialDashboard = {
  restaurant_id: string;

  available_amount:
    | number
    | string;

  pending_debt_amount:
    | number
    | string;

  total_paid_out:
    | number
    | string;

  pending_orders: number;

  payouts: Payout[];

  debts: Debt[];
};

function money(
  value:
    | number
    | string
    | null
) {
  return Number(
    value ?? 0
  ).toLocaleString(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    }
  );
}

function dateOnly(
  value:
    | string
    | null
) {
  if (!value) {
    return "-";
  }

  return new Date(
    value
  ).toLocaleDateString(
    "pt-BR"
  );
}

function payoutStatus(
  status: string
) {
  switch (status) {
    case "pending":
      return {
        text:
          "Aguardando",

        className:
          "bg-zinc-100 text-zinc-700",
      };

    case "processing":
      return {
        text:
          "Processando",

        className:
          "bg-blue-50 text-blue-700",
      };

    case "paid":
      return {
        text:
          "Pago",

        className:
          "bg-green-50 text-green-700",
      };

    case "failed":
      return {
        text:
          "Falhou",

        className:
          "bg-red-50 text-red-700",
      };

    case "cancelled":
      return {
        text:
          "Cancelado",

        className:
          "bg-zinc-100 text-zinc-500",
      };

    default:
      return {
        text:
          status,

        className:
          "bg-zinc-100 text-zinc-600",
      };
  }
}

export default function FinanceiroRepassesSection() {
  const searchParams =
    useSearchParams();

  const restaurantId =
    searchParams.get(
      "restaurant"
    ) ?? "";

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      FinancialDashboard | null
    >(null);

  // ==========================================
  // CARREGAR FINANCEIRO
  // ==========================================

  const loadDashboard =
    useCallback(
      async (
        firstLoad =
          false
      ) => {
        if (
          firstLoad
        ) {
          setLoading(
            true
          );
        } else {
          setRefreshing(
            true
          );
        }

        setError("");

        if (
          !restaurantId
        ) {
          setDashboard(
            null
          );

          setError(
            "Loja não informada."
          );

          setLoading(
            false
          );

          setRefreshing(
            false
          );

          return;
        }

        const {
          data,
          error:
            rpcError,
        } =
          await supabase.rpc(
            "get_my_restaurant_financial_dashboard",
            {
              p_restaurant_id:
                restaurantId,
            }
          );

        if (
          rpcError
        ) {
          console.error(
            "Erro ao carregar financeiro:",
            rpcError
          );

          setDashboard(
            null
          );

          setError(
            "Não foi possível carregar os dados financeiros."
          );

          setLoading(
            false
          );

          setRefreshing(
            false
          );

          return;
        }

        setDashboard(
          data as FinancialDashboard
        );

        setLoading(
          false
        );

        setRefreshing(
          false
        );
      },
      [
        restaurantId,
      ]
    );

  // ==========================================
  // PRIMEIRO CARREGAMENTO
  // ==========================================

  useEffect(() => {
    loadDashboard(
      true
    );
  }, [
    loadDashboard,
  ]);

  // ==========================================
  // ATUALIZAÇÃO AUTOMÁTICA
  // ==========================================

  useEffect(() => {
    const interval =
      window.setInterval(
        () => {
          loadDashboard(
            false
          );
        },
        15000
      );

    return () => {
      window.clearInterval(
        interval
      );
    };
  }, [
    loadDashboard,
  ]);

  // ==========================================
  // CARREGANDO
  // ==========================================

  if (
    loading
  ) {
    return (
      <section className="mt-6 rounded-3xl border border-zinc-200 bg-white p-8 text-center">
        <p className="font-semibold text-zinc-600">
          Carregando informações financeiras...
        </p>
      </section>
    );
  }

  // ==========================================
  // ERRO
  // ==========================================

  if (
    error ||
    !dashboard
  ) {
    return (
      <section className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="font-bold text-red-700">
            Não foi possível carregar o financeiro
          </p>

          <p className="mt-1 text-sm text-red-600">
            {error}
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            loadDashboard(
              false
            )
          }
          className="mt-4 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-bold text-zinc-700 transition hover:bg-zinc-50"
        >
          Tentar novamente
        </button>
      </section>
    );
  }

  const payouts =
    dashboard.payouts ??
    [];

  const debts =
    dashboard.debts ??
    [];

  const hasDebt =
    Number(
      dashboard.pending_debt_amount ??
        0
    ) > 0;

  return (
    <section className="mt-6 rounded-3xl border border-zinc-200 bg-white">
      {/* =====================================
          CABEÇALHO
      ===================================== */}

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 px-6 py-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">
            Financeiro
          </p>

          <h3 className="mt-1 text-xl font-black text-zinc-900">
            Repasses
          </h3>

          <p className="mt-1 text-sm text-zinc-500">
            Consulte seu saldo e o histórico de valores recebidos.
          </p>
        </div>

        <button
          type="button"
          disabled={
            refreshing
          }
          onClick={() =>
            loadDashboard(
              false
            )
          }
          className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-bold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
        >
          {refreshing
            ? "Atualizando..."
            : "Atualizar"}
        </button>
      </div>

      <div className="p-6">
        {/* =====================================
            RESUMO PRINCIPAL
        ===================================== */}

        <div className="grid gap-4 md:grid-cols-3">
          {/* SALDO */}

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
            <p className="text-sm font-semibold text-zinc-500">
              Saldo disponível
            </p>

            <p className="mt-3 text-3xl font-black text-zinc-900">
              {money(
                dashboard.available_amount
              )}
            </p>

            <p className="mt-3 text-xs text-zinc-500">
              {
                dashboard.pending_orders
              }{" "}
              {dashboard.pending_orders ===
              1
                ? "pedido aguardando repasse"
                : "pedidos aguardando repasse"}
            </p>
          </div>

          {/* TOTAL REPASSADO */}

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
            <p className="text-sm font-semibold text-zinc-500">
              Total já repassado
            </p>

            <p className="mt-3 text-3xl font-black text-green-700">
              {money(
                dashboard.total_paid_out
              )}
            </p>

            <p className="mt-3 text-xs text-zinc-500">
              Valores já concluídos.
            </p>
          </div>

          {/* DÉBITOS */}

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
            <p className="text-sm font-semibold text-zinc-500">
              Débitos pendentes
            </p>

            <p
              className={`mt-3 text-3xl font-black ${
                hasDebt
                  ? "text-red-600"
                  : "text-zinc-900"
              }`}
            >
              {money(
                dashboard.pending_debt_amount
              )}
            </p>

            <p className="mt-3 text-xs text-zinc-500">
              {hasDebt
                ? "Valores pendentes serão considerados nos próximos repasses."
                : "Nenhum débito pendente."}
            </p>
          </div>
        </div>

        {/* =====================================
            DÉBITOS DETALHADOS
            SÓ APARECE SE EXISTIR
        ===================================== */}

        {debts.length >
          0 && (
          <div className="mt-8">
            <div className="border-b border-zinc-200 pb-3">
              <h4 className="text-lg font-black text-zinc-900">
                Débitos pendentes
              </h4>

              <p className="mt-1 text-sm text-zinc-500">
                Valores ainda pendentes nesta loja.
              </p>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200">
              {debts.map(
                (
                  debt,
                  index
                ) => (
                  <div
                    key={
                      debt.id
                    }
                    className={`flex flex-wrap items-center justify-between gap-4 p-4 ${
                      index >
                      0
                        ? "border-t border-zinc-200"
                        : ""
                    }`}
                  >
                    <div>
                      <p className="font-bold text-zinc-900">
                        {
                          debt.description
                        }
                      </p>

                      {debt.due_at && (
                        <p className="mt-1 text-xs text-zinc-500">
                          Vencimento:{" "}
                          {dateOnly(
                            debt.due_at
                          )}
                        </p>
                      )}
                    </div>

                    <p className="text-lg font-black text-red-600">
                      {money(
                        debt.remaining_amount
                      )}
                    </p>
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* =====================================
            HISTÓRICO
        ===================================== */}

        <div className="mt-8">
          <div className="border-b border-zinc-200 pb-3">
            <h4 className="text-lg font-black text-zinc-900">
              Histórico de repasses
            </h4>

            <p className="mt-1 text-sm text-zinc-500">
              Consulte os valores já processados para esta loja.
            </p>
          </div>

          {payouts.length ===
          0 ? (
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-10 text-center">
              <p className="font-bold text-zinc-700">
                Nenhum repasse realizado
              </p>

              <p className="mt-1 text-sm text-zinc-500">
                Quando houver um repasse, ele aparecerá aqui.
              </p>
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-200">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="bg-zinc-50">
                  <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                    <th className="px-5 py-4 font-bold">
                      Data
                    </th>

                    <th className="px-5 py-4 font-bold">
                      Referência
                    </th>

                    <th className="px-5 py-4 font-bold">
                      Valor
                    </th>

                    <th className="px-5 py-4 font-bold">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {payouts.map(
                    (
                      payout
                    ) => {
                      const status =
                        payoutStatus(
                          payout.status
                        );

                      return (
                        <tr
                          key={
                            payout.id
                          }
                          className="border-b border-zinc-100 last:border-b-0"
                        >
                          <td className="px-5 py-4 text-zinc-600">
                            {dateOnly(
                              payout.paid_at ??
                                payout.scheduled_for ??
                                payout.created_at
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <span className="font-semibold text-zinc-700">
                              {payout.external_reference ||
                                `#${payout.id
                                  .slice(
                                    0,
                                    8
                                  )
                                  .toUpperCase()}`}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-lg font-black text-zinc-900">
                            {money(
                              payout.net_amount
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${status.className}`}
                            >
                              {
                                status.text
                              }
                            </span>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* =====================================
            AVISO
        ===================================== */}

        <div className="mt-6 border-t border-zinc-200 pt-5">
          <p className="text-xs leading-5 text-zinc-500">
            Os valores desta área representam somente o saldo e os repasses disponíveis para esta loja.
          </p>
        </div>
      </div>
    </section>
  );
}