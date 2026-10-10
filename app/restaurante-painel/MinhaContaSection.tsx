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

type Restaurant = {
  id: string;
  name: string;
  active: boolean;
};

type ApplicationStatus =
  | "pending"
  | "approved"
  | "rejected";

type RestaurantApplication = {
  id: string;
  business_name: string;
  status: ApplicationStatus;
  created_at: string;

  responsible_name: string | null;
  responsible_cpf: string | null;

  has_cnpj: boolean | null;
  cnpj: string | null;
  legal_name: string | null;

  phone: string | null;
  category: string | null;
};

type CnpjCompliance = {
  has_cnpj: boolean;
  grace_started_at: string;
  deadline_at: string;
  days_remaining: number;
  blocked: boolean;
};

type CnpjHistoryItem = {
  event_type: string;
  event_at: string;
};

function onlyNumbers(
  value:
    | string
    | null
    | undefined
) {
  return (
    value ??
    ""
  ).replace(
    /\D/g,
    ""
  );
}

function formatCpf(
  value:
    | string
    | null
    | undefined
) {
  const numbers =
    onlyNumbers(
      value
    ).slice(
      0,
      11
    );

  if (
    numbers.length !==
    11
  ) {
    return value || "—";
  }

  return numbers
    .replace(
      /^(\d{3})(\d)/,
      "$1.$2"
    )
    .replace(
      /^(\d{3})\.(\d{3})(\d)/,
      "$1.$2.$3"
    )
    .replace(
      /\.(\d{3})(\d)/,
      ".$1-$2"
    );
}

function maskCpf(
  value:
    | string
    | null
    | undefined
) {
  const numbers =
    onlyNumbers(
      value
    );

  if (
    numbers.length !==
    11
  ) {
    return "—";
  }

  return `***.***.***-${numbers.slice(
    -2
  )}`;
}

