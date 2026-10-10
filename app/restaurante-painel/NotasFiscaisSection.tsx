"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useSearchParams } from "next/navigation";

import { supabase } from "@/lib/supabase";

type FiscalSettings = {
  restaurant_id: string;
  cnpj: string | null;
  state_registration: string | null;
  legal_name: string | null;
  tax_regime: string | null;
  nfce_series: number;
  environment: "homologation" | "production";
  enabled: boolean;
  updated_at: string;
};

type FiscalDocument = {
  id: string;
  order_id: string;
  model: "55" | "65";
  status:
    | "draft"
    | "processing"
    | "authorized"
    | "rejected"
    | "cancelled"
    | "error";
  number: number | null;
  series: number | null;
  access_key: string | null;
  protocol: string | null;
  xml_url: string | null;
  danfe_url: string | null;
  error_message: string | null;
  created_at: string;
  authorized_at: string | null;
  cancelled_at: string | null;
};

type OrderItem = {
  product_id: string | null;
  name: string;
  quantity: number;
};

type Order = {
  order_id: string;
  restaurant_id: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  total: number | string;
  created_at: string;
  customer_name: string | null;
  items?: OrderItem[];
};

type ProductFiscal = {
  product_id: string;
  restaurant_id: string;
  product_name: string;
  product_active: boolean;
  ncm: string | null;
  cfop: string | null;
  unit: string | null;
  cest: string | null;
  origin_code: string | null;
  tax_status_type: "CSOSN" | "CST" | null;
  tax_status_code: string | null;
  gtin: string | null;
  fiscal_complete: boolean;
  updated_at: string | null;
};

type FiscalProductForm = {
  ncm: string;
  cfop: string;
  unit: string;
  cest: string;
  origin_code: string;
  tax_status_type: "CSOSN" | "CST" | "";
  tax_status_code: string;
  gtin: string;
};

