"use client";

import Link from "next/link";

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

type ApplicationStatus =
  | "pending"
  | "approved"
  | "rejected";

type DriverApplication = {
  id: string;
  full_name: string;
  status: ApplicationStatus;
  rejection_reason: string | null;
  created_at: string;

  cpf?: string | null;
  birth_date?: string | null;
  city?: string | null;
  neighborhood?: string | null;

  vehicle_type?: string | null;
  plate?: string | null;
  vehicle_model?: string | null;
  vehicle_year?: number | null;

  cnh_number?: string | null;
  cnh_category?: string | null;
  cnh_expiry?: string | null;
};

type Step =
  | 1
  | 2
  | 3
  | 4
  | 5;

const MAX_FILE_SIZE =
  5 * 1024 * 1024;

function onlyNumbers(
  value: string
) {
  return value.replace(
    /\D/g,
    ""
  );
}

function formatCpf(
  value: string
) {
  const numbers =
    onlyNumbers(
      value
    ).slice(
      0,
      11
    );

  return numbers
    .replace(
      /(\d{3})(\d)/,
      "$1.$2"
    )
    .replace(
      /(\d{3})(\d)/,
      "$1.$2"
    )
    .replace(
      /(\d{3})(\d{1,2})$/,
      "$1-$2"
    );
}

function isValidCpf(
  cpf: string
) {
  const value =
    onlyNumbers(
      cpf
    );

  if (
    value.length !==
    11
  ) {
    return false;
  }

  if (
    /^(\d)\1+$/.test(
      value
    )
  ) {
    return false;
  }

  let sum = 0;

  for (
    let index = 0;
    index < 9;
    index++
  ) {
    sum +=
      Number(
        value[index]
      ) *
      (10 - index);
  }

  let digit =
    (sum * 10) %
    11;

  if (
    digit === 10
  ) {
    digit = 0;
  }

  if (
    digit !==
    Number(
      value[9]
    )
  ) {
    return false;
  }

  sum = 0;

  for (
    let index = 0;
    index < 10;
    index++
  ) {
    sum +=
      Number(
        value[index]
      ) *
      (11 - index);
  }

  digit =
    (sum * 10) %
    11;

  if (
    digit === 10
  ) {
    digit = 0;
  }

  return (
    digit ===
    Number(
      value[10]
    )
  );
}

function getExtension(
  file: File
) {
  const extension =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(
        /[^a-z0-9]/g,
        ""
      );

  if (extension) {
    return extension;
  }

  if (
    file.type ===
    "image/png"
  ) {
    return "png";
  }

  if (
    file.type ===
    "image/webp"
  ) {
    return "webp";
  }

  if (
    file.type ===
    "application/pdf"
  ) {
    return "pdf";
  }

  return "jpg";
}

