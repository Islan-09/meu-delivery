"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import { supabase } from "@/lib/supabase";

// ==========================================
// TIPOS
// ==========================================

type Restaurant = {
  id: string;
  name: string;
  owner_id: string;

  cnpj:
    | string
    | null;

  legal_name:
    | string
    | null;

  approved_at:
    | string
    | null;

  cnpj_required_by:
    | string
    | null;

  cnpj_verified_at:
    | string
    | null;
};

// ==========================================
// LIMPAR CNPJ
// ==========================================

function cleanCnpj(
  value: string
) {
  return value.replace(
    /\D/g,
    ""
  );
}

// ==========================================
// FORMATAR CNPJ
// ==========================================

function formatCnpj(
  value: string
) {
  const numbers =
    cleanCnpj(
      value
    ).slice(
      0,
      14
    );

  return numbers
    .replace(
      /^(\d{2})(\d)/,
      "$1.$2"
    )
    .replace(
      /^(\d{2})\.(\d{3})(\d)/,
      "$1.$2.$3"
    )
    .replace(
      /\.(\d{3})(\d)/,
      ".$1/$2"
    )
    .replace(
      /(\d{4})(\d)/,
      "$1-$2"
    );
}

// ==========================================
// VALIDAR CNPJ
// ==========================================

function isValidCnpj(
  value: string
) {
  const cnpj =
    cleanCnpj(
      value
    );

  if (
    cnpj.length !==
    14
  ) {
    return false;
  }

  if (
    /^(\d)\1{13}$/.test(
      cnpj
    )
  ) {
    return false;
  }

  const calculateDigit = (
    base: string,
    weights: number[]
  ) => {
    let sum =
      0;

    for (
      let i = 0;
      i <
      weights.length;
      i++
    ) {
      sum +=
        Number(
          base[i]
        ) *
        weights[i];
    }

    const remainder =
      sum % 11;

    return remainder <
      2
      ? 0
      : 11 -
          remainder;
  };

  const firstDigit =
    calculateDigit(
      cnpj.slice(
        0,
        12
      ),
      [
        5,
        4,
        3,
        2,
        9,
        8,
        7,
        6,
        5,
        4,
        3,
        2,
      ]
    );

  if (
    firstDigit !==
    Number(
      cnpj[12]
    )
  ) {
    return false;
  }

  const secondDigit =
    calculateDigit(
      cnpj.slice(
        0,
        13
      ),
      [
        6,
        5,
        4,
        3,
        2,
        9,
        8,
        7,
        6,
        5,
        4,
        3,
        2,
      ]
    );

  return (
    secondDigit ===
    Number(
      cnpj[13]
    )
  );
}

// ==========================================
// FORMATAR DATA
// ==========================================

function formatDate(
  value:
    | string
    | null
) {
  if (
    !value
  ) {
    return "";
  }

  return new Date(
    value
  ).toLocaleDateString(
    "pt-BR"
  );
}

// ==========================================
// DIAS RESTANTES
// ==========================================

function getDaysRemaining(
  value:
    | string
    | null
) {
  if (
    !value
  ) {
    return null;
  }

  const deadline =
    new Date(
      value
    );

  const now =
    new Date();

  return Math.ceil(
    (
      deadline.getTime() -
      now.getTime()
    ) /
      (
        1000 *
        60 *
        60 *
        24
      )
  );
}

// ==========================================
// TRADUZIR ERRO DO BACKEND
// ==========================================

function translateSubmitError(
  message: string
) {
  if (
    message.includes(
      "CNPJ_INVALID"
    )
  ) {
    return "O CNPJ informado é inválido.";
  }

  if (
    message.includes(
      "LEGAL_NAME_INVALID"
    )
  ) {
    return "Informe uma razão social válida.";
  }

  if (
    message.includes(
      "RESTAURANT_NOT_FOUND"
    )
  ) {
    return "Essa loja não foi encontrada ou não pertence à sua conta.";
  }

  if (
    message.includes(
      "RESTAURANT_NOT_APPROVED"
    )
  ) {
    return "O CNPJ só pode ser enviado depois que a loja for aprovada.";
  }

  if (
    message.includes(
      "CNPJ_ALREADY_VERIFIED"
    )
  ) {
    return "O CNPJ desta loja já foi verificado.";
  }

  if (
    message.includes(
      "CNPJ_ALREADY_IN_USE"
    )
  ) {
    return "Esse CNPJ já está cadastrado em outra loja.";
  }

  if (
    message.includes(
      "NOT_AUTHENTICATED"
    )
  ) {
    return "Sua sessão expirou. Entre novamente.";
  }

  return "Não foi possível salvar o CNPJ. Tente novamente.";
}

