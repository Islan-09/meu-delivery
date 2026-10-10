"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { FormEvent, ReactNode, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, } from "next/navigation";
import { supabase } from "@/lib/supabase";

const MapPicker = dynamic(() => import("./MapPicker"), {
    ssr: false,
    loading: () => (
      <div className="flex h-[360px] items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50">
        <p className="font-bold text-zinc-500">
          Carregando mapa...
        </p>
      </div>
    ),
});

type ApplicationStatus = "pending" | "approved" | "rejected";

type Step = 1 | 2 | 3 | 4 | 5 | 6;

type RestaurantApplication = {
    id: string;
    business_name: string;
    status: ApplicationStatus;
    rejection_reason: string | null;
    created_at: string;
    responsible_name: string | null;
    responsible_cpf: string | null;
    has_cnpj: boolean | null;
    cnpj: string | null;
    legal_name: string | null;
    phone: string | null;
    category: string | null;
    description: string | null;
    postal_code: string | null;
    street: string | null;
    number: string | null;
    complement: string | null;
    neighborhood: string | null;
    city: string | null;
    state: string | null;
    latitude: number | null;
    longitude: number | null;
    accepts_delivery: boolean | null;
    accepts_pickup: boolean | null;
    preparation_minutes: number | null;
    minimum_order: number | string | null;
};

type DraftFormData = {
    responsibleName?: string;
    responsibleCpf?: string;
    phone?: string;
    hasCnpj?: boolean | null;
    cnpj?: string;
    legalName?: string;
    businessName?: string;
    category?: string;
    description?: string;
    postalCode?: string;
    cepValidated?: boolean;
    validatedCep?: string;
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    latitude?: number | null;
    longitude?: number | null;
    locationConfirmed?: boolean;
    acceptsDelivery?: boolean;
    acceptsPickup?: boolean;
    preparationMinutes?: string;
    minimumOrder?: string;
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

// ======================================================
// FORMATAÇÃO
// ======================================================

function onlyNumbers(value: string) {
    return value.replace(/\D/g, "");
}

function formatCpf(value: string) {
    const numbers = onlyNumbers(value).slice(0, 11);

    return numbers
        .replace(/^(\d{3})(\d)/, "$1.$2")
        .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function formatCnpj(value: string) {
    const numbers = onlyNumbers(value).slice(0, 14);

    return numbers
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d)/, "$1-$2");
}

function formatPhone(value: string) {
    const numbers = onlyNumbers(value).slice(0, 11);

    if (numbers.length <= 10) {
        return numbers
            .replace(/^(\d{2})(\d)/, "($1) $2")
            .replace(/(\d{4})(\d)/, "$1-$2");
    }

    return numbers
        .replace(/^(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{5})(\d)/, "$1-$2");
}

function formatCep(value: string) {
    return onlyNumbers(value)
        .slice(0, 8)
        .replace(/^(\d{5})(\d)/, "$1-$2");
}

function parseMoney(value: string) {
    const normalized = value
        .replace(/\./g, "")
        .replace(",", ".");

    const number = Number(normalized);

    return Number.isNaN(number)
        ? 0
        : number;
}

// ======================================================
// VALIDAR CPF
// ======================================================

function isValidCpf(value: string) {
    const cpf = onlyNumbers(value);

    if (cpf.length !== 11) {
        return false;
    }

    if (/^(\d)\1+$/.test(cpf)) {
        return false;
    }

    let sum = 0;

    for (let i = 0; i < 9; i++) {
        sum += Number(cpf[i]) * (10 - i);
    }

    let digit = (sum * 10) % 11;

    if (digit === 10) {
        digit = 0;
    }

    if (digit !== Number(cpf[9])) {
        return false;
    }

    sum = 0;

    for (let i = 0; i < 10; i++) {
        sum += Number(cpf[i]) * (11 - i);
    }

    digit = (sum * 10) % 11;

    if (digit === 10) {
        digit = 0;
    }

    return digit === Number(cpf[10]);
}

// ======================================================
// VALIDAR CELULAR
// ======================================================

function isValidBrazilianPhone(value: string) {
    const phone = onlyNumbers(value);

    if (phone.length !== 11) {
        return false;
    }

    const ddd = phone.slice(0, 2);

    const validDdds = new Set([
        "11",
        "12",
        "13",
        "14",
        "15",
        "16",
        "17",
        "18",
        "19",
        "21",
        "22",
        "24",
        "27",
        "28",
        "31",
        "32",
        "33",
        "34",
        "35",
        "37",
        "38",
        "41",
        "42",
        "43",
        "44",
        "45",
        "46",
        "47",
        "48",
        "49",
        "51",
        "53",
        "54",
        "55",
        "61",
        "62",
        "63",
        "64",
        "65",
        "66",
        "67",
        "68",
        "69",
        "71",
        "73",
        "74",
        "75",
        "77",
        "79",
        "81",
        "82",
        "83",
        "84",
        "85",
        "86",
        "87",
        "88",
        "89",
        "91",
        "92",
        "93",
        "94",
        "95",
        "96",
        "97",
        "98",
        "99",
    ]);

    if (!validDdds.has(ddd)) {
        return false;
    }

    if (phone[2] !== "9") {
        return false;
    }

    const subscriber = phone.slice(2);

    if (/^(\d)\1+$/.test(subscriber)) {
        return false;
    }

    return true;
}

// ======================================================
// VALIDAR CNPJ
// ======================================================

