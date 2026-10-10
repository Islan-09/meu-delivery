"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useSearchParams } from "next/navigation";

import { supabase } from "@/lib/supabase";

type DiscountType = "percent" | "fixed";

type Coupon = {
  id: string;
  restaurant_id: string;
  code: string;
  description: string | null;
  discount_type: DiscountType;
  discount_value: number | string;
  minimum_order: number | string;
  starts_at: string | null;
  expires_at: string | null;
  max_uses: number | null;
  one_use_per_customer: boolean;
  first_order_only: boolean;
  current_uses: number | string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type CouponForm = {
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: string;
  minimumOrder: string;
  startsAt: string;
  expiresAt: string;
  maxUses: string;
  oneUsePerCustomer: boolean;
  firstOrderOnly: boolean;
  active: boolean;
};

const EMPTY_FORM: CouponForm = {
  code: "",
  description: "",
  discountType: "percent",
  discountValue: "",
  minimumOrder: "0",
  startsAt: "",
  expiresAt: "",
  maxUses: "",
  oneUsePerCustomer: false,
  firstOrderOnly: false,
  active: true,
};

function money(value: number | string | null | undefined) {
  const number = Number(value ?? 0);

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(number) ? number : 0);
}

function dateTime(value: string | null) {
  if (!value) {
    return "Sem limite";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function toDateTimeLocal(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);

  return local.toISOString().slice(0, 16);
}

function toIsoOrNull(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function parseDecimal(value: string) {
  const normalized = value
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : NaN;
}

function couponStatus(coupon: Coupon) {
  const now = Date.now();
  const uses = Number(coupon.current_uses ?? 0);
  const maxUses = coupon.max_uses;
  const startsAt = coupon.starts_at
    ? new Date(coupon.starts_at).getTime()
    : null;
  const expiresAt = coupon.expires_at
    ? new Date(coupon.expires_at).getTime()
    : null;

  if (!coupon.active) {
    return {
      label: "Inativo",
      className: "bg-zinc-100 text-zinc-600",
    };
  }

  if (expiresAt !== null && expiresAt <= now) {
    return {
      label: "Expirado",
      className: "bg-red-50 text-red-600",
    };
  }

  if (maxUses !== null && uses >= maxUses) {
    return {
      label: "Limite atingido",
      className: "bg-orange-50 text-orange-600",
    };
  }

  if (startsAt !== null && startsAt > now) {
    return {
      label: "Agendado",
      className: "bg-blue-50 text-blue-600",
    };
  }

  return {
    label: "Ativo",
    className: "bg-green-50 text-green-700",
  };
}

function friendlyError(message: string) {
  if (message.includes("COUPON_CODE_ALREADY_EXISTS")) {
    return "Já existe um cupom com esse código nesta loja.";
  }

  if (message.includes("COUPON_CODE_REQUIRED")) {
    return "Informe o código do cupom.";
  }

  if (message.includes("COUPON_CODE_INVALID_LENGTH")) {
    return "O código precisa ter entre 3 e 30 caracteres.";
  }

  if (message.includes("COUPON_CODE_INVALID_CHARACTERS")) {
    return "Use somente letras, números, _ ou - no código.";
  }

  if (
    message.includes("INVALID_DISCOUNT_VALUE") ||
    message.includes("INVALID_PERCENT_DISCOUNT")
  ) {
    return "Informe um desconto válido.";
  }

  if (message.includes("INVALID_MINIMUM_ORDER")) {
    return "O pedido mínimo não pode ser negativo.";
  }

  if (message.includes("INVALID_MAX_USES")) {
    return "O limite de usos precisa ser maior que zero.";
  }

  if (message.includes("INVALID_COUPON_DATES")) {
    return "A data final precisa ser depois da data inicial.";
  }

  if (message.includes("MAX_USES_BELOW_CURRENT_USAGE")) {
    return "O limite de usos não pode ser menor que a quantidade já utilizada.";
  }

  if (message.includes("COUPON_HAS_USES")) {
    return "Esse cupom já foi utilizado. Desative em vez de apagar.";
  }

  if (message.includes("COUPON_NOT_FOUND")) {
    return "Cupom não encontrado.";
  }

  if (message.includes("RESTAURANT_NOT_OWNED")) {
    return "Essa loja não pertence à conta logada.";
  }

  return "Não foi possível concluir a operação.";
}

export default function CuponsSection() {
  const searchParams = useSearchParams();

  const restaurantId =
    searchParams.get("restaurant") ?? "";

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState<CouponForm>(EMPTY_FORM);

  const loadCoupons = useCallback(async () => {
    if (!restaurantId) {
      setCoupons([]);
      setLoading(false);
      return;
    }

    const { data, error: rpcError } = await supabase.rpc(
      "get_my_restaurant_coupons",
      {
        p_restaurant_id: restaurantId,
      }
    );

    if (rpcError) {
      console.error("Erro ao carregar cupons:", rpcError);
      setError("Não foi possível carregar os cupons desta loja.");
      setLoading(false);
      return;
    }

    setCoupons((data ?? []) as Coupon[]);
    setError("");
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    loadCoupons();
  }, [loadCoupons]);

  const filteredCoupons = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return coupons;
    }

    return coupons.filter((coupon) => {
      return (
        coupon.code.toLowerCase().includes(term) ||
        (coupon.description ?? "").toLowerCase().includes(term)
      );
    });
  }, [coupons, search]);

  const activeCount = useMemo(
    () =>
      coupons.filter(
        (coupon) => couponStatus(coupon).label === "Ativo"
      ).length,
    [coupons]
  );

  const totalUses = useMemo(
    () =>
      coupons.reduce(
        (sum, coupon) => sum + Number(coupon.current_uses ?? 0),
        0
      ),
    [coupons]
  );

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId("");
    setShowForm(false);
  }

  function startCreate() {
    setError("");
    setSuccess("");
    setEditingId("");
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function startEdit(coupon: Coupon) {
    setError("");
    setSuccess("");
    setEditingId(coupon.id);
    setForm({
      code: coupon.code,
      description: coupon.description ?? "",
      discountType: coupon.discount_type,
      discountValue: String(coupon.discount_value).replace(".", ","),
      minimumOrder: String(coupon.minimum_order ?? 0).replace(".", ","),
      startsAt: toDateTimeLocal(coupon.starts_at),
      expiresAt: toDateTimeLocal(coupon.expires_at),
      maxUses: coupon.max_uses === null ? "" : String(coupon.max_uses),
      oneUsePerCustomer: Boolean(coupon.one_use_per_customer),
      firstOrderOnly: Boolean(coupon.first_order_only),
      active: coupon.active,
    });
    setShowForm(true);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveCoupon() {
    setError("");
    setSuccess("");

    if (!restaurantId) {
      setError("Loja não informada.");
      return;
    }

    const code = form.code.trim().toUpperCase();
    const discountValue = parseDecimal(form.discountValue);
    const minimumOrder = parseDecimal(form.minimumOrder || "0");
    const maxUses = form.maxUses.trim()
      ? Number(form.maxUses)
      : null;

    if (code.length < 3) {
      setError("Informe um código com pelo menos 3 caracteres.");
      return;
    }

    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      setError("Informe o valor do desconto.");
      return;
    }

    if (form.discountType === "percent" && discountValue > 100) {
      setError("O desconto percentual não pode passar de 100%. ");
      return;
    }

    if (!Number.isFinite(minimumOrder) || minimumOrder < 0) {
      setError("Informe um pedido mínimo válido.");
      return;
    }

    if (
      maxUses !== null &&
      (!Number.isInteger(maxUses) || maxUses < 1)
    ) {
      setError("O limite de usos precisa ser um número inteiro maior que zero.");
      return;
    }

    const startsAt = toIsoOrNull(form.startsAt);
    const expiresAt = toIsoOrNull(form.expiresAt);

    if (
      startsAt &&
      expiresAt &&
      new Date(expiresAt).getTime() <= new Date(startsAt).getTime()
    ) {
      setError("A data final precisa ser depois da data inicial.");
      return;
    }

    setSaving(true);

    const args = {
      p_code: code,
      p_description: form.description.trim() || null,
      p_discount_type: form.discountType,
      p_discount_value: discountValue,
      p_minimum_order: minimumOrder,
      p_starts_at: startsAt,
      p_expires_at: expiresAt,
      p_max_uses: maxUses,
      p_one_use_per_customer: form.oneUsePerCustomer,
      p_first_order_only: form.firstOrderOnly,
      p_active: form.active,
    };

    const response = editingId
      ? await supabase.rpc("update_my_restaurant_coupon", {
          p_coupon_id: editingId,
          ...args,
        })
      : await supabase.rpc("create_my_restaurant_coupon", {
          p_restaurant_id: restaurantId,
          ...args,
        });

    if (response.error) {
      console.error("Erro ao salvar cupom:", response.error);
      setError(friendlyError(response.error.message));
      setSaving(false);
      return;
    }

    setSuccess(
      editingId
        ? "Cupom atualizado com sucesso."
        : "Cupom criado com sucesso."
    );

    setSaving(false);
    resetForm();
    await loadCoupons();
  }

  async function toggleCoupon(coupon: Coupon) {
    setError("");
    setSuccess("");
    setProcessingId(coupon.id);

    const nextActive = !coupon.active;

    const { error: rpcError } = await supabase.rpc(
      "set_my_restaurant_coupon_active",
      {
        p_coupon_id: coupon.id,
        p_active: nextActive,
      }
    );

    if (rpcError) {
      console.error("Erro ao alterar cupom:", rpcError);
      setError(friendlyError(rpcError.message));
      setProcessingId("");
      return;
    }

    setSuccess(
      nextActive ? "Cupom ativado." : "Cupom desativado."
    );
    setProcessingId("");
    await loadCoupons();
  }

  async function deleteCoupon(coupon: Coupon) {
    const uses = Number(coupon.current_uses ?? 0);

    if (uses > 0) {
      setError("Esse cupom já foi utilizado. Desative em vez de apagar.");
      return;
    }

    const confirmed = window.confirm(
      `Apagar o cupom ${coupon.code}?`
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");
    setProcessingId(coupon.id);

    const { error: rpcError } = await supabase.rpc(
      "delete_my_restaurant_coupon",
      {
        p_coupon_id: coupon.id,
      }
    );

    if (rpcError) {
      console.error("Erro ao apagar cupom:", rpcError);
      setError(friendlyError(rpcError.message));
      setProcessingId("");
      return;
    }

    setSuccess("Cupom apagado.");
    setProcessingId("");
    await loadCoupons();
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setSuccess(`Código ${code} copiado.`);
    } catch {
      setError("Não foi possível copiar o código.");
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-8 shadow-sm">
        <p className="font-bold">Carregando cupons...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase text-red-600">
            Promoções
          </p>

          <h2 className="mt-1 text-3xl font-black">Cupons</h2>

          <p className="mt-1 text-sm text-zinc-500">
            Crie códigos de desconto exclusivos para esta loja.
          </p>
        </div>

        <button
          type="button"
          onClick={startCreate}
          className="rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white transition hover:bg-red-700"
        >
          + Novo cupom
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-700">
          ✅ {success}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase text-zinc-400">
            Cupons cadastrados
          </p>
          <p className="mt-2 text-2xl font-black">{coupons.length}</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase text-zinc-400">
            Ativos agora
          </p>
          <p className="mt-2 text-2xl font-black text-green-600">
            {activeCount}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase text-zinc-400">
            Usos registrados
          </p>
          <p className="mt-2 text-2xl font-black">{totalUses}</p>
        </div>
      </div>

      {showForm && (
        <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase text-red-600">
                {editingId ? "Editar cupom" : "Novo cupom"}
              </p>
              <h3 className="mt-1 text-xl font-black">
                {editingId ? "Alterar promoção" : "Criar promoção"}
              </h3>
            </div>

            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-black hover:bg-zinc-50"
            >
              Fechar
            </button>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="text-sm font-black">Código *</span>
              <input
                value={form.code}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    code: event.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9_-]/g, "")
                      .slice(0, 30),
                  }))
                }
                placeholder="Código do cupom"
                className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 font-bold uppercase outline-none transition focus:border-red-400"
              />
            </label>

            <label className="block">
              <span className="text-sm font-black">Descrição</span>
              <input
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value.slice(0, 120),
                  }))
                }
                placeholder="Descrição opcional"
                className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition focus:border-red-400"
              />
            </label>

            <label className="block">
              <span className="text-sm font-black">Tipo de desconto *</span>
              <select
                value={form.discountType}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    discountType: event.target.value as DiscountType,
                  }))
                }
                className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 font-bold outline-none transition focus:border-red-400"
              >
                <option value="percent">Porcentagem (%)</option>
                <option value="fixed">Valor fixo (R$)</option>
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-black">
                {form.discountType === "percent"
                  ? "Desconto (%) *"
                  : "Desconto (R$) *"}
              </span>
              <input
                inputMode="decimal"
                value={form.discountValue}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    discountValue: event.target.value,
                  }))
                }
                placeholder={form.discountType === "percent" ? "10" : "5,00"}
                className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 font-bold outline-none transition focus:border-red-400"
              />
            </label>

            <label className="block">
              <span className="text-sm font-black">Pedido mínimo</span>
              <div className="mt-2 flex overflow-hidden rounded-xl border border-zinc-200 focus-within:border-red-400">
                <span className="flex items-center bg-zinc-50 px-4 text-sm font-black text-zinc-500">
                  R$
                </span>
                <input
                  inputMode="decimal"
                  value={form.minimumOrder}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      minimumOrder: event.target.value,
                    }))
                  }
                  placeholder="0,00"
                  className="min-w-0 flex-1 px-4 py-3 font-bold outline-none"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-sm font-black">Limite de usos</span>
              <input
                type="number"
                min="1"
                step="1"
                value={form.maxUses}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    maxUses: event.target.value,
                  }))
                }
                placeholder="Sem limite"
                className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 font-bold outline-none transition focus:border-red-400"
              />
            </label>

            <label className="block">
              <span className="text-sm font-black">Começa em</span>
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    startsAt: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition focus:border-red-400"
              />
              <span className="mt-1 block text-xs text-zinc-400">
                Deixe vazio para começar imediatamente.
              </span>
            </label>

            <label className="block">
              <span className="text-sm font-black">Termina em</span>
              <input
                type="datetime-local"
                value={form.expiresAt}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    expiresAt: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition focus:border-red-400"
              />
              <span className="mt-1 block text-xs text-zinc-400">
                Deixe vazio para não definir uma data final.
              </span>
            </label>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <input
                type="checkbox"
                checked={form.oneUsePerCustomer}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    oneUsePerCustomer: event.target.checked,
                  }))
                }
                className="mt-0.5 h-5 w-5 accent-red-600"
              />

              <span>
                <span className="block text-sm font-black">
                  👤 Limitar a 1 uso por cliente
                </span>

                <span className="mt-1 block text-xs leading-5 text-zinc-500">
                  A mesma conta não poderá usar este cupom novamente.
                </span>
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <input
                type="checkbox"
                checked={form.firstOrderOnly}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    firstOrderOnly: event.target.checked,
                  }))
                }
                className="mt-0.5 h-5 w-5 accent-red-600"
              />

              <span>
                <span className="block text-sm font-black">
                  🆕 Somente primeira compra
                </span>

                <span className="mt-1 block text-xs leading-5 text-zinc-500">
                  Só funciona se o cliente ainda não tiver nenhuma compra paga nesta loja.
                </span>
              </span>
            </label>
          </div>

          <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-2xl bg-zinc-50 p-4">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  active: event.target.checked,
                }))
              }
              className="h-5 w-5 accent-red-600"
            />
            <span>
              <span className="block text-sm font-black">
                Cupom ativo
              </span>
              <span className="block text-xs text-zinc-500">
                Desative para cadastrar agora e liberar depois.
              </span>
            </span>
          </label>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={resetForm}
              disabled={saving}
              className="rounded-xl border border-zinc-200 px-5 py-3 text-sm font-black disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={saveCoupon}
              disabled={saving}
              className="rounded-xl bg-red-600 px-6 py-3 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? "Salvando..."
                : editingId
                ? "Salvar alterações"
                : "Criar cupom"}
            </button>
          </div>
        </section>
      )}

      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-black">Cupons da loja</h3>
            <p className="mt-1 text-sm text-zinc-500">
              Ative, pause ou edite cada promoção quando quiser.
            </p>
          </div>

          <div className="w-full sm:max-w-sm">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="🔎 Buscar cupom"
              className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm outline-none transition focus:border-red-400"
            />
          </div>
        </div>

        {filteredCoupons.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-zinc-200 px-5 py-10 text-center">
            <div className="text-3xl">🎟️</div>
            <p className="mt-3 font-black">
              {coupons.length === 0
                ? "Nenhum cupom cadastrado"
                : "Nenhum cupom encontrado"}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              {coupons.length === 0
                ? "Crie o primeiro código de desconto desta loja."
                : "Tente pesquisar por outro código."}
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {filteredCoupons.map((coupon) => {
              const status = couponStatus(coupon);
              const uses = Number(coupon.current_uses ?? 0);
              const discountLabel =
                coupon.discount_type === "percent"
                  ? `${Number(coupon.discount_value).toLocaleString("pt-BR")}% OFF`
                  : `${money(coupon.discount_value)} OFF`;

              return (
                <article
                  key={coupon.id}
                  className="rounded-2xl border border-zinc-200 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => copyCode(coupon.code)}
                          className="max-w-full truncate rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-black text-white"
                          title="Clique para copiar"
                        >
                          {coupon.code}
                        </button>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-black ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </div>

                      {coupon.description && (
                        <p className="mt-2 text-sm text-zinc-500">
                          {coupon.description}
                        </p>
                      )}

                      {(coupon.one_use_per_customer ||
                        coupon.first_order_only) && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {coupon.one_use_per_customer && (
                            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700">
                              👤 1 uso por cliente
                            </span>
                          )}

                          {coupon.first_order_only && (
                            <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-black text-violet-700">
                              🆕 Primeira compra
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <p className="text-xl font-black text-red-600">
                      {discountLabel}
                    </p>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <div className="rounded-xl bg-zinc-50 p-3">
                      <p className="text-xs font-bold uppercase text-zinc-400">
                        Pedido mínimo
                      </p>
                      <p className="mt-1 font-black">
                        {Number(coupon.minimum_order ?? 0) > 0
                          ? money(coupon.minimum_order)
                          : "Sem mínimo"}
                      </p>
                    </div>

                    <div className="rounded-xl bg-zinc-50 p-3">
                      <p className="text-xs font-bold uppercase text-zinc-400">
                        Usos
                      </p>
                      <p className="mt-1 font-black">
                        {uses}
                        {coupon.max_uses !== null
                          ? ` / ${coupon.max_uses}`
                          : " / ∞"}
                      </p>
                    </div>

                    <div className="rounded-xl bg-zinc-50 p-3">
                      <p className="text-xs font-bold uppercase text-zinc-400">
                        Início
                      </p>
                      <p className="mt-1 font-black">
                        {coupon.starts_at
                          ? dateTime(coupon.starts_at)
                          : "Agora"}
                      </p>
                    </div>

                    <div className="rounded-xl bg-zinc-50 p-3">
                      <p className="text-xs font-bold uppercase text-zinc-400">
                        Fim
                      </p>
                      <p className="mt-1 font-black">
                        {dateTime(coupon.expires_at)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(coupon)}
                      disabled={processingId === coupon.id}
                      className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-black transition hover:bg-zinc-50 disabled:opacity-50"
                    >
                      ✏️ Editar
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleCoupon(coupon)}
                      disabled={processingId === coupon.id}
                      className={`rounded-xl border px-4 py-2 text-sm font-black transition disabled:opacity-50 ${
                        coupon.active
                          ? "border-orange-200 text-orange-600 hover:bg-orange-50"
                          : "border-green-200 text-green-700 hover:bg-green-50"
                      }`}
                    >
                      {processingId === coupon.id
                        ? "Aguarde..."
                        : coupon.active
                        ? "⏸ Desativar"
                        : "▶ Ativar"}
                    </button>

                    {uses === 0 && (
                      <button
                        type="button"
                        onClick={() => deleteCoupon(coupon)}
                        disabled={processingId === coupon.id}
                        className="rounded-xl border border-red-200 px-4 py-2 text-sm font-black text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                      >
                        🗑 Apagar
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
