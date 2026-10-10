"use client";

import {
  DragEvent,
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { useSearchParams } from "next/navigation";

import { supabase } from "@/lib/supabase";

type AddonOption = {
  id: string;
  name: string;
  price: number | string;
  max_quantity: number;
  active: boolean;
  sort_order: number;
};

type AddonGroup = {
  id: string;
  restaurant_id: string;
  name: string;
  min_select: number;
  max_select: number;
  required: boolean;
  active: boolean;
  sort_order: number;
  options: AddonOption[];
};

type ProductForAddon = {
  id: string;
  restaurant_id: string;
  name: string;
  active: boolean;
  image_url: string | null;
  addon_group_ids: string[];
};

function money(
  value: number | string
) {
  return Number(
    value
  ).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function normalizeSearchText(
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

export default function ComplementosSection() {
  const searchParams =
    useSearchParams();

  const restaurantId =
    searchParams.get(
      "restaurant"
    ) ?? "";

  const [
    groups,
    setGroups,
  ] =
    useState<AddonGroup[]>([]);

  const [
    products,
    setProducts,
  ] =
    useState<ProductForAddon[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const [
    searchOpen,
    setSearchOpen,
  ] = useState(false);

  const [
    searchTerm,
    setSearchTerm,
  ] = useState("");

  const [
    expandedGroupId,
    setExpandedGroupId,
  ] = useState("");

  const [
    productSearchOpenGroupId,
    setProductSearchOpenGroupId,
  ] = useState("");

  const [
    productSearchTerms,
    setProductSearchTerms,
  ] = useState<
    Record<
      string,
      string
    >
  >({});

  const [
    draggingGroupId,
    setDraggingGroupId,
  ] = useState("");

  const [
    reorderingGroup,
    setReorderingGroup,
  ] = useState(false);

  const dragOriginalGroupsRef =
    useRef<AddonGroup[] | null>(
      null
    );

  const dragCurrentGroupsRef =
    useRef<AddonGroup[] | null>(
      null
    );

  const dragDroppedRef =
    useRef(false);

  // ==========================================
  // NOVO GRUPO
  // ==========================================

  const [
    showNewGroup,
    setShowNewGroup,
  ] = useState(false);

  const [
    groupName,
    setGroupName,
  ] = useState("");

  const [
    minSelect,
    setMinSelect,
  ] = useState("0");

  const [
    maxSelect,
    setMaxSelect,
  ] = useState("4");

  const [
    required,
    setRequired,
  ] = useState(false);

  const [
    creatingGroup,
    setCreatingGroup,
  ] = useState(false);

  // ==========================================
  // NOVA OPÇÃO
  // ==========================================

  const [
    optionNames,
    setOptionNames,
  ] = useState<
    Record<string, string>
  >({});

  const [
    optionPrices,
    setOptionPrices,
  ] = useState<
    Record<string, string>
  >({});

  const [
    optionMaxQuantities,
    setOptionMaxQuantities,
  ] = useState<
    Record<string, string>
  >({});

  const [
    addingOption,
    setAddingOption,
  ] = useState("");

  // ==========================================
  // AÇÕES
  // ==========================================

  const [
    deleting,
    setDeleting,
  ] = useState("");

  const [
    updatingMax,
    setUpdatingMax,
  ] = useState("");

  const [
    linkingProduct,
    setLinkingProduct,
  ] = useState("");

  // ==========================================
  // VALIDAR LOJA
  // ==========================================

  function ensureRestaurant() {
    if (!restaurantId) {
      setError(
        "Loja não informada. Volte para Minhas lojas e abra o painel novamente."
      );

      return false;
    }

    return true;
  }

  // ==========================================
  // CARREGAR GRUPOS
  // SOMENTE DA LOJA SELECIONADA
  // ==========================================

  const loadGroups =
    useCallback(async () => {
      if (!restaurantId) {
        setGroups([]);
        return;
      }

      const {
        data,
        error: rpcError,
      } =
        await supabase.rpc(
          "get_my_addon_groups",
          {
            p_restaurant_id:
              restaurantId,
          }
        );

      if (rpcError) {
        console.error(
          "Erro complementos:",
          rpcError
        );

        setError(
          "Não foi possível carregar os complementos desta loja."
        );

        return;
      }

      const result =
        Array.isArray(data)
          ? data
          : [];

      const normalized =
        result
          .filter(
            (group) =>
              group.restaurant_id ===
              restaurantId
          )
          .map(
            (group) => ({
              ...group,

              options:
                Array.isArray(
                  group.options
                )
                  ? group.options.map(
                      (
                        option: AddonOption
                      ) => ({
                        ...option,

                        max_quantity:
                          Number(
                            option.max_quantity ??
                              1
                          ),
                      })
                    )
                  : [],
            })
          )
          .sort(
            (
              a,
              b
            ) =>
              Number(
                a.sort_order ??
                  0
              ) -
              Number(
                b.sort_order ??
                  0
              )
          );

      setGroups(
        normalized as AddonGroup[]
      );
    }, [
      restaurantId,
    ]);

  // ==========================================
  // CARREGAR PRODUTOS
  // SOMENTE DA LOJA SELECIONADA
  // ==========================================

  const loadProducts =
    useCallback(async () => {
      if (!restaurantId) {
        setProducts([]);
        return;
      }

      const {
        data,
        error: rpcError,
      } =
        await supabase.rpc(
          "get_my_products_for_addons",
          {
            p_restaurant_id:
              restaurantId,
          }
        );

      if (rpcError) {
        console.error(
          "Erro produtos adicionais:",
          rpcError
        );

        setError(
          "Não foi possível carregar os produtos desta loja."
        );

        return;
      }

      const result =
        Array.isArray(data)
          ? data
          : [];

      const normalized =
        result
          .filter(
            (item) =>
              item.restaurant_id ===
              restaurantId
          )
          .map(
            (item) => ({
              ...item,

              addon_group_ids:
                Array.isArray(
                  item.addon_group_ids
                )
                  ? item.addon_group_ids
                  : [],
            })
          );

      setProducts(
        normalized as ProductForAddon[]
      );
    }, [
      restaurantId,
    ]);

  // ==========================================
  // INICIAR
  // ==========================================

  useEffect(() => {
    async function start() {
      setLoading(true);
      setError("");
      setSuccess("");

      if (!restaurantId) {
        setError(
          "Loja não informada. Volte para Minhas lojas e abra o painel novamente."
        );

        setLoading(false);
        return;
      }

      await Promise.all([
        loadGroups(),
        loadProducts(),
      ]);

      setLoading(false);
    }

    start();
  }, [
    restaurantId,
    loadGroups,
    loadProducts,
  ]);

  // ==========================================
  // CRIAR GRUPO
  // ==========================================

  async function createGroup(
    event: FormEvent
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!ensureRestaurant()) {
      return;
    }

    const cleanName =
      groupName.trim();

    const parsedMin =
      Number(
        minSelect
      );

    const parsedMax =
      Number(
        maxSelect
      );

    if (!cleanName) {
      setError(
        "Digite o nome do grupo."
      );

      return;
    }

    if (
      !Number.isInteger(
        parsedMin
      ) ||
      parsedMin < 0
    ) {
      setError(
        "O mínimo precisa ser 0 ou maior."
      );

      return;
    }

    if (
      !Number.isInteger(
        parsedMax
      ) ||
      parsedMax < 1
    ) {
      setError(
        "O máximo precisa ser pelo menos 1."
      );

      return;
    }

    if (
      parsedMin >
      parsedMax
    ) {
      setError(
        "O mínimo não pode ser maior que o máximo."
      );

      return;
    }

    setCreatingGroup(
      true
    );

    const finalMin =
      required &&
      parsedMin === 0
        ? 1
        : parsedMin;

    const {
      error: rpcError,
    } =
      await supabase.rpc(
        "create_my_addon_group",
        {
          p_restaurant_id:
            restaurantId,

          p_name:
            cleanName,

          p_min_select:
            finalMin,

          p_max_select:
            parsedMax,

          p_required:
            required,
        }
      );

    if (rpcError) {
      console.error(
        "Erro criar grupo:",
        rpcError
      );

      if (
        rpcError.message.includes(
          "RESTAURANT_NOT_FOUND"
        )
      ) {
        setError(
          "Essa loja não foi encontrada ou não pertence à sua conta."
        );
      } else {
        setError(
          "Não foi possível criar o grupo."
        );
      }

      setCreatingGroup(
        false
      );

      return;
    }

    setGroupName(
      ""
    );

    setMinSelect(
      "0"
    );

    setMaxSelect(
      "4"
    );

    setRequired(
      false
    );

    setShowNewGroup(
      false
    );

    setSuccess(
      "Grupo criado com sucesso!"
    );

    await loadGroups();

    setCreatingGroup(
      false
    );
  }

  // ==========================================
  // ADICIONAR OPÇÃO
  // ==========================================

  async function addOption(
    groupId: string
  ) {
    setError("");
    setSuccess("");

    if (!ensureRestaurant()) {
      return;
    }

    const group =
      groups.find(
        (item) =>
          item.id ===
          groupId
      );

    if (
      !group ||
      group.restaurant_id !==
        restaurantId
    ) {
      setError(
        "Esse grupo não pertence à loja aberta."
      );

      return;
    }

    const name =
      (
        optionNames[
          groupId
        ] ?? ""
      ).trim();

    const priceText =
      (
        optionPrices[
          groupId
        ] ?? ""
      )
        .trim()
        .replace(
          ",",
          "."
        );

    const price =
      Number(
        priceText ||
          "0"
      );

    const maxQuantity =
      Number(
        optionMaxQuantities[
          groupId
        ] || "1"
      );

    if (!name) {
      setError(
        "Digite o nome do adicional."
      );

      return;
    }

    if (
      !Number.isFinite(
        price
      ) ||
      price < 0
    ) {
      setError(
        "Digite um preço válido."
      );

      return;
    }

    if (
      !Number.isInteger(
        maxQuantity
      ) ||
      maxQuantity < 1
    ) {
      setError(
        "O máximo por pedido precisa ser pelo menos 1."
      );

      return;
    }

    setAddingOption(
      groupId
    );

    const {
      error: rpcError,
    } =
      await supabase.rpc(
        "create_my_addon_option",
        {
          p_restaurant_id:
            restaurantId,

          p_group_id:
            groupId,

          p_name:
            name,

          p_price:
            price,

          p_max_quantity:
            maxQuantity,
        }
      );

    if (rpcError) {
      console.error(
        "Erro adicionar opção:",
        rpcError
      );

      if (
        rpcError.message.includes(
          "GROUP_NOT_FOUND"
        )
      ) {
        setError(
          "Esse grupo não pertence à loja aberta."
        );
      } else {
        setError(
          "Não foi possível adicionar o complemento."
        );
      }

      setAddingOption(
        ""
      );

      return;
    }

    setOptionNames(
      (current) => ({
        ...current,

        [groupId]:
          "",
      })
    );

    setOptionPrices(
      (current) => ({
        ...current,

        [groupId]:
          "",
      })
    );

    setOptionMaxQuantities(
      (current) => ({
        ...current,

        [groupId]:
          "1",
      })
    );

    setSuccess(
      "Opção adicionada!"
    );

    await loadGroups();

    setAddingOption(
      ""
    );
  }

  // ==========================================
  // ALTERAR MÁXIMO DO ADICIONAL
  // ==========================================

  async function updateMaxQuantity(
    option: AddonOption,
    newQuantity: number
  ) {
    if (
      newQuantity < 1 ||
      newQuantity > 99
    ) {
      return;
    }

    if (!ensureRestaurant()) {
      return;
    }

    setError("");
    setSuccess("");

    setUpdatingMax(
      option.id
    );

    const {
      error: rpcError,
    } =
      await supabase.rpc(
        "update_my_addon_option_max_quantity",
        {
          p_restaurant_id:
            restaurantId,

          p_option_id:
            option.id,

          p_max_quantity:
            newQuantity,
        }
      );

    if (rpcError) {
      console.error(
        "Erro ao atualizar máximo:",
        rpcError
      );

      setError(
        "Não foi possível alterar o máximo deste adicional."
      );

      setUpdatingMax(
        ""
      );

      return;
    }

    setGroups(
      (current) =>
        current.map(
          (group) => ({
            ...group,

            options:
              (
                group.options ??
                []
              ).map(
                (item) =>
                  item.id ===
                  option.id
                    ? {
                        ...item,

                        max_quantity:
                          newQuantity,
                      }
                    : item
              ),
          })
        )
    );

    setSuccess(
      `Máximo de "${option.name}" alterado para ${newQuantity}.`
    );

    setUpdatingMax(
      ""
    );
  }

  // ==========================================
  // APAGAR OPÇÃO
  // ==========================================

  async function deleteOption(
    option: AddonOption
  ) {
    if (!ensureRestaurant()) {
      return;
    }

    const confirmed =
      window.confirm(
        `Apagar "${option.name}"?`
      );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");

    setDeleting(
      option.id
    );

    const {
      error: rpcError,
    } =
      await supabase.rpc(
        "delete_my_addon_option",
        {
          p_restaurant_id:
            restaurantId,

          p_option_id:
            option.id,
        }
      );

    if (rpcError) {
      console.error(
        "Erro apagar opção:",
        rpcError
      );

      setError(
        "Não foi possível apagar o complemento."
      );

      setDeleting(
        ""
      );

      return;
    }

    setSuccess(
      "Opção apagada."
    );

    await loadGroups();

    setDeleting(
      ""
    );
  }

  // ==========================================
  // APAGAR GRUPO
  // ==========================================

  async function deleteGroup(
    group: AddonGroup
  ) {
    if (!ensureRestaurant()) {
      return;
    }

    if (
      group.restaurant_id !==
      restaurantId
    ) {
      setError(
        "Esse grupo não pertence à loja aberta."
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Apagar o grupo "${group.name}" e todos os complementos dele?`
      );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");

    setDeleting(
      group.id
    );

    const {
      error: rpcError,
    } =
      await supabase.rpc(
        "delete_my_addon_group",
        {
          p_restaurant_id:
            restaurantId,

          p_group_id:
            group.id,
        }
      );

    if (rpcError) {
      console.error(
        "Erro apagar grupo:",
        rpcError
      );

      setError(
        "Não foi possível apagar o grupo."
      );

      setDeleting(
        ""
      );

      return;
    }

    setSuccess(
      "Grupo apagado."
    );

    await Promise.all([
      loadGroups(),
      loadProducts(),
    ]);

    setDeleting(
      ""
    );
  }

  // ==========================================
  // LIGAR / DESLIGAR GRUPO NO PRODUTO
  // ==========================================

  async function toggleProductGroup(
    product: ProductForAddon,
    group: AddonGroup
  ) {
    if (!ensureRestaurant()) {
      return;
    }

    if (
      product.restaurant_id !==
        restaurantId ||
      group.restaurant_id !==
        restaurantId
    ) {
      setError(
        "Produto ou grupo não pertence à loja aberta."
      );

      return;
    }

    const currentlyEnabled =
      (
        product.addon_group_ids ??
        []
      ).includes(
        group.id
      );

    const nextEnabled =
      !currentlyEnabled;

    const key =
      `${product.id}-${group.id}`;

    setLinkingProduct(
      key
    );

    setError("");
    setSuccess("");

    const {
      error: rpcError,
    } =
      await supabase.rpc(
        "set_my_product_addon_group",
        {
          p_restaurant_id:
            restaurantId,

          p_product_id:
            product.id,

          p_group_id:
            group.id,

          p_enabled:
            nextEnabled,
        }
      );

    if (rpcError) {
      console.error(
        "Erro ligar complemento:",
        rpcError
      );

      setError(
        "Não foi possível alterar os complementos deste produto."
      );

      setLinkingProduct(
        ""
      );

      return;
    }

    setProducts(
      (current) =>
        current.map(
          (item) => {
            if (
              item.id !==
              product.id
            ) {
              return item;
            }

            const currentIds =
              item.addon_group_ids ??
              [];

            return {
              ...item,

              addon_group_ids:
                nextEnabled
                  ? Array.from(
                      new Set([
                        ...currentIds,
                        group.id,
                      ])
                    )
                  : currentIds.filter(
                      (id) =>
                        id !==
                        group.id
                    ),
            };
          }
        )
    );

    setSuccess(
      nextEnabled
        ? `"${group.name}" ativado em ${product.name}.`
        : `"${group.name}" removido de ${product.name}.`
    );

    setLinkingProduct(
      ""
    );
  }

  // ==========================================
  // ARRASTAR GRUPOS
  // ==========================================

  function startGroupDrag(
    groupId: string
  ) {
    if (
      reorderingGroup ||
      normalizeSearchText(
        searchTerm
      )
    ) {
      return;
    }

    dragDroppedRef.current =
      false;

    dragOriginalGroupsRef.current =
      [...groups];

    dragCurrentGroupsRef.current =
      [...groups];

    setDraggingGroupId(
      groupId
    );

    setExpandedGroupId(
      ""
    );

    setError("");
    setSuccess("");
  }

  function moveDraggedGroupOver(
    targetGroupId: string
  ) {
    if (
      !draggingGroupId ||
      draggingGroupId ===
        targetGroupId ||
      reorderingGroup ||
      normalizeSearchText(
        searchTerm
      )
    ) {
      return;
    }

    setGroups(
      (
        current
      ) => {
        const fromIndex =
          current.findIndex(
            (
              group
            ) =>
              group.id ===
              draggingGroupId
          );

        const toIndex =
          current.findIndex(
            (
              group
            ) =>
              group.id ===
              targetGroupId
          );

        if (
          fromIndex === -1 ||
          toIndex === -1 ||
          fromIndex ===
            toIndex
        ) {
          return current;
        }

        const nextOrder =
          [...current];

        const [moved] =
          nextOrder.splice(
            fromIndex,
            1
          );

        if (
          !moved
        ) {
          return current;
        }

        nextOrder.splice(
          toIndex,
          0,
          moved
        );

        const normalizedOrder =
          nextOrder.map(
            (
              group,
              position
            ) => ({
              ...group,

              sort_order:
                position +
                1,
            })
          );

        dragCurrentGroupsRef.current =
          normalizedOrder;

        return normalizedOrder;
      }
    );
  }

  async function finishGroupDrop(
    event: DragEvent<HTMLElement>
  ) {
    event.preventDefault();

    if (
      !draggingGroupId ||
      reorderingGroup ||
      normalizeSearchText(
        searchTerm
      )
    ) {
      return;
    }

    dragDroppedRef.current =
      true;

    const originalOrder =
      dragOriginalGroupsRef.current ??
      [...groups];

    const finalOrder =
      (
        dragCurrentGroupsRef.current ??
        groups
      ).map(
        (
          group,
          position
        ) => ({
          ...group,

          sort_order:
            position +
            1,
        })
      );

    setDraggingGroupId(
      ""
    );

    const originalIds =
      originalOrder.map(
        (
          group
        ) =>
          group.id
      );

    const finalIds =
      finalOrder.map(
        (
          group
        ) =>
          group.id
      );

    const orderChanged =
      originalIds.some(
        (
          id,
          index
        ) =>
          id !==
          finalIds[
            index
          ]
      );

    if (
      !orderChanged
    ) {
      dragOriginalGroupsRef.current =
        null;

      dragCurrentGroupsRef.current =
        null;

      return;
    }

    setGroups(
      finalOrder
    );

    setReorderingGroup(
      true
    );

    const {
      error:
        rpcError,
    } =
      await supabase.rpc(
        "reorder_my_addon_groups",
        {
          p_restaurant_id:
            restaurantId,

          p_group_ids:
            finalIds,
        }
      );

    if (
      rpcError
    ) {
      console.error(
        "Erro ao reordenar grupos:",
        rpcError
      );

      setGroups(
        originalOrder
      );

      setError(
        "Não foi possível alterar a ordem dos grupos."
      );

      setReorderingGroup(
        false
      );

      dragOriginalGroupsRef.current =
        null;

      dragCurrentGroupsRef.current =
        null;

      return;
    }

    await loadGroups();

    setSuccess(
      "Ordem das personalizações atualizada!"
    );

    setReorderingGroup(
      false
    );

    dragOriginalGroupsRef.current =
      null;

    dragCurrentGroupsRef.current =
      null;
  }

  function endGroupDrag() {
    if (
      !dragDroppedRef.current &&
      dragOriginalGroupsRef.current
    ) {
      setGroups(
        dragOriginalGroupsRef.current
      );
    }

    setDraggingGroupId(
      ""
    );

    dragOriginalGroupsRef.current =
      null;

    dragCurrentGroupsRef.current =
      null;

    dragDroppedRef.current =
      false;
  }

  // ==========================================
  // PESQUISA
  // ==========================================

  const normalizedSearch =
    normalizeSearchText(
      searchTerm
    );

  const filteredGroups =
    groups.filter(
      (
        group
      ) =>
        !normalizedSearch ||
        normalizeSearchText(
          group.name
        ).includes(
          normalizedSearch
        )
    );

  // ==========================================
  // CARREGANDO
  // ==========================================

  if (loading) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center">
        <p className="font-bold">
          Carregando personalizações...
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* ==================================
          CABEÇALHO
      ================================== */}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-red-600">
            COMPLEMENTOS
          </p>

          <h2 className="mt-1 text-3xl font-black">
            Personalizações
          </h2>

          <p className="mt-1 text-sm text-zinc-500">
            Crie grupos de escolhas e vincule aos produtos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Pesquisar grupos"
            title="Pesquisar grupos"
            onClick={() => {
              setSearchOpen(
                (
                  current
                ) =>
                  !current
              );

              if (
                searchOpen
              ) {
                setSearchTerm(
                  ""
                );
              }
            }}
            className={`flex h-11 w-11 items-center justify-center rounded-xl border text-lg transition ${
              searchOpen
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            🔍
          </button>

          <button
            type="button"
            onClick={() => {
              setShowNewGroup(
                (
                  current
                ) =>
                  !current
              );

              setError("");
              setSuccess("");
            }}
            className="h-11 rounded-xl bg-red-600 px-5 text-sm font-black text-white transition hover:bg-red-700"
          >
            + Novo grupo
          </button>
        </div>
      </div>

      {/* ==================================
          PESQUISA
      ================================== */}

      {searchOpen && (
        <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-3">
          <div className="flex items-center gap-3">
            <span className="text-zinc-400">
              🔍
            </span>

            <input
              autoFocus
              value={
                searchTerm
              }
              onChange={(event) =>
                setSearchTerm(
                  event.target.value
                )
              }
              placeholder="Pesquisar pelo nome do grupo"
              className="min-w-0 flex-1 bg-transparent py-2 text-sm font-semibold outline-none"
            />

            {searchTerm && (
              <button
                type="button"
                onClick={() =>
                  setSearchTerm(
                    ""
                  )
                }
                className="rounded-lg px-3 py-2 text-xs font-black text-zinc-500 transition hover:bg-zinc-100"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      )}

      {/* ==================================
          MENSAGENS
      ================================== */}

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-700">
          {success}
        </div>
      )}

      {/* ==================================
          NOVO GRUPO - MAIS COMPACTO
      ================================== */}

      {showNewGroup && (
        <form
          onSubmit={
            createGroup
          }
          className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black">
                Novo grupo
              </h3>

              <p className="mt-1 text-xs text-zinc-500">
                O nome aparece no produto para o cliente.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setShowNewGroup(
                  false
                )
              }
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 font-bold text-zinc-600"
            >
              ✕
            </button>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(260px,1fr)_120px_120px_auto_auto]">
            <div>
              <label className="mb-1 block text-xs font-bold text-zinc-500">
                Nome do grupo
              </label>

              <input
                required
                value={
                  groupName
                }
                onChange={(event) =>
                  setGroupName(
                    event.target.value
                  )
                }
                placeholder=""
                className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm font-semibold outline-none focus:border-red-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-zinc-500">
                Mínimo
              </label>

              <input
                type="number"
                min={0}
                value={
                  minSelect
                }
                onChange={(event) =>
                  setMinSelect(
                    event.target.value
                  )
                }
                className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm font-semibold outline-none focus:border-red-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-zinc-500">
                Máximo
              </label>

              <input
                type="number"
                min={1}
                value={
                  maxSelect
                }
                onChange={(event) =>
                  setMaxSelect(
                    event.target.value
                  )
                }
                className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm font-semibold outline-none focus:border-red-500"
              />
            </div>

            <label className="flex h-11 cursor-pointer items-center gap-2 self-end rounded-xl border border-zinc-200 px-3">
              <input
                type="checkbox"
                checked={
                  required
                }
                onChange={(event) =>
                  setRequired(
                    event.target.checked
                  )
                }
                className="h-4 w-4 accent-red-600"
              />

              <span className="whitespace-nowrap text-sm font-bold">
                Obrigatório
              </span>
            </label>

            <button
              type="submit"
              disabled={
                creatingGroup
              }
              className="h-11 self-end rounded-xl bg-zinc-900 px-5 text-sm font-black text-white disabled:bg-zinc-300"
            >
              {creatingGroup
                ? "Criando..."
                : "Criar"}
            </button>
          </div>
        </form>
      )}

      {/* ==================================
          SEM GRUPOS
      ================================== */}

      {groups.length ===
        0 &&
        !showNewGroup && (
          <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-8 text-center">
            <h3 className="font-black">
              Nenhum grupo criado
            </h3>

            <p className="mt-1 text-sm text-zinc-500">
              Crie seu primeiro grupo de personalização.
            </p>
          </div>
        )}

      {groups.length >
        0 &&
        filteredGroups.length ===
          0 && (
          <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-8 text-center">
            <h3 className="font-black">
              Nenhum grupo encontrado
            </h3>

            <p className="mt-1 text-sm text-zinc-500">
              Tente pesquisar outro nome.
            </p>
          </div>
        )}

      {/* ==================================
          GRUPOS COMPACTOS
      ================================== */}

      <div className="mt-5 space-y-3">
        {filteredGroups.map(
          (
            group
          ) => {
            const isExpanded =
              expandedGroupId ===
              group.id;

            const optionCount =
              group.options
                ?.length ??
              0;

            const linkedProductsCount =
              products.filter(
                (
                  product
                ) =>
                  (
                    product.addon_group_ids ??
                    []
                  ).includes(
                    group.id
                  )
              ).length;

            const productSearchTerm =
              productSearchTerms[
                group.id
              ] ?? "";

            const normalizedProductSearch =
              normalizeSearchText(
                productSearchTerm
              );

            const visibleGroupProducts =
              products.filter(
                (
                  product
                ) =>
                  !normalizedProductSearch ||
                  normalizeSearchText(
                    product.name
                  ).includes(
                    normalizedProductSearch
                  )
              );

            return (
              <section
                key={
                  group.id
                }
                onDragEnter={() =>
                  moveDraggedGroupOver(
                    group.id
                  )
                }
                onDragOver={(event) => {
                  if (
                    draggingGroupId
                  ) {
                    event.preventDefault();
                  }
                }}
                onDrop={
                  finishGroupDrop
                }
                className={`overflow-hidden rounded-2xl border bg-white transition ${
                  draggingGroupId ===
                  group.id
                    ? "border-red-300 opacity-70"
                    : "border-zinc-200"
                }`}
              >
                {/* TOPO COMPACTO */}

                <div className="flex flex-wrap items-center gap-3 p-4">
                  <button
                    type="button"
                    draggable={
                      !normalizedSearch &&
                      !reorderingGroup
                    }
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed =
                        "move";

                      event.dataTransfer.setData(
                        "text/plain",
                        group.id
                      );

                      startGroupDrag(
                        group.id
                      );
                    }}
                    onDragEnd={
                      endGroupDrag
                    }
                    disabled={
                      Boolean(
                        normalizedSearch
                      ) ||
                      reorderingGroup
                    }
                    title={
                      normalizedSearch
                        ? "Limpe a pesquisa para ordenar"
                        : "Segure e arraste para mudar a posição"
                    }
                    className="flex h-9 w-9 shrink-0 cursor-grab items-center justify-center rounded-lg border border-zinc-200 bg-white text-lg font-black text-zinc-400 transition hover:bg-zinc-50 hover:text-zinc-700 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    ⠿
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setExpandedGroupId(
                        isExpanded
                          ? ""
                          : group.id
                      )
                    }
                    className="flex min-w-0 flex-1 items-center gap-4 text-left"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-sm font-black text-zinc-600">
                      {isExpanded
                        ? "−"
                        : "+"}
                    </span>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-lg font-black">
                          {
                            group.name
                          }
                        </h3>

                        <span
                          className={`rounded-md px-2 py-1 text-[10px] font-black uppercase ${
                            group.required
                              ? "bg-red-50 text-red-600"
                              : "bg-zinc-100 text-zinc-500"
                          }`}
                        >
                          {group.required
                            ? "Obrigatório"
                            : "Opcional"}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-zinc-500">
                        {optionCount}{" "}
                        {optionCount ===
                        1
                          ? "opção"
                          : "opções"}
                        {" · "}
                        máximo{" "}
                        {
                          group.max_select
                        }
                        {" · "}
                        {linkedProductsCount}{" "}
                        {linkedProductsCount ===
                        1
                          ? "produto"
                          : "produtos"}
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={
                      deleting ===
                      group.id
                    }
                    onClick={() =>
                      deleteGroup(
                        group
                      )
                    }
                    className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    Apagar
                  </button>
                </div>

                {/* CONTEÚDO SÓ QUANDO ABRIR */}

                {isExpanded && (
                  <div className="border-t border-zinc-100 p-4">
                    {/* OPÇÕES */}

                    <div className="flex items-center justify-between gap-4">
                      <h4 className="text-sm font-black">
                        Opções
                      </h4>

                      <span className="text-xs text-zinc-400">
                        {
                          optionCount
                        }{" "}
                        cadastradas
                      </span>
                    </div>

                    {optionCount ===
                    0 ? (
                      <div className="mt-3 rounded-xl bg-zinc-50 px-4 py-3 text-center text-xs text-zinc-500">
                        Nenhuma opção adicionada.
                      </div>
                    ) : (
                      <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200">
                        {(
                          group.options ??
                          []
                        ).map(
                          (
                            option,
                            index
                          ) => (
                            <div
                              key={
                                option.id
                              }
                              className={`flex flex-wrap items-center gap-3 px-4 py-3 ${
                                index >
                                0
                                  ? "border-t border-zinc-100"
                                  : ""
                              }`}
                            >
                              <div className="min-w-44 flex-1">
                                <p className="text-sm font-black">
                                  {
                                    option.name
                                  }
                                </p>

                                <p className="mt-0.5 text-xs font-bold text-green-600">
                                  {Number(
                                    option.price
                                  ) >
                                  0
                                    ? `+ ${money(
                                        option.price
                                      )}`
                                    : "Sem custo"}
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold text-zinc-400">
                                  Máx.
                                </span>

                                <div className="flex items-center overflow-hidden rounded-lg border border-zinc-200 bg-white">
                                  <button
                                    type="button"
                                    disabled={
                                      updatingMax ===
                                        option.id ||
                                      Number(
                                        option.max_quantity
                                      ) <=
                                        1
                                    }
                                    onClick={() =>
                                      updateMaxQuantity(
                                        option,
                                        Number(
                                          option.max_quantity
                                        ) -
                                          1
                                      )
                                    }
                                    className="flex h-8 w-8 items-center justify-center font-black transition hover:bg-zinc-50 disabled:text-zinc-300"
                                  >
                                    −
                                  </button>

                                  <span className="flex h-8 min-w-8 items-center justify-center border-x border-zinc-200 text-sm font-black">
                                    {
                                      option.max_quantity
                                    }
                                  </span>

                                  <button
                                    type="button"
                                    disabled={
                                      updatingMax ===
                                        option.id ||
                                      Number(
                                        option.max_quantity
                                      ) >=
                                        99
                                    }
                                    onClick={() =>
                                      updateMaxQuantity(
                                        option,
                                        Number(
                                          option.max_quantity
                                        ) +
                                          1
                                      )
                                    }
                                    className="flex h-8 w-8 items-center justify-center font-black transition hover:bg-zinc-50 disabled:text-zinc-300"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>

                              <button
                                type="button"
                                disabled={
                                  deleting ===
                                  option.id
                                }
                                onClick={() =>
                                  deleteOption(
                                    option
                                  )
                                }
                                className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-xs text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                              >
                                🗑
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    )}

                    {/* ADICIONAR OPÇÃO */}

                    <div className="mt-4 rounded-xl bg-zinc-50 p-4">
                      <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_130px_110px_auto]">
                        <div>
                          <label className="mb-1 block text-[11px] font-bold text-zinc-500">
                            Nova opção
                          </label>

                          <input
                            value={
                              optionNames[
                                group.id
                              ] ?? ""
                            }
                            onChange={(event) =>
                              setOptionNames(
                                (
                                  current
                                ) => ({
                                  ...current,

                                  [group.id]:
                                    event
                                      .target
                                      .value,
                                })
                              )
                            }
                            placeholder=""
                            className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold outline-none focus:border-red-500"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-[11px] font-bold text-zinc-500">
                            Preço
                          </label>

                          <div className="flex h-10 overflow-hidden rounded-lg border border-zinc-200 bg-white">
                            <span className="flex items-center px-2 text-xs font-bold text-zinc-400">
                              R$
                            </span>

                            <input
                              inputMode="decimal"
                              value={
                                optionPrices[
                                  group.id
                                ] ?? ""
                              }
                              onChange={(event) =>
                                setOptionPrices(
                                  (
                                    current
                                  ) => ({
                                    ...current,

                                    [group.id]:
                                      event
                                        .target
                                        .value,
                                  })
                                )
                              }
                              placeholder="0,00"
                              className="min-w-0 flex-1 px-1 text-sm outline-none"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="mb-1 block text-[11px] font-bold text-zinc-500">
                            Máximo
                          </label>

                          <input
                            type="number"
                            min={1}
                            max={99}
                            value={
                              optionMaxQuantities[
                                group.id
                              ] ?? "1"
                            }
                            onChange={(event) =>
                              setOptionMaxQuantities(
                                (
                                  current
                                ) => ({
                                  ...current,

                                  [group.id]:
                                    event
                                      .target
                                      .value,
                                })
                              )
                            }
                            className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold outline-none focus:border-red-500"
                          />
                        </div>

                        <button
                          type="button"
                          disabled={
                            addingOption ===
                            group.id
                          }
                          onClick={() =>
                            addOption(
                              group.id
                            )
                          }
                          className="h-10 self-end rounded-lg bg-zinc-900 px-4 text-sm font-black text-white disabled:bg-zinc-300"
                        >
                          {addingOption ===
                          group.id
                            ? "..."
                            : "Adicionar"}
                        </button>
                      </div>
                    </div>

                    {/* PRODUTOS */}

                    <div className="mt-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-black">
                              Usar nos produtos
                            </h4>

                            <button
                              type="button"
                              title="Pesquisar produto"
                              aria-label="Pesquisar produto"
                              onClick={() => {
                                const isOpen =
                                  productSearchOpenGroupId ===
                                  group.id;

                                setProductSearchOpenGroupId(
                                  isOpen
                                    ? ""
                                    : group.id
                                );

                                if (
                                  isOpen
                                ) {
                                  setProductSearchTerms(
                                    (
                                      current
                                    ) => ({
                                      ...current,

                                      [group.id]:
                                        "",
                                    })
                                  );
                                }
                              }}
                              className={`flex h-7 w-7 items-center justify-center rounded-lg border text-xs transition ${
                                productSearchOpenGroupId ===
                                group.id
                                  ? "border-zinc-900 bg-zinc-900 text-white"
                                  : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                              }`}
                            >
                              🔍
                            </button>
                          </div>

                          <p className="mt-0.5 text-xs text-zinc-500">
                            Marque onde este grupo deve aparecer.
                          </p>
                        </div>

                        <span className="text-xs font-bold text-zinc-400">
                          {linkedProductsCount} selecionados
                        </span>
                      </div>

                      {productSearchOpenGroupId ===
                        group.id && (
                        <div className="mt-3 flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3">
                          <span className="text-sm text-zinc-400">
                            🔍
                          </span>

                          <input
                            autoFocus
                            value={
                              productSearchTerm
                            }
                            onChange={(event) =>
                              setProductSearchTerms(
                                (
                                  current
                                ) => ({
                                  ...current,

                                  [group.id]:
                                    event.target.value,
                                })
                              )
                            }
                            placeholder="Pesquisar produto"
                            className="h-10 min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
                          />

                          {productSearchTerm && (
                            <button
                              type="button"
                              onClick={() =>
                                setProductSearchTerms(
                                  (
                                    current
                                  ) => ({
                                    ...current,

                                    [group.id]:
                                      "",
                                  })
                                )
                              }
                              className="rounded-lg px-2 py-1 text-xs font-black text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      )}

                      {products.length ===
                      0 ? (
                        <div className="mt-3 rounded-xl bg-zinc-50 p-3 text-xs text-zinc-500">
                          Nenhum produto cadastrado.
                        </div>
                      ) : (
                        <>
                          {visibleGroupProducts.length ===
                          0 ? (
                            <div className="mt-3 rounded-xl bg-zinc-50 px-4 py-4 text-center text-xs text-zinc-500">
                              Nenhum produto encontrado.
                            </div>
                          ) : (
                            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                          {visibleGroupProducts.map(
                            (
                              product
                            ) => {
                              const checked =
                                (
                                  product.addon_group_ids ??
                                  []
                                ).includes(
                                  group.id
                                );

                              const key =
                                `${product.id}-${group.id}`;

                              return (
                                <label
                                  key={
                                    product.id
                                  }
                                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                                    checked
                                      ? "border-red-300 bg-red-50"
                                      : "border-zinc-200 bg-white hover:bg-zinc-50"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={
                                      checked
                                    }
                                    disabled={
                                      linkingProduct ===
                                      key
                                    }
                                    onChange={() =>
                                      toggleProductGroup(
                                        product,
                                        group
                                      )
                                    }
                                    className="h-4 w-4 shrink-0 accent-red-600"
                                  />

                                  {product.image_url ? (
                                    <img
                                      src={
                                        product.image_url
                                      }
                                      alt={
                                        product.name
                                      }
                                      className="h-10 w-10 shrink-0 rounded-lg object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-lg">
                                      🍔
                                    </div>
                                  )}

                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-black">
                                      {
                                        product.name
                                      }
                                    </p>

                                    <p
                                      className={`mt-0.5 text-[10px] font-bold ${
                                        product.active
                                          ? "text-green-600"
                                          : "text-zinc-400"
                                      }`}
                                    >
                                      {product.active
                                        ? "Disponível"
                                        : "Indisponível"}
                                    </p>
                                  </div>
                                </label>
                              );
                            }
                          )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </section>
            );
          }
        )}
      </div>
    </div>
  );
}
