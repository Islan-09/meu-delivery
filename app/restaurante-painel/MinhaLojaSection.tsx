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
  minimum_order: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
};

const IMAGE_BUCKET = "restaurant-images";

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
  return parts.length <= 1 ? cleaned : `${parts[0]}.${parts.slice(1).join("")}`;
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
    minimum_order: "0",
    street: "",
    number: "",
    neighborhood: "",
    city: "Paudalho",
    state: "PE",
  };
}

function fileExtension(file: File) {
  const namedExtension = file.name.split(".").pop()?.trim();
  if (namedExtension && namedExtension !== file.name && /^[a-zA-Z0-9]+$/.test(namedExtension)) {
    return namedExtension.toLowerCase();
  }

  const mimeSubtype = file.type.split("/")[1]?.split(";")[0]?.trim();
  if (mimeSubtype && /^[a-zA-Z0-9]+$/.test(mimeSubtype)) {
    return mimeSubtype.toLowerCase();
  }

  return "img";
}

async function uploadRestaurantImage(
  restaurantId: string,
  file: File,
  folder: "logos" | "covers"
) {
  const extension = fileExtension(file);
  const filePath = `${restaurantId}/${folder}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
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
        setError("Loja não encontrada.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      const { data, error: loadError } = await supabase
        .from("restaurants")
        .select(`
          id, name, description, phone, logo_url, cover_url,
          estimated_delivery_minutes, minimum_order,
          street, number, neighborhood, city, state
        `)
        .eq("id", restaurantId)
        .single();

      if (cancelled) return;

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
        estimated_delivery_minutes: String(row.estimated_delivery_minutes ?? 30),
        minimum_order: String(row.minimum_order ?? 0),
        street: row.street ?? "",
        number: row.number ?? "",
        neighborhood: row.neighborhood ?? "",
        city: row.city ?? "Paudalho",
        state: row.state ?? "PE",
      });
      setLoading(false);
    }

    void loadRestaurant();
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  function updateField<K extends keyof FormData>(field: K, value: FormData[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleImageUpload(
    event: ChangeEvent<HTMLInputElement>,
    type: "logo" | "cover"
  ) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || !restaurantId) return;

    setError("");
    setSuccess("");
    if (type === "logo") setUploadingLogo(true);
    else setUploadingCover(true);

    try {
      const publicUrl = await uploadRestaurantImage(
        restaurantId,
        file,
        type === "logo" ? "logos" : "covers"
      );

      const payload = type === "logo" ? { logo_url: publicUrl } : { cover_url: publicUrl };
      const { error: updateError } = await supabase
        .from("restaurants")
        .update(payload)
        .eq("id", restaurantId);

      if (updateError) throw updateError;

      if (type === "logo") updateField("logo_url", publicUrl);
      else updateField("cover_url", publicUrl);

      setSuccess(type === "logo" ? "Logo da loja atualizada com sucesso!" : "Capa da loja atualizada com sucesso!");
    } catch (uploadError) {
      console.error("Erro ao enviar imagem:", uploadError);
      setError(
        "Não foi possível enviar a imagem. Confira as configurações de tamanho, formato e permissões do bucket restaurant-images no Supabase."
      );
    } finally {
      input.value = "";
      setUploadingLogo(false);
      setUploadingCover(false);
    }
  }

  async function handleSave() {
    if (!restaurantId) {
      setError("Loja não encontrada.");
      return;
    }

    if (!form.name.trim()) {
      setError("Informe o nome da loja.");
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
    () => [form.street, form.number, form.neighborhood, form.city, form.state].filter(Boolean).join(", "),
    [form.street, form.number, form.neighborhood, form.city, form.state]
  );

  if (loading) {
    return (
      <section className="rounded-[28px] border border-zinc-200 bg-white p-8 shadow-sm">
        <p className="font-bold text-zinc-500">Carregando dados da loja...</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-red-600">Minha loja</p>
            <h2 className="mt-1 text-3xl font-black text-zinc-900">Dados da loja</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
              Atualize as informações, as imagens e o endereço que seus clientes veem.
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

        {error && <div role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">⚠️ {error}</div>}
        {success && <div role="status" className="mt-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-700">✅ {success}</div>}

        <div className="mt-6 overflow-hidden rounded-[28px] border border-zinc-200 bg-zinc-50">
          <div className="relative h-48 w-full bg-zinc-200 md:h-56">
            {form.cover_url ? (
              <img src={form.cover_url} alt="Capa da loja" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-bold text-zinc-500">Sua capa da loja aparece aqui</div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
              <div className="flex flex-wrap items-end gap-4">
                <div className="h-24 w-24 overflow-hidden rounded-3xl border-4 border-white bg-white shadow-md">
                  {form.logo_url ? (
                    <img src={form.logo_url} alt="Logo da loja" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-3xl">🍔</div>
                  )}
                </div>
                <div className="min-w-0 flex-1 text-white">
                  <h3 className="truncate text-2xl font-black md:text-3xl">{form.name || "Nome da loja"}</h3>
                  <p className="mt-1 max-w-2xl text-sm text-white/90">{form.description || "Descrição da loja"}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
                    <span className="rounded-full bg-white/15 px-3 py-2 backdrop-blur-sm">⏱️ {form.estimated_delivery_minutes || "0"} min</span>
                    <span className="rounded-full bg-white/15 px-3 py-2 backdrop-blur-sm">🧾 Mínimo {money(form.minimum_order)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 border-t border-zinc-200 bg-white p-4 sm:grid-cols-2">
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
          </div>

          <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => handleImageUpload(event, "logo")} />
          <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => handleImageUpload(event, "cover")} />
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm md:p-7">
          <div className="mb-5">
            <p className="text-xs font-black uppercase tracking-wide text-red-600">Informações principais</p>
            <h3 className="mt-1 text-2xl font-black">Sobre a loja</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-black text-zinc-800">Nome da loja *</label>
              <input value={form.name} onChange={(event) => updateField("name", event.target.value)} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-red-400" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-black text-zinc-800">WhatsApp / telefone</label>
              <input value={form.phone} onChange={(event) => updateField("phone", formatPhone(event.target.value))} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-red-400" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-black text-zinc-800">Descrição</label>
              <textarea value={form.description} onChange={(event) => updateField("description", event.target.value)} rows={3} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-red-400" placeholder="Conte aos clientes o que sua loja oferece." />
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm md:p-7">
          <div className="mb-5">
            <p className="text-xs font-black uppercase tracking-wide text-red-600">Pedidos</p>
            <h3 className="mt-1 text-2xl font-black">Tempo estimado e pedido mínimo</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-black text-zinc-800">Tempo estimado</label>
              <div className="relative">
                <input value={form.estimated_delivery_minutes} onChange={(event) => updateField("estimated_delivery_minutes", onlyNumbers(event.target.value))} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 pr-12 outline-none transition focus:border-red-400" />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-500">min</span>
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-black text-zinc-800">Pedido mínimo</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-zinc-500">R$</span>
                <input value={form.minimum_order} onChange={(event) => updateField("minimum_order", normalizeMoneyInput(event.target.value))} className="w-full rounded-2xl border border-zinc-200 bg-white px-12 py-3 outline-none transition focus:border-red-400" />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm md:p-7">
          <div className="mb-5">
            <p className="text-xs font-black uppercase tracking-wide text-red-600">Endereço</p>
            <h3 className="mt-1 text-2xl font-black">Endereço da loja</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-black text-zinc-800">Rua *</label>
              <input value={form.street} onChange={(event) => updateField("street", event.target.value)} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-red-400" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-black text-zinc-800">Número</label>
              <input value={form.number} onChange={(event) => updateField("number", event.target.value)} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-red-400" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-black text-zinc-800">Bairro *</label>
              <input value={form.neighborhood} onChange={(event) => updateField("neighborhood", event.target.value)} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-red-400" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-black text-zinc-800">Cidade *</label>
              <input value={form.city} onChange={(event) => updateField("city", event.target.value)} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-red-400" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-black text-zinc-800">UF *</label>
              <input value={form.state} onChange={(event) => updateField("state", event.target.value.toUpperCase().slice(0, 2))} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-red-400" />
            </div>
          </div>
          <div className="mt-5 rounded-2xl bg-zinc-50 p-4">
            <p className="text-xs font-black uppercase text-zinc-400">Endereço atual</p>
            <p className="mt-2 font-bold text-zinc-800">{previewAddress || "Preencha o endereço da loja"}</p>
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

      <div className="flex justify-end rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
        <button type="button" onClick={handleSave} disabled={saving} className="rounded-2xl bg-red-600 px-6 py-3 text-sm font-black text-white transition hover:bg-red-700 disabled:opacity-60">
          {saving ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </section>
  );
}
