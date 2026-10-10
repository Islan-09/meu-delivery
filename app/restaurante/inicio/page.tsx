"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

// ==========================================
// TIPOS
// ==========================================

type Restaurant = {
  id: string;
  name: string;
  active: boolean;
  neighborhood: string | null;

  cnpj: string | null;
  legal_name: string | null;

  approved_at: string | null;
  cnpj_required_by: string | null;
  cnpj_verified_at: string | null;
};

type ApplicationStatus =
  | "pending"
  | "approved"
  | "rejected";

type RestaurantApplication = {
  id: string;
  business_name: string;
  status: ApplicationStatus;
  rejection_reason: string | null;
  created_at: string;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
};

type DraftFormData = {
  businessName?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  category?: string;
};

type RegistrationDraft = {
  id: string;
  user_id: string;
  current_step: number;
  display_name: string | null;
  form_data: DraftFormData | null;
  created_at: string;
  updated_at: string;
};

// ==========================================
// NOME DA ETAPA
// ==========================================

function stepName(step: number) {
  const names: Record<number, string> = {
    1: "Responsável",
    2: "Loja",
    3: "Endereço",
    4: "Operação",
    5: "Acesso",
    6: "Revisão",
  };

  return names[step] || "Cadastro";
}

// ==========================================
// FORMATAR DATA / HORA
// ==========================================

function formatDate(value: string) {
  return new Date(value).toLocaleString(
    "pt-BR",
    {
      dateStyle: "short",
      timeStyle: "short",
    }
  );
}

// ==========================================
// FORMATAR DATA SIMPLES
// ==========================================

function formatSimpleDate(
  value: string | null
) {
  if (!value) {
    return "";
  }

  return new Date(
    value
  ).toLocaleDateString(
    "pt-BR"
  );
}

// ==========================================
// FORMATAR CNPJ
// ==========================================

function formatRestaurantCnpj(
  value: string | null
) {
  if (!value) {
    return "";
  }

  const numbers =
    value.replace(
      /\D/g,
      ""
    );

  if (
    numbers.length !==
    14
  ) {
    return value;
  }

  return numbers.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}

// ==========================================
// CALCULAR DIAS RESTANTES
// ==========================================

function getCnpjDaysRemaining(
  value: string | null
) {
  if (!value) {
    return null;
  }

  const deadline =
    new Date(
      value
    );

  const now =
    new Date();

  const milliseconds =
    deadline.getTime() -
    now.getTime();

  return Math.ceil(
    milliseconds /
      (
        1000 *
        60 *
        60 *
        24
      )
  );
}

// ==========================================
// PÁGINA
// ==========================================