function isValidCnpj(value: string) {
    const cnpj = onlyNumbers(value);

    if (cnpj.length !== 14) {
        return false;
    }

    if (/^(\d)\1+$/.test(cnpj)) {
        return false;
    }

    function calculateDigit(
        base: string,
        weights: number[]
    ) {
        const total = base
            .split("")
            .reduce(
                (
                    sum,
                    digit,
                    index
                ) =>
                    sum +
                    Number(digit) *
                    weights[index],
                0
            );

        const remainder = total % 11;

        return remainder < 2
            ? 0
            : 11 - remainder;
    }

    const firstDigit = calculateDigit(
        cnpj.slice(0, 12),
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

    const secondDigit = calculateDigit(
        cnpj.slice(0, 12) + firstDigit,
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
        Number(cnpj[12]) === firstDigit &&
        Number(cnpj[13]) === secondDigit
    );
}

function SejaParceiroContent() {
    const router = useRouter();

    const searchParams = useSearchParams();

    const draftId =
        searchParams.get("draft") || "";

    const applicationId =
        searchParams.get("application") || "";

    const [
        draftReady,
        setDraftReady,
    ] = useState(false);

    const [
        savingDraft,
        setSavingDraft,
    ] = useState(false);

    const [
        draftSaved,
        setDraftSaved,
    ] = useState(false);

    const [
        loading,
        setLoading,
    ] = useState(true);

    const [
        sending,
        setSending,
    ] = useState(false);

    const [
        searchingCep,
        setSearchingCep,
    ] = useState(false);

    const [
        searchingLocation,
        setSearchingLocation,
    ] = useState(false);

    const [
        error,
        setError,
    ] = useState("");

    const [
        userId,
        setUserId,
    ] = useState("");

    const [
        userEmail,
        setUserEmail,
    ] = useState("");

    const [
        hasRestaurant,
        setHasRestaurant,
    ] = useState(false);

    const [
        application,
        setApplication,
    ] =
        useState<RestaurantApplication | null>(
            null
        );

    // Tela que a pessoa está vendo agora.
    const [
        step,
        setStep,
    ] =
        useState<Step>(
            1
        );

    // Maior etapa já alcançada.
    // Nunca diminui quando volta para editar.
    const [
        progressStep,
        setProgressStep,
    ] =
        useState<Step>(
            1
        );

    // ======================================================
    // RESPONSÁVEL
    // ======================================================

    const [
        responsibleName,
        setResponsibleName,
    ] =
        useState("");

    const [
        responsibleCpf,
        setResponsibleCpf,
    ] =
        useState("");

    // CPF oficial vinculado à conta.
    // Depois de definido, todas as lojas usam o mesmo CPF.
    const [
        accountCpf,
        setAccountCpf,
    ] =
        useState("");

    const [
        phone,
        setPhone,
    ] =
        useState("");

    const [
        hasCnpj,
        setHasCnpj,
    ] =
        useState<boolean | null>(
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

    // ======================================================
    // LOJA
    // ======================================================

    const [
        businessName,
        setBusinessName,
    ] =
        useState("");

    const [
        category,
        setCategory,
    ] =
        useState("");

    const [
        description,
        setDescription,
    ] =
        useState("");

    // ======================================================
    // ENDEREÇO
    // ======================================================

    const [
        postalCode,
        setPostalCode,
    ] =
        useState("");

    const [
        cepValidated,
        setCepValidated,
    ] =
        useState(false);

    const [
        validatedCep,
        setValidatedCep,
    ] =
        useState("");

    const [
        street,
        setStreet,
    ] =
        useState("");

    const [
        number,
        setNumber,
    ] =
        useState("");

    const [
        complement,
        setComplement,
    ] =
        useState("");

    const [
        neighborhood,
        setNeighborhood,
    ] =
        useState("");

    const [
        city,
        setCity,
    ] =
        useState(
            "Paudalho"
        );

    const [
        state,
        setState,
    ] =
        useState(
            "PE"
        );

    const [
        latitude,
        setLatitude,
    ] =
        useState<number | null>(
            null
        );

    const [
        longitude,
        setLongitude,
    ] =
        useState<number | null>(
            null
        );

    const [
        locationConfirmed,
        setLocationConfirmed,
    ] =
        useState(false);

    // ======================================================
    // OPERAÇÃO
    // ======================================================

    const [
        acceptsDelivery,
        setAcceptsDelivery,
    ] =
        useState(true);

    const [
        acceptsPickup,
        setAcceptsPickup,
    ] =
        useState(true);

    const [
        preparationMinutes,
        setPreparationMinutes,
    ] =
        useState("30");

    const [
        minimumOrder,
        setMinimumOrder,
    ] =
        useState("0");

    // ======================================================
    // ACESSO
    // ======================================================

    const [
        password,
        setPassword,
    ] =
        useState("");

    const [
        confirmPassword,
        setConfirmPassword,
    ] =
        useState("");

    // A senha pertence à conta, e não à loja.
    // Depois de configurada uma vez, novas lojas não pedem senha.
    const [
        passwordConfigured,
        setPasswordConfigured,
    ] =
        useState(false);

    // ======================================================
    // VALIDAÇÕES VISUAIS
    // ======================================================

    const cpfComplete =
        onlyNumbers(
            responsibleCpf
        ).length === 11;

    const cpfValid =
        cpfComplete &&
        isValidCpf(
            responsibleCpf
        );

    const phoneComplete =
        onlyNumbers(
            phone
        ).length === 11;

    const phoneValid =
        phoneComplete &&
        isValidBrazilianPhone(
            phone
        );

    const cnpjComplete =
        onlyNumbers(
            cnpj
        ).length === 14;

    const cnpjValid =
        cnpjComplete &&
        isValidCnpj(
            cnpj
        );

    const cepComplete =
        onlyNumbers(
            postalCode
        ).length === 8;

    const currentCep =
        onlyNumbers(
            postalCode
        );

    const cepIsConfirmed =
        cepValidated &&
        validatedCep === currentCep;

    // ======================================================
    // ENDEREÇO PARA MAPA
    // ======================================================

    const mapAddress =
        useMemo(
            () => {
                return [
                    street,
                    number,
                    neighborhood,
                    city,
                    state,
                    postalCode,
                    "Brasil",
                ]
                    .filter(Boolean)
                    .join(", ");
            },
            [
                street,
                number,
                neighborhood,
                city,
                state,
                postalCode,
            ]
        );

    // ======================================================
    // DADOS DO RASCUNHO
    // ======================================================

    const getDraftFormData =
        useCallback(
            (): DraftFormData => ({
                responsibleName,
                responsibleCpf,
                phone,
                hasCnpj,
                cnpj,
                legalName,
                businessName,
                category,
                description,
                postalCode,
                cepValidated,
                validatedCep,
                street,
                number,
                complement,
                neighborhood,
                city,
                state,
                latitude,
                longitude,
                locationConfirmed,
                acceptsDelivery,
                acceptsPickup,
                preparationMinutes,
                minimumOrder,
            }),
            [
                responsibleName,
                responsibleCpf,
                phone,
                hasCnpj,
                cnpj,
                legalName,
                businessName,
                category,
                description,
                postalCode,
                cepValidated,
                validatedCep,
                street,
                number,
                complement,
                neighborhood,
                city,
                state,
                latitude,
                longitude,
                locationConfirmed,
                acceptsDelivery,
                acceptsPickup,
                preparationMinutes,
                minimumOrder,
            ]
        );

    // ======================================================
    // SALVAR RASCUNHO
    // ======================================================

    const saveDraftNow =
        useCallback(
            async (
                stepToSave?: Step
            ) => {
                if (
                    !draftId ||
                    !userId ||
                    !draftReady
                ) {
                    return true;
                }

                setSavingDraft(
                    true
                );

                setDraftSaved(
                    false
                );

                const requestedStep =
                    stepToSave ??
                    progressStep;

                const stepToPersist =
                    Math.max(
                        progressStep,
                        requestedStep
                    ) as Step;

                const {
                    error:
                        draftError,
                } =
                    await supabase
                        .from(
                            "restaurant_registration_drafts"
                        )
                        .update({
                            // IMPORTANTE:
                            // nunca deixa o progresso diminuir.
                            current_step:
                                stepToPersist,

                            display_name:
                                businessName
                                    .trim() ||
                                "Novo restaurante",

                            form_data:
                                getDraftFormData(),

                            updated_at:
                                new Date()
                                    .toISOString(),
                        })
                        .eq(
                            "id",
                            draftId
                        )
                        .eq(
                            "user_id",
                            userId
                        );

                setSavingDraft(
                    false
                );

                if (
                    draftError
                ) {
                    console.error(
                        "Erro ao salvar rascunho:",
                        draftError
                    );

                    setDraftSaved(
                        false
                    );

                    return false;
                }

                setProgressStep(
                    stepToPersist
                );

                setDraftSaved(
                    true
                );

                return true;
            },
            [
                draftId,
                userId,
                draftReady,
                progressStep,
                businessName,
                getDraftFormData,
            ]
        );

    // ======================================================
    // CARREGAR PÁGINA
    // ======================================================

    useEffect(() => {
        async function loadPage() {
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

            const currentUserId =
                session.user.id;

            setUserId(
                currentUserId
            );

            setUserEmail(
                session.user.email ||
                ""
            );

            const metadataName =
                session.user
                    .user_metadata
                    ?.full_name;

            if (
                typeof metadataName ===
                    "string" &&
                metadataName.trim()
            ) {
                setResponsibleName(
                    metadataName
                );
            }

            const {
                data:
                    profileData,
            } =
                await supabase
                    .from(
                        "profiles"
                    )
                    .select(
                        "phone"
                    )
                    .eq(
                        "id",
                        currentUserId
                    )
                    .maybeSingle();

            if (
                profileData?.phone
            ) {
                setPhone(
                    formatPhone(
                        profileData.phone
                    )
                );
            }

            // ==================================================
            // CPF OFICIAL DA CONTA
            // ==================================================

            let resolvedAccountCpf = "";

            const {
                data:
                    accountCpfData,

                error:
                    accountCpfError,
            } =
                await supabase
                    .from(
                        "account_cpfs"
                    )
                    .select(
                        "cpf"
                    )
                    .eq(
                        "user_id",
                        currentUserId
                    )
                    .maybeSingle();

            if (
                accountCpfError
            ) {
                console.error(
                    "Erro ao buscar CPF da conta:",
                    accountCpfError
                );
            }

            if (
                accountCpfData?.cpf
            ) {
                resolvedAccountCpf =
                    onlyNumbers(
                        accountCpfData.cpf
                    );

                const formattedAccountCpf =
                    formatCpf(
                        resolvedAccountCpf
                    );

                setAccountCpf(
                    formattedAccountCpf
                );

                setResponsibleCpf(
                    formattedAccountCpf
                );
            } else {
                // Compatibilidade com contas criadas antes
                // da regra de 1 CPF por conta. Se já existe
                // um cadastro enviado, tenta vincular o CPF
                // usado no primeiro cadastro dessa conta.
                const {
                    data:
                        previousCpfData,
                } =
                    await supabase
                        .from(
                            "restaurant_applications"
                        )
                        .select(
                            "responsible_cpf"
                        )
                        .eq(
                            "user_id",
                            currentUserId
                        )
                        .not(
                            "responsible_cpf",
                            "is",
                            null
                        )
                        .order(
                            "created_at",
                            {
                                ascending:
                                    true,
                            }
                        )
                        .limit(
                            1
                        )
                        .maybeSingle();

                const previousCpf =
                    onlyNumbers(
                        previousCpfData
                            ?.responsible_cpf ||
                        ""
                    );

                if (
                    previousCpf &&
                    isValidCpf(
                        previousCpf
                    )
                ) {
                    const {
                        data:
                            cpfMigrationData,

                        error:
                            cpfMigrationError,
                    } =
                        await supabase.rpc(
                            "set_account_cpf",
                            {
                                p_cpf:
                                    previousCpf,
                            }
                        );

                    if (
                        !cpfMigrationError
                    ) {
                        const migratedCpf =
                            onlyNumbers(
                                String(
                                    (
                                        cpfMigrationData as {
                                            cpf?: string;
                                        }
                                    )?.cpf ||
                                    previousCpf
                                )
                            );

                        resolvedAccountCpf =
                            migratedCpf;

                        const formattedMigratedCpf =
                            formatCpf(
                                migratedCpf
                            );

                        setAccountCpf(
                            formattedMigratedCpf
                        );

                        setResponsibleCpf(
                            formattedMigratedCpf
                        );
                    } else {
                        console.warn(
                            "Não foi possível migrar o CPF antigo para a conta:",
                            cpfMigrationError
                        );
                    }
                }
            }

            // ==================================================
            // SENHA DA CONTA
            // ==================================================

            let accessAlreadyConfigured =
                session.user
                    .user_metadata
                    ?.restaurant_password_configured ===
                true;

            // Contas antigas não possuem a flag acima.
            // No fluxo antigo, a senha era criada antes de
            // enviar o primeiro cadastro. Então, se já existe
            // solicitação ou restaurante, consideramos o acesso
            // da conta como já configurado.
            if (
                !accessAlreadyConfigured
            ) {
                const [
                    existingApplicationResult,
                    existingRestaurantResult,
                ] =
                    await Promise.all([
                        supabase
                            .from(
                                "restaurant_applications"
                            )
                            .select(
                                "id"
                            )
                            .eq(
                                "user_id",
                                currentUserId
                            )
                            .limit(
                                1
                            )
                            .maybeSingle(),

                        supabase
                            .from(
                                "restaurants"
                            )
                            .select(
                                "id"
                            )
                            .eq(
                                "owner_id",
                                currentUserId
                            )
                            .limit(
                                1
                            )
                            .maybeSingle(),
                    ]);

                if (
                    existingApplicationResult.data ||
                    existingRestaurantResult.data
                ) {
                    accessAlreadyConfigured =
                        true;
                }
            }

            setPasswordConfigured(
                accessAlreadyConfigured
            );

            // ==================================================
            // ABRIR RASCUNHO
            // ==================================================

            if (
                draftId
            ) {
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
                            "id",
                            draftId
                        )
                        .eq(
                            "user_id",
                            currentUserId
                        )
                        .maybeSingle();

                if (
                    draftError ||
                    !draftData
                ) {
                    console.error(
                        "Erro ao abrir rascunho:",
                        draftError
                    );

                    setError(
                        "Esse cadastro em andamento não foi encontrado."
                    );

                    setLoading(
                        false
                    );

                    return;
                }

                const draft =
                    draftData as RegistrationDraft;

                const saved =
                    draft.form_data ||
                    {};

                if (
                    saved.responsibleName !==
                    undefined
                ) {
                    setResponsibleName(
                        saved.responsibleName
                    );
                }

                if (
                    resolvedAccountCpf
                ) {
                    setResponsibleCpf(
                        formatCpf(
                            resolvedAccountCpf
                        )
                    );
                } else if (
                    saved.responsibleCpf !==
                    undefined
                ) {
                    setResponsibleCpf(
                        formatCpf(
                            saved.responsibleCpf
                        )
                    );
                }

                if (
                    saved.phone !==
                    undefined
                ) {
                    setPhone(
                        formatPhone(
                            saved.phone
                        )
                    );
                }

                if (
                    saved.hasCnpj !==
                    undefined
                ) {
                    setHasCnpj(
                        saved.hasCnpj ??
                        null
                    );
                }

                if (
                    saved.cnpj !==
                    undefined
                ) {
                    setCnpj(
                        formatCnpj(
                            saved.cnpj
                        )
                    );
                }

                if (
                    saved.legalName !==
                    undefined
                ) {
                    setLegalName(
                        saved.legalName
                    );
                }

                if (
                    saved.businessName !==
                    undefined
                ) {
                    setBusinessName(
                        saved.businessName
                    );
                }

                if (
                    saved.category !==
                    undefined
                ) {
                    setCategory(
                        saved.category
                    );
                }

                if (
                    saved.description !==
                    undefined
                ) {
                    setDescription(
                        saved.description
                    );
                }

                if (
                    saved.postalCode !==
                    undefined
                ) {
                    setPostalCode(
                        formatCep(
                            saved.postalCode
                        )
                    );
                }

                if (
                    typeof saved.cepValidated ===
                    "boolean"
                ) {
                    setCepValidated(
                        saved.cepValidated
                    );
                }

                if (
                    saved.validatedCep !==
                    undefined
                ) {
                    setValidatedCep(
                        onlyNumbers(
                            saved.validatedCep
                        )
                    );
                }

                if (
                    saved.street !==
                    undefined
                ) {
                    setStreet(
                        saved.street
                    );
                }

                if (
                    saved.number !==
                    undefined
                ) {
                    setNumber(
                        saved.number
                    );
                }

                if (
                    saved.complement !==
                    undefined
                ) {
                    setComplement(
                        saved.complement
                    );
                }

                if (
                    saved.neighborhood !==
                    undefined
                ) {
                    setNeighborhood(
                        saved.neighborhood
                    );
                }

                if (
                    saved.city !==
                    undefined
                ) {
                    setCity(
                        saved.city
                    );
                }

                if (
                    saved.state !==
                    undefined
                ) {
                    setState(
                        saved.state
                    );
                }

                if (
                    typeof saved.latitude ===
                    "number"
                ) {
                    setLatitude(
                        saved.latitude
                    );
                }

                if (
                    typeof saved.longitude ===
                    "number"
                ) {
                    setLongitude(
                        saved.longitude
                    );
                }

                if (
                    typeof saved.locationConfirmed ===
                    "boolean"
                ) {
                    setLocationConfirmed(
                        saved.locationConfirmed
                    );
                }

                if (
                    typeof saved.acceptsDelivery ===
                    "boolean"
                ) {
                    setAcceptsDelivery(
                        saved.acceptsDelivery
                    );
                }

                if (
                    typeof saved.acceptsPickup ===
                    "boolean"
                ) {
                    setAcceptsPickup(
                        saved.acceptsPickup
                    );
                }

                if (
                    saved.preparationMinutes !==
                    undefined
                ) {
                    setPreparationMinutes(
                        saved.preparationMinutes
                    );
                }

                if (
                    saved.minimumOrder !==
                    undefined
                ) {
                    setMinimumOrder(
                        saved.minimumOrder
                    );
                }

                const savedStep =
                    Number(
                        draft.current_step
                    );

                if (
                    savedStep >= 1 &&
                    savedStep <= 6
                ) {
                    const restoredStep =
                        savedStep as Step;

                    setStep(
                        restoredStep
                    );

                    setProgressStep(
                        restoredStep
                    );
                }

                setDraftReady(
                    true
                );

                setDraftSaved(
                    true
                );

                setLoading(
                    false
                );

                return;
            }

            // ==================================================
            // SE NÃO FOI ABERTO UM CADASTRO ESPECÍFICO,
            // PODEMOS VERIFICAR SE JÁ EXISTE LOJA APROVADA.
            // Quando vem ?application=..., NÃO podemos retornar
            // outra loja só porque a conta já possui uma aprovada.
            // ==================================================

            if (
                !applicationId
            ) {
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
                        .select(
                            "id"
                        )
                        .eq(
                            "owner_id",
                            currentUserId
                        )
                        .limit(
                            1
                        )
                        .maybeSingle();

                if (
                    restaurantError
                ) {
                    console.error(
                        "Erro ao verificar restaurante:",
                        restaurantError
                    );
                }

                if (
                    restaurantData
                ) {
                    setHasRestaurant(
                        true
                    );

                    setLoading(
                        false
                    );

                    return;
                }
            }

            let applicationQuery =
                supabase
                    .from(
                        "restaurant_applications"
                    )
                    .select(`
                        id,
                        business_name,
                        status,
                        rejection_reason,
                        created_at,
                        responsible_name,
                        responsible_cpf,
                        has_cnpj,
                        cnpj,
                        legal_name,
                        phone,
                        category,
                        description,
                        postal_code,
                        street,
                        number,
                        complement,
                        neighborhood,
                        city,
                        state,
                        latitude,
                        longitude,
                        accepts_delivery,
                        accepts_pickup,
                        preparation_minutes,
                        minimum_order
                    `)
                    .eq(
                        "user_id",
                        currentUserId
                    );

            if (
                applicationId
            ) {
                applicationQuery =
                    applicationQuery.eq(
                        "id",
                        applicationId
                    );
            } else {
                applicationQuery =
                    applicationQuery
                        .order(
                            "created_at",
                            {
                                ascending:
                                    false,
                            }
                        )
                        .limit(
                            1
                        );
            }

            const {
                data:
                    applicationData,

                error:
                    applicationError,
            } =
                await applicationQuery
                    .maybeSingle();

            if (
                applicationError
            ) {
                console.error(
                    "Erro ao buscar solicitação:",
                    applicationError
                );
            }

            if (
                applicationId &&
                !applicationData
            ) {
                setError(
                    "Esse cadastro não foi encontrado ou não pertence à sua conta."
                );

                setLoading(
                    false
                );

                return;
            }

            if (
                applicationData
            ) {
                const app =
                    applicationData as RestaurantApplication;

                setApplication(
                    app
                );

                if (
                    app.status ===
                    "rejected"
                ) {
                    setResponsibleName(
                        app.responsible_name ||
                        ""
                    );

                    setResponsibleCpf(
                        formatCpf(
                            resolvedAccountCpf ||
                            app.responsible_cpf ||
                            ""
                        )
                    );

                    setHasCnpj(
                        app.has_cnpj ??
                        false
                    );

                    setCnpj(
                        formatCnpj(
                            app.cnpj ||
                            ""
                        )
                    );

                    setLegalName(
                        app.legal_name ||
                        ""
                    );

                    setPhone(
                        formatPhone(
                            app.phone ||
                            ""
                        )
                    );

                    setBusinessName(
                        app.business_name ||
                        ""
                    );

                    setCategory(
                        app.category ||
                        ""
                    );

                    setDescription(
                        app.description ||
                        ""
                    );

                    setPostalCode(
                        formatCep(
                            app.postal_code ||
                            ""
                        )
                    );

                    // Cadastro recusado precisa
                    // validar o CEP novamente.

                    setCepValidated(
                        false
                    );

                    setValidatedCep(
                        ""
                    );

                    setStreet(
                        app.street ||
                        ""
                    );

                    setNumber(
                        app.number ||
                        ""
                    );

                    setComplement(
                        app.complement ||
                        ""
                    );

                    setNeighborhood(
                        app.neighborhood ||
                        ""
                    );

                    setCity(
                        app.city ||
                        "Paudalho"
                    );

                    setState(
                        app.state ||
                        "PE"
                    );

                    setLatitude(
                        app.latitude ??
                        null
                    );

                    setLongitude(
                        app.longitude ??
                        null
                    );

                    setLocationConfirmed(
                        app.latitude !==
                            null &&
                        app.longitude !==
                            null
                    );

                    setAcceptsDelivery(
                        app.accepts_delivery ??
                        true
                    );

                    setAcceptsPickup(
                        app.accepts_pickup ??
                        true
                    );

                    setPreparationMinutes(
                        String(
                            app.preparation_minutes ??
                            30
                        )
                    );

                    setMinimumOrder(
                        String(
                            app.minimum_order ??
                            0
                        ).replace(
                            ".",
                            ","
                        )
                    );
                }
            }

            setLoading(
                false
            );
        }

        loadPage();
    }, [
        router,
        draftId,
        applicationId,
    ]);

    // ======================================================
    // SALVAMENTO AUTOMÁTICO
    // ======================================================

    useEffect(() => {
        if (
            !draftId ||
            !draftReady ||
            !userId
        ) {
            return;
        }

        setDraftSaved(
            false
        );

        const timer =
            window.setTimeout(
                () => {
                    saveDraftNow();
                },
                800
            );

        return () => {
            window.clearTimeout(
                timer
            );
        };
    }, [
        draftId,
        draftReady,
        userId,
        step,
        responsibleName,
        responsibleCpf,
        phone,
        hasCnpj,
        cnpj,
        legalName,
        businessName,
        category,
        description,
        postalCode,
        cepValidated,
        validatedCep,
        street,
        number,
        complement,
        neighborhood,
        city,
        state,
        latitude,
        longitude,
        locationConfirmed,
        acceptsDelivery,
        acceptsPickup,
        preparationMinutes,
        minimumOrder,
        saveDraftNow,
    ]);

    // ======================================================
    // ENDEREÇO ALTERADO
    // ======================================================

    function addressChanged() {
        setLocationConfirmed(
            false
        );

        setLatitude(
            null
        );

        setLongitude(
            null
        );
    }

    // ======================================================
    // CEP ALTERADO
    // ======================================================

    function handlePostalCodeChange(
        value: string
    ) {
        const formatted =
            formatCep(
                value
            );

        setPostalCode(
            formatted
        );

        setCepValidated(
            false
        );

        setValidatedCep(
            ""
        );

        addressChanged();

        setError(
            ""
        );
    }

    // ======================================================
    // BUSCAR E VALIDAR CEP
    // ======================================================

    async function searchPostalCode() {
        const cleanCep =
            onlyNumbers(
                postalCode
            );

        setError("");

        setCepValidated(
            false
        );

        setValidatedCep(
            ""
        );

        if (
            cleanCep.length !==
            8
        ) {
            setError(
                "Digite um CEP válido com 8 números."
            );

            return;
        }

        setSearchingCep(
            true
        );

        try {
            const response =
                await fetch(
                    `https://viacep.com.br/ws/${cleanCep}/json/`,
                    {
                        cache:
                            "no-store",
                    }
                );

            if (
                !response.ok
            ) {
                setError(
                    "Não foi possível validar o CEP agora. Tente novamente."
                );

                return;
            }

            const data =
                await response.json();

            if (
                data.erro
            ) {
                setError(
                    "Esse CEP não existe. Confira os números digitados."
                );

                return;
            }

            const receivedUf =
                String(
                    data.uf ||
                    ""
                )
                    .trim()
                    .toUpperCase();

            const receivedCity =
                String(
                    data.localidade ||
                    ""
                )
                    .trim()
                    .toLowerCase();

            if (
                receivedUf !==
                    "PE" ||
                receivedCity !==
                    "paudalho"
            ) {
                setError(
                    `Esse CEP pertence a ${data.localidade || "outra cidade"} - ${data.uf || ""}. No momento aceitamos lojas somente em Paudalho - PE.`
                );

                return;
            }

            setPostalCode(
                formatCep(
                    cleanCep
                )
            );

            setStreet(
                data.logradouro ||
                ""
            );

            setNeighborhood(
                data.bairro ||
                ""
            );

            setCity(
                "Paudalho"
            );

            setState(
                "PE"
            );

            setCepValidated(
                true
            );

            setValidatedCep(
                cleanCep
            );

            setLocationConfirmed(
                false
            );

            setLatitude(
                null
            );

            setLongitude(
                null
            );
        } catch (
            cepError
        ) {
            console.error(
                "Erro CEP:",
                cepError
            );

            setCepValidated(
                false
            );

            setValidatedCep(
                ""
            );

            setError(
                "Não foi possível consultar o CEP agora. Verifique sua internet e tente novamente."
            );
        } finally {
            setSearchingCep(
                false
            );
        }
    }

    // ======================================================
    // LOCALIZAR ENDEREÇO
    // ======================================================

    async function locateAddressOnMap() {
        setError("");

        if (
            !cepIsConfirmed
        ) {
            setError(
                "Primeiro valide o CEP clicando em Buscar."
            );

            return;
        }

        if (
            !street.trim() ||
            !neighborhood.trim() ||
            !city.trim()
        ) {
            setError(
                "Preencha o endereço antes de localizar no mapa."
            );

            return;
        }

        setSearchingLocation(
            true
        );

        const fullAddress = [
            street,
            number,
            neighborhood,
            city,
            state,
            postalCode,
            "Brasil",
        ]
            .filter(
                Boolean
            )
            .join(
                ", "
            );

        const addressWithoutNumber = [
            street,
            neighborhood,
            city,
            state,
            postalCode,
            "Brasil",
        ]
            .filter(
                Boolean
            )
            .join(
                ", "
            );

        const queries = [
            fullAddress,
            addressWithoutNumber,
            `${postalCode}, ${city}, ${state}, Brasil`,
        ];

        try {
            let found:
                | {
                    lat: string;
                    lon: string;
                }
                | null =
                null;

            for (
                const query of
                queries
            ) {
                const response =
                    await fetch(
                        `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(
                            query
                        )}`
                    );

                if (
                    !response.ok
                ) {
                    continue;
                }

                const data:
                    {
                        lat: string;
                        lon: string;
                    }[] =
                    await response.json();

                if (
                    data.length >
                    0
                ) {
                    found =
                        data[0];

                    break;
                }
            }

            if (
                !found
            ) {
                setError(
                    "Não consegui localizar esse endereço automaticamente. Marque manualmente no mapa."
                );

                return;
            }

            const foundLatitude =
                Number(
                    found.lat
                );

            const foundLongitude =
                Number(
                    found.lon
                );

            if (
                Number.isNaN(
                    foundLatitude
                ) ||
                Number.isNaN(
                    foundLongitude
                )
            ) {
                setError(
                    "Não foi possível identificar as coordenadas desse endereço."
                );

                return;
            }

            setLatitude(
                foundLatitude
            );

            setLongitude(
                foundLongitude
            );

            setLocationConfirmed(
                false
            );
        } catch (
            locationError
        ) {
            console.error(
                "Erro ao localizar endereço:",
                locationError
            );

            setError(
                "Não foi possível localizar automaticamente. Marque o ponto manualmente no mapa."
            );
        } finally {
            setSearchingLocation(
                false
            );
        }
    }

    // ======================================================
    // GARANTIR CPF ÚNICO DA CONTA
    // ======================================================

    async function ensureAccountCpf() {
        const cleanCpf =
            onlyNumbers(
                responsibleCpf
            );

        if (
            !isValidCpf(
                cleanCpf
            )
        ) {
            setError(
                "Digite um CPF válido."
            );

            return false;
        }

        if (
            accountCpf
        ) {
            if (
                onlyNumbers(
                    accountCpf
                ) !==
                cleanCpf
            ) {
                setError(
                    "O CPF desta conta já está vinculado e não pode ser trocado."
                );

                setResponsibleCpf(
                    accountCpf
                );

                return false;
            }

            return true;
        }

        const {
            data,
            error:
                cpfError,
        } =
            await supabase.rpc(
                "set_account_cpf",
                {
                    p_cpf:
                        cleanCpf,
                }
            );

        if (
            cpfError
        ) {
            console.error(
                "Erro ao vincular CPF à conta:",
                cpfError
            );

            if (
                cpfError.message.includes(
                    "CPF_ALREADY_IN_USE"
                )
            ) {
                setError(
                    "Este CPF já está vinculado a outra conta."
                );
            } else if (
                cpfError.message.includes(
                    "ACCOUNT_ALREADY_HAS_CPF"
                )
            ) {
                setError(
                    "Esta conta já possui outro CPF vinculado. Atualize a página e tente novamente."
                );
            } else if (
                cpfError.message.includes(
                    "CPF_INVALID"
                )
            ) {
                setError(
                    "Digite um CPF válido."
                );
            } else {
                setError(
                    "Não foi possível vincular o CPF à sua conta. Tente novamente."
                );
            }

            return false;
        }

        const savedCpf =
            onlyNumbers(
                String(
                    (
                        data as {
                            cpf?: string;
                        }
                    )?.cpf ||
                    cleanCpf
                )
            );

        const formattedCpf =
            formatCpf(
                savedCpf
            );

        setAccountCpf(
            formattedCpf
        );

        setResponsibleCpf(
            formattedCpf
        );

        return true;
    }

    // ======================================================
    // CONFIGURAR SENHA DA CONTA UMA ÚNICA VEZ
    // ======================================================

    async function configureAccountAccess() {
        if (
            passwordConfigured
        ) {
            return true;
        }

        if (
            password.length <
            8
        ) {
            setError(
                "Crie uma senha com pelo menos 8 caracteres."
            );

            return false;
        }

        if (
            password !==
            confirmPassword
        ) {
            setError(
                "As duas senhas precisam ser iguais."
            );

            return false;
        }

        const {
            error:
                accessError,
        } =
            await supabase.auth
                .updateUser({
                    password,

                    data: {
                        full_name:
                            responsibleName.trim(),

                        phone:
                            phone.trim(),

                        account_origin:
                            "restaurant",

                        restaurant_password_configured:
                            true,
                    },
                });

        if (
            accessError
        ) {
            console.error(
                "Erro ao configurar acesso da conta:",
                accessError
            );

            setError(
                "Não foi possível configurar sua senha. Tente novamente."
            );

            return false;
        }

        setPasswordConfigured(
            true
        );

        // Nunca salvamos senha no rascunho.
        setPassword("");
        setConfirmPassword("");

        return true;
    }

    // ======================================================
    // VALIDAR ETAPAS
    // ======================================================

    function validateStep(
        currentStep: Step
    ) {
        setError("");

        if (
            currentStep ===
            1
        ) {
            if (
                responsibleName
                    .trim()
                    .length <
                3
            ) {
                setError(
                    "Digite o nome completo do responsável."
                );

                return false;
            }

            if (
                !isValidCpf(
                    responsibleCpf
                )
            ) {
                setError(
                    "Digite um CPF válido."
                );

                return false;
            }

            if (
                !isValidBrazilianPhone(
                    phone
                )
            ) {
                setError(
                    "Digite um celular válido com DDD. Exemplo: (81) 99999-9999."
                );

                return false;
            }

            if (
                hasCnpj ===
                null
            ) {
                setError(
                    "Informe se a loja possui CNPJ."
                );

                return false;
            }

            if (
                hasCnpj
            ) {
                if (
                    !isValidCnpj(
                        cnpj
                    )
                ) {
                    setError(
                        "Digite um CNPJ válido."
                    );

                    return false;
                }

                if (
                    legalName
                        .trim()
                        .length <
                    3
                ) {
                    setError(
                        "Digite a razão social da empresa."
                    );

                    return false;
                }
            }
        }

        if (
            currentStep ===
            2
        ) {
            if (
                businessName
                    .trim()
                    .length <
                2
            ) {
                setError(
                    "Digite o nome da loja."
                );

                return false;
            }

            if (
                !category.trim()
            ) {
                setError(
                    "Selecione a categoria da loja."
                );

                return false;
            }
        }

        if (
            currentStep ===
            3
        ) {
            if (
                onlyNumbers(
                    postalCode
                ).length !==
                8
            ) {
                setError(
                    "Digite um CEP com 8 números."
                );

                return false;
            }

            if (
                !cepIsConfirmed
            ) {
                setError(
                    "Esse CEP ainda não foi validado. Clique em Buscar e confirme que ele pertence a Paudalho - PE."
                );

                return false;
            }

            if (
                !street.trim()
            ) {
                setError(
                    "Digite a rua da loja."
                );

                return false;
            }

            if (
                !number.trim()
            ) {
                setError(
                    "Digite o número do endereço."
                );

                return false;
            }

            if (
                !neighborhood.trim()
            ) {
                setError(
                    "Digite o bairro."
                );

                return false;
            }

            if (
                latitude ===
                    null ||
                longitude ===
                    null
            ) {
                setError(
                    "Marque no mapa o ponto exato onde fica sua loja."
                );

                return false;
            }

            if (
                !locationConfirmed
            ) {
                setError(
                    "Confira o pino no mapa e confirme a localização."
                );

                return false;
            }
        }

        if (
            currentStep ===
            4
        ) {
            if (
                !acceptsDelivery &&
                !acceptsPickup
            ) {
                setError(
                    "Escolha pelo menos Entrega ou Retirada."
                );

                return false;
            }

            const prep =
                Number(
                    preparationMinutes
                );

            if (
                Number.isNaN(
                    prep
                ) ||
                prep < 5 ||
                prep > 180
            ) {
                setError(
                    "Informe um tempo de preparo entre 5 e 180 minutos."
                );

                return false;
            }

            const minimum =
                parseMoney(
                    minimumOrder
                );

            if (
                minimum < 0
            ) {
                setError(
                    "O pedido mínimo não pode ser negativo."
                );

                return false;
            }
        }

        if (
            currentStep ===
                5 &&
            !passwordConfigured
        ) {
            if (
                password.length <
                8
            ) {
                setError(
                    "Crie uma senha com pelo menos 8 caracteres."
                );

                return false;
            }

            if (
                password !==
                confirmPassword
            ) {
                setError(
                    "As duas senhas precisam ser iguais."
                );

                return false;
            }
        }

        return true;
    }

    // ======================================================
    // AVANÇAR
    // ======================================================

    async function nextStep() {
        if (
            !validateStep(
                step
            )
        ) {
            return;
        }

        // Ao sair da etapa 1, vincula o CPF à conta.
        // Depois disso ele fica bloqueado para todas as lojas.
        if (
            step ===
            1
        ) {
            const cpfReady =
                await ensureAccountCpf();

            if (
                !cpfReady
            ) {
                return;
            }
        }

        // A senha é configurada uma única vez na conta.
        // Criar uma nova loja nunca altera a senha existente.
        if (
            step ===
                5 &&
            !passwordConfigured
        ) {
            const accessReady =
                await configureAccountAccess();

            if (
                !accessReady
            ) {
                return;
            }
        }

        if (
            step < 6
        ) {
            const next =
                (
                    step +
                    1
                ) as Step;

            if (
                draftId
            ) {
                const saved =
                    await saveDraftNow(
                        next
                    );

                if (
                    !saved
                ) {
                    setError(
                        "Não conseguimos salvar seu progresso. Tente novamente."
                    );

                    return;
                }
            }

            setStep(
                next
            );

            window.scrollTo({
                top:
                    0,

                behavior:
                    "smooth",
            });
        }
    }

    // ======================================================
    // VOLTAR UMA ETAPA
    // ======================================================

    async function previousStep() {
        setError("");

        if (
            step > 1
        ) {
            const previous =
                (
                    step -
                    1
                ) as Step;

            // Salva os dados que acabaram
            // de ser editados, mas NÃO reduz
            // current_step no banco.
            if (
                draftId
            ) {
                const saved =
                    await saveDraftNow();

                if (
                    !saved
                ) {
                    setError(
                        "Não conseguimos salvar seu progresso. Tente novamente."
                    );

                    return;
                }
            }

            setStep(
                previous
            );

            window.scrollTo({
                top:
                    0,

                behavior:
                    "smooth",
            });
        }
    }

    // ======================================================
    // VOLTAR PARA TELA INICIAL
    // ======================================================

    async function goToInitialScreen() {
        setError("");

        // Salva imediatamente antes de sair.
        // Assim não depende dos 800 ms
        // do salvamento automático.
        if (
            draftId &&
            draftReady
        ) {
            const saved =
                await saveDraftNow();

            if (
                !saved
            ) {
                setError(
                    "Não conseguimos salvar seu progresso. Tente novamente."
                );

                return;
            }
        }

        router.push(
            "/restaurante/inicio"
        );
    }

    // ======================================================
    // ENVIAR CADASTRO
    // ======================================================

    async function handleSubmit(
        event:
            FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        if (
            !userId ||
            step !== 6 ||
            sending
        ) {
            return;
        }

        setSending(
            true
        );

        setError("");

        for (
            let current = 1;
            current <= 5;
            current++
        ) {
            if (
                !validateStep(
                    current as Step
                )
            ) {
                setStep(
                    current as Step
                );

                setSending(
                    false
                );

                return;
            }
        }

        // Garante a regra 1 conta = 1 CPF também no envio final.
        const cpfReady =
            await ensureAccountCpf();

        if (
            !cpfReady
        ) {
            setStep(
                1
            );

            setSending(
                false
            );

            return;
        }

        // Compatibilidade com quem chegou à revisão antes de
        // concluir a configuração de acesso.
        if (
            !passwordConfigured
        ) {
            const accessReady =
                await configureAccountAccess();

            if (
                !accessReady
            ) {
                setStep(
                    5
                );

                setSending(
                    false
                );

                return;
            }
        }

        // Atualiza apenas os dados da conta.
        // IMPORTANTE: não envia password aqui.
        // Assim cadastrar outra loja nunca troca a senha.
        const {
            error:
                accountDataError,
        } =
            await supabase.auth
                .updateUser({
                    data: {
                        full_name:
                            responsibleName.trim(),

                        phone:
                            phone.trim(),

                        account_origin:
                            "restaurant",

                        restaurant_password_configured:
                            true,
                    },
                });

        if (
            accountDataError
        ) {
            console.error(
                "Erro ao atualizar dados da conta:",
                accountDataError
            );

            setError(
                "Não foi possível atualizar os dados da sua conta. Tente novamente."
            );

            setSending(
                false
            );

            return;
        }

        const {
            data,

            error:
                insertError,
        } =
            await supabase
                .from(
                    "restaurant_applications"
                )
                .insert({
                    user_id:
                        userId,

                    responsible_name:
                        responsibleName.trim(),

                    responsible_cpf:
                        onlyNumbers(
                            responsibleCpf
                        ),

                    has_cnpj:
                        hasCnpj ===
                        true,

                    cnpj:
                        hasCnpj
                            ? onlyNumbers(
                                cnpj
                            )
                            : null,

                    legal_name:
                        hasCnpj
                            ? legalName.trim()
                            : null,

                    business_name:
                        businessName.trim(),

                    phone:
                        phone.trim(),

                    category:
                        category.trim(),

                    description:
                        description.trim() ||
                        null,

                    postal_code:
                        onlyNumbers(
                            postalCode
                        ),

                    street:
                        street.trim(),

                    number:
                        number.trim(),

                    complement:
                        complement.trim() ||
                        null,

                    neighborhood:
                        neighborhood.trim(),

                    city:
                        city.trim(),

                    state:
                        state
                            .trim()
                            .toUpperCase(),

                    latitude,

                    longitude,

                    accepts_delivery:
                        acceptsDelivery,

                    accepts_pickup:
                        acceptsPickup,

                    preparation_minutes:
                        Number(
                            preparationMinutes
                        ),

                    minimum_order:
                        parseMoney(
                            minimumOrder
                        ),
                })
                .select(`
                    id,
                    business_name,
                    status,
                    rejection_reason,
                    created_at,
                    responsible_name,
                    responsible_cpf,
                    has_cnpj,
                    cnpj,
                    legal_name,
                    phone,
                    category,
                    description,
                    postal_code,
                    street,
                    number,
                    complement,
                    neighborhood,
                    city,
                    state,
                    latitude,
                    longitude,
                    accepts_delivery,
                    accepts_pickup,
                    preparation_minutes,
                    minimum_order
                `)
                .single();

        if (
            insertError
        ) {
            console.error(
                "Erro ao enviar solicitação:",
                insertError
            );

            if (
                insertError.message.includes(
                    "restaurant_application_pending_user_unique"
                )
            ) {
                setError(
                    "Você já possui um cadastro aguardando aprovação."
                );
            } else {
                setError(
                    "Não foi possível enviar seu cadastro. Tente novamente."
                );
            }

            setSending(
                false
            );

            return;
        }

        if (
            draftId
        ) {
            const {
                error:
                    deleteDraftError,
            } =
                await supabase
                    .from(
                        "restaurant_registration_drafts"
                    )
                    .delete()
                    .eq(
                        "id",
                        draftId
                    )
                    .eq(
                        "user_id",
                        userId
                    );

            if (
                deleteDraftError
            ) {
                console.error(
                    "Erro ao remover rascunho:",
                    deleteDraftError
                );
            }
        }

        setApplication(
            data as RestaurantApplication
        );

        setSending(
            false
        );
    }

    // ======================================================
    // CARREGANDO
    // ======================================================

    if (
        loading
    ) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7]">
                <div className="text-center">
                    <div className="text-5xl">
                        🏪
                    </div>

                    <p className="mt-4 font-bold">
                        Carregando Portal do Restaurante...
                    </p>
                </div>
            </main>
        );
    }

    // ======================================================
    // LOJA LIBERADA
    // ======================================================

    if (
        hasRestaurant
    ) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7] px-4">
                <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-sm">
                    <div className="text-center">
                        <div className="text-6xl">
                            🏪
                        </div>

                        <h1 className="mt-5 text-3xl font-black">
                            Sua loja está liberada
                        </h1>

                        <p className="mt-2 text-zinc-500">
                            Seu restaurante foi aprovado no
                            Entrega Paudalho.
                        </p>
                    </div>

                    <div className="mt-6 rounded-2xl bg-green-50 p-5">
                        <p className="font-black text-green-700">
                            ✅ Cadastro aprovado
                        </p>

                        <p className="mt-2 text-sm leading-6 text-green-700">
                            Agora você pode entrar no painel
                            da loja e gerenciar sua operação.
                        </p>
                    </div>

                    <Link
                        href="/restaurante-painel"
                        className="mt-6 block rounded-xl bg-red-600 px-5 py-4 text-center font-black text-white transition hover:bg-red-700"
                    >
                        Abrir painel da loja
                    </Link>

                    <Link
                        href="/restaurante"
                        className="mt-3 block rounded-xl border border-zinc-200 px-5 py-4 text-center font-bold transition hover:bg-zinc-50"
                    >
                        Voltar ao Portal do Restaurante
                    </Link>
                </div>
            </main>
        );
    }

    // ======================================================
    // CADASTRO PENDENTE
    // ======================================================

    if (
        application?.status ===
        "pending"
    ) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7] px-4 py-10">
                <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-sm">
                    <div className="text-center">
                        <div className="text-6xl">
                            ⏳
                        </div>

                        <h1 className="mt-5 text-3xl font-black">
                            Cadastro em análise
                        </h1>

                        <p className="mt-3 text-zinc-500">
                            Recebemos o cadastro da
                        </p>

                        <p className="mt-1 text-xl font-black">
                            {
                                application.business_name
                            }
                        </p>
                    </div>

                    <div className="mt-7 rounded-2xl border border-yellow-200 bg-yellow-50 p-5">
                        <p className="font-black text-yellow-800">
                            🕐 Aguardando aprovação
                        </p>

                        <p className="mt-2 text-sm leading-6 text-yellow-700">
                            Vamos analisar as informações
                            enviadas antes de liberar a loja
                            para operar.
                        </p>
                    </div>

                    <Link
  href="/restaurante/inicio"
  className="mt-7 block w-full rounded-xl border-2 border-zinc-900 bg-white px-5 py-4 text-center font-black text-zinc-900 shadow-sm transition hover:bg-zinc-900 hover:text-white"