export default function SejaEntregadorPage() {
  const router =
    useRouter();

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    sending,
    setSending,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    userId,
    setUserId,
  ] =
    useState("");

  const [
    userEmail,
    setUserEmail,
  ] =
    useState("");

  const [
    hasDriver,
    setHasDriver,
  ] =
    useState(false);

  const [
    application,
    setApplication,
  ] =
    useState<
      DriverApplication | null
    >(null);

  const [
    step,
    setStep,
  ] =
    useState<Step>(
      1
    );

  // ==========================================
  // ETAPA 1
  // ==========================================

  const [
    fullName,
    setFullName,
  ] =
    useState("");

  const [
    cpf,
    setCpf,
  ] =
    useState("");

  const [
    birthDate,
    setBirthDate,
  ] =
    useState("");

  const [
    phone,
    setPhone,
  ] =
    useState("");

  const [
    city,
    setCity,
  ] =
    useState("");

  const [
    neighborhood,
    setNeighborhood,
  ] =
    useState("");

  // ==========================================
  // ETAPA 2
  // ==========================================

  const [
    vehicleType,
    setVehicleType,
  ] =
    useState("Moto");

  const [
    plate,
    setPlate,
  ] =
    useState("");

  const [
    vehicleModel,
    setVehicleModel,
  ] =
    useState("");

  const [
    vehicleYear,
    setVehicleYear,
  ] =
    useState("");

  // ==========================================
  // ETAPA 3
  // ==========================================

  const [
    cnhNumber,
    setCnhNumber,
  ] =
    useState("");

  const [
    cnhCategory,
    setCnhCategory,
  ] =
    useState("A");

  const [
    cnhExpiry,
    setCnhExpiry,
  ] =
    useState("");

  const [
    cnhFile,
    setCnhFile,
  ] =
    useState<File | null>(
      null
    );

  const [
    vehicleDocFile,
    setVehicleDocFile,
  ] =
    useState<File | null>(
      null
    );

  // ==========================================
  // ETAPA 4
  // ==========================================

  const [
    profilePhoto,
    setProfilePhoto,
  ] =
    useState<File | null>(
      null
    );

  // ==========================================
  // ETAPA 5
  // ==========================================

  const [
    acceptedTerms,
    setAcceptedTerms,
  ] =
    useState(false);

  // ==========================================
  // CARREGAR CONTA
  // ==========================================

  const loadDriverStatus =
    useCallback(
      async (
        showLoading = false
      ) => {
        if (
          showLoading
        ) {
          setLoading(
            true
          );
        }

        const {
          data: {
            session,
          },
        } =
          await supabase.auth
            .getSession();

        if (!session) {
          router.replace(
            "/entregador"
          );

          return;
        }

        const currentUserId =
          session.user.id;

        setUserId(
          currentUserId
        );

        setUserEmail(
          session.user.email ??
            ""
        );

        // ======================================
        // PERFIL
        // ======================================

        const {
          data:
            profileData,
        } =
          await supabase
            .from(
              "profiles"
            )
            .select(`
              full_name,
              phone
            `)
            .eq(
              "id",
              currentUserId
            )
            .maybeSingle();

        if (
          profileData
        ) {
          setFullName(
            profileData.full_name ??
              ""
          );

          setPhone(
            profileData.phone ??
              ""
          );
        }

        // ======================================
        // JÁ É ENTREGADOR
        // ======================================

        const {
          data:
            driverData,
          error:
            driverError,
        } =
          await supabase
            .from(
              "drivers"
            )
            .select(`
              user_id,
              active
            `)
            .eq(
              "user_id",
              currentUserId
            )
            .maybeSingle();

        if (
          driverError
        ) {
          console.error(
            "Erro entregador:",
            driverError
          );
        }

        if (
          driverData
        ) {
          setHasDriver(
            true
          );

          setApplication(
            null
          );

          setLoading(
            false
          );

          return;
        }

        setHasDriver(
          false
        );

        // ======================================
        // ÚLTIMA SOLICITAÇÃO
        // ======================================

        const {
          data:
            applicationData,
          error:
            applicationError,
        } =
          await supabase
            .from(
              "driver_applications"
            )
            .select(`
              id,
              full_name,
              status,
              rejection_reason,
              created_at,
              cpf,
              birth_date,
              city,
              neighborhood,
              vehicle_type,
              plate,
              vehicle_model,
              vehicle_year,
              cnh_number,
              cnh_category,
              cnh_expiry
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
            )
            .limit(
              1
            )
            .maybeSingle();

        if (
          applicationError
        ) {
          console.error(
            "Erro solicitação:",
            applicationError
          );
        }

        if (
          applicationData
        ) {
          const app =
            applicationData as DriverApplication;

          setApplication(
            app
          );

          if (
            app.status ===
            "rejected"
          ) {
            setFullName(
              app.full_name ??
                ""
            );

            setCpf(
              formatCpf(
                app.cpf ??
                  ""
              )
            );

            setBirthDate(
              app.birth_date ??
                ""
            );

            setCity(
              app.city ??
                ""
            );

            setNeighborhood(
              app.neighborhood ??
                ""
            );

            setVehicleType(
              app.vehicle_type ??
                "Moto"
            );

            setPlate(
              app.plate ??
                ""
            );

            setVehicleModel(
              app.vehicle_model ??
                ""
            );

            setVehicleYear(
              app.vehicle_year
                ? String(
                    app.vehicle_year
                  )
                : ""
            );

            setCnhNumber(
              app.cnh_number ??
                ""
            );

            setCnhCategory(
              app.cnh_category ??
                "A"
            );

            setCnhExpiry(
              app.cnh_expiry ??
                ""
            );
          }
        } else {
          setApplication(
            null
          );
        }

        setLoading(
          false
        );
      },
      [
        router,
      ]
    );

  useEffect(() => {
    loadDriverStatus(
      true
    );
  }, [
    loadDriverStatus,
  ]);

  // ==========================================
  // ATUALIZAR APROVAÇÃO
  // ==========================================

  useEffect(() => {
    if (
      application?.status !==
      "pending"
    ) {
      return;
    }

    const interval =
      window.setInterval(
        () => {
          loadDriverStatus(
            false
          );
        },
        3000
      );

    return () => {
      window.clearInterval(
        interval
      );
    };
  }, [
    application?.status,
    loadDriverStatus,
  ]);

  // ==========================================
  // VALIDAR ARQUIVO
  // ==========================================

  function validateFile(
    file: File | null
  ) {
    if (!file) {
      return true;
    }

    if (
      file.size >
      MAX_FILE_SIZE
    ) {
      setError(
        "Cada arquivo pode ter no máximo 5 MB."
      );

      return false;
    }

    return true;
  }

  // ==========================================
  // IR PARA PRÓXIMA ETAPA
  // ==========================================

  function nextStep() {
    setError("");

    if (
      step === 1
    ) {
      if (
        !fullName.trim() ||
        !cpf.trim() ||
        !birthDate ||
        !phone.trim() ||
        !city.trim() ||
        !neighborhood.trim()
      ) {
        setError(
          "Preencha todos os campos obrigatórios."
        );

        return;
      }

      if (
        !isValidCpf(
          cpf
        )
      ) {
        setError(
          "Informe um CPF válido."
        );

        return;
      }

      if (
        phone.trim().length <
        8
      ) {
        setError(
          "Informe um telefone válido."
        );

        return;
      }

      setStep(
        2
      );

      return;
    }

    if (
      step === 2
    ) {
      if (
        vehicleType ===
        "Moto"
      ) {
        if (
          !plate.trim() ||
          !vehicleModel.trim() ||
          !vehicleYear.trim()
        ) {
          setError(
            "Preencha os dados da moto."
          );

          return;
        }

        const year =
          Number(
            vehicleYear
          );

        if (
          !Number.isInteger(
            year
          ) ||
          year < 1950 ||
          year >
            new Date()
              .getFullYear() +
              1
        ) {
          setError(
            "Informe um ano válido para a moto."
          );

          return;
        }
      }

      setStep(
        3
      );

      return;
    }

    if (
      step === 3
    ) {
      if (
        vehicleType ===
        "Moto"
      ) {
        if (
          !cnhNumber.trim() ||
          !cnhCategory.trim() ||
          !cnhExpiry
        ) {
          setError(
            "Preencha os dados da CNH."
          );

          return;
        }

        if (
          !cnhFile
        ) {
          setError(
            "Envie a foto ou PDF da CNH."
          );

          return;
        }

        if (
          !vehicleDocFile
        ) {
          setError(
            "Envie o documento da moto."
          );

          return;
        }

        if (
          !validateFile(
            cnhFile
          ) ||
          !validateFile(
            vehicleDocFile
          )
        ) {
          return;
        }
      }

      setStep(
        4
      );

      return;
    }

    if (
      step === 4
    ) {
      if (
        !profilePhoto
      ) {
        setError(
          "Envie uma foto de perfil."
        );

        return;
      }

      if (
        !validateFile(
          profilePhoto
        )
      ) {
        return;
      }

      setStep(
        5
      );
    }
  }

  // ==========================================
  // VOLTAR ETAPA
  // ==========================================

  function previousStep() {
    setError("");

    if (
      step >
      1
    ) {
      setStep(
        (step -
          1) as Step
      );
    }
  }

  // ==========================================
  // UPLOAD PRIVADO
  // ==========================================

  async function uploadDocument(
    file: File,
    folder: string,
    fileName: string
  ) {
    const extension =
      getExtension(
        file
      );

    const path =
      `${userId}/${folder}/${fileName}.${extension}`;

    const {
      error:
        uploadError,
    } =
      await supabase.storage
        .from(
          "driver-documents"
        )
        .upload(
          path,
          file,
          {
            upsert:
              true,

            contentType:
              file.type,
          }
        );

    if (
      uploadError
    ) {
      throw uploadError;
    }

    return path;
  }

  // ==========================================
  // ENVIAR CADASTRO
  // ==========================================

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      sending ||
      !userId
    ) {
      return;
    }

    setError("");

    if (
      !acceptedTerms
    ) {
      setError(
        "Você precisa aceitar os termos para enviar o cadastro."
      );

      return;
    }

    if (
      !profilePhoto
    ) {
      setError(
        "A foto de perfil é obrigatória."
      );

      return;
    }

    if (
      vehicleType ===
        "Moto" &&
      (
        !cnhFile ||
        !vehicleDocFile
      )
    ) {
      setError(
        "Envie todos os documentos obrigatórios."
      );

      return;
    }

    setSending(
      true
    );

    try {
      // ======================================
      // FOTO DE PERFIL
      // ======================================

      const profilePhotoPath =
        await uploadDocument(
          profilePhoto,
          "perfil",
          "perfil"
        );

      let cnhPath:
        | string
        | null =
        null;

      let vehicleDocPath:
        | string
        | null =
        null;

      // ======================================
      // DOCUMENTOS DA MOTO
      // ======================================

      if (
        vehicleType ===
        "Moto" &&
        cnhFile &&
        vehicleDocFile
      ) {
        cnhPath =
          await uploadDocument(
            cnhFile,
            "cnh",
            "cnh"
          );

        vehicleDocPath =
          await uploadDocument(
            vehicleDocFile,
            "veiculo",
            "documento"
          );
      }

      // ======================================
      // ATUALIZAR PERFIL
      // ======================================

      const {
        error:
          profileError,
      } =
        await supabase
          .from(
            "profiles"
          )
          .update({
            full_name:
              fullName.trim(),

            phone:
              phone.trim(),
          })
          .eq(
            "id",
            userId
          );

      if (
        profileError
      ) {
        console.error(
          "Erro perfil:",
          profileError
        );
      }

      // ======================================
      // CRIAR SOLICITAÇÃO
      // ======================================

      const {
        data,
        error:
          insertError,
      } =
        await supabase
          .from(
            "driver_applications"
          )
          .insert({
            user_id:
              userId,

            full_name:
              fullName.trim(),

            phone:
              phone.trim(),

            cpf:
              onlyNumbers(
                cpf
              ),

            birth_date:
              birthDate,

            city:
              city.trim(),

            neighborhood:
              neighborhood.trim(),

            vehicle_type:
              vehicleType,

            plate:
              vehicleType ===
              "Moto"
                ? plate
                    .trim()
                    .toUpperCase()
                : null,

            vehicle_model:
              vehicleType ===
              "Moto"
                ? vehicleModel.trim()
                : null,

            vehicle_year:
              vehicleType ===
              "Moto"
                ? Number(
                    vehicleYear
                  )
                : null,

            cnh_number:
              vehicleType ===
              "Moto"
                ? cnhNumber.trim()
                : null,

            cnh_category:
              vehicleType ===
              "Moto"
                ? cnhCategory
                : null,

            cnh_expiry:
              vehicleType ===
              "Moto"
                ? cnhExpiry
                : null,

            profile_photo_url:
              profilePhotoPath,

            cnh_photo_url:
              cnhPath,

            vehicle_doc_url:
              vehicleDocPath,

            accepted_terms_at:
              new Date()
                .toISOString(),
          })
          .select(`
            id,
            full_name,
            status,
            rejection_reason,
            created_at
          `)
          .single();

      if (
        insertError
      ) {
        console.error(
          "Erro cadastro:",
          insertError
        );

        if (
          insertError.message.includes(
            "driver_application_pending_user_unique"
          )
        ) {
          setError(
            "Você já possui um cadastro aguardando aprovação."
          );
        } else {
          setError(
            "Não foi possível enviar seu cadastro."
          );
        }

        setSending(
          false
        );

        return;
      }

      setApplication(
        data as DriverApplication
      );

      setSending(
        false
      );
    } catch (
      uploadError
    ) {
      console.error(
        "Erro upload:",
        uploadError
      );

      setError(
        "Não foi possível enviar um dos documentos. Tente novamente."
      );

      setSending(
        false
      );
    }
  }

  // ==========================================
  // LOGOUT
  // ==========================================

  async function logout() {
    await supabase.auth
      .signOut();

    router.replace(
      "/entregador"
    );

    router.refresh();
  }

  // ==========================================
  // CARREGANDO
  // ==========================================

  if (
    loading
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7]">
        <p className="font-bold">
          Carregando cadastro...
        </p>
      </main>
    );
  }

  // ==========================================
  // APROVADO
  // ==========================================

  if (
    hasDriver ||
    application?.status ===
      "approved"
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7] px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
          <div className="text-6xl">
            🛵
          </div>

          <h1 className="mt-5 text-3xl font-black">
            Cadastro aprovado!
          </h1>

          <p className="mt-3 text-zinc-500">
            Sua conta de entregador
            está liberada.
          </p>

          <Link
            href="/entregador-painel"
            className="mt-6 block rounded-xl bg-red-600 px-5 py-4 font-black text-white"
          >
            🛵 Ir para o painel
          </Link>

          <button
            type="button"
            onClick={
              logout
            }
            className="mt-3 w-full rounded-xl border border-zinc-200 px-5 py-4 font-black"
          >
            Sair da conta
          </button>
        </div>
      </main>
    );
  }

  // ==========================================
  // PENDENTE
  // ==========================================

  if (
    application?.status ===
    "pending"
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7] px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
          <div className="text-6xl">
            🛵
          </div>

          <h1 className="mt-5 text-3xl font-black">
            Cadastro em análise
          </h1>

          <p className="mt-3 text-zinc-500">
            Olá,{" "}
            <strong>
              {
                application.full_name
              }
            </strong>
            .
          </p>

          <div className="mt-6 rounded-2xl border border-yellow-200 bg-yellow-50 p-5 text-left">
            <p className="font-black text-yellow-800">
              ⏳ Aguardando aprovação
            </p>

            <p className="mt-2 text-sm leading-6 text-yellow-700">
              Seus dados e documentos
              foram enviados para análise.
            </p>
          </div>

          <div className="mt-4 rounded-2xl bg-zinc-50 p-4">
            <p className="text-xs font-bold text-zinc-400">
              CONTA
            </p>

            <p className="mt-1 font-bold">
              {
                userEmail
              }
            </p>
          </div>

          <p className="mt-5 text-xs text-zinc-400">
            Esta página verifica
            automaticamente quando
            seu cadastro for aprovado.
          </p>

          <button
            type="button"
            onClick={
              logout
            }
            className="mt-6 w-full rounded-xl border border-zinc-200 px-5 py-4 font-black"
          >
            Sair da conta
          </button>
        </div>
      </main>
    );
  }

  // ==========================================
  // FORMULÁRIO
  // ==========================================

  return (
    <main className="min-h-screen bg-[#f7f7f7] text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link
            href="/entregador"
            className="font-black text-red-600"
          >
            ← Voltar
          </Link>

          <div className="text-right">
            <p className="text-xs font-black uppercase text-red-600">
              Entrega Paudalho
            </p>

            <p className="font-black">
              Cadastro do entregador
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8">
        <div>
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 text-3xl">
            🛵
          </div>

          <h1 className="mt-5 text-3xl font-black">
            Complete seu cadastro
          </h1>

          <p className="mt-2 text-zinc-500">
            Complete todas as etapas
            para enviar seu cadastro
            para análise.
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4">
          <p className="font-black text-green-700">
            ✅ Conta confirmada
          </p>

          <p className="mt-1 text-sm text-green-600">
            {
              userEmail
            }
          </p>
        </div>

        {/* =====================================
            PROGRESSO
        ===================================== */}

        <div className="mt-6 grid grid-cols-5 gap-2">
          {[
            1,
            2,
            3,
            4,
            5,
          ].map(
            (
              item
            ) => (
              <div
                key={
                  item
                }
                className={`h-2 rounded-full ${
                  item <=
                  step
                    ? "bg-red-600"
                    : "bg-zinc-200"
                }`}
              />
            )
          )}
        </div>

        <p className="mt-3 text-sm font-black text-zinc-500">
          Etapa {step} de 5
        </p>

        {application?.status ===
          "rejected" && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="font-black text-red-700">
              ❌ Cadastro anterior recusado
            </p>

            {application.rejection_reason && (
              <p className="mt-2 text-sm text-red-700">
                Motivo:{" "}
                {
                  application.rejection_reason
                }
              </p>
            )}
          </div>
        )}

        <form
          onSubmit={
            handleSubmit
          }
          className="mt-6"
        >
          {/* =====================================
              ETAPA 1
          ===================================== */}

          {step === 1 && (
            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <p className="text-xs font-black uppercase text-red-600">
                Etapa 1
              </p>

              <h2 className="mt-1 text-2xl font-black">
                Dados pessoais
              </h2>

              <div className="mt-6 space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-black">
                    Nome completo *
                  </label>

                  <input
                    value={
                      fullName
                    }
                    onChange={(
                      event
                    ) =>
                      setFullName(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-zinc-200 px-4 py-3.5 outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-black">
                    CPF *
                  </label>

                  <input
                    value={
                      cpf
                    }
                    inputMode="numeric"
                    onChange={(
                      event
                    ) =>
                      setCpf(
                        formatCpf(
                          event.target.value
                        )
                      )
                    }
                    maxLength={
                      14
                    }
                    className="w-full rounded-xl border border-zinc-200 px-4 py-3.5 outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-black">
                    Data de nascimento *
                  </label>

                  <input
                    type="date"
                    value={
                      birthDate
                    }
                    onChange={(
                      event
                    ) =>
                      setBirthDate(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-zinc-200 px-4 py-3.5 outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-black">
                    WhatsApp / telefone *
                  </label>

                  <input
                    type="tel"
                    value={
                      phone
                    }
                    onChange={(
                      event
                    ) =>
                      setPhone(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-zinc-200 px-4 py-3.5 outline-none focus:border-red-500"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-black">
                      Cidade *
                    </label>

                    <input
                      value={
                        city
                      }
                      onChange={(
                        event
                      ) =>
                        setCity(
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border border-zinc-200 px-4 py-3.5 outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-black">
                      Bairro *
                    </label>

                    <input
                      value={
                        neighborhood
                      }
                      onChange={(
                        event
                      ) =>
                        setNeighborhood(
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border border-zinc-200 px-4 py-3.5 outline-none focus:border-red-500"
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* =====================================
              ETAPA 2
          ===================================== */}

          {step === 2 && (
            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <p className="text-xs font-black uppercase text-red-600">
                Etapa 2
              </p>

              <h2 className="mt-1 text-2xl font-black">
                Veículo
              </h2>

              <div className="mt-6 space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-black">
                    Tipo de veículo *
                  </label>

                  <select
                    value={
                      vehicleType
                    }
                    onChange={(
                      event
                    ) => {
                      setVehicleType(
                        event.target.value
                      );
                    }}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3.5"
                  >
                    <option value="Moto">
                      🏍️ Moto
                    </option>

                    <option value="Bicicleta">
                      🚲 Bicicleta
                    </option>
                  </select>
                </div>

                {vehicleType ===
                  "Moto" && (
                  <>
                    <div>
                      <label className="mb-2 block text-sm font-black">
                        Placa *
                      </label>

                      <input
                        value={
                          plate
                        }
                        maxLength={
                          7
                        }
                        onChange={(
                          event
                        ) =>
                          setPlate(
                            event.target.value
                              .toUpperCase()
                              .replace(
                                /[^A-Z0-9]/g,
                                ""
                              )
                          )
                        }
                        className="w-full rounded-xl border border-zinc-200 px-4 py-3.5 uppercase"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-black">
                        Modelo da moto *
                      </label>

                      <input
                        value={
                          vehicleModel
                        }
                        onChange={(
                          event
                        ) =>
                          setVehicleModel(
                            event.target.value
                          )
                        }
                        className="w-full rounded-xl border border-zinc-200 px-4 py-3.5"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-black">
                        Ano *
                      </label>

                      <input
                        type="number"
                        value={
                          vehicleYear
                        }
                        onChange={(
                          event
                        ) =>
                          setVehicleYear(
                            event.target.value
                          )
                        }
                        className="w-full rounded-xl border border-zinc-200 px-4 py-3.5"
                      />
                    </div>
                  </>
                )}
              </div>
            </section>
          )}

          {/* =====================================
              ETAPA 3
          ===================================== */}

          {step === 3 && (
            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <p className="text-xs font-black uppercase text-red-600">
                Etapa 3
              </p>

              <h2 className="mt-1 text-2xl font-black">
                Documentos
              </h2>

              {vehicleType ===
              "Moto" ? (
                <div className="mt-6 space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-black">
                      Número da CNH *
                    </label>

                    <input
                      value={
                        cnhNumber
                      }
                      onChange={(
                        event
                      ) =>
                        setCnhNumber(
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border border-zinc-200 px-4 py-3.5"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-black">
                      Categoria da CNH *
                    </label>

                    <select
                      value={
                        cnhCategory
                      }
                      onChange={(
                        event
                      ) =>
                        setCnhCategory(
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3.5"
                    >
                      <option value="A">
                        A
                      </option>

                      <option value="AB">
                        AB
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-black">
                      Validade da CNH *
                    </label>

                    <input
                      type="date"
                      value={
                        cnhExpiry
                      }
                      onChange={(
                        event
                      ) =>
                        setCnhExpiry(
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border border-zinc-200 px-4 py-3.5"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-black">
                      Foto ou PDF da CNH *
                    </label>

                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={(
                        event
                      ) =>
                        setCnhFile(
                          event.target.files?.[0] ??
                            null
                        )
                      }
                      className="w-full rounded-xl border border-zinc-200 bg-white p-3"
                    />

                    {cnhFile && (
                      <p className="mt-2 text-sm font-bold text-green-600">
                        ✅{" "}
                        {
                          cnhFile.name
                        }
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-black">
                      Documento da moto *
                    </label>

                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={(
                        event
                      ) =>
                        setVehicleDocFile(
                          event.target.files?.[0] ??
                            null
                        )
                      }
                      className="w-full rounded-xl border border-zinc-200 bg-white p-3"
                    />

                    {vehicleDocFile && (
                      <p className="mt-2 text-sm font-bold text-green-600">
                        ✅{" "}
                        {
                          vehicleDocFile.name
                        }
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-6 rounded-2xl bg-green-50 p-5">
                  <p className="font-black text-green-700">
                    🚲 Cadastro com bicicleta
                  </p>

                  <p className="mt-2 text-sm text-green-600">
                    CNH e documento de moto
                    não são necessários.
                  </p>
                </div>
              )}
            </section>
          )}

          {/* =====================================
              ETAPA 4
          ===================================== */}

          {step === 4 && (
            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <p className="text-xs font-black uppercase text-red-600">
                Etapa 4
              </p>

              <h2 className="mt-1 text-2xl font-black">
                Identificação
              </h2>

              <p className="mt-2 text-zinc-500">
                Envie uma foto clara do
                seu rosto.
              </p>

              <div className="mt-6">
                <label className="mb-2 block text-sm font-black">
                  Foto de perfil *
                </label>

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(
                    event
                  ) =>
                    setProfilePhoto(
                      event.target.files?.[0] ??
                        null
                    )
                  }
                  className="w-full rounded-xl border border-zinc-200 bg-white p-3"
                />

                {profilePhoto && (
                  <div className="mt-4 rounded-xl bg-green-50 p-4">
                    <p className="font-bold text-green-700">
                      ✅ Foto selecionada
                    </p>

                    <p className="mt-1 text-sm text-green-600">
                      {
                        profilePhoto.name
                      }
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* =====================================
              ETAPA 5
          ===================================== */}

          {step === 5 && (
            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <p className="text-xs font-black uppercase text-red-600">
                Etapa 5
              </p>

              <h2 className="mt-1 text-2xl font-black">
                Revisar cadastro
              </h2>

              <div className="mt-6 space-y-4">
                <div className="rounded-2xl bg-zinc-50 p-4">
                  <p className="text-xs font-black text-zinc-400">
                    DADOS PESSOAIS
                  </p>

                  <p className="mt-2 font-black">
                    {
                      fullName
                    }
                  </p>

                  <p className="mt-1 text-sm text-zinc-600">
                    CPF: {cpf}
                  </p>

                  <p className="mt-1 text-sm text-zinc-600">
                    Nascimento:{" "}
                    {
                      birthDate
                    }
                  </p>

                  <p className="mt-1 text-sm text-zinc-600">
                    Telefone:{" "}
                    {
                      phone
                    }
                  </p>

                  <p className="mt-1 text-sm text-zinc-600">
                    {neighborhood} •{" "}
                    {city}
                  </p>
                </div>

                <div className="rounded-2xl bg-zinc-50 p-4">
                  <p className="text-xs font-black text-zinc-400">
                    VEÍCULO
                  </p>

                  <p className="mt-2 font-black">
                    {
                      vehicleType
                    }
                  </p>

                  {vehicleType ===
                    "Moto" && (
                    <>
                      <p className="mt-1 text-sm text-zinc-600">
                        Placa:{" "}
                        {
                          plate
                        }
                      </p>

                      <p className="mt-1 text-sm text-zinc-600">
                        Modelo:{" "}
                        {
                          vehicleModel
                        }
                      </p>

                      <p className="mt-1 text-sm text-zinc-600">
                        Ano:{" "}
                        {
                          vehicleYear
                        }
                      </p>

                      <p className="mt-1 text-sm text-zinc-600">
                        CNH:{" "}
                        {
                          cnhNumber
                        }{" "}
                        ({cnhCategory})
                      </p>
                    </>
                  )}
                </div>

                <div className="rounded-2xl bg-zinc-50 p-4">
                  <p className="text-xs font-black text-zinc-400">
                    DOCUMENTOS
                  </p>

                  <p className="mt-2 text-sm font-bold text-green-700">
                    ✅ Foto de perfil
                  </p>

                  {vehicleType ===
                    "Moto" && (
                    <>
                      <p className="mt-1 text-sm font-bold text-green-700">
                        ✅ CNH
                      </p>

                      <p className="mt-1 text-sm font-bold text-green-700">
                        ✅ Documento da moto
                      </p>
                    </>
                  )}
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-zinc-200 p-4">
                  <input
                    type="checkbox"
                    checked={
                      acceptedTerms
                    }
                    onChange={(
                      event
                    ) =>
                      setAcceptedTerms(
                        event.target.checked
                      )
                    }
                    className="mt-1 h-5 w-5"
                  />

                  <span className="text-sm leading-6">
                    Li e aceito os termos
                    de uso e autorizo o
                    Entrega Paudalho a
                    analisar os dados e
                    documentos enviados
                    para avaliação do meu
                    cadastro.
                  </span>
                </label>
              </div>
            </section>
          )}

          {/* =====================================
              ERRO
          ===================================== */}

          {error && (
            <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">
              ⚠️{" "}
              {
                error
              }
            </div>
          )}

          {/* =====================================
              BOTÕES
          ===================================== */}

          <div className="mt-6 flex gap-3">
            {step >
              1 && (
              <button
                type="button"
                onClick={
                  previousStep
                }
                disabled={
                  sending
                }
                className="rounded-xl border border-zinc-200 bg-white px-6 py-4 font-black"
              >
                ← Voltar
              </button>
            )}

            {step <
            5 ? (
              <button
                type="button"
                onClick={
                  nextStep
                }
                className="flex-1 rounded-xl bg-red-600 px-6 py-4 font-black text-white"
              >
                Continuar →
              </button>
            ) : (
              <button
                type="submit"
                disabled={
                  sending ||
                  !acceptedTerms
                }
                className="flex-1 rounded-xl bg-red-600 px-6 py-4 font-black text-white disabled:bg-zinc-300"
              >
                {sending
                  ? "Enviando cadastro..."
                  : "Enviar para aprovação"}
              </button>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}