// ==========================================
// CONTEÚDO
// ==========================================

function CnpjPageContent() {
  const router =
    useRouter();

  const searchParams =
    useSearchParams();

  const restaurantId =
    searchParams.get(
      "restaurant"
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
    restaurant,
    setRestaurant,
  ] =
    useState<
      Restaurant | null
    >(
      null
    );

  const [
    cnpj,
    setCnpj,
  ] =
    useState("");

  const [
    legalName,
    setLegalName,
  ] =
    useState("");

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    success,
    setSuccess,
  ] =
    useState("");

  // ==========================================
  // DIAS RESTANTES
  // ==========================================

  const daysRemaining =
    useMemo(
      () =>
        getDaysRemaining(
          restaurant
            ?.cnpj_required_by ??
            null
        ),
      [
        restaurant,
      ]
    );

  // ==========================================
  // CARREGAR LOJA
  // ==========================================

  const loadRestaurant =
    useCallback(
      async () => {
        setLoading(
          true
        );

        setError("");

        const {
          data: {
            session,
          },
        } =
          await supabase.auth
            .getSession();

        if (
          !session
        ) {
          router.replace(
            "/restaurante"
          );

          return;
        }

        if (
          !restaurantId
        ) {
          setError(
            "Nenhuma loja foi selecionada."
          );

          setLoading(
            false
          );

          return;
        }

        const {
          data,
          error:
            restaurantError,
        } =
          await supabase
            .from(
              "restaurants"
            )
            .select(`
              id,
              name,
              owner_id,
              cnpj,
              legal_name,
              approved_at,
              cnpj_required_by,
              cnpj_verified_at
            `)
            .eq(
              "id",
              restaurantId
            )
            .eq(
              "owner_id",
              session.user.id
            )
            .maybeSingle();

        if (
          restaurantError
        ) {
          console.error(
            "Erro ao carregar loja:",
            restaurantError
          );

          setError(
            "Não foi possível carregar os dados da loja."
          );

          setLoading(
            false
          );

          return;
        }

        if (
          !data
        ) {
          setError(
            "Essa loja não foi encontrada ou não pertence à sua conta."
          );

          setLoading(
            false
          );

          return;
        }

        const loadedRestaurant =
          data as Restaurant;

        setRestaurant(
          loadedRestaurant
        );

        if (
          loadedRestaurant.cnpj
        ) {
          setCnpj(
            formatCnpj(
              loadedRestaurant.cnpj
            )
          );
        }

        if (
          loadedRestaurant.legal_name
        ) {
          setLegalName(
            loadedRestaurant.legal_name
          );
        }

        setLoading(
          false
        );
      },
      [
        restaurantId,
        router,
      ]
    );

  useEffect(() => {
    loadRestaurant();
  }, [
    loadRestaurant,
  ]);

  // ==========================================
  // VOLTAR
  // ==========================================

  function goBack() {
    router.push(
      "/restaurante/inicio"
    );
  }

  // ==========================================
  // SALVAR
  // ==========================================

  async function submitCnpj(
    event:
      React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      saving ||
      !restaurant
    ) {
      return;
    }

    setError("");
    setSuccess("");

    if (
      !restaurant.approved_at
    ) {
      setError(
        "Esta loja ainda não foi aprovada."
      );

      return;
    }

    if (
      restaurant.cnpj_verified_at
    ) {
      setError(
        "O CNPJ desta loja já foi verificado e não pode ser alterado por esta tela."
      );

      return;
    }

    const cleanValue =
      cleanCnpj(
        cnpj
      );

    if (
      !isValidCnpj(
        cleanValue
      )
    ) {
      setError(
        "Digite um CNPJ válido."
      );

      return;
    }

    const cleanLegalName =
      legalName.trim();

    if (
      cleanLegalName.length <
      3
    ) {
      setError(
        "Digite a razão social da empresa."
      );

      return;
    }

    setSaving(
      true
    );

    const {
      data,
      error:
        submitError,
    } =
      await supabase.rpc(
        "submit_restaurant_cnpj",
        {
          p_restaurant_id:
            restaurant.id,

          p_cnpj:
            cleanValue,

          p_legal_name:
            cleanLegalName,
        }
      );

    if (
      submitError
    ) {
      console.error(
        "Erro ao enviar CNPJ:",
        submitError
      );

      setError(
        translateSubmitError(
          submitError.message
        )
      );

      setSaving(
        false
      );

      return;
    }

    const result =
      data as {
        success?: boolean;
        cnpj?: string;
        legal_name?: string;
        cnpj_required_by?: string | null;
        cnpj_verified_at?: string | null;
      };

    setRestaurant(
      (
        current
      ) =>
        current
          ? {
              ...current,

              cnpj:
                result.cnpj ??
                cleanValue,

              legal_name:
                result.legal_name ??
                cleanLegalName,

              cnpj_required_by:
                result.cnpj_required_by ??
                current.cnpj_required_by,

              cnpj_verified_at:
                result.cnpj_verified_at ??
                null,
            }
          : current
    );

    setCnpj(
      formatCnpj(
        result.cnpj ??
          cleanValue
      )
    );

    setLegalName(
      result.legal_name ??
        cleanLegalName
    );

    setSuccess(
      "CNPJ enviado com sucesso. Agora ele está aguardando verificação."
    );

    setSaving(
      false
    );
  }

  // ==========================================
  // CARREGANDO
  // ==========================================

  if (
    loading
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7]">
        <div className="text-center">
          <div className="text-5xl">
            🧾
          </div>

          <p className="mt-4 font-black">
            Carregando dados fiscais...
          </p>
        </div>
      </main>
    );
  }

  // ==========================================
  // LOJA NÃO ENCONTRADA
  // ==========================================

  if (
    !restaurant
  ) {
    return (
      <main className="min-h-screen bg-[#f7f7f7] px-4 py-12 text-zinc-900">
        <div className="mx-auto max-w-xl">
          <div className="rounded-3xl border border-red-200 bg-white p-8 shadow-sm">
            <div className="text-5xl">
              ⚠️
            </div>

            <h1 className="mt-5 text-2xl font-black">
              Não foi possível abrir esta loja
            </h1>

            <p className="mt-3 leading-7 text-zinc-500">
              {error ||
                "A loja não foi encontrada."}
            </p>

            <button
              type="button"
              onClick={
                goBack
              }
              className="mt-7 w-full rounded-xl bg-zinc-900 px-5 py-4 font-black text-white transition hover:bg-zinc-800"
            >
              ← Voltar para minhas lojas
            </button>
          </div>
        </div>
      </main>
    );
  }

  const isVerified =
    Boolean(
      restaurant.cnpj_verified_at
    );

  const hasSubmittedCnpj =
    Boolean(
      restaurant.cnpj
    );

  // ==========================================
  // PÁGINA
  // ==========================================

  return (
    <main className="min-h-screen bg-[#f7f7f7] text-zinc-900">
      {/* ======================================
          CABEÇALHO
      ====================================== */}

      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-xs font-black uppercase text-red-600">
              Entrega Paudalho
            </p>

            <h1 className="mt-1 font-black">
              Portal do Restaurante
            </h1>
          </div>

          <button
            type="button"
            onClick={
              goBack
            }
            className="rounded-xl border-2 border-zinc-900 bg-white px-4 py-2 text-sm font-black text-zinc-900 transition hover:bg-zinc-900 hover:text-white"
          >
            ← Minhas lojas
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-10">
        {/* ==================================
            TÍTULO
        ================================== */}

        <div>
          <p className="text-sm font-black uppercase text-red-600">
            DADOS FISCAIS
          </p>

          <h2 className="mt-2 text-3xl font-black">
            CNPJ da loja
          </h2>

          <p className="mt-3 leading-7 text-zinc-500">
            Loja:{" "}
            <strong className="text-zinc-900">
              {
                restaurant.name
              }
            </strong>
          </p>
        </div>

        {/* ==================================
            STATUS VERIFICADO
        ================================== */}

        {isVerified && (
          <div className="mt-7 rounded-2xl border border-green-200 bg-green-50 p-5">
            <div className="flex gap-3">
              <div className="text-2xl">
                ✅
              </div>

              <div>
                <p className="font-black text-green-800">
                  CNPJ verificado
                </p>

                <p className="mt-1 text-sm leading-6 text-green-700">
                  Os dados fiscais desta loja já
                  foram verificados.
                </p>

                {restaurant.cnpj && (
                  <p className="mt-3 text-sm font-black text-green-800">
                    {formatCnpj(
                      restaurant.cnpj
                    )}
                  </p>
                )}

                {restaurant.legal_name && (
                  <p className="mt-1 text-sm text-green-700">
                    {
                      restaurant.legal_name
                    }
                  </p>
                )}

                {restaurant.cnpj_verified_at && (
                  <p className="mt-3 text-xs text-green-700">
                    Verificado em{" "}
                    {formatDate(
                      restaurant.cnpj_verified_at
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================================
            CNPJ JÁ ENVIADO
        ================================== */}

        {!isVerified &&
          hasSubmittedCnpj && (
            <div className="mt-7 rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <div className="flex gap-3">
                <div className="text-2xl">
                  🔎
                </div>

                <div>
                  <p className="font-black text-blue-800">
                    CNPJ aguardando verificação
                  </p>

                  <p className="mt-1 text-sm leading-6 text-blue-700">
                    Recebemos os dados fiscais
                    desta loja. Enquanto eles não
                    forem verificados, o prazo
                    continua contando normalmente.
                  </p>
                </div>
              </div>
            </div>
          )}

        {/* ==================================
            PRAZO
        ================================== */}

        {!isVerified &&
          restaurant.cnpj_required_by &&
          daysRemaining !==
            null && (
            <>
              {daysRemaining >
              0 ? (
                <div className="mt-5 rounded-2xl border border-yellow-200 bg-yellow-50 p-5">
                  <p className="font-black text-yellow-800">
                    ⚠️ Prazo para regularização
                  </p>

                  <p className="mt-2 text-sm leading-6 text-yellow-700">
                    O CNPJ precisa ser verificado
                    até{" "}
                    <strong>
                      {formatDate(
                        restaurant.cnpj_required_by
                      )}
                    </strong>
                    .
                  </p>

                  <p className="mt-2 font-black text-yellow-800">
                    {daysRemaining ===
                    1
                      ? "Falta 1 dia"
                      : `Faltam ${daysRemaining} dias`}
                  </p>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5">
                  <p className="font-black text-red-700">
                    🚨 Prazo vencido
                  </p>

                  <p className="mt-2 text-sm leading-6 text-red-700">
                    O prazo terminou em{" "}
                    <strong>
                      {formatDate(
                        restaurant.cnpj_required_by
                      )}
                    </strong>
                    .
                  </p>
                </div>
              )}
            </>
          )}

        {/* ==================================
            FORMULÁRIO
        ================================== */}

        {!isVerified && (
          <form
            onSubmit={
              submitCnpj
            }
            className="mt-7 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm md:p-8"
          >
            <div>
              <label
                htmlFor="cnpj"
                className="text-sm font-black"
              >
                CNPJ
              </label>

              <input
                id="cnpj"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={
                  cnpj
                }
                onChange={(
                  event
                ) => {
                  setCnpj(
                    formatCnpj(
                      event
                        .target
                        .value
                    )
                  );

                  setError("");
                  setSuccess("");
                }}
                placeholder="00.000.000/0000-00"
                className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 font-bold outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
              />

              <p className="mt-2 text-xs leading-5 text-zinc-400">
                Digite os 14 números do CNPJ.
              </p>
            </div>

            <div className="mt-6">
              <label
                htmlFor="legalName"
                className="text-sm font-black"
              >
                Razão social
              </label>

              <input
                id="legalName"
                type="text"
                value={
                  legalName
                }
                onChange={(
                  event
                ) => {
                  setLegalName(
                    event
                      .target
                      .value
                  );

                  setError("");
                  setSuccess("");
                }}
                placeholder="Ex.: Restaurante Exemplo LTDA"
                className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 font-bold outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
              />

              <p className="mt-2 text-xs leading-5 text-zinc-400">
                Informe a razão social exatamente
                como consta no cadastro da empresa.
              </p>
            </div>

            {/* ==================================
                ERRO
            ================================== */}

            {error && (
              <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
                ⚠️{" "}
                {
                  error
                }
              </div>
            )}

            {/* ==================================
                SUCESSO
            ================================== */}

            {success && (
              <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-700">
                ✅{" "}
                {
                  success
                }
              </div>
            )}

            <button
              type="submit"
              disabled={
                saving
              }
              className="mt-7 w-full rounded-xl bg-red-600 px-5 py-4 font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Enviando CNPJ..."
                : hasSubmittedCnpj
                ? "Atualizar dados do CNPJ"
                : "Enviar CNPJ para verificação"}
            </button>

            {hasSubmittedCnpj && (
              <p className="mt-4 text-center text-xs leading-5 text-zinc-400">
                Enquanto o CNPJ ainda não tiver
                sido verificado, você poderá
                corrigir os dados enviados.
              </p>
            )}
          </form>
        )}

        {/* ==================================
            VOLTAR
        ================================== */}

        <button
          type="button"
          onClick={
            goBack
          }
          className="mt-6 w-full rounded-xl border-2 border-zinc-900 bg-white px-5 py-4 font-black text-zinc-900 transition hover:bg-zinc-900 hover:text-white"
        >
          ← Voltar para minhas lojas
        </button>
      </div>
    </main>
  );
}

// ==========================================
// EXPORT DA PÁGINA
// ==========================================

export default function RestauranteCnpjPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7]">
          <p className="font-black">
            Carregando...
          </p>
        </main>
      }
    >
      <CnpjPageContent />
    </Suspense>
  );
}