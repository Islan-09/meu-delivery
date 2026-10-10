"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { useSearchParams } from "next/navigation";

import { supabase } from "@/lib/supabase";

type RestaurantHourPeriod = {
  period_id: string;
  day_of_week: number;
  opens_at: string;
  closes_at: string;
  sort_order: number;
};

type PeriodConfig = {
  key: string;
  opensAt: string;
  closesAt: string;
};

type DayConfig = {
  day: number;
  name: string;
  isOpen: boolean;
  periods: PeriodConfig[];
};

const dayNames: Record<
  number,
  string
> = {
  0: "Domingo",
  1: "Segunda-feira",
  2: "Terça-feira",
  3: "Quarta-feira",
  4: "Quinta-feira",
  5: "Sexta-feira",
  6: "Sábado",
};

const dayOrder = [
  1,
  2,
  3,
  4,
  5,
  6,
  0,
];

function normalizeTime(
  value:
    | string
    | null
    | undefined
) {
  if (!value) {
    return "";
  }

  return value.slice(
    0,
    5
  );
}

function newPeriodKey(
  day: number
) {
  return `${day}-${Date.now()}-${Math.random()}`;
}

function defaultPeriod(
  day: number
): PeriodConfig {
  return {
    key:
      newPeriodKey(
        day
      ),

    opensAt:
      "18:00",

    closesAt:
      "23:00",
  };
}

function createInitialDays():
  DayConfig[] {
  return dayOrder.map(
    (day) => ({
      day,

      name:
        dayNames[
          day
        ],

      isOpen:
        false,

      periods:
        [],
    })
  );
}

function crossesMidnight(
  period: PeriodConfig
) {
  if (
    !period.opensAt ||
    !period.closesAt
  ) {
    return false;
  }

  return (
    period.closesAt <
    period.opensAt
  );
}