>
  ← Voltar para minhas lojas
</Link>
                </div>
            </main>
        );
    }

    // ======================================================
    // APROVADO
    // ======================================================

    if (
        application?.status ===
        "approved"
    ) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7] px-4">
                <div className="w-full max-w-lg rounded-3xl bg-white p-8 text-center shadow-sm">
                    <div className="text-6xl">
                        ✅
                    </div>

                    <h1 className="mt-5 text-3xl font-black">
                        Cadastro aprovado
                    </h1>

                    <p className="mt-3 text-zinc-500">
                        Estamos finalizando a liberação da
                        sua loja.
                    </p>

                    <button
                        type="button"
                        onClick={() =>
                            window.location.reload()
                        }
                        className="mt-6 w-full rounded-xl bg-red-600 px-5 py-4 font-black text-white"
                    >
                        Atualizar
                    </button>
                </div>
            </main>
        );
    }

    const steps = [
        {
            number: 1,
            label: "Responsável",
        },
        {
            number: 2,
            label: "Loja",
        },
        {
            number: 3,
            label: "Endereço",
        },
        {
            number: 4,
            label: "Operação",
        },
        {
            number: 5,
            label: "Acesso",
        },
        {
            number: 6,
            label: "Revisão",
        },
    ];

    return (
        <main className="min-h-screen bg-[#f7f7f7] text-zinc-900">
            <header className="border-b border-zinc-200 bg-white">
                <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
                    <div>
                        <p className="text-xs font-black uppercase text-red-600">
                            Entrega Paudalho
                        </p>

                        <p className="mt-1 font-black">
                            Cadastro de Restaurante
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={
                            goToInitialScreen
                        }
                        className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-bold transition hover:bg-zinc-50"
                    >
                        ← Tela inicial
                    </button>
                </div>
            </header>

            <div className="mx-auto max-w-5xl px-4 py-8">
                {/* EMAIL */}

                <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="font-black text-green-800">
                                ✅ E-mail confirmado
                            </p>

                            <p className="mt-1 text-sm text-green-700">
                                {
                                    userEmail
                                }
                            </p>

                            {draftId && (
                                <p className="mt-2 text-xs font-bold text-green-700">
                                    {savingDraft
                                        ? "⏳ Salvando seu progresso..."
                                        : draftSaved
                                            ? "☁️ Progresso salvo automaticamente"
                                            : "Alterações pendentes..."}
                                </p>
                            )}
                        </div>

                        <span className="rounded-full bg-green-600 px-3 py-1 text-xs font-black text-white">
                            VERIFICADO
                        </span>
                    </div>
                </div>

                {/* PROGRESSO */}

                <div className="mt-6 overflow-x-auto rounded-3xl bg-white p-4 shadow-sm">
                    <div className="flex min-w-[720px] items-center">
                        {steps.map(
                            (
                                item,
                                index
                            ) => {
                                const active =
                                    step ===
                                    item.number;

                                const done =
                                    progressStep >=
                                    item.number &&
                                    !active;

                                return (
                                    <div
                                        key={
                                            item.number
                                        }
                                        className="flex flex-1 items-center"
                                    >
                                        <div className="flex flex-col items-center">
                                            <div
                                                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-black ${
                                                    done
                                                        ? "bg-green-600 text-white"
                                                        : active
                                                            ? "bg-red-600 text-white"
                                                            : "bg-zinc-100 text-zinc-400"
                                                }`}
                                            >
                                                {done
                                                    ? "✓"
                                                    : item.number}
                                            </div>

                                            <p
                                                className={`mt-2 text-xs font-black ${
                                                    active
                                                        ? "text-red-600"
                                                        : done
                                                            ? "text-green-700"
                                                            : "text-zinc-400"
                                                }`}
                                            >
                                                {
                                                    item.label
                                                }
                                            </p>
                                        </div>

                                        {index <
                                            steps.length -
                                            1 && (
                                            <div
                                                className={`mx-3 h-1 flex-1 rounded-full ${
                                                    progressStep >
                                                    item.number
                                                        ? "bg-green-500"
                                                        : "bg-zinc-100"
                                                }`}
                                            />
                                        )}
                                    </div>
                                );
                            }
                        )}
                    </div>
                </div>

                {progressStep ===
                    6 &&
                    step <
                    6 && (
                    <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                        <p className="font-black text-blue-800">
                            ✏️ Editando uma etapa já concluída
                        </p>

                        <p className="mt-1 text-sm leading-6 text-blue-700">
                            Seu cadastro continua salvo como
                            etapa 6 de 6. As outras etapas não
                            serão apagadas quando você alterar
                            estes dados.
                        </p>
                    </div>
                )}

                <form
                    onSubmit={
                        handleSubmit
                    }
                    className="mt-6"
                >
                    {/* ==================================================
                        ETAPA 1
                    ================================================== */}

                    {step ===
                        1 && (
                        <section className="rounded-3xl bg-white p-6 shadow-sm md:p-8">
                            <p className="text-xs font-black uppercase tracking-wide text-red-600">
                                ETAPA 1 DE 6
                            </p>

                            <h1 className="mt-2 text-3xl font-black">
                                Quem é o responsável?
                            </h1>

                            <p className="mt-2 text-zinc-500">
                                Precisamos saber quem responde
                                pelo estabelecimento.
                            </p>

                            <div className="mt-8 space-y-5">
                                <div>
                                    <label className="mb-2 block text-sm font-black">
                                        Nome completo *
                                    </label>

                                    <input
                                        value={
                                            responsibleName
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            setResponsibleName(
                                                event.target
                                                    .value
                                            )
                                        }
                                        placeholder="Nome do responsável"
                                        className="w-full rounded-xl border border-zinc-200 px-4 py-4 outline-none transition focus:border-red-500"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-black">
                                        CPF do responsável *
                                    </label>

                                    <input
                                        inputMode="numeric"
                                        value={
                                            responsibleCpf
                                        }
                                        readOnly={
                                            Boolean(
                                                accountCpf
                                            )
                                        }
                                        onChange={(
                                            event
                                        ) => {
                                            if (
                                                accountCpf
                                            ) {
                                                return;
                                            }

                                            setResponsibleCpf(
                                                formatCpf(
                                                    event.target
                                                        .value
                                                )
                                            );
                                        }}
                                        placeholder="000.000.000-00"
                                        className={`w-full rounded-xl border px-4 py-4 outline-none transition ${
                                            accountCpf
                                                ? "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-600"
                                                : cpfComplete
                                                ? cpfValid
                                                    ? "border-green-500"
                                                    : "border-red-400"
                                                : "border-zinc-200"
                                        }`}
                                    />

                                    {accountCpf ? (
                                        <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
                                            <p className="text-sm font-black text-blue-800">
                                                🔒 CPF vinculado à sua conta
                                            </p>

                                            <p className="mt-1 text-xs leading-5 text-blue-700">
                                                Este CPF é usado em todos os
                                                estabelecimentos desta conta e
                                                não pode ser trocado ao criar
                                                outra loja.
                                            </p>
                                        </div>
                                    ) : (
                                        cpfComplete && (
                                            <p
                                                className={`mt-2 text-sm font-bold ${
                                                    cpfValid
                                                        ? "text-green-600"
                                                        : "text-red-600"
                                                }`}
                                            >
                                                {cpfValid
                                                    ? "✅ CPF válido"
                                                    : "⚠️ CPF inválido"}
                                            </p>
                                        )
                                    )}
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-black">
                                        WhatsApp *
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
                                                formatPhone(
                                                    event.target
                                                        .value
                                                )
                                            )
                                        }
                                        placeholder="(81) 99999-9999"
                                        className={`w-full rounded-xl border px-4 py-4 outline-none ${
                                            phoneComplete
                                                ? phoneValid
                                                    ? "border-green-500"
                                                    : "border-red-400"
                                                : "border-zinc-200"
                                        }`}
                                    />

                                    {phoneComplete && (
                                        <p
                                            className={`mt-2 text-sm font-bold ${
                                                phoneValid
                                                    ? "text-green-600"
                                                    : "text-red-600"
                                            }`}
                                        >
                                            {phoneValid
                                                ? "✅ Celular com formato válido"
                                                : "⚠️ Número inválido"}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <p className="mb-3 text-sm font-black">
                                        Sua loja possui CNPJ? *
                                    </p>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setHasCnpj(
                                                    true
                                                )
                                            }
                                            className={`rounded-2xl border p-5 text-left ${
                                                hasCnpj ===
                                                true
                                                    ? "border-red-500 bg-red-50"
                                                    : "border-zinc-200"
                                            }`}
                                        >
                                            <p className="font-black">
                                                ✓ Sim
                                            </p>

                                            <p className="mt-1 text-sm text-zinc-500">
                                                Minha empresa possui CNPJ.
                                            </p>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setHasCnpj(
                                                    false
                                                );

                                                setCnpj(
                                                    ""
                                                );

                                                setLegalName(
                                                    ""
                                                );
                                            }}
                                            className={`rounded-2xl border p-5 text-left ${
                                                hasCnpj ===
                                                false
                                                    ? "border-red-500 bg-red-50"
                                                    : "border-zinc-200"
                                            }`}
                                        >
                                            <p className="font-black">
                                                ✕ Ainda não
                                            </p>

                                            <p className="mt-1 text-sm text-zinc-500">
                                                Continuar utilizando os
                                                dados do responsável.
                                            </p>
                                        </button>
                                    </div>
                                </div>

                                {hasCnpj ===
                                    false && (
                                    <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5">
                                        <p className="font-black text-yellow-800">
                                            ⏳ Cadastro temporário com CPF
                                        </p>

                                        <p className="mt-2 text-sm leading-6 text-yellow-700">
                                            Depois que a loja for
                                            aprovada e liberada, será
                                            necessário cadastrar um CNPJ
                                            dentro do prazo de 6 meses
                                            para continuar operando.
                                        </p>
                                    </div>
                                )}

                                {hasCnpj ===
                                    true && (
                                    <>
                                        <div>
                                            <label className="mb-2 block text-sm font-black">
                                                CNPJ *
                                            </label>

                                            <input
                                                value={
                                                    cnpj
                                                }
                                                onChange={(
                                                    event
                                                ) =>
                                                    setCnpj(
                                                        formatCnpj(
                                                            event.target
                                                                .value
                                                        )
                                                    )
                                                }
                                                placeholder="00.000.000/0000-00"
                                                className={`w-full rounded-xl border px-4 py-4 ${
                                                    cnpjComplete
                                                        ? cnpjValid
                                                            ? "border-green-500"
                                                            : "border-red-400"
                                                        : "border-zinc-200"
                                                }`}
                                            />

                                            {cnpjComplete && (
                                                <p
                                                    className={`mt-2 text-sm font-bold ${
                                                        cnpjValid
                                                            ? "text-green-600"
                                                            : "text-red-600"
                                                    }`}
                                                >
                                                    {cnpjValid
                                                        ? "✅ CNPJ válido"
                                                        : "⚠️ CNPJ inválido"}
                                                </p>
                                            )}
                                        </div>

                                        <div>
                                            <label className="mb-2 block text-sm font-black">
                                                Razão social *
                                            </label>

                                            <input
                                                value={
                                                    legalName
                                                }
                                                onChange={(
                                                    event
                                                ) =>
                                                    setLegalName(
                                                        event.target
                                                            .value
                                                    )
                                                }
                                                placeholder="Nome empresarial"
                                                className="w-full rounded-xl border border-zinc-200 px-4 py-4"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </section>
                    )}

                    {/* ==================================================
                        ETAPA 2
                    ================================================== */}

                    {step ===
                        2 && (
                        <section className="rounded-3xl bg-white p-6 shadow-sm md:p-8">
                            <p className="text-xs font-black uppercase text-red-600">
                                ETAPA 2 DE 6
                            </p>

                            <h1 className="mt-2 text-3xl font-black">
                                Conte sobre sua loja
                            </h1>

                            <p className="mt-2 text-zinc-500">
                                Essas informações serão usadas
                                para identificar o estabelecimento.
                            </p>

                            <div className="mt-8 space-y-5">
                                <div>
                                    <label className="mb-2 block text-sm font-black">
                                        Nome da loja *
                                    </label>

                                    <input
                                        value={
                                            businessName
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            setBusinessName(
                                                event.target
                                                    .value
                                            )
                                        }
                                        className="w-full rounded-xl border border-zinc-200 px-4 py-4"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-black">
                                        Categoria principal *
                                    </label>

                                    <select
                                        value={
                                            category
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            setCategory(
                                                event.target
                                                    .value
                                            )
                                        }
                                        className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-4"
                                    >
                                        <option value="">
                                            Selecione uma categoria
                                        </option>

                                        <option value="Hamburgueria">
                                            Hamburgueria
                                        </option>

                                        <option value="Pizzaria">
                                            Pizzaria
                                        </option>

                                        <option value="Lanchonete">
                                            Lanchonete
                                        </option>

                                        <option value="Restaurante">
                                            Restaurante
                                        </option>

                                        <option value="Açaí">
                                            Açaí
                                        </option>

                                        <option value="Doces">
                                            Doces
                                        </option>

                                        <option value="Mercado">
                                            Mercado
                                        </option>

                                        <option value="Padaria">
                                            Padaria
                                        </option>

                                        <option value="Bebidas">
                                            Bebidas
                                        </option>

                                        <option value="Outros">
                                            Outros
                                        </option>
                                    </select>
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-black">
                                        Descrição
                                    </label>

                                    <textarea
                                        value={
                                            description
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            setDescription(
                                                event.target
                                                    .value
                                            )
                                        }
                                        rows={
                                            5
                                        }
                                        maxLength={
                                            500
                                        }
                                        placeholder="Conte um pouco sobre sua loja, especialidades e produtos..."
                                        className="w-full resize-none rounded-xl border border-zinc-200 px-4 py-4"
                                    />

                                    <p className="mt-2 text-right text-xs text-zinc-400">
                                        {
                                            description.length
                                        }
                                        /500
                                    </p>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* ==================================================
                        ETAPA 3 - ENDEREÇO
                    ================================================== */}

                    {step ===
                        3 && (
                        <section className="rounded-3xl bg-white p-6 shadow-sm md:p-8">
                            <p className="text-xs font-black uppercase text-red-600">
                                ETAPA 3 DE 6
                            </p>

                            <h1 className="mt-2 text-3xl font-black">
                                Onde fica sua loja?
                            </h1>

                            <p className="mt-2 text-zinc-500">
                                Informe o endereço e marque o ponto
                                exato no mapa.
                            </p>

                            <div className="mt-8 space-y-5">
                                {/* CEP */}

                                <div>
                                    <label className="mb-2 block text-sm font-black">
                                        CEP *
                                    </label>

                                    <div className="flex gap-3">
                                        <input
                                            inputMode="numeric"
                                            value={
                                                postalCode
                                            }
                                            onChange={(
                                                event
                                            ) =>
                                                handlePostalCodeChange(
                                                    event.target
                                                        .value
                                                )
                                            }
                                            placeholder="55825-000"
                                            className={`min-w-0 flex-1 rounded-xl border px-4 py-4 outline-none transition ${
                                                cepIsConfirmed
                                                    ? "border-green-500 bg-green-50"
                                                    : cepComplete
                                                        ? "border-yellow-400"
                                                        : "border-zinc-200"
                                            }`}
                                        />

                                        <button
                                            type="button"
                                            onClick={
                                                searchPostalCode
                                            }
                                            disabled={
                                                searchingCep
                                            }
                                            className="rounded-xl bg-zinc-900 px-5 font-black text-white disabled:bg-zinc-300"
                                        >
                                            {searchingCep
                                                ? "Validando..."
                                                : "Buscar"}
                                        </button>
                                    </div>

                                    {cepIsConfirmed ? (
                                        <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-3">
                                            <p className="text-sm font-black text-green-700">
                                                ✅ CEP confirmado
                                            </p>

                                            <p className="mt-1 text-xs text-green-600">
                                                CEP válido de Paudalho - PE.
                                            </p>
                                        </div>
                                    ) : cepComplete ? (
                                        <div className="mt-3 rounded-xl border border-yellow-200 bg-yellow-50 p-3">
                                            <p className="text-sm font-bold text-yellow-800">
                                                ⚠️ Clique em Buscar para validar o CEP.
                                            </p>
                                        </div>
                                    ) : null}
                                </div>

                                {/* RUA */}

                                <div>
                                    <label className="mb-2 block text-sm font-black">
                                        Rua *
                                    </label>

                                    <input
                                        value={
                                            street
                                        }
                                        onChange={(
                                            event
                                        ) => {
                                            setStreet(
                                                event.target
                                                    .value
                                            );

                                            addressChanged();
                                        }}
                                        placeholder="Nome da rua"
                                        className="w-full rounded-xl border border-zinc-200 px-4 py-4"
                                    />
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div>
                                        <label className="mb-2 block text-sm font-black">
                                            Número *
                                        </label>

                                        <input
                                            value={
                                                number
                                            }
                                            onChange={(
                                                event
                                            ) => {
                                                setNumber(
                                                    event.target
                                                        .value
                                                );

                                                addressChanged();
                                            }}
                                            placeholder="123"
                                            className="w-full rounded-xl border border-zinc-200 px-4 py-4"
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-sm font-black">
                                            Complemento
                                        </label>

                                        <input
                                            value={
                                                complement
                                            }
                                            onChange={(
                                                event
                                            ) =>
                                                setComplement(
                                                    event.target
                                                        .value
                                                )
                                            }
                                            placeholder="Sala, loja, referência..."
                                            className="w-full rounded-xl border border-zinc-200 px-4 py-4"
                                        />
                                    </div>
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
                                        ) => {
                                            setNeighborhood(
                                                event.target
                                                    .value
                                            );

                                            addressChanged();
                                        }}
                                        placeholder="Centro"
                                        className="w-full rounded-xl border border-zinc-200 px-4 py-4"
                                    />
                                </div>

                                <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
                                    <div>
                                        <label className="mb-2 block text-sm font-black">
                                            Cidade
                                        </label>

                                        <input
                                            value={
                                                city
                                            }
                                            readOnly
                                            className="w-full rounded-xl border border-zinc-200 bg-zinc-100 px-4 py-4 font-bold text-zinc-600"
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-sm font-black">
                                            Estado
                                        </label>

                                        <input
                                            value={
                                                state
                                            }
                                            readOnly
                                            className="w-full rounded-xl border border-zinc-200 bg-zinc-100 px-4 py-4 text-center font-bold text-zinc-600"
                                        />
                                    </div>
                                </div>

                                <div className="pt-3">
                                    <h2 className="text-xl font-black">
                                        Marque sua loja no mapa
                                    </h2>

                                    <p className="mt-1 text-sm text-zinc-500">
                                        Localize o endereço e depois
                                        ajuste o pino exatamente na
                                        entrada do estabelecimento.
                                    </p>

                                    <div className="mt-4 rounded-2xl bg-zinc-50 p-4">
                                        <p className="text-xs font-black uppercase text-zinc-400">
                                            Endereço informado
                                        </p>

                                        <p className="mt-2 font-bold">
                                            {mapAddress ||
                                                "Preencha o endereço acima."}
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={
                                            locateAddressOnMap
                                        }
                                        disabled={
                                            searchingLocation ||
                                            !cepIsConfirmed
                                        }
                                        className="mt-4 w-full rounded-xl bg-zinc-900 px-5 py-4 font-black text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
                                    >
                                        {searchingLocation
                                            ? "Localizando endereço..."
                                            : cepIsConfirmed
                                                ? "📍 Localizar endereço no mapa"
                                                : "Valide o CEP primeiro"}
                                    </button>

                                    <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                                        <p className="font-black text-blue-800">
                                            Como posicionar o pino
                                        </p>

                                        <p className="mt-2 text-sm text-blue-700">
                                            Clique no ponto exato onde
                                            fica sua loja. Se precisar,
                                            clique em outro ponto para
                                            corrigir.
                                        </p>
                                    </div>

                                    <div className="mt-4">
                                        <MapPicker
                                            latitude={
                                                latitude
                                            }
                                            longitude={
                                                longitude
                                            }
                                            onChange={(
                                                newLatitude,
                                                newLongitude
                                            ) => {
                                                setLatitude(
                                                    newLatitude
                                                );

                                                setLongitude(
                                                    newLongitude
                                                );

                                                setLocationConfirmed(
                                                    false
                                                );
                                            }}
                                        />
                                    </div>

                                    {latitude !==
                                        null &&
                                        longitude !==
                                        null && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setLocationConfirmed(
                                                    true
                                                )
                                            }
                                            className={`mt-4 w-full rounded-xl px-5 py-4 font-black ${
                                                locationConfirmed
                                                    ? "bg-green-600 text-white"
                                                    : "bg-red-600 text-white"
                                            }`}
                                        >
                                            {locationConfirmed
                                                ? "✅ Localização confirmada"
                                                : "Confirmar que o pino está na loja"}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </section>
                    )}

                    {/* ==================================================
                        ETAPA 4
                    ================================================== */}

                    {step ===
                        4 && (
                        <section className="rounded-3xl bg-white p-6 shadow-sm md:p-8">
                            <p className="text-xs font-black uppercase text-red-600">
                                ETAPA 4 DE 6
                            </p>

                            <h1 className="mt-2 text-3xl font-black">
                                Como sua loja funciona?
                            </h1>

                            <div className="mt-8 space-y-6">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setAcceptsDelivery(
                                                !acceptsDelivery
                                            )
                                        }
                                        className={`rounded-3xl border p-6 text-left ${
                                            acceptsDelivery
                                                ? "border-red-500 bg-red-50"
                                                : "border-zinc-200"
                                        }`}
                                    >
                                        <div className="text-3xl">
                                            🛵
                                        </div>

                                        <p className="mt-3 text-lg font-black">
                                            Entrega
                                        </p>

                                        <p className="mt-4 font-black text-red-600">
                                            {acceptsDelivery
                                                ? "✓ Ativado"
                                                : "Desativado"}
                                        </p>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setAcceptsPickup(
                                                !acceptsPickup
                                            )
                                        }
                                        className={`rounded-3xl border p-6 text-left ${
                                            acceptsPickup
                                                ? "border-orange-400 bg-orange-50"
                                                : "border-zinc-200"
                                        }`}
                                    >
                                        <div className="text-3xl">
                                            🏪
                                        </div>

                                        <p className="mt-3 text-lg font-black">
                                            Retirada
                                        </p>

                                        <p className="mt-4 font-black text-orange-600">
                                            {acceptsPickup
                                                ? "✓ Ativado"
                                                : "Desativado"}
                                        </p>
                                    </button>
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-black">
                                        Tempo médio de preparo *
                                    </label>

                                    <input
                                        type="number"
                                        min={
                                            5
                                        }
                                        max={
                                            180
                                        }
                                        value={
                                            preparationMinutes
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            setPreparationMinutes(
                                                event.target
                                                    .value
                                            )
                                        }
                                        className="w-full rounded-xl border border-zinc-200 px-4 py-4"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-black">
                                        Pedido mínimo
                                    </label>

                                    <input
                                        value={
                                            minimumOrder
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            setMinimumOrder(
                                                event.target
                                                    .value
                                            )
                                        }
                                        className="w-full rounded-xl border border-zinc-200 px-4 py-4"
                                    />
                                </div>
                            </div>
                        </section>
                    )}

                    {/* ==================================================
                        ETAPA 5
                    ================================================== */}

                    {step ===
                        5 && (
                        <section className="rounded-3xl bg-white p-6 shadow-sm md:p-8">
                            <p className="text-xs font-black uppercase text-red-600">
                                ETAPA 5 DE 6
                            </p>

                            <h1 className="mt-2 text-3xl font-black">
                                Acesso à sua conta
                            </h1>

                            <p className="mt-2 text-zinc-500">
                                O acesso pertence à sua conta do
                                restaurante e vale para todas as suas lojas.
                            </p>

                            <div className="mt-8 space-y-5">
                                <div>
                                    <label className="mb-2 block text-sm font-black">
                                        E-mail
                                    </label>

                                    <input
                                        value={
                                            userEmail
                                        }
                                        readOnly
                                        className="w-full rounded-xl border border-zinc-200 bg-zinc-100 px-4 py-4"
                                    />
                                </div>

                                {passwordConfigured ? (
                                    <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
                                        <p className="font-black text-green-800">
                                            ✅ Acesso já configurado
                                        </p>

                                        <p className="mt-2 text-sm leading-6 text-green-700">
                                            Sua senha já pertence a esta conta.
                                            Ao cadastrar outra loja, ela não será
                                            solicitada nem alterada.
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <div>
                                            <label className="mb-2 block text-sm font-black">
                                                Crie sua senha *
                                            </label>

                                            <input
                                                type="password"
                                                value={
                                                    password
                                                }
                                                onChange={(
                                                    event
                                                ) =>
                                                    setPassword(
                                                        event.target
                                                            .value
                                                    )
                                                }
                                                autoComplete="new-password"
                                                className="w-full rounded-xl border border-zinc-200 px-4 py-4"
                                            />

                                            <p className="mt-2 text-xs text-zinc-400">
                                                Mínimo de 8 caracteres. Você fará
                                                isso apenas uma vez por conta.
                                            </p>
                                        </div>

                                        <div>
                                            <label className="mb-2 block text-sm font-black">
                                                Confirmar senha *
                                            </label>

                                            <input
                                                type="password"
                                                value={
                                                    confirmPassword
                                                }
                                                onChange={(
                                                    event
                                                ) =>
                                                    setConfirmPassword(
                                                        event.target
                                                            .value
                                                    )
                                                }
                                                autoComplete="new-password"
                                                className="w-full rounded-xl border border-zinc-200 px-4 py-4"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </section>
                    )}

                    {/* ==================================================
                        ETAPA 6
                    ================================================== */}

                    {step ===
                        6 && (
                        <section className="rounded-3xl bg-white p-6 shadow-sm md:p-8">
                            <p className="text-xs font-black uppercase text-red-600">
                                ETAPA 6 DE 6
                            </p>

                            <h1 className="mt-2 text-3xl font-black">
                                Revise seu cadastro
                            </h1>

                            <div className="mt-8 space-y-4">
                                <ReviewCard
                                    title="👤 Responsável"
                                    onEdit={() =>
                                        setStep(
                                            1
                                        )
                                    }
                                >
                                    <p>
                                        <strong>
                                            Nome:
                                        </strong>{" "}
                                        {
                                            responsibleName
                                        }
                                    </p>

                                    <p>
                                        <strong>
                                            CPF:
                                        </strong>{" "}
                                        {
                                            responsibleCpf
                                        }
                                    </p>

                                    <p>
                                        <strong>
                                            WhatsApp:
                                        </strong>{" "}
                                        {
                                            phone
                                        }
                                    </p>
                                </ReviewCard>

                                <ReviewCard
                                    title="🧾 Dados fiscais"
                                    onEdit={() =>
                                        setStep(
                                            1
                                        )
                                    }
                                >
                                    {hasCnpj ? (
                                        <>
                                            <p className="font-bold text-green-700">
                                                ✅ Loja cadastrada com CNPJ
                                            </p>

                                            <p className="mt-2">
                                                <strong>
                                                    CNPJ:
                                                </strong>{" "}
                                                {
                                                    cnpj
                                                }
                                            </p>

                                            <p>
                                                <strong>
                                                    Razão social:
                                                </strong>{" "}
                                                {
                                                    legalName
                                                }
                                            </p>
                                        </>
                                    ) : (
                                        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                                            <p className="font-black text-yellow-800">
                                                ⏳ Cadastro temporário com CPF
                                            </p>

                                            <p className="mt-2 leading-6 text-yellow-700">
                                                Esta loja ainda não possui CNPJ.
                                                Depois que ela for aprovada e
                                                liberada, será necessário cadastrar
                                                um CNPJ dentro do prazo de 6 meses
                                                para continuar operando.
                                            </p>
                                        </div>
                                    )}
                                </ReviewCard>

                                <ReviewCard
                                    title="🏪 Loja"
                                    onEdit={() =>
                                        setStep(
                                            2
                                        )
                                    }
                                >
                                    <p>
                                        <strong>
                                            Nome:
                                        </strong>{" "}
                                        {
                                            businessName
                                        }
                                    </p>

                                    <p>
                                        <strong>
                                            Categoria:
                                        </strong>{" "}
                                        {
                                            category
                                        }
                                    </p>
                                </ReviewCard>

                                <ReviewCard
                                    title="📍 Endereço"
                                    onEdit={() =>
                                        setStep(
                                            3
                                        )
                                    }
                                >
                                    <p>
                                        CEP{" "}
                                        {
                                            postalCode
                                        }
                                    </p>

                                    <p>
                                        {
                                            street
                                        }
                                        ,{" "}
                                        {
                                            number
                                        }
                                    </p>

                                    <p>
                                        {
                                            neighborhood
                                        }
                                    </p>

                                    <p>
                                        {
                                            city
                                        }{" "}
                                        -{" "}
                                        {
                                            state
                                        }
                                    </p>

                                    <p className="mt-2 font-bold text-green-600">
                                        ✅ CEP e localização confirmados
                                    </p>
                                </ReviewCard>

                                <ReviewCard
                                    title="⚙️ Operação"
                                    onEdit={() =>
                                        setStep(
                                            4
                                        )
                                    }
                                >
                                    <p>
                                        Entrega:{" "}
                                        {acceptsDelivery
                                            ? "Sim"
                                            : "Não"}
                                    </p>

                                    <p>
                                        Retirada:{" "}
                                        {acceptsPickup
                                            ? "Sim"
                                            : "Não"}
                                    </p>

                                    <p>
                                        Preparo:{" "}
                                        {
                                            preparationMinutes
                                        }{" "}
                                        minutos
                                    </p>
                                </ReviewCard>
                            </div>

                            <div className="mt-6 rounded-2xl border border-yellow-200 bg-yellow-50 p-5">
                                <p className="font-black text-yellow-800">
                                    🔎 Cadastro sujeito à análise
                                </p>

                                <p className="mt-2 text-sm text-yellow-700">
                                    Os dados serão conferidos antes
                                    da loja ser liberada.
                                </p>
                            </div>
                        </section>
                    )}

                    {/* ERRO */}

                    {error && (
                        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">
                            ⚠️{" "}
                            {
                                error
                            }
                        </div>
                    )}

                    {/* BOTÕES */}

                    <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                        {step > 1 ? (
                            <button
                                type="button"
                                onClick={
                                    previousStep
                                }
                                className="rounded-xl border border-zinc-200 bg-white px-6 py-4 font-black transition hover:bg-zinc-50"
                            >
                                ← Etapa anterior
                            </button>
                        ) : (
                            <div />
                        )}

                        {step < 6 ? (
                            <button
                                type="button"
                                onClick={
                                    nextStep
                                }
                                className="rounded-xl bg-red-600 px-8 py-4 font-black text-white"
                            >
                                Continuar →
                            </button>
                        ) : (
                            <button
                                type="submit"
                                disabled={
                                    sending
                                }
                                className="rounded-xl bg-red-600 px-8 py-4 font-black text-white disabled:bg-zinc-300"
                            >
                                {sending
                                    ? "Enviando cadastro..."
                                    : "Enviar cadastro para análise"}
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </main>
    );
}

// ======================================================
// CARD REVISÃO
// ======================================================

function ReviewCard({
    title,
    onEdit,
    children,
}: {
    title: string;
    onEdit: () => void;
    children: ReactNode;
}) {
    return (
        <div className="rounded-2xl border border-zinc-200 p-5">
            <div className="flex justify-between gap-3">
                <h3 className="font-black">
                    {
                        title
                    }
                </h3>

                <button
                    type="button"
                    onClick={
                        onEdit
                    }
                    className="text-sm font-black text-red-600"
                >
                    Editar
                </button>
            </div>

            <div className="mt-4 space-y-1 text-sm text-zinc-600">
                {
                    children
                }
            </div>
        </div>
    );
}
export default function SejaParceiroPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <SejaParceiroContent />
    </Suspense>
  );
}