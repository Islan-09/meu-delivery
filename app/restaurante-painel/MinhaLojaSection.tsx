"use client";

import {
  ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useSearchParams } from "next/navigation";

import { supabase } from "@/lib/supabase";
import MapaLojaSection from "./MapaLojaSection";

type RestaurantRow = {
  id: string;
  name: string | null;
  description: string | null;
  phone: string | null;
  logo_url: string | null;
  cover_url: string | null;
  estimated_delivery_minutes: number | null;
  delivery_base_fee: number | string | null;
  minimum_order: number | string | null;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
};

type FormData = {
  name: string;
  description: string;
  phone: string;
  logo_url: string;
  cover_url: string;
  estimated_delivery_minutes: string;
  delivery_base_fee: string;
  minimum_order: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
};

const IMAGE_BUCKET_CANDIDATES = [
  "restaurant-images",
  "restaurant-assets",
  "restaurants",
  "store-images",
  "store-assets",
];

function onlyNumbers(value: string) {
  return value.replace(/\D/g, "");
}

function formatPhone(value: string) {
  const numbers = onlyNumbers(value).slice(0, 11);

  if (numbers.length <= 10) {
    return numbers
      .replace(/^(\d{0,2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2")
      .replace(/(\d{4})-(\d{4}).*/, "$1-$2");
  }

  return numbers
    .replace(/^(\d{0,2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2")
    .replace(/(\d{5})-(\d{4}).*/, "$1-$2");
}

function normalizeMoneyInput(value: string) {
  const cleaned = value.replace(/,/g, ".").replace(/[^\d.]/g, "");

  const parts = cleaned.split(".");
  if (parts.length <= 1) {
    return cleaned;
  }

  return `${parts[0]}.${parts.slice(1).join("")}`;
}

function money(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(numeric) ? numeric : 0);
}

function emptyForm(): FormData {
  return {
    name: "",
    description: "",
    phone: "",
    logo_url: "",
    cover_url: "",
    estimated_delivery_minutes: "30",
    delivery_base_fee: "0",
    minimum_order: "0",
    street: "",
    number: "",
    neighborhood: "",
    city: "Paudalho",
    state: "PE",
  };
}

async function uploadRestaurantImage(
  restaurantId: string,
  file: File,
  folder: "logos" | "covers"
) {
  const extension =
    file.name.split(".").pop()?.toLowerCase() || "jpg";

  const filePath = `${restaurantId}/${folder}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${extension}`;

  let lastError: unknown = null;

  for (const bucket of IMAGE_BUCKET_CANDIDATES) {
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type,
      });

    if (!uploadError) {
      const { data } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      return data.publicUrl;
    }

    lastError = uploadError;
  }

  throw lastError;
}

export default function MinhaLojaSection() {
  const searchParams = useSearchParams();
  const restaurantId = searchParams.get("restaurant") ?? "";

  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState<FormData>(emptyForm());

  useEffect(() => {
    let cancelled = false;

    async function loadRestaurant() {
      if (!restaurantId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      const { data, error: loadError } = await supabase
        .from("restaurants")
        .select(
          `
          id,
          name,
          description,
          phone,
          logo_url,
          cover_url,
          estimated_delivery_minutes,
          delivery_base_fee,
          minimum_order,
          street,
          number,
          neighborhood,
          city,
          state
        `
        )
        .eq("id", restaurantId)
        .single();

      if (cancelled) {
        return;
      }

      const row = data as RestaurantRow | null;

      if (loadError || !row) {
        console.error("Erro ao carregar loja:", loadError);
        setError("Não foi possível carregar os dados da loja.");
        setLoading(false);
        return;
      }

      setForm({
        name: row.name ?? "",
        description: row.description ?? "",
        phone: row.phone ?? "",
        logo_url: row.logo_url ?? "",
        cover_url: row.cover_url ?? "",
        estimated_delivery_minutes: String(
          row.estimated_delivery_minutes ?? 30
        ),
        delivery_base_fee: String(row.delivery_base_fee ?? 0),
        minimum_order: String(row.minimum_order ?? 0),
        street: row.street ?? "",
        number: row.number ?? "",
        neighborhood: row.neighborhood ?? "",
        city: row.city ?? "Paudalho",
        state: row.state ?? "PE",
      });

      setLoading(false);
    }

    loadRestaurant();

    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  function updateField<K extends keyof FormData>(
    field: K,
    value: FormData[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleImageUpload(
    event: ChangeEvent<HTMLInputElement>,
    type: "logo" | "cover"
  ) {
    const file = event.target.files?.[0];

    if (!file || !restaurantId) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      if (type === "logo") {
        setUploadingLogo(true);
      } else {
        setUploadingCover(true);
      }

      const publicUrl = await uploadRestaurantImage(
        restaurantId,
        file,
        type === "logo" ? "logos" : "covers"
      );

      const payload =
        type === "logo"
          ? { logo_url: publicUrl }
          : { cover_url: publicUrl };

      const { error: updateError } = await supabase
        .from("restaurants")
        .update(payload)
        .eq("id", restaurantId);

      if (updateError) {
        throw updateError;
      }

      if (type === "logo") {
        updateField("logo_url", publicUrl);
      } else {
        updateField("cover_url", publicUrl);
      }

      setSuccess(
        type === "logo"
          ? "Logo da loja atualizado com sucesso!"
          : "Capa da loja atualizada com sucesso!"
      );
    } catch (uploadError) {
      console.error("Erro ao enviar imagem:", uploadError);
      setError(
        "Não foi possível enviar a imagem. Se quiser, me manda o erro do console que eu ajusto o bucket certinho."
      );
    } finally {
      if (event.target) {
        event.target.value = "";
      }

      setUploadingLogo(false);
      setUploadingCover(false);
    }
  }

  async function handleSave() {
    if (!restaurantId) {
      setError("Loja não encontrada.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      phone: form.phone.trim() || null,
      estimated_delivery_minutes: Number(form.estimated_delivery_minutes || 0),
      delivery_base_fee: Number(normalizeMoneyInput(form.delivery_base_fee) || 0),
      minimum_order: Number(normalizeMoneyInput(form.minimum_order) || 0),
      street: form.street.trim(),
      number: form.number.trim(),
      neighborhood: form.neighborhood.trim(),
      city: form.city.trim(),
      state: form.state.trim().toUpperCase(),
    };

    const { error: updateError } = await supabase
      .from("restaurants")
      .update(payload)
      .eq("id", restaurantId);

    if (updateError) {
      console.error("Erro ao salvar loja:", updateError);
      setError("Não foi possível salvar as alterações da loja.");
      setSaving(false);
      return;
    }

    setSuccess("Dados da loja atualizados com sucesso!");
    setSaving(false);
  }

  const previewAddress = useMemo(
    () =>
      [
        form.street,
        form.number,
        form.neighborhood,
        form.city,
        form.state,
      ]
        .filter(Boolean)
        .join(", "),
    [
      form.street,
      form.number,
      form.neighborhood,
      form.city,
      form.state,
    ]
  );

  if (loading) {
    return (
      <section className="rounded-[28px] border border-zinc-200 bg-white p-8 shadow-sm">
        <p className="font-bold text-zinc-500">
          Carregando dados da loja...
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-red-600">
              Minha loja
            </p>
            <h2 className="mt-1 text-3xl font-black text-zinc-900">
              Configurações da loja
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
              Uma tela mais limpa para editar o básico da loja sem ficar pesada.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>

        {error && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-700">
            ✅ {success}
          </div>
        )}

        <div className="mt-6 overflow-hidden rounded-[28px] border border-zinc-200 bg-zinc-50">
          <div className="relative h-48 w-full bg-zinc-200 md:h-56">
            {form.cover_url ? (
              <img
                src={form.cover_url}
                alt="Capa da loja"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-bold text-zinc-500">
                Sua capa da loja aparece aqui
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

            <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
              <div className="flex flex-wrap items-end gap-4">
                <div className="h-24 w-24 overflow-hidden rounded-3xl border-4 border-white bg-white shadow-md">
                  {form.logo_url ? (
                    <img
                      src={form.logo_url}
                      alt="Logo da loja"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-3xl">
                      🍔
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 text-white">
                  <h3 className="truncate text-2xl font-black md:text-3xl">
                    {form.name || "Nome da loja"}
                  </h3>

                  <p className="mt-1 max-w-2xl text-sm text-white/90">
                    {form.description ||
                      "Adicione uma descrição curta para a loja aparecer mais bonita para o cliente."}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
                    <span className="rounded-full bg-white/15 px-3 py-2 backdrop-blur-sm">
                      ⏱️ {form.estimated_delivery_minutes || "0"} min
                    </span>
                    <span className="rounded-full bg-white/15 px-3 py-2 backdrop-blur-sm">
                      🛵 {money(form.delivery_base_fee)}
                    </span>
                    <span className="rounded-full bg-white/15 px-3 py-2 backdrop-blur-sm">
                      🧾 Mínimo {money(form.minimum_order)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 border-t border-zinc-200 bg-white p-4 md:grid-cols-3">
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              disabled={uploadingLogo}
              className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-black text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-60"
            >
              {uploadingLogo ? "Enviando logo..." : "Trocar logo"}
            </button>

            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              disabled={uploadingCover}
              className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-black text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-60"
            >
              {uploadingCover ? "Enviando capa..." : "Trocar capa"}
            </button>

            <div className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
              JPG, PNG ou WEBP. Prefira logo quadrado e capa horizontal.
            </div>
          </div>

          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => handleImageUpload(event, "logo")}
          />

          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => handleImageUpload(event, "cover")}
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm md:p-7">
            <div className="mb-5">
              <p className="text-xs font-black uppercase tracking-wide text-red-600">
                Dados da loja
              </p>
              <h3 className="mt-1 text-2xl font-black">Informações principais</h3>
            </div>

            <div className="grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-black text-zinc-800">
                  Nome da loja *
                </label>
                <input
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-red-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-black text-zinc-800">
                  Descrição
                </label>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    updateField("description", event.target.value)
                  }
                  rows={4}
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-red-400"
                  placeholder="Ex: Hambúrgueres artesanais, porções e bebidas."
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-black text-zinc-800">
                  WhatsApp / telefone
                </label>
                <input
                  value={form.phone}
                  onChange={(event) =>
                    updateField("phone", formatPhone(event.target.value))
                  }
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-red-400"
                />
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm md:p-7">
            <div className="mb-5">
              <p className="text-xs font-black uppercase tracking-wide text-red-600">
                Pedidos e entrega
              </p>
              <h3 className="mt-1 text-2xl font-black">Valores e tempo</h3>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-black text-zinc-800">
                  Tempo estimado
                </label>
                <div className="relative">
                  <input
                    value={form.estimated_delivery_minutes}
                    onChange={(event) =>
                      updateField(
                        "estimated_delivery_minutes",
                        onlyNumbers(event.target.value)
                      )
                    }
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 pr-12 outline-none transition focus:border-red-400"
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-500">
                    min
                  </span>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-black text-zinc-800">
                  Taxa de entrega
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-zinc-500">
                    R$
                  </span>
                  <input
                    value={form.delivery_base_fee}
                    onChange={(event) =>
                      updateField(
                        "delivery_base_fee",
                        normalizeMoneyInput(event.target.value)
                      )
                    }
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-12 py-3 outline-none transition focus:border-red-400"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-black text-zinc-800">
                  Pedido mínimo
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-zinc-500">
                    R$
                  </span>
                  <input
                    value={form.minimum_order}
                    onChange={(event) =>
                      updateField(
                        "minimum_order",
                        normalizeMoneyInput(event.target.value)
                      )
                    }
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-12 py-3 outline-none transition focus:border-red-400"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm md:p-7">
            <div className="mb-5">
              <p className="text-xs font-black uppercase tracking-wide text-red-600">
                Endereço
              </p>
              <h3 className="mt-1 text-2xl font-black">Endereço da loja</h3>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-black text-zinc-800">
                  Rua *
                </label>
                <input
                  value={form.street}
                  onChange={(event) => updateField("street", event.target.value)}
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-red-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-black text-zinc-800">
                  Número
                </label>
                <input
                  value={form.number}
                  onChange={(event) => updateField("number", event.target.value)}
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-red-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-black text-zinc-800">
                  Bairro *
                </label>
                <input
                  value={form.neighborhood}
                  onChange={(event) =>
                    updateField("neighborhood", event.target.value)
                  }
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-red-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-black text-zinc-800">
                  Cidade *
                </label>
                <input
                  value={form.city}
                  onChange={(event) => updateField("city", event.target.value)}
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-red-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-black text-zinc-800">
                  UF *
                </label>
                <input
                  value={form.state}
                  onChange={(event) =>
                    updateField("state", event.target.value.toUpperCase().slice(0, 2))
                  }
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-red-400"
                />
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-zinc-50 p-4">
              <p className="text-xs font-black uppercase text-zinc-400">
                Endereço atual
              </p>
              <p className="mt-2 font-bold text-zinc-800">
                {previewAddress || "Preencha o endereço da loja"}
              </p>
            </div>
          </div>

          <MapaLojaSection
            street={form.street}
            number={form.number}
            neighborhood={form.neighborhood}
            city={form.city}
            state={form.state}
          />
        </div>

        <div className="space-y-6">
          <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-red-600">
              Resumo rápido
            </p>
            <h3 className="mt-1 text-2xl font-black">Como o cliente vai ver</h3>

            <div className="mt-5 space-y-3">
              <div className="rounded-2xl bg-zinc-50 p-4">
                <p className="text-xs font-black uppercase text-zinc-400">Loja</p>
                <p className="mt-1 font-bold text-zinc-900">{form.name || "Nome da loja"}</p>
              </div>

              <div className="rounded-2xl bg-zinc-50 p-4">
                <p className="text-xs font-black uppercase text-zinc-400">Telefone</p>
                <p className="mt-1 font-bold text-zinc-900">{form.phone || "Não informado"}</p>
              </div>

              <div className="rounded-2xl bg-zinc-50 p-4">
                <p className="text-xs font-black uppercase text-zinc-400">Entrega</p>
                <p className="mt-1 font-bold text-zinc-900">
                  {form.estimated_delivery_minutes || "0"} min • {money(form.delivery_base_fee)}
                </p>
              </div>

              <div className="rounded-2xl bg-zinc-50 p-4">
                <p className="text-xs font-black uppercase text-zinc-400">Pedido mínimo</p>
                <p className="mt-1 font-bold text-zinc-900">{money(form.minimum_order)}</p>
              </div>

              <div className="rounded-2xl bg-zinc-50 p-4">
                <p className="text-xs font-black uppercase text-zinc-400">Endereço</p>
                <p className="mt-1 font-bold text-zinc-900">
                  {previewAddress || "Não informado"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-red-600">
              Dica
            </p>
            <h3 className="mt-1 text-2xl font-black">Deixar bonito sem complicar</h3>

            <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-600">
              <li>• Use uma descrição curta e direta.</li>
              <li>• Coloque um logo quadrado bem legível.</li>
              <li>• Use uma capa horizontal com boa qualidade.</li>
              <li>• Confirme o pino exato da loja no mapa.</li>
              <li>• Deixe telefone e valores sempre atualizados.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-2xl bg-red-600 px-6 py-3 text-sm font-black text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </div>
    </section>
  );
}