function money(value: number | string | null) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function dateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function shortOrder(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function digits(value: string, max?: number) {
  const result = value.replace(/\D/g, "");
  return max ? result.slice(0, max) : result;
}

function statusInfo(status?: FiscalDocument["status"]) {
  switch (status) {
    case "authorized":
      return { label: "Autorizada", className: "bg-green-100 text-green-700" };
    case "processing":
      return { label: "Processando", className: "bg-blue-100 text-blue-700" };
    case "rejected":
      return { label: "Rejeitada", className: "bg-red-100 text-red-700" };
    case "cancelled":
      return { label: "Cancelada", className: "bg-zinc-200 text-zinc-700" };
    case "error":
      return { label: "Erro", className: "bg-red-100 text-red-700" };
    case "draft":
      return { label: "Rascunho", className: "bg-amber-100 text-amber-800" };
    default:
      return { label: "Não preparada", className: "bg-zinc-100 text-zinc-600" };
  }
}

function emptyFiscalForm(): FiscalProductForm {
  return {
    ncm: "",
    cfop: "",
    unit: "UN",
    cest: "",
    origin_code: "0",
    tax_status_type: "",
    tax_status_code: "",
    gtin: "",
  };
}

export default function NotasFiscaisSection() {
  const searchParams = useSearchParams();
  const restaurantId = searchParams.get("restaurant") ?? "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preparingOrder, setPreparingOrder] = useState("");
  const [savingProductId, setSavingProductId] = useState("");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [orders, setOrders] = useState<Order[]>([]);
  const [documents, setDocuments] = useState<FiscalDocument[]>([]);
  const [fiscalProducts, setFiscalProducts] = useState<ProductFiscal[]>([]);
  const [productForm, setProductForm] = useState<FiscalProductForm>(
    emptyFiscalForm()
  );

  const [cnpj, setCnpj] = useState("");
  const [stateRegistration, setStateRegistration] = useState("");
  const [legalName, setLegalName] = useState("");
  const [taxRegime, setTaxRegime] = useState("");
  const [series, setSeries] = useState("1");
  const [environment, setEnvironment] = useState<"homologation" | "production">(
    "homologation"
  );

  const loadData = useCallback(async () => {
    if (!restaurantId) {
      setError("Loja não informada.");
      setLoading(false);
      return;
    }

    setError("");

    const [settingsResponse, ordersResponse, documentsResponse, productsResponse] =
      await Promise.all([
        supabase.rpc("get_my_restaurant_fiscal_settings", {
          p_restaurant_id: restaurantId,
        }),
        supabase.rpc("get_my_restaurant_orders"),
        supabase.rpc("get_my_fiscal_documents", {
          p_restaurant_id: restaurantId,
        }),
        supabase.rpc("get_my_restaurant_product_fiscal_settings", {
          p_restaurant_id: restaurantId,
        }),
      ]);

    if (settingsResponse.error) {
      console.error("Erro configuração fiscal:", settingsResponse.error);
      setError("Não foi possível carregar a configuração fiscal.");
      setLoading(false);
      return;
    }

    if (ordersResponse.error) {
      console.error("Erro pedidos:", ordersResponse.error);
      setError("Não foi possível carregar os pedidos.");
      setLoading(false);
      return;
    }

    if (documentsResponse.error) {
      console.error("Erro documentos fiscais:", documentsResponse.error);
      setError("Não foi possível carregar as notas fiscais.");
      setLoading(false);
      return;
    }

    if (productsResponse.error) {
      console.error("Erro fiscal dos produtos:", productsResponse.error);
      setError("Não foi possível carregar os dados fiscais dos produtos.");
      setLoading(false);
      return;
    }

    const settings =
      Array.isArray(settingsResponse.data) && settingsResponse.data.length > 0
        ? (settingsResponse.data[0] as FiscalSettings)
        : null;

    if (settings) {
      setCnpj(settings.cnpj ?? "");
      setStateRegistration(settings.state_registration ?? "");
      setLegalName(settings.legal_name ?? "");
      setTaxRegime(settings.tax_regime ?? "");
      setSeries(String(settings.nfce_series ?? 1));
      setEnvironment(settings.environment ?? "homologation");
    }

    const restaurantOrders = ((ordersResponse.data ?? []) as Order[]).filter(
      (order) =>
        order.restaurant_id === restaurantId && order.payment_status === "paid"
    );

    setOrders(restaurantOrders);
    setDocuments((documentsResponse.data ?? []) as FiscalDocument[]);
    setFiscalProducts((productsResponse.data ?? []) as ProductFiscal[]);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const documentsByOrder = useMemo(() => {
    const map = new Map<string, FiscalDocument>();
    documents.forEach((document) => map.set(document.order_id, document));
    return map;
  }, [documents]);

  const fiscalProductsById = useMemo(() => {
    const map = new Map<string, ProductFiscal>();
    fiscalProducts.forEach((product) => map.set(product.product_id, product));
    return map;
  }, [fiscalProducts]);

  const authorizedCount = documents.filter(
    (document) => document.status === "authorized"
  ).length;

  const draftCount = documents.filter(
    (document) => document.status === "draft"
  ).length;

  const activeFiscalProducts = fiscalProducts.filter(
    (product) => product.product_active
  );

  const configuredProductCount = activeFiscalProducts.filter(
    (product) => product.fiscal_complete
  ).length;

  const filteredFiscalProducts = fiscalProducts.filter((product) =>
    product.product_name.toLowerCase().includes(productSearch.trim().toLowerCase())
  );

  function missingFiscalProducts(order: Order) {
    const uniqueMissing = new Map<string, string>();

    (order.items ?? []).forEach((item) => {
      if (!item.product_id) return;

      const fiscal = fiscalProductsById.get(item.product_id);

      if (!fiscal?.fiscal_complete) {
        uniqueMissing.set(item.product_id, item.name);
      }
    });

    return Array.from(uniqueMissing.values());
  }

  async function saveSettings() {
    const numericSeries = Number(series);

    if (!cnpj.trim() || !legalName.trim()) {
      setError("Informe pelo menos o CNPJ e a razão social.");
      return;
    }

    if (!Number.isInteger(numericSeries) || numericSeries <= 0) {
      setError("A série da NFC-e precisa ser um número maior que zero.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const { error: rpcError } = await supabase.rpc(
      "save_my_restaurant_fiscal_settings",
      {
        p_restaurant_id: restaurantId,
        p_cnpj: cnpj,
        p_state_registration: stateRegistration,
        p_legal_name: legalName,
        p_tax_regime: taxRegime,
        p_nfce_series: numericSeries,
        p_environment: environment,
      }
    );

    if (rpcError) {
      console.error("Erro ao salvar fiscal:", rpcError);
      setError("Não foi possível salvar os dados fiscais.");
      setSaving(false);
      return;
    }

    setSuccess("Dados fiscais da loja salvos.");
    setSaving(false);
    await loadData();
  }

  function openFiscalProduct(product: ProductFiscal) {
    setError("");
    setSuccess("");
    setEditingProductId(product.product_id);
    setProductForm({
      ncm: product.ncm ?? "",
      cfop: product.cfop ?? "",
      unit: product.unit ?? "UN",
      cest: product.cest ?? "",
      origin_code: product.origin_code ?? "0",
      tax_status_type: product.tax_status_type ?? "",
      tax_status_code: product.tax_status_code ?? "",
      gtin: product.gtin ?? "",
    });
  }

  async function saveFiscalProduct(product: ProductFiscal) {
    if (productForm.ncm.length !== 8) {
      setError("O NCM precisa ter 8 dígitos.");
      return;
    }

    if (productForm.cfop.length !== 4) {
      setError("O CFOP precisa ter 4 dígitos.");
      return;
    }

    if (!productForm.unit.trim()) {
      setError("Informe a unidade do produto.");
      return;
    }

    if (productForm.cest && productForm.cest.length !== 7) {
      setError("Quando informado, o CEST precisa ter 7 dígitos.");
      return;
    }

    if (!productForm.tax_status_type || !productForm.tax_status_code) {
      setError("Informe o tipo e o código da tributação de ICMS.");
      return;
    }

    if (
      productForm.gtin &&
      ![8, 12, 13, 14].includes(productForm.gtin.length)
    ) {
      setError("Quando informado, o GTIN/EAN deve ter 8, 12, 13 ou 14 dígitos.");
      return;
    }

    setSavingProductId(product.product_id);
    setError("");
    setSuccess("");

    const { error: rpcError } = await supabase.rpc(
      "save_my_product_fiscal_settings",
      {
        p_restaurant_id: restaurantId,
        p_product_id: product.product_id,
        p_ncm: productForm.ncm,
        p_cfop: productForm.cfop,
        p_unit: productForm.unit,
        p_cest: productForm.cest,
        p_origin_code: productForm.origin_code,
        p_tax_status_type: productForm.tax_status_type,
        p_tax_status_code: productForm.tax_status_code,
        p_gtin: productForm.gtin,
      }
    );

    if (rpcError) {
      console.error("Erro fiscal do produto:", rpcError);

      let message = "Não foi possível salvar os dados fiscais do produto.";

      if (rpcError.message.includes("INVALID_NCM")) {
        message = "NCM inválido. Informe 8 dígitos.";
      } else if (rpcError.message.includes("INVALID_CFOP")) {
        message = "CFOP inválido. Informe 4 dígitos.";
      } else if (rpcError.message.includes("INVALID_CEST")) {
        message = "CEST inválido. Informe 7 dígitos ou deixe em branco.";
      } else if (rpcError.message.includes("INVALID_GTIN")) {
        message = "GTIN/EAN inválido.";
      } else if (rpcError.message.includes("PRODUCT_NOT_OWNED")) {
        message = "Esse produto não pertence à loja aberta.";
      }

      setError(message);
      setSavingProductId("");
      return;
    }

    setEditingProductId(null);
    setProductForm(emptyFiscalForm());
    setSavingProductId("");
    setSuccess(`Dados fiscais de “${product.product_name}” salvos.`);
    await loadData();
  }

  async function prepareDocument(order: Order) {
    const missing = missingFiscalProducts(order);

    if (missing.length > 0) {
      setError(
        `Antes de preparar a NFC-e, configure os dados fiscais de: ${missing.join(
          ", "
        )}.`
      );
      return;
    }

    setPreparingOrder(order.order_id);
    setError("");
    setSuccess("");

    const { error: rpcError } = await supabase.rpc(
      "create_my_fiscal_document_draft",
      {
        p_restaurant_id: restaurantId,
        p_order_id: order.order_id,
        p_model: "65",
      }
    );

    if (rpcError) {
      console.error("Erro ao preparar documento fiscal:", rpcError);
      setError("Não foi possível preparar a NFC-e desse pedido.");
      setPreparingOrder("");
      return;
    }

    setSuccess(`NFC-e do pedido #${shortOrder(order.order_id)} preparada.`);
    setPreparingOrder("");
    await loadData();
  }

  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
        <p className="font-bold">Carregando notas fiscais...</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-black text-red-600">FISCAL</p>
          <h2 className="mt-1 text-3xl font-black">Notas fiscais</h2>
          <p className="mt-1 text-zinc-500">
            Dados da empresa, tributação dos produtos e documentos dos pedidos.
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-black transition hover:bg-zinc-50"
        >
          ↻ Atualizar
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5">
        <p className="font-black text-blue-800">🧪 Preparação para emissão fiscal</p>
        <p className="mt-2 text-sm leading-6 text-blue-700">
          Os campos abaixo deixam os pedidos prontos para uma futura integração
          de NFC-e. Os códigos fiscais devem ser fornecidos pelo contador da loja.
          O sistema ainda não transmite documentos para a SEFAZ.
        </p>
      </div>

      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 font-bold text-green-700">
          ✅ {success}
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase text-zinc-400">Pedidos pagos</p>
          <p className="mt-2 text-3xl font-black">{orders.length}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase text-zinc-400">Produtos fiscais</p>
          <p className="mt-2 text-3xl font-black text-blue-600">
            {configuredProductCount}/{activeFiscalProducts.length}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase text-zinc-400">Rascunhos</p>
          <p className="mt-2 text-3xl font-black text-amber-600">{draftCount}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase text-zinc-400">Autorizadas</p>
          <p className="mt-2 text-3xl font-black text-green-600">{authorizedCount}</p>
        </div>
      </div>

      <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
        <div>
          <h3 className="text-xl font-black">1. Dados fiscais da loja</h3>
          <p className="mt-1 text-sm text-zinc-500">
            Preencha com os dados oficiais informados pelo contador da empresa.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-xs font-black uppercase text-zinc-500">CNPJ</span>
            <input
              value={cnpj}
              onChange={(event) => setCnpj(event.target.value)}
              placeholder="00.000.000/0000-00"
              className="mt-2 h-12 w-full rounded-xl border border-zinc-200 px-4 font-semibold outline-none focus:border-red-500"
            />
          </label>

          <label className="block">
            <span className="text-xs font-black uppercase text-zinc-500">
              Inscrição estadual
            </span>
            <input
              value={stateRegistration}
              onChange={(event) => setStateRegistration(event.target.value)}
              placeholder="Inscrição estadual"
              className="mt-2 h-12 w-full rounded-xl border border-zinc-200 px-4 font-semibold outline-none focus:border-red-500"
            />
          </label>

          <label className="block md:col-span-2">
            <span className="text-xs font-black uppercase text-zinc-500">
              Razão social
            </span>
            <input
              value={legalName}
              onChange={(event) => setLegalName(event.target.value)}
              placeholder="Razão social da empresa"
              className="mt-2 h-12 w-full rounded-xl border border-zinc-200 px-4 font-semibold outline-none focus:border-red-500"
            />
          </label>

          <label className="block">
            <span className="text-xs font-black uppercase text-zinc-500">
              Regime tributário
            </span>
            <select
              value={taxRegime}
              onChange={(event) => setTaxRegime(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 font-semibold outline-none focus:border-red-500"
            >
              <option value="">Selecione</option>
              <option value="simples_nacional">Simples Nacional</option>
              <option value="mei">MEI</option>
              <option value="regime_normal">Regime normal</option>
              <option value="outro">Outro</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-black uppercase text-zinc-500">
              Série NFC-e
            </span>
            <input
              type="number"
              min={1}
              value={series}
              onChange={(event) => setSeries(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-zinc-200 px-4 font-semibold outline-none focus:border-red-500"
            />
          </label>

          <label className="block md:col-span-2">
            <span className="text-xs font-black uppercase text-zinc-500">Ambiente</span>
            <select
              value={environment}
              onChange={(event) =>
                setEnvironment(event.target.value as "homologation" | "production")
              }
              className="mt-2 h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 font-semibold outline-none focus:border-red-500"
            >
              <option value="homologation">Homologação / testes</option>
              <option value="production">Produção</option>
            </select>
          </label>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={saveSettings}
          className="mt-6 rounded-xl bg-red-600 px-6 py-3 font-black text-white transition hover:bg-red-700 disabled:bg-zinc-300"
        >
          {saving ? "Salvando..." : "Salvar dados fiscais"}
        </button>
      </section>

      <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="text-xl font-black">2. Tributação dos produtos</h3>
            <p className="mt-1 text-sm text-zinc-500">
              Configure NCM, CFOP e tributação antes de preparar a nota do pedido.
            </p>
          </div>

          <div className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-black text-zinc-700">
            {configuredProductCount} de {activeFiscalProducts.length} ativos configurados
          </div>
        </div>

        <div className="mt-5">
          <input
            type="text"
            value={productSearch}
            onChange={(event) => setProductSearch(event.target.value)}
            placeholder="Buscar produto..."
            className="h-12 w-full max-w-md rounded-xl border border-zinc-200 px-4 font-semibold outline-none focus:border-red-500"
          />
        </div>

        {filteredFiscalProducts.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-zinc-200 p-8 text-center text-zinc-500">
            Nenhum produto encontrado.
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {filteredFiscalProducts.map((product) => {
              const editing = editingProductId === product.product_id;

              return (
                <div
                  key={product.product_id}
                  className="overflow-hidden rounded-2xl border border-zinc-200"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black">{product.product_name}</p>
                        {!product.product_active && (
                          <span className="rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-black text-zinc-500">
                            INATIVO
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
                            product.fiscal_complete
                              ? "bg-green-100 text-green-700"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {product.fiscal_complete ? "FISCAL OK" : "PENDENTE"}
                        </span>
                      </div>

                      {product.fiscal_complete && (
                        <p className="mt-2 text-sm text-zinc-500">
                          NCM {product.ncm} • CFOP {product.cfop} • {product.unit} • {product.tax_status_type} {product.tax_status_code}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        editing ? setEditingProductId(null) : openFiscalProduct(product)
                      }
                      className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-black transition hover:bg-zinc-50"
                    >
                      {editing ? "Fechar" : product.fiscal_complete ? "Editar" : "Configurar"}
                    </button>
                  </div>

                  {editing && (
                    <div className="border-t border-zinc-200 bg-zinc-50 p-5">
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                        ⚠️ Não adivinhe esses códigos. Use exatamente os dados fiscais informados pelo contador da loja.
                      </div>

                      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <label className="block">
                          <span className="text-xs font-black uppercase text-zinc-500">NCM *</span>
                          <input
                            value={productForm.ncm}
                            onChange={(event) =>
                              setProductForm((current) => ({
                                ...current,
                                ncm: digits(event.target.value, 8),
                              }))
                            }
                            inputMode="numeric"
                            placeholder="8 dígitos"
                            className="mt-2 h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 font-semibold outline-none focus:border-red-500"
                          />
                        </label>

                        <label className="block">
                          <span className="text-xs font-black uppercase text-zinc-500">CFOP *</span>
                          <input
                            value={productForm.cfop}
                            onChange={(event) =>
                              setProductForm((current) => ({
                                ...current,
                                cfop: digits(event.target.value, 4),
                              }))
                            }
                            inputMode="numeric"
                            placeholder="4 dígitos"
                            className="mt-2 h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 font-semibold outline-none focus:border-red-500"
                          />
                        </label>

                        <label className="block">
                          <span className="text-xs font-black uppercase text-zinc-500">Unidade *</span>
                          <select
                            value={productForm.unit}
                            onChange={(event) =>
                              setProductForm((current) => ({
                                ...current,
                                unit: event.target.value,
                              }))
                            }
                            className="mt-2 h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 font-semibold outline-none focus:border-red-500"
                          >
                            <option value="UN">UN</option>
                            <option value="KG">KG</option>
                            <option value="G">G</option>
                            <option value="L">L</option>
                            <option value="ML">ML</option>
                            <option value="PCT">PCT</option>
                            <option value="CX">CX</option>
                          </select>
                        </label>

                        <label className="block">
                          <span className="text-xs font-black uppercase text-zinc-500">CEST</span>
                          <input
                            value={productForm.cest}
                            onChange={(event) =>
                              setProductForm((current) => ({
                                ...current,
                                cest: digits(event.target.value, 7),
                              }))
                            }
                            inputMode="numeric"
                            placeholder="Opcional • 7 dígitos"
                            className="mt-2 h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 font-semibold outline-none focus:border-red-500"
                          />
                        </label>

                        <label className="block">
                          <span className="text-xs font-black uppercase text-zinc-500">Origem *</span>
                          <select
                            value={productForm.origin_code}
                            onChange={(event) =>
                              setProductForm((current) => ({
                                ...current,
                                origin_code: event.target.value,
                              }))
                            }
                            className="mt-2 h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 font-semibold outline-none focus:border-red-500"
                          >
                            <option value="0">0 - Nacional</option>
                            <option value="1">1 - Estrangeira importação direta</option>
                            <option value="2">2 - Estrangeira mercado interno</option>
                            <option value="3">3 - Nacional conteúdo importado &gt; 40%</option>
                            <option value="4">4 - Nacional processo básico</option>
                            <option value="5">5 - Nacional conteúdo importado ≤ 40%</option>
                            <option value="6">6 - Estrangeira sem similar nacional</option>
                            <option value="7">7 - Estrangeira mercado interno sem similar</option>
                            <option value="8">8 - Nacional conteúdo importado &gt; 70%</option>
                          </select>
                        </label>

                        <label className="block">
                          <span className="text-xs font-black uppercase text-zinc-500">Tipo ICMS *</span>
                          <select
                            value={productForm.tax_status_type}
                            onChange={(event) =>
                              setProductForm((current) => ({
                                ...current,
                                tax_status_type: event.target.value as "CSOSN" | "CST" | "",
                                tax_status_code: "",
                              }))
                            }
                            className="mt-2 h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 font-semibold outline-none focus:border-red-500"
                          >
                            <option value="">Selecione</option>
                            <option value="CSOSN">CSOSN</option>
                            <option value="CST">CST</option>
                          </select>
                        </label>

                        <label className="block">
                          <span className="text-xs font-black uppercase text-zinc-500">
                            Código {productForm.tax_status_type || "ICMS"} *
                          </span>
                          <input
                            value={productForm.tax_status_code}
                            onChange={(event) =>
                              setProductForm((current) => ({
                                ...current,
                                tax_status_code: digits(event.target.value, 3),
                              }))
                            }
                            inputMode="numeric"
                            placeholder={productForm.tax_status_type === "CST" ? "Ex.: 00" : "Ex.: 102"}
                            className="mt-2 h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 font-semibold outline-none focus:border-red-500"
                          />
                        </label>

                        <label className="block">
                          <span className="text-xs font-black uppercase text-zinc-500">GTIN / EAN</span>
                          <input
                            value={productForm.gtin}
                            onChange={(event) =>
                              setProductForm((current) => ({
                                ...current,
                                gtin: digits(event.target.value, 14),
                              }))
                            }
                            inputMode="numeric"
                            placeholder="Opcional"
                            className="mt-2 h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 font-semibold outline-none focus:border-red-500"
                          />
                        </label>
                      </div>

                      <button
                        type="button"
                        disabled={savingProductId === product.product_id}
                        onClick={() => saveFiscalProduct(product)}
                        className="mt-5 rounded-xl bg-zinc-900 px-6 py-3 font-black text-white transition hover:bg-zinc-800 disabled:bg-zinc-300"
                      >
                        {savingProductId === product.product_id
                          ? "Salvando..."
                          : "Salvar tributação do produto"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
        <div>
          <h3 className="text-xl font-black">3. Pedidos e documentos</h3>
          <p className="mt-1 text-sm text-zinc-500">
            O rascunho só é liberado quando todos os produtos do pedido têm os dados fiscais mínimos cadastrados.
          </p>
        </div>

        {orders.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-zinc-200 p-8 text-center text-zinc-500">
            Nenhum pedido pago encontrado nesta loja.
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[950px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs font-black uppercase text-zinc-400">
                  <th className="pb-3 pr-4">Pedido</th>
                  <th className="pb-3 pr-4">Cliente</th>
                  <th className="pb-3 pr-4">Data</th>
                  <th className="pb-3 pr-4">Valor</th>
                  <th className="pb-3 pr-4">Fiscal</th>
                  <th className="pb-3 pr-4">Nota</th>
                  <th className="pb-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const document = documentsByOrder.get(order.order_id);
                  const info = statusInfo(document?.status);
                  const missing = missingFiscalProducts(order);

                  return (
                    <tr key={order.order_id} className="border-b border-zinc-100">
                      <td className="py-4 pr-4 font-black">#{shortOrder(order.order_id)}</td>
                      <td className="py-4 pr-4 font-semibold">
                        {order.customer_name || "Cliente"}
                      </td>
                      <td className="py-4 pr-4 text-zinc-500">{dateTime(order.created_at)}</td>
                      <td className="py-4 pr-4 font-black">{money(order.total)}</td>
                      <td className="py-4 pr-4">
                        {missing.length === 0 ? (
                          <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-black text-green-700">
                            Produtos OK
                          </span>
                        ) : (
                          <div>
                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-800">
                              Fiscal pendente
                            </span>
                            <p className="mt-2 max-w-[260px] text-xs text-zinc-500">
                              {missing.join(", ")}
                            </p>
                          </div>
                        )}
                      </td>
                      <td className="py-4 pr-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${info.className}`}>
                          {info.label}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        {document?.status === "authorized" ? (
                          <div className="flex justify-end gap-2">
                            {document.danfe_url && (
                              <a
                                href={document.danfe_url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-lg border border-zinc-200 px-3 py-2 font-black"
                              >
                                DANFE
                              </a>
                            )}
                            {document.xml_url && (
                              <a
                                href={document.xml_url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-lg border border-zinc-200 px-3 py-2 font-black"
                              >
                                XML
                              </a>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={
                              preparingOrder === order.order_id || missing.length > 0
                            }
                            onClick={() => prepareDocument(order)}
                            className="rounded-lg bg-zinc-900 px-4 py-2 font-black text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
                          >
                            {preparingOrder === order.order_id
                              ? "Preparando..."
                              : missing.length > 0
                                ? "Fiscal pendente"
                                : document
                                  ? "Atualizar rascunho"
                                  : "Preparar NFC-e"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
