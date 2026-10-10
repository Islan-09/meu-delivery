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

type Address = {
  id: string;

  label: string | null;

  street: string;
  number: string | null;
  complement: string | null;

  neighborhood: string;

  city: string;
  state: string;

  zipcode: string | null;

  lat: number | null;
  long: number | null;

  is_default: boolean;

  created_at: string;
};

type AddressForm = {
  label: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zipcode: string;
  isDefault: boolean;
};

const emptyForm: AddressForm = {
  label: "Casa",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "Paudalho",
  state: "PE",
  zipcode: "",
  isDefault: false,
};

export default function MeusEnderecosPage() {
  const router = useRouter();

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [
    processingId,
    setProcessingId,
  ] = useState("");

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [addresses, setAddresses] =
    useState<Address[]>([]);

  const [formOpen, setFormOpen] =
    useState(false);

  const [editingId, setEditingId] =
    useState<string | null>(
      null
    );

  const [form, setForm] =
    useState<AddressForm>(
      emptyForm
    );

  // ==========================================
  // CARREGAR ENDEREÇOS
  // ==========================================

  const loadAddresses =
    useCallback(async () => {
      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      if (!session) {
        sessionStorage.setItem(
          "after-login",
          "/meus-enderecos"
        );

        router.replace("/login");

        return;
      }

      const {
        data,
        error: addressError,
      } = await supabase
        .from("addresses")
        .select(`
          id,
          label,
          street,
          number,
          complement,
          neighborhood,
          city,
          state,
          zipcode,
          lat,
          long,
          is_default,
          created_at
        `)
        .eq(
          "user_id",
          session.user.id
        )
        .order(
          "is_default",
          {
            ascending: false,
          }
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        );

      if (addressError) {
        console.error(
          "Erro endereços:",
          addressError
        );

        setError(
          "Não foi possível carregar seus endereços."
        );

        setLoading(false);

        return;
      }

      setAddresses(
        (data ?? []) as Address[]
      );

      setLoading(false);
    }, [router]);

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  // ==========================================
  // NOVO ENDEREÇO
  // ==========================================

  function newAddress() {
    setEditingId(null);

    setForm({
      ...emptyForm,

      isDefault:
        addresses.length === 0,
    });

    setError("");
    setSuccess("");

    setFormOpen(true);
  }

  // ==========================================
  // EDITAR ENDEREÇO
  // ==========================================

  function editAddress(
    address: Address
  ) {
    setEditingId(
      address.id
    );

    setForm({
      label:
        address.label ||
        "Casa",

      street:
        address.street || "",

      number:
        address.number || "",

      complement:
        address.complement || "",

      neighborhood:
        address.neighborhood || "",

      city:
        address.city ||
        "Paudalho",

      state:
        address.state ||
        "PE",

      zipcode:
        address.zipcode || "",

      isDefault:
        address.is_default,
    });

    setError("");
    setSuccess("");

    setFormOpen(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // ==========================================
  // FECHAR FORMULÁRIO
  // ==========================================

  function closeForm() {
    setFormOpen(false);

    setEditingId(null);

    setForm(emptyForm);
  }

  // ==========================================
  // SALVAR ENDEREÇO
  // DEPOIS ABRIR O MAPA
  // ==========================================

  async function saveAddress(
    event: FormEvent
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (
      !form.street.trim() ||
      !form.neighborhood.trim() ||
      !form.city.trim() ||
      form.state.trim().length !== 2
    ) {
      setError(
        "Preencha rua, bairro, cidade e UF corretamente."
      );

      return;
    }

    setSaving(true);

    const {
      data: savedAddressId,
      error: saveError,
    } = await supabase.rpc(
      "save_my_address",
      {
        p_address_id:
          editingId,

        p_label:
          form.label.trim(),

        p_street:
          form.street.trim(),

        p_number:
          form.number.trim(),

        p_complement:
          form.complement.trim(),

        p_neighborhood:
          form.neighborhood.trim(),

        p_city:
          form.city.trim(),

        p_state:
          form.state
            .trim()
            .toUpperCase(),

        p_zipcode:
          form.zipcode.trim(),

        p_is_default:
          form.isDefault,
      }
    );

    if (saveError) {
      console.error(
        "Erro salvar endereço:",
        saveError
      );

      setError(
        "Não foi possível salvar o endereço."
      );

      setSaving(false);

      return;
    }

    if (!savedAddressId) {
      setError(
        "O endereço foi salvo, mas não foi possível abrir o mapa."
      );

      setSaving(false);

      return;
    }

    // ======================================
    // DEPOIS DE SALVAR,
    // ABRIR O MAPA AUTOMATICAMENTE
    // ======================================

    router.push(
      `/meus-enderecos/${savedAddressId}/localizacao`
    );
  }

  // ==========================================
  // DEFINIR COMO PRINCIPAL
  // ==========================================

  async function setDefault(
    addressId: string
  ) {
    setProcessingId(
      addressId
    );

    setError("");
    setSuccess("");

    const {
      error: defaultError,
    } = await supabase.rpc(
      "set_my_default_address",
      {
        p_address_id:
          addressId,
      }
    );

    if (defaultError) {
      console.error(
        "Erro endereço principal:",
        defaultError
      );

      setError(
        "Não foi possível definir o endereço principal."
      );

      setProcessingId("");

      return;
    }

    setSuccess(
      "Endereço principal alterado!"
    );

    await loadAddresses();

    setProcessingId("");
  }

  // ==========================================
  // EXCLUIR
  // ==========================================

  async function deleteAddress(
    addressId: string
  ) {
    const confirmed =
      window.confirm(
        "Deseja excluir este endereço?"
      );

    if (!confirmed) {
      return;
    }

    setProcessingId(
      addressId
    );

    setError("");
    setSuccess("");

    const {
      error: deleteError,
    } = await supabase.rpc(
      "delete_my_address",
      {
        p_address_id:
          addressId,
      }
    );

    if (deleteError) {
      console.error(
        "Erro excluir endereço:",
        deleteError
      );

      if (
        deleteError.message.includes(
          "ADDRESS_IN_USE"
        )
      ) {
        setError(
          "Este endereço já foi usado em um pedido e precisa continuar salvo no histórico."
        );
      } else {
        setError(
          "Não foi possível excluir este endereço."
        );
      }

      setProcessingId("");

      return;
    }

    setSuccess(
      "Endereço excluído."
    );

    await loadAddresses();

    setProcessingId("");
  }

  // ==========================================
  // CARREGANDO
  // ==========================================

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7]">
        <p className="font-bold">
          Carregando seus endereços...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f7f7] text-zinc-900">
      {/* ==================================
          CABEÇALHO
      ================================== */}

      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link
            href="/"
            className="font-bold text-red-600"
          >
            ← Voltar
          </Link>

          <p className="font-black text-red-600">
            Entrega Paudalho
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* ==================================
            TÍTULO
        ================================== */}

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl">
              📍
            </div>

            <h1 className="mt-4 text-3xl font-black">
              Meus endereços
            </h1>

            <p className="mt-2 text-zinc-500">
              Cadastre seu endereço e
              marque no mapa exatamente
              onde o entregador deve chegar.
            </p>
          </div>

          {!formOpen && (
            <button
              type="button"
              onClick={newAddress}
              className="rounded-xl bg-red-600 px-5 py-3 font-black text-white"
            >
              + Novo endereço
            </button>
          )}
        </div>

        {/* ==================================
            MENSAGENS
        ================================== */}

        {error && (
          <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-6 rounded-2xl bg-green-50 p-4 text-sm font-semibold text-green-700">
            ✅ {success}
          </div>
        )}

        {/* ==================================
            FORMULÁRIO
        ================================== */}

        {formOpen && (
          <form
            onSubmit={saveAddress}
            className="mt-6 rounded-3xl bg-white p-6 shadow-sm"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">
                  {editingId
                    ? "Editar endereço"
                    : "Novo endereço"}
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Depois vamos ajustar
                  a localização no mapa.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                className="font-bold text-zinc-400"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 space-y-5">
              {/* NOME DO ENDEREÇO */}

              <div>
                <label className="mb-2 block text-sm font-bold">
                  Nome do endereço
                </label>

                <input
                  value={form.label}
                  onChange={(event) =>
                    setForm({
                      ...form,

                      label:
                        event.target.value,
                    })
                  }
                  placeholder="Casa, Trabalho..."
                  className="w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-red-500"
                />
              </div>

              {/* RUA */}

              <div>
                <label className="mb-2 block text-sm font-bold">
                  Rua *
                </label>

                <input
                  required
                  value={form.street}
                  onChange={(event) =>
                    setForm({
                      ...form,

                      street:
                        event.target.value,
                    })
                  }
                  placeholder="Nome da rua"
                  className="w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-red-500"
                />
              </div>

              {/* NÚMERO E COMPLEMENTO */}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-bold">
                    Número
                  </label>

                  <input
                    value={form.number}
                    onChange={(event) =>
                      setForm({
                        ...form,

                        number:
                          event.target.value,
                      })
                    }
                    placeholder="123"
                    className="w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold">
                    Complemento
                  </label>

                  <input
                    value={
                      form.complement
                    }
                    onChange={(event) =>
                      setForm({
                        ...form,

                        complement:
                          event.target.value,
                      })
                    }
                    placeholder="Apto, bloco..."
                    className="w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-red-500"
                  />
                </div>
              </div>

              {/* BAIRRO */}

              <div>
                <label className="mb-2 block text-sm font-bold">
                  Bairro *
                </label>

                <input
                  required
                  value={
                    form.neighborhood
                  }
                  onChange={(event) =>
                    setForm({
                      ...form,

                      neighborhood:
                        event.target.value,
                    })
                  }
                  placeholder="Ex: Centro"
                  className="w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-red-500"
                />
              </div>

              {/* CIDADE / UF */}

              <div className="grid grid-cols-[1fr_90px] gap-4">
                <div>
                  <label className="mb-2 block text-sm font-bold">
                    Cidade *
                  </label>

                  <input
                    required
                    value={form.city}
                    onChange={(event) =>
                      setForm({
                        ...form,

                        city:
                          event.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold">
                    UF *
                  </label>

                  <input
                    required
                    maxLength={2}
                    value={form.state}
                    onChange={(event) =>
                      setForm({
                        ...form,

                        state:
                          event.target.value
                            .toUpperCase()
                            .slice(
                              0,
                              2
                            ),
                      })
                    }
                    className="w-full rounded-xl border border-zinc-200 px-4 py-3 uppercase outline-none focus:border-red-500"
                  />
                </div>
              </div>

              {/* CEP */}

              <div>
                <label className="mb-2 block text-sm font-bold">
                  CEP
                </label>

                <input
                  value={form.zipcode}
                  onChange={(event) =>
                    setForm({
                      ...form,

                      zipcode:
                        event.target.value,
                    })
                  }
                  placeholder="55825-000"
                  className="w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-red-500"
                />
              </div>

              {/* PRINCIPAL */}

              <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-zinc-50 p-4">
                <input
                  type="checkbox"
                  checked={
                    form.isDefault
                  }
                  onChange={(event) =>
                    setForm({
                      ...form,

                      isDefault:
                        event.target.checked,
                    })
                  }
                  className="h-5 w-5 accent-red-600"
                />

                <div>
                  <p className="font-bold">
                    Endereço principal
                  </p>

                  <p className="text-sm text-zinc-500">
                    Usar como primeira
                    opção nos pedidos.
                  </p>
                </div>
              </label>
            </div>

            {/* BOTÕES */}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-red-600 px-5 py-4 font-black text-white disabled:bg-zinc-300"
              >
                {saving
                  ? "Salvando..."
                  : "Salvar e ajustar localização →"}
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={closeForm}
                className="rounded-xl border border-zinc-200 px-5 py-4 font-black"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {/* ==================================
            SEM ENDEREÇOS
        ================================== */}

        {!formOpen &&
          addresses.length === 0 && (
            <section className="mt-8 rounded-3xl bg-white p-10 text-center shadow-sm">
              <div className="text-6xl">
                🏠
              </div>

              <h2 className="mt-4 text-2xl font-black">
                Nenhum endereço cadastrado
              </h2>

              <p className="mt-2 text-zinc-500">
                Cadastre seu endereço e
                marque sua casa no mapa.
              </p>

              <button
                type="button"
                onClick={newAddress}
                className="mt-6 rounded-xl bg-red-600 px-6 py-4 font-black text-white"
              >
                + Cadastrar endereço
              </button>
            </section>
          )}

        {/* ==================================
            LISTA DE ENDEREÇOS
        ================================== */}

        <div className="mt-8 space-y-4">
          {addresses.map(
            (address) => {
              const hasLocation =
                address.lat !== null &&
                address.long !== null;

              return (
                <article
                  key={address.id}
                  className={`rounded-3xl bg-white p-6 shadow-sm ${
                    address.is_default
                      ? "ring-2 ring-red-500"
                      : ""
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-50 text-2xl">
                        {address.label
                          ?.toLowerCase()
                          .includes(
                            "trabalho"
                          )
                          ? "💼"
                          : "🏠"}
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-black">
                            {address.label ||
                              "Endereço"}
                          </h2>

                          {address.is_default && (
                            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-600">
                              Principal
                            </span>
                          )}
                        </div>

                        <p className="mt-2 text-zinc-700">
                          {address.street}

                          {address.number
                            ? `, ${address.number}`
                            : ""}
                        </p>

                        {address.complement && (
                          <p className="text-sm text-zinc-500">
                            {
                              address.complement
                            }
                          </p>
                        )}

                        <p className="text-sm text-zinc-500">
                          {
                            address.neighborhood
                          }
                          {" • "}
                          {address.city}
                          {" - "}
                          {address.state}
                        </p>

                        {address.zipcode && (
                          <p className="mt-1 text-xs text-zinc-400">
                            CEP{" "}
                            {
                              address.zipcode
                            }
                          </p>
                        )}

                        {/* LOCALIZAÇÃO */}

                        {hasLocation ? (
                          <p className="mt-3 text-sm font-bold text-green-600">
                            ✅ Localização
                            ajustada no mapa
                          </p>
                        ) : (
                          <p className="mt-3 text-sm font-bold text-orange-600">
                            ⚠️ Localização
                            ainda não ajustada
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* BOTÕES */}

                  <div className="mt-5 flex flex-wrap gap-2 border-t border-zinc-100 pt-5">
                    {/* MAPA */}

                    <Link
                      href={`/meus-enderecos/${address.id}/localizacao`}
                      className={`rounded-xl px-4 py-2.5 text-sm font-bold ${
                        hasLocation
                          ? "bg-green-50 text-green-700 hover:bg-green-100"
                          : "bg-red-600 text-white hover:bg-red-700"
                      }`}
                    >
                      {hasLocation
                        ? "📍 Ajustar localização"
                        : "📍 Marcar no mapa"}
                    </Link>

                    {!address.is_default && (
                      <button
                        type="button"
                        disabled={
                          processingId ===
                          address.id
                        }
                        onClick={() =>
                          setDefault(
                            address.id
                          )
                        }
                        className="rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-bold hover:bg-zinc-200"
                      >
                        📌 Tornar principal
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={
                        processingId ===
                        address.id
                      }
                      onClick={() =>
                        editAddress(
                          address
                        )
                      }
                      className="rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-bold hover:bg-zinc-200"
                    >
                      ✏️ Editar
                    </button>

                    <button
                      type="button"
                      disabled={
                        processingId ===
                        address.id
                      }
                      onClick={() =>
                        deleteAddress(
                          address.id
                        )
                      }
                      className="rounded-xl px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50"
                    >
                      🗑️ Excluir
                    </button>
                  </div>
                </article>
              );
            }
          )}
        </div>
      </div>
    </main>
  );
}