export default function RestauranteInicioPage() {
  const router =
    useRouter();

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    creating,
    setCreating,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    userName,
    setUserName,
  ] =
    useState("");

  const [
    userEmail,
    setUserEmail,
  ] =
    useState("");

  const [
    restaurants,
    setRestaurants,
  ] =
    useState<
      Restaurant[]
    >([]);

  const [
    drafts,
    setDrafts,
  ] =
    useState<
      RegistrationDraft[]
    >([]);

  const [
    applications,
    setApplications,
  ] =
    useState<
      RestaurantApplication[]
    >([]);

  // ==========================================
  // SEPARAR CADASTROS
  // ==========================================

  const pendingApplications =
    useMemo(
      () =>
        applications.filter(
          (application) =>
            application.status ===
            "pending"
        ),
      [applications]
    );

  const rejectedApplications =
    useMemo(
      () =>
        applications.filter(
          (application) =>
            application.status ===
            "rejected"
        ),
      [applications]
    );

  // ==========================================
  // CARREGAR PORTAL
  // ==========================================

  const loadPortal =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        const {
          data: {
            session,
          },
        } =
          await supabase.auth.getSession();

        // ======================================
        // NÃO ESTÁ LOGADO
        // ======================================

        if (!session) {
          router.replace(
            "/restaurante"
          );

          return;
        }

        const currentUserId =
          session.user.id;

        const metadataName =
          session.user
            .user_metadata
            ?.full_name;

        if (
          typeof metadataName ===
          "string"
        ) {
          setUserName(
            metadataName
          );
        }

        setUserEmail(
          session.user.email ||
            ""
        );

        // ======================================
        // LOJAS APROVADAS
        // ======================================

        const {
          data:
            restaurantData,

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
              active,
              neighborhood,
              cnpj,
              legal_name,
              approved_at,
              cnpj_required_by,
              cnpj_verified_at
            `)
            .eq(
              "owner_id",
              currentUserId
            )
            .order(
              "name",
              {
                ascending:
                  true,
              }
            );

        if (
          restaurantError
        ) {
          console.error(
            "Erro lojas:",
            restaurantError
          );

          setError(
            "Não foi possível carregar suas lojas."
          );
        } else {
          setRestaurants(
            (
              restaurantData ??
              []
            ) as Restaurant[]
          );
        }

        // ======================================
        // CADASTROS EM ANDAMENTO
        // ======================================

        const {
          data:
            draftData,

          error:
            draftError,
        } =
          await supabase
            .from(
              "restaurant_registration_drafts"
            )
            .select(`
              id,
              user_id,
              current_step,
              display_name,
              form_data,
              created_at,
              updated_at
            `)
            .eq(
              "user_id",
              currentUserId
            )
            .order(
              "updated_at",
              {
                ascending:
                  false,
              }
            );

        if (
          draftError
        ) {
          console.error(
            "Erro rascunhos:",
            draftError
          );

          setError(
            "Não foi possível carregar os cadastros em andamento."
          );
        } else {
          setDrafts(
            (
              draftData ??
              []
            ) as RegistrationDraft[]
          );
        }

        // ======================================
        // CADASTROS ENVIADOS
        // ======================================

        const {
          data:
            applicationData,

          error:
            applicationError,
        } =
          await supabase
            .from(
              "restaurant_applications"
            )
            .select(`
              id,
              business_name,
              status,
              rejection_reason,
              created_at,
              street,
              number,
              neighborhood
            `)
            .eq(
              "user_id",
              currentUserId
            )
            .order(
              "created_at",
              {
                ascending:
                  false,
              }
            );

        if (
          applicationError
        ) {
          console.error(
            "Erro solicitações:",
            applicationError
          );

          setError(
            "Não foi possível carregar os cadastros enviados."
          );
        } else {
          setApplications(
            (
              applicationData ??
              []
            ) as RestaurantApplication[]
          );
        }

        setLoading(false);
      },
      [router]
    );

  useEffect(() => {
    loadPortal();
  }, [loadPortal]);

  // ==========================================
  // CRIAR NOVO CADASTRO
  // ==========================================

  async function createNewRegistration() {
    if (creating) {
      return;
    }

    setCreating(true);
    setError("");

    const {
      data: {
        session,
      },
    } =
      await supabase.auth.getSession();

    if (!session) {
      router.replace(
        "/restaurante"
      );

      return;
    }

    const {
      data,
      error:
        createError,
    } =
      await supabase
        .from(
          "restaurant_registration_drafts"
        )
        .insert({
          user_id:
            session.user.id,

          current_step:
            1,

          display_name:
            "Novo restaurante",

          form_data:
            {},
        })
        .select(`
          id
        `)
        .single();

    if (
      createError ||
      !data
    ) {
      console.error(
        "Erro ao criar cadastro:",
        createError
      );

      setError(
        "Não foi possível iniciar um novo cadastro."
      );

      setCreating(false);

      return;
    }

    router.push(
      `/seja-parceiro?draft=${data.id}`
    );
  }

  // ==========================================
  // ABRIR RASCUNHO
  // ==========================================

  function openDraft(
    draftId: string
  ) {
    router.push(
      `/seja-parceiro?draft=${draftId}`
    );
  }

  // ==========================================
  // VER CADASTRO EM ANÁLISE
  // ==========================================

  function openPendingApplication(
  applicationId: string
) {
  router.push(
    `/seja-parceiro?application=${applicationId}`
  );
}

  // ==========================================
  // ABRIR PAINEL DA LOJA
  // ==========================================

  function openRestaurant(
    restaurantId: string
  ) {
    router.push(
      `/restaurante-painel?restaurant=${restaurantId}`
    );
  }

  // ==========================================
  // ABRIR DADOS DO CNPJ
  // ==========================================

  function openCnpj(
    restaurantId: string
  ) {
    router.push(
      `/restaurante/cnpj?restaurant=${restaurantId}`
    );
  }

  // ==========================================
  // SAIR
  // ==========================================

  async function logout() {
    await supabase.auth.signOut();

    router.replace(
      "/restaurante"
    );

    router.refresh();
  }

  // ==========================================
  // CARREGANDO
  // ==========================================

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7]">
        <div className="text-center">
          <div className="text-5xl">
            🏪
          </div>

          <p className="mt-4 font-black">
            Carregando suas lojas...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f7f7] text-zinc-900">
      {/* ======================================
          CABEÇALHO
      ====================================== */}

      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
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
              logout
            }
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-black transition hover:bg-zinc-50"
          >
            Sair
          </button>
        </div>
      </header>

      {/* ======================================
          CONTEÚDO
      ====================================== */}

      <div className="mx-auto max-w-3xl px-4 py-12">
        {/* ==================================
            BOAS-VINDAS
        ================================== */}

        <div>
          <p className="text-sm font-black uppercase text-red-600">
            PORTAL DO RESTAURANTE
          </p>

          <h2 className="mt-2 text-3xl font-black md:text-4xl">
            Que bom te ver de novo!
          </h2>

          <p className="mt-3 text-zinc-500">
            Acompanhe suas lojas e continue
            seus cadastros de onde parou.
          </p>

          {(userName ||
            userEmail) && (
            <p className="mt-2 text-sm font-bold text-zinc-400">
              {userName
                ? `${userName} • `
                : ""}

              {userEmail}
            </p>
          )}
        </div>

        {/* ==================================
            RESUMO
        ================================== */}

        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <p className="text-2xl font-black">
              {drafts.length}
            </p>

            <p className="mt-1 text-sm font-bold text-zinc-500">
              Em andamento
            </p>
          </div>

          <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5">
            <p className="text-2xl font-black text-yellow-800">
              {
                pendingApplications.length
              }
            </p>

            <p className="mt-1 text-sm font-bold text-yellow-700">
              Em análise
            </p>
          </div>

          <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
            <p className="text-2xl font-black text-green-800">
              {
                restaurants.length
              }
            </p>

            <p className="mt-1 text-sm font-bold text-green-700">
              Lojas aprovadas
            </p>
          </div>
        </section>

        {/* ==================================
            ERRO
        ================================== */}

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">
            ⚠️ {error}
          </div>
        )}

        {/* ==================================
            CADASTROS EM ANDAMENTO
        ================================== */}

        <section className="mt-10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black">
                Cadastros em andamento
              </h3>

              <p className="mt-1 text-sm text-zinc-500">
                Continue exatamente de onde
                parou.
              </p>
            </div>

            {drafts.length >
              0 && (
              <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700">
                {drafts.length}
              </span>
            )}
          </div>

          {drafts.length ===
          0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-zinc-300 bg-white p-7 text-center">
              <div className="text-4xl">
                📝
              </div>

              <p className="mt-3 font-black">
                Nenhum cadastro em andamento
              </p>

              <p className="mt-2 text-sm text-zinc-500">
                Seus novos cadastros aparecerão
                aqui enquanto ainda estiverem
                sendo preenchidos.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {drafts.map(
                (
                  draft
                ) => {
                  const formData =
                    draft.form_data ||
                    {};

                  const name =
                    formData.businessName ||
                    draft.display_name ||
                    "Novo restaurante";

                  const addressParts =
                    [
                      formData.street,
                      formData.number,
                      formData.neighborhood,
                    ].filter(
                      Boolean
                    );

                  return (
                    <button
                      key={
                        draft.id
                      }
                      type="button"
                      onClick={() =>
                        openDraft(
                          draft.id
                        )
                      }
                      className="group flex w-full items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-sm transition hover:border-red-200 hover:shadow-md"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 text-2xl">
                        🏬
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="truncate font-black">
                            {name}
                          </p>

                          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-black text-zinc-600">
                            Preenchimento pendente
                          </span>
                        </div>

                        {addressParts.length >
                          0 && (
                          <p className="mt-2 truncate text-sm text-zinc-500">
                            📍{" "}
                            {addressParts.join(
                              ", "
                            )}
                          </p>
                        )}

                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                          <p className="text-sm font-black text-red-600">
                            Etapa{" "}
                            {
                              draft.current_step
                            }{" "}
                            de 6 •{" "}
                            {stepName(
                              draft.current_step
                            )}
                          </p>

                          <p className="text-xs text-zinc-400">
                            Salvo em{" "}
                            {formatDate(
                              draft.updated_at
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="text-xl text-zinc-300">
                        ›
                      </div>
                    </button>
                  );
                }
              )}
            </div>
          )}
        </section>

        {/* ==================================
            CADASTROS EM ANÁLISE
        ================================== */}

        <section className="mt-10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black">
                Cadastros em análise
              </h3>

              <p className="mt-1 text-sm text-zinc-500">
                Cadastros enviados e aguardando
                aprovação.
              </p>
            </div>

            {pendingApplications.length >
              0 && (
              <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-black text-yellow-700">
                {
                  pendingApplications.length
                }
              </span>
            )}
          </div>

          {pendingApplications.length ===
          0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-zinc-300 bg-white p-7 text-center">
              <div className="text-4xl">
                🔎
              </div>

              <p className="mt-3 font-black">
                Nenhum cadastro em análise
              </p>

              <p className="mt-2 text-sm text-zinc-500">
                Quando você enviar um cadastro,
                ele aparecerá aqui.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {pendingApplications.map(
                (
                  application
                ) => {
                  const addressParts =
                    [
                      application.street,
                      application.number,
                      application.neighborhood,
                    ].filter(
                      Boolean
                    );

                  return (
                    <button
                      key={
                        application.id
                      }
                      type="button"
                      onClick={() =>
  openPendingApplication(
    application.id
  )
}
                      className="group flex w-full items-center gap-4 rounded-2xl border border-yellow-200 bg-white p-5 text-left shadow-sm transition hover:border-yellow-400 hover:shadow-md"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-yellow-50 text-2xl">
                        ⏳
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="truncate font-black">
                            {
                              application.business_name
                            }
                          </p>

                          <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-black text-yellow-700">
                            Aguardando aprovação
                          </span>
                        </div>

                        {addressParts.length >
                          0 && (
                          <p className="mt-2 truncate text-sm text-zinc-500">
                            📍{" "}
                            {addressParts.join(
                              ", "
                            )}
                          </p>
                        )}

                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                          <p className="text-sm font-black text-yellow-700">
                            🔎 Cadastro em análise
                          </p>

                          <p className="text-xs text-zinc-400">
                            Enviado em{" "}
                            {formatDate(
                              application.created_at
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="text-xl text-zinc-300">
                        ›
                      </div>
                    </button>
                  );
                }
              )}
            </div>
          )}
        </section>

        {/* ==================================
            CADASTROS RECUSADOS
        ================================== */}

        {rejectedApplications.length >
          0 && (
          <section className="mt-10">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black">
                  Cadastros que precisam de correção
                </h3>

                <p className="mt-1 text-sm text-zinc-500">
                  Revise o motivo e envie novamente.
                </p>
              </div>

              <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700">
                {
                  rejectedApplications.length
                }
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {rejectedApplications.map(
                (
                  application
                ) => (
                  <button
                    key={
                      application.id
                    }
                    type="button"
                    onClick={() =>
  openPendingApplication(
    application.id
  )
}
                    className="group flex w-full items-center gap-4 rounded-2xl border border-red-200 bg-white p-5 text-left shadow-sm transition hover:border-red-400 hover:shadow-md"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 text-2xl">
                      ⚠️
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="truncate font-black">
                          {
                            application.business_name
                          }
                        </p>

                        <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700">
                          Correção necessária
                        </span>
                      </div>

                      {application.rejection_reason && (
                        <p className="mt-2 text-sm text-red-700">
                          Motivo:{" "}
                          {
                            application.rejection_reason
                          }
                        </p>
                      )}

                      <p className="mt-3 text-sm font-black text-red-600">
                        Corrigir cadastro
                      </p>
                    </div>

                    <div className="text-xl text-zinc-300">
                      ›
                    </div>
                  </button>
                )
              )}
            </div>
          </section>
        )}

        {/* ==================================
            LOJAS APROVADAS
        ================================== */}

        <section className="mt-10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black">
                Lojas aprovadas
              </h3>

              <p className="mt-1 text-sm text-zinc-500">
                Estabelecimentos já liberados.
              </p>
            </div>

            {restaurants.length >
              0 && (
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-black text-green-700">
                {
                  restaurants.length
                }
              </span>
            )}
          </div>

          {restaurants.length ===
          0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-zinc-300 bg-white p-7 text-center">
              <div className="text-4xl">
                🏪
              </div>

              <p className="mt-3 font-black">
                Nenhuma loja aprovada ainda
              </p>

              <p className="mt-2 text-sm text-zinc-500">
                As lojas liberadas pelo
                administrador aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {restaurants.map(
                (
                  restaurant
                ) => {
                  const hasCnpj =
                    Boolean(
                      restaurant.cnpj
                    );

                  const isVerified =
                    Boolean(
                      restaurant.cnpj_verified_at
                    );

                  const cnpjDays =
                    getCnpjDaysRemaining(
                      restaurant.cnpj_required_by
                    );

                  return (
                    <div
                      key={
                        restaurant.id
                      }
                      className="rounded-2xl border border-green-200 bg-white p-5 shadow-sm"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-50 text-2xl">
                          🏪
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-black">
                              {
                                restaurant.name
                              }
                            </p>

                            <span
                              className={`rounded-full px-2 py-1 text-[10px] font-black ${
                                restaurant.active
                                  ? "bg-green-100 text-green-700"
                                  : "bg-zinc-100 text-zinc-500"
                              }`}
                            >
                              {restaurant.active
                                ? "ATIVA"
                                : "INATIVA"}
                            </span>
                          </div>

                          {restaurant.neighborhood && (
                            <p className="mt-1 text-sm text-zinc-500">
                              📍{" "}
                              {
                                restaurant.neighborhood
                              }
                              , Paudalho
                            </p>
                          )}

                          {/* ===============================
                              CNPJ VERIFICADO
                          =============================== */}

                          {isVerified && (
                            <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4">
                              <p className="text-sm font-black text-green-800">
                                ✅ CNPJ verificado
                              </p>

                              {restaurant.cnpj && (
                                <p className="mt-1 text-xs font-bold text-green-700">
                                  {formatRestaurantCnpj(
                                    restaurant.cnpj
                                  )}
                                </p>
                              )}

                              {restaurant.legal_name && (
                                <p className="mt-1 text-xs text-green-700">
                                  {
                                    restaurant.legal_name
                                  }
                                </p>
                              )}
                            </div>
                          )}

                          {/* ===============================
                              CNPJ ENVIADO MAS NÃO VERIFICADO
                          =============================== */}

                          {!isVerified &&
                            hasCnpj && (
                            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
                              <p className="text-sm font-black text-blue-800">
                                🔎 CNPJ aguardando verificação
                              </p>

                              <p className="mt-1 text-xs font-bold text-blue-700">
                                {formatRestaurantCnpj(
                                  restaurant.cnpj
                                )}
                              </p>

                              {restaurant.legal_name && (
                                <p className="mt-1 text-xs text-blue-700">
                                  {
                                    restaurant.legal_name
                                  }
                                </p>
                              )}

                              {restaurant.cnpj_required_by &&
                                cnpjDays !==
                                  null && (
                                  <p className="mt-2 text-xs text-blue-700">
                                    Prazo para verificação:{" "}
                                    <strong>
                                      {formatSimpleDate(
                                        restaurant.cnpj_required_by
                                      )}
                                    </strong>
                                  </p>
                                )}
                            </div>
                          )}

                          {/* ===============================
                              SEM CNPJ - DENTRO DO PRAZO
                          =============================== */}

                          {!isVerified &&
                            !hasCnpj &&
                            restaurant.cnpj_required_by &&
                            cnpjDays !==
                              null &&
                            cnpjDays >
                              0 && (
                            <div className="mt-4 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                              <p className="text-sm font-black text-yellow-800">
                                ⚠️ CNPJ pendente
                              </p>

                              <p className="mt-1 text-xs leading-5 text-yellow-700">
                                Esta loja está utilizando
                                temporariamente o cadastro
                                com CPF.
                              </p>

                              <p className="mt-2 text-xs text-yellow-700">
                                Prazo:{" "}
                                <strong>
                                  {formatSimpleDate(
                                    restaurant.cnpj_required_by
                                  )}
                                </strong>
                              </p>

                              <p className="mt-1 text-xs font-black text-yellow-800">
                                {cnpjDays ===
                                1
                                  ? "Falta 1 dia"
                                  : `Faltam ${cnpjDays} dias`}
                              </p>
                            </div>
                          )}

                          {/* ===============================
                              SEM CNPJ - PRAZO VENCIDO
                          =============================== */}

                          {!isVerified &&
                            !hasCnpj &&
                            restaurant.cnpj_required_by &&
                            cnpjDays !==
                              null &&
                            cnpjDays <=
                              0 && (
                            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                              <p className="text-sm font-black text-red-700">
                                🚨 Prazo do CNPJ vencido
                              </p>

                              <p className="mt-1 text-xs leading-5 text-red-700">
                                O prazo terminou em{" "}
                                <strong>
                                  {formatSimpleDate(
                                    restaurant.cnpj_required_by
                                  )}
                                </strong>
                                .
                              </p>
                            </div>
                          )}

                          {/* ===============================
                              SEM PRAZO AINDA
                          =============================== */}

                          {!isVerified &&
                            !hasCnpj &&
                            !restaurant.cnpj_required_by && (
                            <div className="mt-4 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                              <p className="text-sm font-black text-yellow-800">
                                ⚠️ CNPJ ainda não cadastrado
                              </p>

                              <p className="mt-1 text-xs leading-5 text-yellow-700">
                                Cadastre os dados fiscais
                                desta loja.
                              </p>
                            </div>
                          )}

                          {/* ===============================
                              BOTÕES
                          =============================== */}

                          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                            <button
                              type="button"
                              onClick={() =>
                                openRestaurant(
                                  restaurant.id
                                )
                              }
                              className="flex-1 rounded-xl bg-green-600 px-4 py-3 text-sm font-black text-white transition hover:bg-green-700"
                            >
                              Abrir painel da loja
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                openCnpj(
                                  restaurant.id
                                )
                              }
                              className={`flex-1 rounded-xl border-2 px-4 py-3 text-sm font-black transition ${
                                isVerified
                                  ? "border-green-600 bg-white text-green-700 hover:bg-green-50"
                                  : hasCnpj
                                  ? "border-blue-600 bg-white text-blue-700 hover:bg-blue-50"
                                  : "border-red-600 bg-white text-red-600 hover:bg-red-50"
                              }`}
                            >
                              {isVerified
                                ? "Ver dados fiscais"
                                : hasCnpj
                                ? "Ver / atualizar CNPJ"
                                : "Cadastrar CNPJ"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </section>

        {/* ==================================
            CADASTRAR OUTRA LOJA
        ================================== */}

        <section className="mt-10">
          <button
            type="button"
            onClick={
              createNewRegistration
            }
            disabled={
              creating
            }
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-300 bg-white px-5 py-5 font-black transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="text-xl">
              +
            </span>

            {creating
              ? "Criando cadastro..."
              : "Cadastrar outra loja"}
          </button>
        </section>

        {/* ==================================
            AVISO
        ================================== */}

        <div className="mt-8 rounded-2xl bg-zinc-100 p-5">
          <p className="font-black">
            💡 Seus dados ficam salvos
          </p>

          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Você pode interromper um cadastro e
            continuar depois. Quando enviar para
            análise, ele será movido
            automaticamente para a área de
            cadastros em análise.
          </p>
        </div>
      </div>
    </main>
  );
}