function formatCnpj(
  value:
    | string
    | null
    | undefined
) {
  const numbers =
    onlyNumbers(
      value
    ).slice(
      0,
      14
    );

  if (
    numbers.length !==
    14
  ) {
    return value || "—";
  }

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

function maskCnpj(
  value:
    | string
    | null
    | undefined
) {
  const numbers =
    onlyNumbers(
      value
    );

  if (
    numbers.length !==
    14
  ) {
    return "—";
  }

  return `**.***.***/****-${numbers.slice(
    -2
  )}`;
}

function formatPhone(
  value:
    | string
    | null
    | undefined
) {
  const numbers =
    onlyNumbers(
      value
    );

  if (
    numbers.length ===
    11
  ) {
    return `(${numbers.slice(
      0,
      2
    )}) ${numbers.slice(
      2,
      7
    )}-${numbers.slice(
      7
    )}`;
  }

  if (
    numbers.length ===
    10
  ) {
    return `(${numbers.slice(
      0,
      2
    )}) ${numbers.slice(
      2,
      6
    )}-${numbers.slice(
      6
    )}`;
  }

  return value || "—";
}

function formatDate(
  value:
    | string
    | null
    | undefined
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return date.toLocaleDateString(
    "pt-BR",
    {
      day:
        "2-digit",
      month:
        "2-digit",
      year:
        "numeric",
    }
  );
}

function normalizeText(
  value:
    | string
    | null
    | undefined
) {
  return (
    value ??
    ""
  )
    .normalize(
      "NFD"
    )
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .trim();
}

function cnpjHistoryText(
  eventType: string
) {
  if (
    eventType ===
    "deadline_started"
  ) {
    return "Prazo de 6 meses iniciado";
  }

  if (
    eventType ===
    "cnpj_added"
  ) {
    return "CNPJ informado";
  }

  if (
    eventType ===
    "cnpj_changed"
  ) {
    return "CNPJ alterado";
  }

  if (
    eventType ===
    "cnpj_removed"
  ) {
    return "CNPJ removido";
  }

  if (
    eventType ===
    "sales_blocked"
  ) {
    return "Vendas bloqueadas por falta de CNPJ";
  }

  if (
    eventType ===
    "sales_unblocked"
  ) {
    return "Vendas liberadas após regularização";
  }

  return "Atualização da regularização";
}

function statusInfo(
  status:
    ApplicationStatus
) {
  if (
    status ===
    "approved"
  ) {
    return {
      label:
        "Aprovado",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  if (
    status ===
    "rejected"
  ) {
    return {
      label:
        "Recusado",
      className:
        "border-red-200 bg-red-50 text-red-700",
    };
  }

  return {
    label:
      "Em análise",
    className:
      "border-amber-200 bg-amber-50 text-amber-700",
  };
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value:
    | string
    | number;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-zinc-200 bg-white px-4 py-3">
      <p className="text-[11px] font-black uppercase tracking-wide text-zinc-400">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-bold text-zinc-900">
        {value ||
          "—"}
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  disabled = false,
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChange:
    (
      value: string
    ) => void;
  type?:
    | "text"
    | "email"
    | "tel";
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-black uppercase tracking-wide text-zinc-500">
        {label}
      </span>

      <input
        type={
          type
        }
        value={
          value
        }
        disabled={
          disabled
        }
        autoFocus={
          autoFocus
        }
        placeholder={
          placeholder
        }
        onChange={(
          event
        ) =>
          onChange(
            event.target.value
          )
        }
        className="mt-1 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-bold outline-none transition focus:border-zinc-400 disabled:bg-zinc-100 disabled:text-zinc-500"
      />
    </label>
  );
}

export default function MinhaContaSection() {
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
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    editing,
    setEditing,
  ] =
    useState(false);

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

  const [
    email,
    setEmail,
  ] =
    useState("");

  const [
    accountCreatedAt,
    setAccountCreatedAt,
  ] =
    useState("");

  const [
    metadataName,
    setMetadataName,
  ] =
    useState("");

  const [
    metadataPhone,
    setMetadataPhone,
  ] =
    useState("");

  const [
    profilePhone,
    setProfilePhone,
  ] =
    useState("");

  const [
    accountCpf,
    setAccountCpf,
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
    applications,
    setApplications,
  ] =
    useState<
      RestaurantApplication[]
    >([]);

  const [
    showCpf,
    setShowCpf,
  ] =
    useState(false);

  const [
    showCnpj,
    setShowCnpj,
  ] =
    useState(false);

  const [
    cnpjCompliance,
    setCnpjCompliance,
  ] =
    useState<CnpjCompliance | null>(
      null
    );

  const [
    cnpjHistory,
    setCnpjHistory,
  ] =
    useState<CnpjHistoryItem[]>(
      []
    );

  const [
    focusCnpjAfterEdit,
    setFocusCnpjAfterEdit,
  ] =
    useState(false);

  // ==========================================
  // CAMPOS DE EDIÇÃO
  // ==========================================

  const [
    editName,
    setEditName,
  ] =
    useState("");

  const [
    editEmail,
    setEditEmail,
  ] =
    useState("");

  const [
    editPhone,
    setEditPhone,
  ] =
    useState("");

  const [
    editBusinessName,
    setEditBusinessName,
  ] =
    useState("");

  const [
    editLegalName,
    setEditLegalName,
  ] =
    useState("");

  const [
    editCnpj,
    setEditCnpj,
  ] =
    useState("");

  const [
    editCategory,
    setEditCategory,
  ] =
    useState("");

  const [
    editRegistrationPhone,
    setEditRegistrationPhone,
  ] =
    useState("");

  const loadAccount =
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

        setError(
          ""
        );

        const {
          data: {
            session,
          },
          error:
            sessionError,
        } =
          await supabase.auth
            .getSession();

        if (
          sessionError ||
          !session
        ) {
          setError(
            "Não foi possível carregar sua conta."
          );

          setLoading(
            false
          );

          setRefreshing(
            false
          );

          return;
        }

        const user =
          session.user;

        setEmail(
          user.email ??
            ""
        );

        setAccountCreatedAt(
          user.created_at ??
            ""
        );

        const fullName =
          user
            .user_metadata
            ?.full_name;

        const phone =
          user
            .user_metadata
            ?.phone;

        setMetadataName(
          typeof fullName ===
            "string"
            ? fullName
            : ""
        );

        setMetadataPhone(
          typeof phone ===
            "string"
            ? phone
            : ""
        );

        const [
          profileResult,
          cpfResult,
          restaurantsResult,
          applicationsResult,
          complianceResult,
          historyResult,
        ] =
          await Promise.all([
            supabase
              .from(
                "profiles"
              )
              .select(
                "phone"
              )
              .eq(
                "id",
                user.id
              )
              .maybeSingle(),

            supabase
              .from(
                "account_cpfs"
              )
              .select(
                "cpf"
              )
              .eq(
                "user_id",
                user.id
              )
              .maybeSingle(),

            supabase
              .from(
                "restaurants"
              )
              .select(`
                id,
                name,
                active
              `)
              .eq(
                "owner_id",
                user.id
              )
              .order(
                "name",
                {
                  ascending:
                    true,
                }
              ),

            supabase
              .from(
                "restaurant_applications"
              )
              .select(`
                id,
                business_name,
                status,
                created_at,
                responsible_name,
                responsible_cpf,
                has_cnpj,
                cnpj,
                legal_name,
                phone,
                category
              `)
              .eq(
                "user_id",
                user.id
              )
              .order(
                "created_at",
                {
                  ascending:
                    false,
                }
              ),

            restaurantId
              ? supabase.rpc(
                  "get_my_cnpj_compliance",
                  {
                    p_restaurant_id:
                      restaurantId,
                  }
                )
              : Promise.resolve({
                  data:
                    null,

                  error:
                    null,
                }),

            restaurantId
              ? supabase.rpc(
                  "get_my_cnpj_history",
                  {
                    p_restaurant_id:
                      restaurantId,
                  }
                )
              : Promise.resolve({
                  data:
                    [],

                  error:
                    null,
                }),
          ]);

        if (
          profileResult.error
        ) {
          console.error(
            "Erro ao carregar perfil:",
            profileResult.error
          );
        }

        if (
          cpfResult.error
        ) {
          console.error(
            "Erro ao carregar CPF:",
            cpfResult.error
          );
        }

        if (
          restaurantsResult.error
        ) {
          console.error(
            "Erro ao carregar lojas:",
            restaurantsResult.error
          );
        }

        if (
          applicationsResult.error
        ) {
          console.error(
            "Erro ao carregar cadastros:",
            applicationsResult.error
          );
        }

        if (
          complianceResult.error
        ) {
          console.error(
            "Erro ao carregar prazo do CNPJ:",
            complianceResult.error
          );
        }

        if (
          historyResult.error
        ) {
          console.error(
            "Erro ao carregar histórico do CNPJ:",
            historyResult.error
          );
        }

        setProfilePhone(
          profileResult
            .data
            ?.phone ??
            ""
        );

        setAccountCpf(
          cpfResult
            .data
            ?.cpf ??
            ""
        );

        setRestaurants(
          (
            restaurantsResult
              .data ??
            []
          ) as Restaurant[]
        );

        setApplications(
          (
            applicationsResult
              .data ??
            []
          ) as RestaurantApplication[]
        );

        const complianceData =
          Array.isArray(
            complianceResult.data
          ) &&
          complianceResult.data.length >
            0
            ? (
                complianceResult
                  .data[0] as CnpjCompliance
              )
            : null;

        setCnpjCompliance(
          complianceData
        );

        setCnpjHistory(
          (
            historyResult.data ??
            []
          ) as CnpjHistoryItem[]
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

  useEffect(() => {
    loadAccount(
      true
    );
  }, [
    loadAccount,
  ]);

  const currentRestaurant =
    useMemo(
      () =>
        restaurants.find(
          (
            restaurant
          ) =>
            restaurant.id ===
            restaurantId
        ) ??
        null,
      [
        restaurants,
        restaurantId,
      ]
    );

  const currentApplication =
    useMemo(
      () => {
        if (
          applications.length ===
          0
        ) {
          return null;
        }

        const approved =
          applications.filter(
            (
              application
            ) =>
              application.status ===
              "approved"
          );

        if (
          currentRestaurant
        ) {
          const matched =
            approved.find(
              (
                application
              ) =>
                normalizeText(
                  application.business_name
                ) ===
                normalizeText(
                  currentRestaurant.name
                )
            );

          if (
            matched
          ) {
            return matched;
          }
        }

        return (
          approved[0] ??
          applications[0] ??
          null
        );
      },
      [
        applications,
        currentRestaurant,
      ]
    );

  const responsibleName =
    currentApplication
      ?.responsible_name ||
    metadataName ||
    "—";

  const responsiblePhone =
    metadataPhone ||
    profilePhone ||
    currentApplication
      ?.phone ||
    "";

  const cpfValue =
    accountCpf ||
    currentApplication
      ?.responsible_cpf ||
    "";

  const cnpjValue =
    currentApplication
      ?.cnpj ||
    "";

  const cnpjDays =
    cnpjCompliance
      ?.days_remaining ??
    0;

  const cnpjTone =
    cnpjCompliance
      ?.has_cnpj
      ? "green"
      : cnpjCompliance
          ?.blocked ||
        cnpjDays <= 7
        ? "red"
        : cnpjDays <= 30
          ? "yellow"
          : "blue";

  const cnpjBoxClass =
    cnpjTone ===
    "green"
      ? "border-emerald-200 bg-emerald-50"
      : cnpjTone ===
          "red"
        ? "border-red-200 bg-red-50"
        : cnpjTone ===
            "yellow"
          ? "border-amber-200 bg-amber-50"
          : "border-blue-200 bg-blue-50";

  const cnpjTextClass =
    cnpjTone ===
    "green"
      ? "text-emerald-700"
      : cnpjTone ===
          "red"
        ? "text-red-700"
        : cnpjTone ===
            "yellow"
          ? "text-amber-800"
          : "text-blue-700";

  function beginEditing(
    focusCnpj =
      false
  ) {
    setError(
      ""
    );

    setSuccess(
      ""
    );

    setFocusCnpjAfterEdit(
      focusCnpj
    );

    setEditName(
      responsibleName ===
        "—"
        ? ""
        : responsibleName
    );

    setEditEmail(
      email
    );

    setEditPhone(
      responsiblePhone
    );

    setEditBusinessName(
      currentApplication
        ?.business_name ||
        currentRestaurant
          ?.name ||
        ""
    );

    setEditLegalName(
      currentApplication
        ?.legal_name ||
        ""
    );

    setEditCnpj(
      currentApplication
        ?.cnpj
        ? formatCnpj(
            currentApplication.cnpj
          )
        : ""
    );

    setEditCategory(
      currentApplication
        ?.category ||
        ""
    );

    setEditRegistrationPhone(
      currentApplication
        ?.phone ||
        responsiblePhone ||
        ""
    );

    setEditing(
      true
    );
  }

  function cancelEditing() {
    if (
      saving
    ) {
      return;
    }

    setEditing(
      false
    );

    setFocusCnpjAfterEdit(
      false
    );

    setError(
      ""
    );
  }

  async function saveChanges(
    event:
      FormEvent
  ) {
    event.preventDefault();

    if (
      saving
    ) {
      return;
    }

    setError(
      ""
    );

    setSuccess(
      ""
    );

    const cleanName =
      editName.trim();

    const cleanEmail =
      editEmail
        .trim()
        .toLowerCase();

    const cleanPhone =
      editPhone.trim();

    const cleanBusinessName =
      editBusinessName.trim();

    const cleanLegalName =
      editLegalName.trim();

    const cleanCategory =
      editCategory.trim();

    const cleanRegistrationPhone =
      editRegistrationPhone.trim();

    const cleanCnpj =
      onlyNumbers(
        editCnpj
      );

    if (
      !cleanName
    ) {
      setError(
        "Digite o nome do responsável."
      );

      return;
    }

    if (
      !cleanEmail ||
      !cleanEmail.includes(
        "@"
      )
    ) {
      setError(
        "Digite um e-mail válido."
      );

      return;
    }

    const phoneNumbers =
      onlyNumbers(
        cleanPhone
      );

    if (
      phoneNumbers.length !==
        10 &&
      phoneNumbers.length !==
        11
    ) {
      setError(
        "Digite um telefone válido com DDD."
      );

      return;
    }

    if (
      currentApplication &&
      !cleanBusinessName
    ) {
      setError(
        "Digite o nome fantasia."
      );

      return;
    }

    if (
      cleanCnpj &&
      cleanCnpj.length !==
        14
    ) {
      setError(
        "Digite um CNPJ com 14 números ou deixe o campo vazio."
      );

      return;
    }

    if (
      cleanCnpj &&
      !cleanLegalName
    ) {
      setError(
        "Informe a razão social da empresa."
      );

      return;
    }

    setSaving(
      true
    );

    const {
      data: {
        session,
      },
      error:
        sessionError,
    } =
      await supabase.auth
        .getSession();

    if (
      sessionError ||
      !session
    ) {
      setError(
        "Sua sessão expirou. Entre novamente."
      );

      setSaving(
        false
      );

      return;
    }

    // ======================================
    // DADOS DO CADASTRO / LOJA
    // ======================================

    if (
      currentApplication
    ) {
      const {
        error:
          registrationError,
      } =
        await supabase.rpc(
          "update_my_account_registration_details",
          {
            p_restaurant_id:
              restaurantId,

            p_application_id:
              currentApplication.id,

            p_responsible_name:
              cleanName,

            p_business_name:
              cleanBusinessName,

            p_legal_name:
              cleanLegalName ||
              null,

            p_cnpj:
              cleanCnpj ||
              null,

            p_category:
              cleanCategory ||
              null,

            p_phone:
              cleanRegistrationPhone ||
              cleanPhone,
          }
        );

      if (
        registrationError
      ) {
        console.error(
          "Erro ao atualizar cadastro:",
          registrationError
        );

        if (
          registrationError.message.includes(
            "CNPJ_INVALID"
          )
        ) {
          setError(
            "O CNPJ informado é inválido."
          );
        } else if (
          registrationError.message.includes(
            "LEGAL_NAME_REQUIRED"
          )
        ) {
          setError(
            "Informe a razão social da empresa."
          );
        } else if (
          registrationError.message.includes(
            "RESTAURANT_NOT_FOUND"
          )
        ) {
          setError(
            "A loja selecionada não pertence à sua conta."
          );
        } else if (
          registrationError.message.includes(
            "APPLICATION_NOT_FOUND"
          )
        ) {
          setError(
            "Não encontramos o cadastro desta conta."
          );
        } else {
          setError(
            "Não foi possível atualizar os dados do cadastro."
          );
        }

        setSaving(
          false
        );

        return;
      }
    }

    // ======================================
    // NOME + TELEFONE DA CONTA
    // ======================================

    const accountUpdate:
      {
        email?:
          string;

        data: {
          full_name:
            string;

          phone:
            string;
        };
      } = {
      data: {
        full_name:
          cleanName,

        phone:
          cleanPhone,
      },
    };

    const emailChanged =
      cleanEmail !==
      (
        session.user.email ??
        ""
      ).toLowerCase();

    if (
      emailChanged
    ) {
      accountUpdate.email =
        cleanEmail;
    }

    const {
      error:
        accountError,
    } =
      await supabase.auth
        .updateUser(
          accountUpdate
        );

    if (
      accountError
    ) {
      console.error(
        "Erro ao atualizar conta:",
        accountError
      );

      setError(
        "Os dados da loja foram salvos, mas não foi possível atualizar os dados de acesso da conta."
      );

      await loadAccount(
        false
      );

      setSaving(
        false
      );

      return;
    }

    // Tenta manter profiles.phone sincronizado.
    // Se a política RLS não permitir, a conta continua usando
    // o telefone salvo no metadata do Supabase Auth.
    const {
      error:
        profileError,
    } =
      await supabase
        .from(
          "profiles"
        )
        .update({
          phone:
            cleanPhone,
        })
        .eq(
          "id",
          session.user.id
        );

    if (
      profileError
    ) {
      console.warn(
        "Não foi possível sincronizar profiles.phone:",
        profileError
      );
    }

    await loadAccount(
      false
    );

    setEditing(
      false
    );

    setFocusCnpjAfterEdit(
      false
    );

    setSuccess(
      emailChanged
        ? "Dados salvos. Se o Supabase exigir confirmação, confira o novo e-mail para concluir a troca."
        : "Dados atualizados com sucesso!"
    );

    setSaving(
      false
    );
  }

  if (
    loading
  ) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center">
        <p className="text-sm font-semibold text-zinc-600">
          Carregando sua conta...
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* CABEÇALHO */}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-red-600">
            CONTA
          </p>

          <h2 className="mt-1 text-3xl font-black">
            Minha conta
          </h2>

          <p className="mt-1 text-sm text-zinc-500">
            Consulte e altere os dados usados no seu cadastro.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {!editing && (
            <button
              type="button"
              onClick={() =>
                beginEditing(
                  false
                )
              }
              className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-red-700"
            >
              ✏️ Alterar dados
            </button>
          )}

          <button
            type="button"
            disabled={
              refreshing ||
              saving
            }
            onClick={() =>
              loadAccount(
                false
              )
            }
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-black text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
          >
            {refreshing
              ? "Atualizando..."
              : "↻ Atualizar"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {success}
        </div>
      )}

      {cnpjCompliance && (
        <div
          className={`mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border px-5 py-4 ${cnpjBoxClass}`}
        >
          <div className="min-w-0">
            <p
              className={`text-sm font-black ${cnpjTextClass}`}
            >
              {cnpjCompliance.has_cnpj
                ? "✅ CNPJ informado"
                : cnpjCompliance.blocked
                  ? "🔴 Prazo do CNPJ encerrado"
                  : cnpjDays <= 7
                    ? "⚠️ Últimos dias para informar o CNPJ"
                    : "🏢 CNPJ ainda não informado"}
            </p>

            <p
              className={`mt-1 text-sm font-semibold ${cnpjTextClass}`}
            >
              {cnpjCompliance.has_cnpj
                ? "A conta está regularizada e pode continuar recebendo vendas."
                : cnpjCompliance.blocked
                  ? `O prazo terminou em ${formatDate(
                      cnpjCompliance.deadline_at
                    )}. A loja fica indisponível para novas vendas até um CNPJ válido ser informado.`
                  : `Você tem ${cnpjDays} ${
                      cnpjDays === 1
                        ? "dia"
                        : "dias"
                    } para informar um CNPJ. Prazo final: ${formatDate(
                      cnpjCompliance.deadline_at
                    )}.`}
            </p>
          </div>

          {!cnpjCompliance.has_cnpj &&
            !editing && (
            <button
              type="button"
              onClick={() =>
                beginEditing(
                  true
                )
              }
              className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-black text-white transition ${
                cnpjCompliance.blocked ||
                cnpjDays <= 7
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-zinc-900 hover:bg-zinc-800"
              }`}
            >
              Informar CNPJ
            </button>
          )}
        </div>
      )}

      {/* ======================================
          MODO DE EDIÇÃO
      ====================================== */}

      {editing ? (
        <form
          onSubmit={
            saveChanges
          }
          className="mt-5 space-y-4"
        >
          <section className="rounded-2xl border border-zinc-200 bg-white">
            <div className="border-b border-zinc-100 px-5 py-4">
              <h3 className="font-black">
                Editar dados da conta
              </h3>

              <p className="mt-1 text-xs text-zinc-500">
                Altere nome, e-mail e telefone da conta.
              </p>
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
              <Field
                label="Responsável"
                value={
                  editName
                }
                onChange={
                  setEditName
                }
              />

              <Field
                label="E-mail"
                type="email"
                value={
                  editEmail
                }
                onChange={
                  setEditEmail
                }
              />

              <Field
                label="Celular"
                type="tel"
                value={
                  editPhone
                }
                onChange={
                  setEditPhone
                }
              />

              <Field
                label="CPF"
                value={
                  formatCpf(
                    cpfValue
                  )
                }
                onChange={() => {}}
                disabled
              />
            </div>

            <div className="mx-5 mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-800">
              O CPF continua bloqueado porque no seu cadastro ele é o documento oficial da conta e, depois de vinculado, não pode ser trocado automaticamente.
            </div>
          </section>

          {currentApplication && (
            <section className="rounded-2xl border border-zinc-200 bg-white">
              <div className="border-b border-zinc-100 px-5 py-4">
                <h3 className="font-black">
                  Editar dados do cadastro
                </h3>

                <p className="mt-1 text-xs text-zinc-500">
                  Estes dados também ficam sincronizados com a loja selecionada.
                </p>
              </div>

              <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
                <Field
                  label="Nome fantasia"
                  value={
                    editBusinessName
                  }
                  onChange={
                    setEditBusinessName
                  }
                />

                <Field
                  label="Razão social"
                  value={
                    editLegalName
                  }
                  onChange={
                    setEditLegalName
                  }
                />

                <Field
                  label="CNPJ"
                  value={
                    editCnpj
                  }
                  onChange={
                    setEditCnpj
                  }
                  autoFocus={
                    focusCnpjAfterEdit
                  }
                  placeholder="Deixe vazio se não tiver"
                />

                <Field
                  label="Categoria"
                  value={
                    editCategory
                  }
                  onChange={
                    setEditCategory
                  }
                />

                <Field
                  label="Telefone do cadastro"
                  type="tel"
                  value={
                    editRegistrationPhone
                  }
                  onChange={
                    setEditRegistrationPhone
                  }
                />
              </div>
            </section>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={
                saving
              }
              onClick={
                cancelEditing
              }
              className="rounded-xl border border-zinc-200 bg-white px-5 py-3 text-sm font-black text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={
                saving
              }
              className="rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {saving
                ? "Salvando..."
                : "Salvar alterações"}
            </button>
          </div>
        </form>
      ) : (
        <>
          {/* DADOS DA CONTA */}

          <section className="mt-5 rounded-2xl border border-zinc-200 bg-white">
            <div className="border-b border-zinc-100 px-5 py-4">
              <h3 className="font-black">
                Dados da conta
              </h3>

              <p className="mt-1 text-xs text-zinc-500">
                Informações do responsável pela conta.
              </p>
            </div>

            <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
              <InfoItem
                label="Responsável"
                value={
                  responsibleName
                }
              />

              <InfoItem
                label="E-mail"
                value={
                  email ||
                  "—"
                }
              />

              <InfoItem
                label="Celular"
                value={
                  formatPhone(
                    responsiblePhone
                  )
                }
              />

              <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-wide text-zinc-400">
                  CPF
                </p>

                <div className="mt-1 flex items-center justify-between gap-3">
                  <p className="break-all text-sm font-bold text-zinc-900">
                    {showCpf
                      ? formatCpf(
                          cpfValue
                        )
                      : maskCpf(
                          cpfValue
                        )}
                  </p>

                  {cpfValue && (
                    <button
                      type="button"
                      onClick={() =>
                        setShowCpf(
                          (
                            current
                          ) =>
                            !current
                        )
                      }
                      className="shrink-0 text-xs font-black text-zinc-500 hover:text-zinc-900"
                    >
                      {showCpf
                        ? "Ocultar"
                        : "Mostrar"}
                    </button>
                  )}
                </div>
              </div>

              <InfoItem
                label="Conta criada em"
                value={
                  formatDate(
                    accountCreatedAt
                  )
                }
              />

              <InfoItem
                label="Lojas vinculadas"
                value={
                  restaurants.length
                }
              />
            </div>
          </section>

          {/* CADASTRO DA LOJA */}

          <section className="mt-4 rounded-2xl border border-zinc-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
              <div>
                <h3 className="font-black">
                  Dados do cadastro
                </h3>

                <p className="mt-1 text-xs text-zinc-500">
                  Dados enviados no cadastro da loja.
                </p>
              </div>

              {currentApplication && (
                <span
                  className={`rounded-lg border px-2.5 py-1 text-xs font-black ${
                    statusInfo(
                      currentApplication.status
                    )
                      .className
                  }`}
                >
                  {
                    statusInfo(
                      currentApplication.status
                    )
                      .label
                  }
                </span>
              )}
            </div>

            {!currentApplication ? (
              <div className="p-6 text-sm text-zinc-500">
                Não encontramos um cadastro enviado para esta conta.
              </div>
            ) : (
              <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
                <InfoItem
                  label="Nome fantasia"
                  value={
                    currentApplication
                      .business_name ||
                    currentRestaurant
                      ?.name ||
                    "—"
                  }
                />

                <InfoItem
                  label="Razão social"
                  value={
                    currentApplication
                      .legal_name ||
                    "—"
                  }
                />

                <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
                  <p className="text-[11px] font-black uppercase tracking-wide text-zinc-400">
                    CNPJ
                  </p>

                  <div className="mt-1 flex items-center justify-between gap-3">
                    <p className="break-all text-sm font-bold text-zinc-900">
                      {cnpjValue
                        ? showCnpj
                          ? formatCnpj(
                              cnpjValue
                            )
                          : maskCnpj(
                              cnpjValue
                            )
                        : "Não informado"}
                    </p>

                    {cnpjValue && (
                      <button
                        type="button"
                        onClick={() =>
                          setShowCnpj(
                            (
                              current
                            ) =>
                              !current
                          )
                        }
                        className="shrink-0 text-xs font-black text-zinc-500 hover:text-zinc-900"
                      >
                        {showCnpj
                          ? "Ocultar"
                          : "Mostrar"}
                      </button>
                    )}
                  </div>
                </div>

                <InfoItem
                  label="Categoria"
                  value={
                    currentApplication
                      .category ||
                    "—"
                  }
                />

                <InfoItem
                  label="Telefone informado"
                  value={
                    formatPhone(
                      currentApplication
                        .phone
                    )
                  }
                />

                <InfoItem
                  label="Cadastro enviado em"
                  value={
                    formatDate(
                      currentApplication
                        .created_at
                    )
                  }
                />
              </div>
            )}
          </section>

          {/* HISTÓRICO DO CNPJ */}

          {cnpjHistory.length > 0 && (
            <section className="mt-4 rounded-2xl border border-zinc-200 bg-white">
              <div className="border-b border-zinc-100 px-5 py-4">
                <h3 className="font-black">
                  Histórico do CNPJ
                </h3>

                <p className="mt-1 text-xs text-zinc-500">
                  Registro das principais alterações de regularização da conta.
                </p>
              </div>

              <div className="divide-y divide-zinc-100">
                {cnpjHistory.map(
                  (
                    item,
                    index
                  ) => (
                    <div
                      key={`${item.event_type}-${item.event_at}-${index}`}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
                    >
                      <p className="text-sm font-bold text-zinc-800">
                        {cnpjHistoryText(
                          item.event_type
                        )}
                      </p>

                      <p className="text-xs font-semibold text-zinc-400">
                        {new Date(
                          item.event_at
                        ).toLocaleString(
                          "pt-BR",
                          {
                            dateStyle:
                              "short",

                            timeStyle:
                              "short",
                          }
                        )}
                      </p>
                    </div>
                  )
                )}
              </div>
            </section>
          )}

          {/* LOJAS */}

          <section className="mt-4 rounded-2xl border border-zinc-200 bg-white">
            <div className="border-b border-zinc-100 px-5 py-4">
              <h3 className="font-black">
                Minhas lojas
              </h3>

              <p className="mt-1 text-xs text-zinc-500">
                Lojas vinculadas a esta mesma conta.
              </p>
            </div>

            {restaurants.length ===
            0 ? (
              <div className="p-6 text-sm text-zinc-500">
                Nenhuma loja vinculada.
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {restaurants.map(
                  (
                    restaurant
                  ) => {
                    const selected =
                      restaurant.id ===
                      restaurantId;

                    return (
                      <div
                        key={
                          restaurant.id
                        }
                        className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-black">
                              {
                                restaurant.name
                              }
                            </p>

                            {selected && (
                              <span className="rounded-md bg-zinc-900 px-2 py-0.5 text-[10px] font-black uppercase text-white">
                                Loja selecionada
                              </span>
                            )}
                          </div>

                          <p
                            className={`mt-1 text-xs font-bold ${
                              restaurant.active
                                ? "text-emerald-600"
                                : "text-zinc-400"
                            }`}
                          >
                            {restaurant.active
                              ? "Ativa"
                              : "Inativa"}
                          </p>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