export default function HorariosSection() {
  const searchParams =
    useSearchParams();

  const restaurantId =
    searchParams.get(
      "restaurant"
    ) ?? "";

  const [
    days,
    setDays,
  ] =
    useState<
      DayConfig[]
    >(
      createInitialDays()
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    saving,
    setSaving,
  ] =
    useState(
      false
    );

  const [
    error,
    setError,
  ] =
    useState(
      ""
    );

  const [
    success,
    setSuccess,
  ] =
    useState(
      ""
    );

  // ==========================================
  // VALIDAR LOJA
  // ==========================================

  function ensureRestaurant() {
    if (
      !restaurantId
    ) {
      setError(
        "Loja não informada. Volte para Minhas lojas e abra o painel novamente."
      );

      return false;
    }

    return true;
  }

  // ==========================================
  // CARREGAR HORÁRIOS
  // NOVO SISTEMA DE PERÍODOS
  // ==========================================

  const loadHours =
    useCallback(
      async () => {
        setLoading(
          true
        );

        setError(
          ""
        );

        if (
          !restaurantId
        ) {
          setDays(
            createInitialDays()
          );

          setError(
            "Loja não informada. Volte para Minhas lojas e abra o painel novamente."
          );

          setLoading(
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
            "get_my_restaurant_hour_periods",
            {
              p_restaurant_id:
                restaurantId,
            }
          );

        if (
          rpcError
        ) {
          console.error(
            "Erro carregando horários:",
            rpcError
          );

          if (
            rpcError.message.includes(
              "RESTAURANT_NOT_FOUND"
            )
          ) {
            setError(
              "Essa loja não foi encontrada ou não pertence à sua conta."
            );
          } else if (
            rpcError.message.includes(
              "NOT_AUTHENTICATED"
            )
          ) {
            setError(
              "Sua sessão expirou. Entre novamente."
            );
          } else {
            setError(
              "Não foi possível carregar os horários desta loja."
            );
          }

          setLoading(
            false
          );

          return;
        }

        const periods =
          (
            data ??
            []
          ) as RestaurantHourPeriod[];

        const grouped =
          new Map<
            number,
            PeriodConfig[]
          >();

        for (
          const period
          of periods
        ) {
          const day =
            Number(
              period.day_of_week
            );

          const current =
            grouped.get(
              day
            ) ?? [];

          current.push({
            key:
              period.period_id,

            opensAt:
              normalizeTime(
                period.opens_at
              ),

            closesAt:
              normalizeTime(
                period.closes_at
              ),
          });

          grouped.set(
            day,
            current
          );
        }

        setDays(
          dayOrder.map(
            (
              day
            ) => {
              const savedPeriods =
                grouped.get(
                  day
                ) ?? [];

              return {
                day,

                name:
                  dayNames[
                    day
                  ],

                isOpen:
                  savedPeriods.length >
                  0,

                periods:
                  savedPeriods,
              };
            }
          )
        );

        setLoading(
          false
        );
      },
      [
        restaurantId,
      ]
    );

  useEffect(() => {
    loadHours();
  }, [
    loadHours,
  ]);

  // ==========================================
  // LIMPAR MENSAGENS
  // ==========================================

  function clearMessages() {
    setError(
      ""
    );

    setSuccess(
      ""
    );
  }

  // ==========================================
  // ABRIR / FECHAR DIA
  // ==========================================

  function toggleDay(
    dayNumber: number
  ) {
    clearMessages();

    setDays(
      (
        current
      ) =>
        current.map(
          (
            day
          ) => {
            if (
              day.day !==
              dayNumber
            ) {
              return day;
            }

            if (
              day.isOpen
            ) {
              return {
                ...day,

                isOpen:
                  false,
              };
            }

            return {
              ...day,

              isOpen:
                true,

              periods:
                day.periods.length >
                0
                  ? day.periods
                  : [
                      defaultPeriod(
                        day.day
                      ),
                    ],
            };
          }
        )
    );
  }

  // ==========================================
  // ALTERAR UM HORÁRIO
  // ==========================================

  function updatePeriod(
    dayNumber: number,
    periodIndex: number,
    field:
      | "opensAt"
      | "closesAt",
    value: string
  ) {
    clearMessages();

    setDays(
      (
        current
      ) =>
        current.map(
          (
            day
          ) => {
            if (
              day.day !==
              dayNumber
            ) {
              return day;
            }

            return {
              ...day,

              periods:
                day.periods.map(
                  (
                    period,
                    index
                  ) =>
                    index ===
                    periodIndex
                      ? {
                          ...period,

                          [field]:
                            value,
                        }
                      : period
                ),
            };
          }
        )
    );
  }

  // ==========================================
  // ADICIONAR HORÁRIO
  // ==========================================

  function addPeriod(
    dayNumber: number
  ) {
    clearMessages();

    setDays(
      (
        current
      ) =>
        current.map(
          (
            day
          ) => {
            if (
              day.day !==
              dayNumber
            ) {
              return day;
            }

            if (
              day.periods.length >=
              4
            ) {
              return day;
            }

            return {
              ...day,

              isOpen:
                true,

              periods: [
                ...day.periods,

                defaultPeriod(
                  day.day
                ),
              ],
            };
          }
        )
    );
  }

  // ==========================================
  // REMOVER HORÁRIO
  // ==========================================

  function removePeriod(
    dayNumber: number,
    periodIndex: number
  ) {
    clearMessages();

    setDays(
      (
        current
      ) =>
        current.map(
          (
            day
          ) => {
            if (
              day.day !==
              dayNumber
            ) {
              return day;
            }

            const nextPeriods =
              day.periods.filter(
                (
                  _,
                  index
                ) =>
                  index !==
                  periodIndex
              );

            return {
              ...day,

              periods:
                nextPeriods,

              isOpen:
                nextPeriods.length >
                0,
            };
          }
        )
    );
  }

  // ==========================================
  // ABRIR TODOS
  // ==========================================

  function openEveryDay() {
    clearMessages();

    setDays(
      (
        current
      ) =>
        current.map(
          (
            day
          ) => ({
            ...day,

            isOpen:
              true,

            periods:
              day.periods.length >
              0
                ? day.periods
                : [
                    defaultPeriod(
                      day.day
                    ),
                  ],
          })
        )
    );
  }

  // ==========================================
  // FECHAR TODOS
  // ==========================================

  function closeEveryDay() {
    clearMessages();

    setDays(
      (
        current
      ) =>
        current.map(
          (
            day
          ) => ({
            ...day,

            isOpen:
              false,
          })
        )
    );
  }

  // ==========================================
  // VALIDAR HORÁRIOS
  // ==========================================

  function validateHours() {
    for (
      const day
      of days
    ) {
      if (
        !day.isOpen
      ) {
        continue;
      }

      if (
        day.periods.length ===
        0
      ) {
        return `${day.name} está marcado como aberto, mas não possui horário.`;
      }

      if (
        day.periods.length >
        4
      ) {
        return `${day.name} possui horários demais. O máximo é 4 períodos por dia.`;
      }

      for (
        let index = 0;
        index <
        day.periods.length;
        index++
      ) {
        const period =
          day.periods[
            index
          ];

        if (
          !period.opensAt ||
          !period.closesAt
        ) {
          return `Informe a abertura e o fechamento do horário ${index + 1} de ${day.name}.`;
        }

        if (
          period.opensAt ===
          period.closesAt
        ) {
          return `Em ${day.name}, a abertura e o fechamento do horário ${index + 1} não podem ser iguais.`;
        }
      }

      // HORÁRIOS DUPLICADOS

      const signatures =
        day.periods.map(
          (
            period
          ) =>
            `${period.opensAt}-${period.closesAt}`
        );

      if (
        new Set(
          signatures
        ).size !==
        signatures.length
      ) {
        return `${day.name} possui horários duplicados.`;
      }
    }

    return "";
  }

  // ==========================================
  // SALVAR
  // ==========================================

  async function saveHours() {
    if (
      saving
    ) {
      return;
    }

    clearMessages();

    if (
      !ensureRestaurant()
    ) {
      return;
    }

    const validationError =
      validateHours();

    if (
      validationError
    ) {
      setError(
        validationError
      );

      return;
    }

    setSaving(
      true
    );

    for (
      const day
      of days
    ) {
      const periods =
        day.isOpen
          ? day.periods.map(
              (
                period
              ) => ({
                opens_at:
                  period.opensAt,

                closes_at:
                  period.closesAt,
              })
            )
          : [];

      const {
        error:
          saveError,
      } =
        await supabase.rpc(
          "save_my_restaurant_day_hours",
          {
            p_restaurant_id:
              restaurantId,

            p_day_of_week:
              day.day,

            p_periods:
              periods,
          }
        );

      if (
        saveError
      ) {
        console.error(
          "Erro salvando horários:",
          saveError
        );

        if (
          saveError.message.includes(
            "RESTAURANT_NOT_FOUND"
          )
        ) {
          setError(
            "Essa loja não foi encontrada ou não pertence à sua conta."
          );
        } else if (
          saveError.message.includes(
            "TOO_MANY_PERIODS"
          )
        ) {
          setError(
            `Existem horários demais em ${day.name}. O máximo é 4 por dia.`
          );
        } else if (
          saveError.message.includes(
            "SAME_OPEN_CLOSE_TIME"
          )
        ) {
          setError(
            `Em ${day.name}, a hora de abrir não pode ser igual à hora de fechar.`
          );
        } else if (
          saveError.message.includes(
            "HOURS_REQUIRED"
          )
        ) {
          setError(
            `Informe todos os horários de ${day.name}.`
          );
        } else if (
          saveError.message.includes(
            "INVALID_TIME"
          )
        ) {
          setError(
            `Existe um horário inválido em ${day.name}.`
          );
        } else {
          setError(
            `Não foi possível salvar ${day.name}.`
          );
        }

        setSaving(
          false
        );

        return;
      }
    }

    setSuccess(
      "✅ Horários salvos com sucesso!"
    );

    setSaving(
      false
    );

    await loadHours();
  }

  // ==========================================
  // CARREGANDO
  // ==========================================

  if (
    loading
  ) {
    return (
      <div>
        <p className="text-sm font-black text-red-600">
          HORÁRIOS
        </p>

        <h2 className="mt-1 text-3xl font-black">
          Horários de funcionamento
        </h2>

        <div className="mt-6 rounded-3xl bg-white p-10 text-center shadow-sm">
          <p className="font-bold">
            Carregando horários...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ==================================
          TÍTULO
      ================================== */}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-black text-red-600">
            HORÁRIOS
          </p>

          <h2 className="mt-1 text-3xl font-black">
            Horários de funcionamento
          </h2>

          <p className="mt-1 text-zinc-500">
            Defina os dias e horários em que esta
            loja recebe pedidos.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={
              saving
            }
            onClick={
              openEveryDay
            }
            className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Abrir todos
          </button>

          <button
            type="button"
            disabled={
              saving
            }
            onClick={
              closeEveryDay
            }
            className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Fechar todos
          </button>
        </div>
      </div>

      {/* ==================================
          MENSAGENS
      ================================== */}

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-700">
          {
            success
          }
        </div>
      )}

      {/* ==================================
          DIAS
      ================================== */}

      <section className="mt-6 overflow-hidden rounded-3xl bg-white shadow-sm">
        {days.map(
          (
            day,
            dayIndex
          ) => (
            <div
              key={
                day.day
              }
              className={`p-5 ${
                dayIndex !==
                days.length -
                  1
                  ? "border-b border-zinc-100"
                  : ""
              }`}
            >
              <div className="grid items-start gap-4 md:grid-cols-[190px_130px_1fr]">
                {/* ============================
                    DIA
                ============================ */}

                <div className="pt-2">
                  <p className="font-black">
                    {
                      day.name
                    }
                  </p>

                  <p
                    className={`mt-1 text-xs font-bold ${
                      day.isOpen
                        ? "text-green-600"
                        : "text-zinc-400"
                    }`}
                  >
                    {day.isOpen
                      ? "● Loja aberta"
                      : "● Loja fechada"}
                  </p>
                </div>

                {/* ============================
                    ABERTO / FECHADO
                ============================ */}

                <button
                  type="button"
                  disabled={
                    saving
                  }
                  onClick={() =>
                    toggleDay(
                      day.day
                    )
                  }
                  className={`mt-1 rounded-xl px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    day.isOpen
                      ? "bg-green-100 text-green-700 hover:bg-green-200"
                      : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                  }`}
                >
                  {day.isOpen
                    ? "Aberto"
                    : "Fechado"}
                </button>

                {/* ============================
                    HORÁRIOS
                ============================ */}

                {day.isOpen ? (
                  <div>
                    <div className="space-y-3">
                      {day.periods.map(
                        (
                          period,
                          periodIndex
                        ) => (
                          <div
                            key={
                              period.key
                            }
                            className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
                          >
                            {/* CABEÇALHO DO PERÍODO */}

                            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                              <p className="text-xs font-black uppercase text-zinc-500">
                                Horário{" "}
                                {
                                  periodIndex +
                                  1
                                }
                              </p>

                              {day.periods.length >
                                1 && (
                                <button
                                  type="button"
                                  disabled={
                                    saving
                                  }
                                  onClick={() =>
                                    removePeriod(
                                      day.day,
                                      periodIndex
                                    )
                                  }
                                  className="rounded-lg px-3 py-1.5 text-xs font-black text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  🗑️ Remover
                                </button>
                              )}
                            </div>

                            {/* CAMPOS */}

                            <div className="grid items-start gap-3 sm:grid-cols-[1fr_auto_1fr]">
                              <div>
                                <label className="mb-1 block text-xs font-bold text-zinc-500">
                                  Abre às
                                </label>

                                <input
                                  type="time"
                                  disabled={
                                    saving
                                  }
                                  value={
                                    period.opensAt
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    updatePeriod(
                                      day.day,
                                      periodIndex,
                                      "opensAt",
                                      event
                                        .target
                                        .value
                                    )
                                  }
                                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 font-bold outline-none transition focus:border-red-500 disabled:bg-zinc-100"
                                />
                              </div>

                              <span className="hidden pt-8 font-black text-zinc-300 sm:block">
                                →
                              </span>

                              <div>
                                <label className="mb-1 block text-xs font-bold text-zinc-500">
                                  Fecha às
                                </label>

                                <input
                                  type="time"
                                  disabled={
                                    saving
                                  }
                                  value={
                                    period.closesAt
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    updatePeriod(
                                      day.day,
                                      periodIndex,
                                      "closesAt",
                                      event
                                        .target
                                        .value
                                    )
                                  }
                                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 font-bold outline-none transition focus:border-red-500 disabled:bg-zinc-100"
                                />
                              </div>
                            </div>

                            {/* DIA SEGUINTE */}

                            {crossesMidnight(
                              period
                            ) && (
                              <div className="mt-3 inline-flex rounded-lg bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">
                                🌙 Fecha no dia seguinte
                              </div>
                            )}
                          </div>
                        )
                      )}
                    </div>

                    {/* ADICIONAR PERÍODO */}

                    {day.periods.length <
                      4 && (
                      <button
                        type="button"
                        disabled={
                          saving
                        }
                        onClick={() =>
                          addPeriod(
                            day.day
                          )
                        }
                        className="mt-3 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-black text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        ＋ Adicionar horário
                      </button>
                    )}

                    {day.periods.length >=
                      4 && (
                      <p className="mt-3 text-xs font-semibold text-zinc-400">
                        Máximo de 4 horários por dia.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-400">
                    Não recebe pedidos neste dia.
                  </div>
                )}
              </div>
            </div>
          )
        )}
      </section>

      {/* ==================================
          EXPLICAÇÃO
      ================================== */}

      <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-5">
        <p className="font-black text-zinc-900">
          Sobre os horários
        </p>

        <div className="mt-3 space-y-2 text-sm leading-6 text-zinc-600">
          <p>
            Você pode adicionar mais de um período
            no mesmo dia. Exemplo:{" "}
            <strong>
              11:00 às 14:00
            </strong>{" "}
            e{" "}
            <strong>
              18:00 às 23:00
            </strong>.
          </p>

          <p>
            Se a hora de fechamento for menor que a
            hora de abertura, o sistema entende que
            a loja fecha no dia seguinte. Exemplo:{" "}
            <strong>
              18:00 às 02:00
            </strong>.
          </p>
        </div>
      </div>

      {/* ==================================
          AVISO
      ================================== */}

      <div className="mt-4 rounded-2xl bg-yellow-50 p-4">
        <p className="font-bold text-yellow-800">
          🕐 Horário da loja
        </p>

        <p className="mt-1 text-sm leading-5 text-yellow-700">
          Os clientes só poderão realizar pedidos
          quando a loja estiver dentro de um dos
          horários configurados.
        </p>
      </div>

      {/* ==================================
          SALVAR
      ================================== */}

      <button
        type="button"
        onClick={
          saveHours
        }
        disabled={
          saving
        }
        className="mt-5 w-full rounded-xl bg-red-600 px-6 py-4 font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
      >
        {saving
          ? "Salvando horários..."
          : "Salvar horários"}
      </button>
    </div>
  );
}