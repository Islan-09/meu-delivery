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

type Tab =
  | "categories"
  | "products";

type Category = {
  id: string;
  restaurant_id: string;
  name: string;
  sort_order: number;
  active: boolean;
  product_count: number | string;
};

type Product = {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  category: string | null;
  price: number | string;
  discount_percent?: number | string | null;
  image_url: string | null;
  active: boolean;
  created_at: string;
  badge_text?: string | null;
  badge_color?: string | null;
};

type ProductBadge = {
  product_id: string;
  badge_text: string | null;
  badge_color: string | null;
};

type ProductDiscount = {
  product_id: string;
  discount_percent: number | string | null;
};

function money(
  value: number | string | null
) {
  return Number(
    value ?? 0
  ).toLocaleString(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    }
  );
}

function productDiscountPercent(
  product: Product
) {
  const value = Number(
    product.discount_percent ?? 0
  );

  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, value));
}

function discountedProductPrice(
  product: Product
) {
  const base = Number(product.price ?? 0);
  const discount = productDiscountPercent(product);

  return Math.round(
    base * (1 - discount / 100) * 100
  ) / 100;
}

function imageExtension(
  type: string
) {
  if (type === "image/png") {
    return "png";
  }

  if (type === "image/webp") {
    return "webp";
  }

  return "jpg";
}

function storagePathFromUrl(
  url: string
) {
  const marker =
    "/storage/v1/object/public/product-images/";

  const index =
    url.indexOf(marker);

  if (index === -1) {
    return null;
  }

  return decodeURIComponent(
    url.substring(
      index + marker.length
    )
  );
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

function badgeClass(
  color:
    | string
    | null
    | undefined
) {
  switch (color) {
    case "pink":
      return "bg-pink-50 text-pink-700 ring-pink-200";

    case "blue":
      return "bg-blue-50 text-blue-700 ring-blue-200";

    case "green":
      return "bg-green-50 text-green-700 ring-green-200";

    case "orange":
      return "bg-orange-50 text-orange-700 ring-orange-200";

    case "purple":
      return "bg-purple-50 text-purple-700 ring-purple-200";

    case "gray":
      return "bg-zinc-100 text-zinc-700 ring-zinc-200";

    default:
      return "bg-red-50 text-red-700 ring-red-200";
  }
}

export default function CardapioSection() {
  const searchParams =
    useSearchParams();

  const restaurantId =
    searchParams.get(
      "restaurant"
    ) ?? "";

  // ==========================================
  // ABAS
  // ==========================================

  const [
    tab,
    setTab,
  ] = useState<Tab>(
    "products"
  );

  // ==========================================
  // CATEGORIAS
  // ==========================================

  const [
    categories,
    setCategories,
  ] = useState<Category[]>([]);

  const [
    categoriesLoading,
    setCategoriesLoading,
  ] = useState(true);

  const [
    showCategoryForm,
    setShowCategoryForm,
  ] = useState(false);

  const [
    categoryName,
    setCategoryName,
  ] = useState("");

  const [
    creatingCategory,
    setCreatingCategory,
  ] = useState(false);

  const [
    deletingCategory,
    setDeletingCategory,
  ] = useState("");

  const [
    editingCategory,
    setEditingCategory,
  ] = useState<Category | null>(null);

  const [
    editingCategoryName,
    setEditingCategoryName,
  ] = useState("");

  const [
    savingCategory,
    setSavingCategory,
  ] = useState(false);

  const [
    reorderingCategory,
    setReorderingCategory,
  ] = useState(false);

  const [
    draggingCategoryId,
    setDraggingCategoryId,
  ] = useState("");

  const dragOriginalOrderRef =
    useRef<Category[] | null>(
      null
    );

  const dragCurrentOrderRef =
    useRef<Category[] | null>(
      null
    );

  const dragDroppedRef =
    useRef(false);

  // ==========================================
  // PRODUTOS
  // ==========================================

  const [
    products,
    setProducts,
  ] = useState<Product[]>([]);

  const [
    productsLoading,
    setProductsLoading,
  ] = useState(true);

  const [
    showProductForm,
    setShowProductForm,
  ] = useState(false);

  const [
    editingProduct,
    setEditingProduct,
  ] = useState<Product | null>(
    null
  );

  const [
    savingProduct,
    setSavingProduct,
  ] = useState(false);

  const [
    changingActive,
    setChangingActive,
  ] = useState("");

  const [
    uploadingImage,
    setUploadingImage,
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
    editingBadgeProductId,
    setEditingBadgeProductId,
  ] = useState("");

  const [
    badgeText,
    setBadgeText,
  ] = useState("");

  const [
    badgeColor,
    setBadgeColor,
  ] = useState("red");

  const [
    savingBadge,
    setSavingBadge,
  ] = useState(false);

  // ==========================================
  // CAMPOS DO PRODUTO
  // ==========================================

  const [
    name,
    setName,
  ] = useState("");

  const [
    categoryId,
    setCategoryId,
  ] = useState("");

  const [
    description,
    setDescription,
  ] = useState("");

  const [
    price,
    setPrice,
  ] = useState("");

  const [
    discountPercent,
    setDiscountPercent,
  ] = useState("0");

  // ==========================================
  // MENSAGENS
  // ==========================================

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  // ==========================================
  // LIMPAR MENSAGENS
  // ==========================================

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  // ==========================================
  // GARANTIR LOJA SELECIONADA
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
  // CARREGAR CATEGORIAS
  // SOMENTE DA LOJA SELECIONADA
  // ==========================================

  const loadCategories =
    useCallback(
      async () => {
        if (
          !restaurantId
        ) {
          setCategories(
            []
          );

          setCategoriesLoading(
            false
          );

          return;
        }

        setCategoriesLoading(
          true
        );

        const {
          data,
          error:
            rpcError,
        } =
          await supabase.rpc(
            "get_my_restaurant_categories",
            {
              p_restaurant_id:
                restaurantId,
            }
          );

        if (
          rpcError
        ) {
          console.error(
            "Erro ao carregar categorias:",
            rpcError
          );

          setError(
            "Não foi possível carregar as categorias desta loja."
          );

          setCategoriesLoading(
            false
          );

          return;
        }

        const storeCategories =
          (
            data ??
            []
          ).filter(
            (
              category: Category
            ) =>
              category.restaurant_id ===
              restaurantId
          ) as Category[];

        const orderedCategories =
          [...storeCategories].sort(
            (a, b) =>
              Number(
                a.sort_order
              ) -
              Number(
                b.sort_order
              )
          );

        setCategories(
          orderedCategories
        );

        setCategoriesLoading(
          false
        );
      },
      [
        restaurantId,
      ]
    );

  // ==========================================
  // CARREGAR PRODUTOS
  // SOMENTE DA LOJA SELECIONADA
  // ==========================================

  const loadProducts =
    useCallback(
      async () => {
        if (
          !restaurantId
        ) {
          setProducts(
            []
          );

          setProductsLoading(
            false
          );

          return;
        }

        setProductsLoading(
          true
        );

        const {
          data,
          error:
            rpcError,
        } =
          await supabase.rpc(
            "get_my_restaurant_products_v2",
            {
              p_restaurant_id:
                restaurantId,
            }
          );

        if (
          rpcError
        ) {
          console.error(
            "Erro ao carregar produtos:",
            rpcError
          );

          setError(
            "Não foi possível carregar os produtos desta loja."
          );

          setProductsLoading(
            false
          );

          return;
        }

        const storeProducts =
          (
            data ??
            []
          ).filter(
            (
              product: Product
            ) =>
              product.restaurant_id ===
              restaurantId
          ) as Product[];

        const {
          data:
            badgeData,
          error:
            badgeError,
        } =
          await supabase.rpc(
            "get_my_restaurant_product_badges",
            {
              p_restaurant_id:
                restaurantId,
            }
          );

        if (
          badgeError
        ) {
          console.error(
            "Erro ao carregar destaques:",
            badgeError
          );
        }

        const {
          data:
            discountData,
          error:
            discountError,
        } =
          await supabase.rpc(
            "get_my_restaurant_product_discounts",
            {
              p_restaurant_id:
                restaurantId,
            }
          );

        if (
          discountError
        ) {
          console.error(
            "Erro ao carregar descontos:",
            discountError
          );
        }

        const discountMap =
          new Map<
            string,
            ProductDiscount
          >(
            (
              (discountData ??
                []) as ProductDiscount[]
            ).map(
              (
                item
              ) => [
                item.product_id,
                item,
              ]
            )
          );

        const badgeMap =
          new Map<
            string,
            ProductBadge
          >(
            (
              (badgeData ??
                []) as ProductBadge[]
            ).map(
              (
                item
              ) => [
                item.product_id,
                item,
              ]
            )
          );

        const productsWithBadges =
          storeProducts.map(
            (
              product
            ) => {
              const badge =
                badgeMap.get(
                  product.id
                );

              return {
                ...product,

                badge_text:
                  badge
                    ?.badge_text ??
                  null,

                badge_color:
                  badge
                    ?.badge_color ??
                  "red",

                discount_percent:
                  discountMap.get(
                    product.id
                  )?.discount_percent ??
                  0,
              };
            }
          );

        setProducts(
          productsWithBadges
        );

        setProductsLoading(
          false
        );
      },
      [
        restaurantId,
      ]
    );

  // ==========================================
  // PRIMEIRO CARREGAMENTO
  // ==========================================

  useEffect(() => {
    if (
      !restaurantId
    ) {
      setError(
        "Loja não informada. Volte para Minhas lojas e abra o painel novamente."
      );

      setCategoriesLoading(
        false
      );

      setProductsLoading(
        false
      );

      return;
    }

    setError("");
    setSuccess("");

    loadCategories();
    loadProducts();
  }, [
    restaurantId,
    loadCategories,
    loadProducts,
  ]);

  // ==========================================
  // CRIAR CATEGORIA
  // ==========================================

  async function handleCreateCategory(
    event: FormEvent
  ) {
    event.preventDefault();

    clearMessages();

    if (
      !ensureRestaurant()
    ) {
      return;
    }

    const cleanName =
      categoryName.trim();

    if (
      !cleanName
    ) {
      setError(
        "Digite o nome da categoria."
      );

      return;
    }

    setCreatingCategory(
      true
    );

    const {
      error:
        rpcError,
    } =
      await supabase.rpc(
        "create_my_restaurant_category",
        {
          p_restaurant_id:
            restaurantId,

          p_name:
            cleanName,
        }
      );

    if (
      rpcError
    ) {
      console.error(
        "Erro ao criar categoria:",
        rpcError
      );

      if (
        rpcError.message.includes(
          "CATEGORY_ALREADY_EXISTS"
        )
      ) {
        setError(
          "Essa categoria já existe nesta loja."
        );
      } else if (
        rpcError.message.includes(
          "RESTAURANT_NOT_FOUND"
        )
      ) {
        setError(
          "Essa loja não foi encontrada ou não pertence à sua conta."
        );
      } else {
        setError(
          "Não foi possível criar a categoria."
        );
      }

      setCreatingCategory(
        false
      );

      return;
    }

    setCategoryName(
      ""
    );

    setShowCategoryForm(
      false
    );

    await loadCategories();

    setSuccess(
      `Categoria "${cleanName}" criada com sucesso!`
    );

    setCreatingCategory(
      false
    );
  }

  // ==========================================
  // EDITAR CATEGORIA
  // ==========================================

  function openEditCategory(
    category: Category
  ) {
    clearMessages();

    if (
      category.restaurant_id !==
      restaurantId
    ) {
      setError(
        "Essa categoria não pertence à loja aberta."
      );

      return;
    }

    setEditingCategory(
      category
    );

    setEditingCategoryName(
      category.name
    );
  }

  function cancelEditCategory() {
    if (
      savingCategory
    ) {
      return;
    }

    setEditingCategory(
      null
    );

    setEditingCategoryName(
      ""
    );
  }

  async function saveCategoryName() {
    if (
      savingCategory ||
      !editingCategory
    ) {
      return;
    }

    clearMessages();

    if (
      !ensureRestaurant()
    ) {
      return;
    }

    if (
      editingCategory.restaurant_id !==
      restaurantId
    ) {
      setError(
        "Essa categoria não pertence à loja aberta."
      );

      return;
    }

    const cleanName =
      editingCategoryName.trim();

    if (
      !cleanName
    ) {
      setError(
        "Digite o nome da categoria."
      );

      return;
    }

    if (
      cleanName ===
      editingCategory.name
    ) {
      cancelEditCategory();
      return;
    }

    setSavingCategory(
      true
    );

    const {
      error:
        rpcError,
    } =
      await supabase.rpc(
        "update_my_restaurant_category",
        {
          p_restaurant_id:
            restaurantId,

          p_category_id:
            editingCategory.id,

          p_name:
            cleanName,
        }
      );

    if (
      rpcError
    ) {
      console.error(
        "Erro ao editar categoria:",
        rpcError
      );

      if (
        rpcError.message.includes(
          "CATEGORY_ALREADY_EXISTS"
        )
      ) {
        setError(
          "Já existe uma categoria com esse nome nesta loja."
        );
      } else if (
        rpcError.message.includes(
          "CATEGORY_NOT_FOUND"
        ) ||
        rpcError.message.includes(
          "RESTAURANT_NOT_FOUND"
        )
      ) {
        setError(
          "Essa categoria não foi encontrada nesta loja."
        );
      } else {
        setError(
          "Não foi possível editar a categoria."
        );
      }

      setSavingCategory(
        false
      );

      return;
    }

    setCategories(
      (current) =>
        current.map(
          (item) =>
            item.id ===
            editingCategory.id
              ? {
                  ...item,
                  name:
                    cleanName,
                }
              : item
        )
    );

    setSuccess(
      `Categoria alterada para "${cleanName}".`
    );

    setEditingCategory(
      null
    );

    setEditingCategoryName(
      ""
    );

    setSavingCategory(
      false
    );
  }

  // ==========================================
  // REORDENAR CATEGORIA ARRASTANDO
  // ==========================================

  function startCategoryDrag(
    event: DragEvent<HTMLDivElement>,
    category: Category
  ) {
    if (
      reorderingCategory ||
      savingCategory ||
      deletingCategory ||
      editingCategory
    ) {
      event.preventDefault();
      return;
    }

    if (
      category.restaurant_id !==
      restaurantId
    ) {
      event.preventDefault();
      setError(
        "Essa categoria não pertence à loja aberta."
      );
      return;
    }

    clearMessages();

    const originalOrder =
      categories.map(
        (item) => ({
          ...item,
        })
      );

    dragOriginalOrderRef.current =
      originalOrder;

    dragCurrentOrderRef.current =
      originalOrder;

    dragDroppedRef.current =
      false;

    setDraggingCategoryId(
      category.id
    );

    event.dataTransfer.effectAllowed =
      "move";

    event.dataTransfer.setData(
      "text/plain",
      category.id
    );
  }

  function dragCategoryOver(
    event: DragEvent<HTMLDivElement>,
    targetCategoryId: string
  ) {
    event.preventDefault();

    if (
      !draggingCategoryId ||
      draggingCategoryId ===
        targetCategoryId ||
      reorderingCategory
    ) {
      return;
    }

    event.dataTransfer.dropEffect =
      "move";

    setCategories(
      (current) => {
        const fromIndex =
          current.findIndex(
            (category) =>
              category.id ===
              draggingCategoryId
          );

        const toIndex =
          current.findIndex(
            (category) =>
              category.id ===
              targetCategoryId
          );

        if (
          fromIndex === -1 ||
          toIndex === -1 ||
          fromIndex === toIndex
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

        if (!moved) {
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
              category,
              position
            ) => ({
              ...category,
              sort_order:
                position + 1,
            })
          );

        dragCurrentOrderRef.current =
          normalizedOrder;

        return normalizedOrder;
      }
    );
  }

  async function finishCategoryDrop(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();

    if (
      !draggingCategoryId ||
      reorderingCategory
    ) {
      return;
    }

    dragDroppedRef.current =
      true;

    const originalOrder =
      dragOriginalOrderRef.current ??
      [...categories];

    const finalOrder =
      (
        dragCurrentOrderRef.current ??
        categories
      ).map(
        (category, position) => ({
          ...category,
          sort_order:
            position + 1,
        })
      );

    setDraggingCategoryId(
      ""
    );

    const originalIds =
      originalOrder.map(
        (category) =>
          category.id
      );

    const finalIds =
      finalOrder.map(
        (category) =>
          category.id
      );

    const orderChanged =
      originalIds.some(
        (id, index) =>
          id !== finalIds[index]
      );

    if (!orderChanged) {
      dragOriginalOrderRef.current =
        null;

      dragCurrentOrderRef.current =
        null;

      return;
    }

    setCategories(
      finalOrder
    );

    setReorderingCategory(
      true
    );

    const {
      error:
        rpcError,
    } =
      await supabase.rpc(
        "reorder_my_restaurant_categories",
        {
          p_restaurant_id:
            restaurantId,

          p_category_ids:
            finalIds,
        }
      );

    if (rpcError) {
      console.error(
        "Erro ao reordenar categorias:",
        rpcError
      );

      setCategories(
        originalOrder
      );

      setError(
        "Não foi possível alterar a ordem das categorias."
      );

      setReorderingCategory(
        false
      );

      dragOriginalOrderRef.current =
        null;

      dragCurrentOrderRef.current =
        null;

      return;
    }

    await loadCategories();

    setSuccess(
      "Ordem das categorias atualizada!"
    );

    setReorderingCategory(
      false
    );

    dragOriginalOrderRef.current =
      null;

    dragCurrentOrderRef.current =
      null;
  }

  function endCategoryDrag() {
    if (
      !dragDroppedRef.current &&
      dragOriginalOrderRef.current
    ) {
      setCategories(
        dragOriginalOrderRef.current
      );
    }

    setDraggingCategoryId(
      ""
    );

    dragOriginalOrderRef.current =
      null;

    dragCurrentOrderRef.current =
      null;

    dragDroppedRef.current =
      false;
  }

  // ==========================================
  // APAGAR CATEGORIA
  // ==========================================

  async function deleteCategory(
    category: Category
  ) {
    clearMessages();

    if (
      !ensureRestaurant()
    ) {
      return;
    }

    if (
      category.restaurant_id !==
      restaurantId
    ) {
      setError(
        "Essa categoria não pertence à loja aberta."
      );

      return;
    }

    const productCount =
      Number(
        category.product_count
      );

    if (
      productCount >
      0
    ) {
      setError(
        `Não é possível apagar "${category.name}" porque ela possui ${productCount} ${
          productCount ===
          1
            ? "produto"
            : "produtos"
        }. Mova os produtos para outra categoria primeiro.`
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Apagar a categoria "${category.name}"?\n\nEssa ação não poderá ser desfeita.`
      );

    if (
      !confirmed
    ) {
      return;
    }

    setDeletingCategory(
      category.id
    );

    const {
      error:
        rpcError,
    } =
      await supabase.rpc(
        "delete_my_restaurant_category",
        {
          p_restaurant_id:
            restaurantId,

          p_category_id:
            category.id,
        }
      );

    if (
      rpcError
    ) {
      console.error(
        "Erro ao apagar categoria:",
        rpcError
      );

      if (
        rpcError.message.includes(
          "CATEGORY_HAS_PRODUCTS"
        )
      ) {
        setError(
          "Esta categoria possui produtos. Mova os produtos para outra categoria antes de apagar."
        );
      } else if (
        rpcError.message.includes(
          "CATEGORY_NOT_FOUND"
        )
      ) {
        setError(
          "Essa categoria não pertence à loja aberta."
        );
      } else {
        setError(
          "Não foi possível apagar a categoria."
        );
      }

      setDeletingCategory(
        ""
      );

      return;
    }

    setCategories(
      (
        current
      ) =>
        current.filter(
          (
            item
          ) =>
            item.id !==
            category.id
        )
    );

    setSuccess(
      `Categoria "${category.name}" apagada com sucesso!`
    );

    setDeletingCategory(
      ""
    );
  }

  // ==========================================
  // LIMPAR FORMULÁRIO DO PRODUTO
  // ==========================================

  function clearProductForm() {
    setName(
      ""
    );

    setCategoryId(
      ""
    );

    setDescription(
      ""
    );

    setPrice(
      ""
    );

    setDiscountPercent(
      "0"
    );

    setEditingProduct(
      null
    );

    setShowProductForm(
      false
    );
  }

  // ==========================================
  // NOVO PRODUTO
  // ==========================================

  function openCreateProduct() {
    clearMessages();

    if (
      !ensureRestaurant()
    ) {
      return;
    }

    if (
      categories.length ===
      0
    ) {
      setTab(
        "categories"
      );

      setShowCategoryForm(
        true
      );

      setError(
        "Crie uma categoria antes de cadastrar um produto."
      );

      return;
    }

    setEditingProduct(
      null
    );

    setName(
      ""
    );

    setCategoryId(
      categories.find(
        (
          category
        ) =>
          category.active
      )?.id ??
        ""
    );

    setDescription(
      ""
    );

    setPrice(
      ""
    );

    setDiscountPercent(
      "0"
    );

    setShowProductForm(
      true
    );
  }

  // ==========================================
  // EDITAR PRODUTO
  // ==========================================

  function openEditProduct(
    product: Product
  ) {
    clearMessages();

    if (
      product.restaurant_id !==
      restaurantId
    ) {
      setError(
        "Esse produto não pertence à loja aberta."
      );

      return;
    }

    setEditingProduct(
      product
    );

    setName(
      product.name
    );

    setCategoryId(
      product.category_id ??
        ""
    );

    setDescription(
      product.description ??
        ""
    );

    setPrice(
      Number(
        product.price
      )
        .toFixed(
          2
        )
        .replace(
          ".",
          ","
        )
    );

    setDiscountPercent(
      String(
        Number(
          product.discount_percent ?? 0
        )
      )
    );

    setShowProductForm(
      true
    );

    window.scrollTo({
      top: 0,
      behavior:
        "smooth",
    });
  }

  // ==========================================
  // SALVAR PRODUTO
  // ==========================================

  async function handleSaveProduct(
    event: FormEvent
  ) {
    event.preventDefault();

    clearMessages();

    if (
      !ensureRestaurant()
    ) {
      return;
    }

    if (
      !name.trim()
    ) {
      setError(
        "Digite o nome do produto."
      );

      return;
    }

    if (
      !categoryId
    ) {
      setError(
        "Escolha uma categoria."
      );

      return;
    }

    const selectedCategory =
      categories.find(
        (
          category
        ) =>
          category.id ===
          categoryId
      );

    if (
      !selectedCategory ||
      selectedCategory.restaurant_id !==
        restaurantId
    ) {
      setError(
        "A categoria escolhida não pertence à loja aberta."
      );

      return;
    }

    const parsedPrice =
      Number(
        price
          .replace(
            ",",
            "."
          )
          .trim()
      );

    if (
      !Number.isFinite(
        parsedPrice
      ) ||
      parsedPrice <
        0
    ) {
      setError(
        "Digite um preço válido."
      );

      return;
    }

    const parsedDiscount =
      Number(
        (discountPercent || "0")
          .replace(
            ",",
            "."
          )
          .trim()
      );

    if (
      !Number.isFinite(
        parsedDiscount
      ) ||
      parsedDiscount < 0 ||
      parsedDiscount > 100
    ) {
      setError(
        "Digite um desconto entre 0% e 100%."
      );

      return;
    }

    setSavingProduct(
      true
    );

    // ======================================
    // EDITAR
    // ======================================

    if (
      editingProduct
    ) {
      if (
        editingProduct.restaurant_id !==
        restaurantId
      ) {
        setError(
          "Esse produto não pertence à loja aberta."
        );

        setSavingProduct(
          false
        );

        return;
      }

      const {
        error:
          rpcError,
      } =
        await supabase.rpc(
          "update_my_restaurant_product_v2",
          {
            p_restaurant_id:
              restaurantId,

            p_product_id:
              editingProduct.id,

            p_name:
              name.trim(),

            p_description:
              description.trim(),

            p_category_id:
              categoryId,

            p_price:
              parsedPrice,
          }
        );

      if (
        rpcError
      ) {
        console.error(
          "Erro ao editar produto:",
          rpcError
        );

        if (
          rpcError.message.includes(
            "PRODUCT_NOT_FOUND"
          )
        ) {
          setError(
            "Esse produto não pertence à loja aberta."
          );
        } else if (
          rpcError.message.includes(
            "INVALID_CATEGORY"
          )
        ) {
          setError(
            "A categoria escolhida é inválida para esta loja."
          );
        } else {
          setError(
            "Não foi possível salvar as alterações."
          );
        }

        setSavingProduct(
          false
        );

        return;
      }

      const {
        error:
          discountError,
      } =
        await supabase.rpc(
          "set_my_restaurant_product_discount",
          {
            p_restaurant_id:
              restaurantId,

            p_product_id:
              editingProduct.id,

            p_discount_percent:
              parsedDiscount,
          }
        );

      if (
        discountError
      ) {
        console.error(
          "Erro ao salvar desconto:",
          discountError
        );

        setError(
          "O produto foi atualizado, mas não foi possível salvar o desconto."
        );

        setSavingProduct(
          false
        );

        return;
      }

      clearProductForm();

      await Promise.all([
        loadProducts(),
        loadCategories(),
      ]);

      setSuccess(
        "Produto atualizado com sucesso!"
      );

      setSavingProduct(
        false
      );

      return;
    }

    // ======================================
    // CRIAR
    // ======================================

    const {
      error:
        rpcError,
    } =
      await supabase.rpc(
        "create_my_restaurant_product_v2",
        {
          p_restaurant_id:
            restaurantId,

          p_name:
            name.trim(),

          p_description:
            description.trim(),

          p_category_id:
            categoryId,

          p_price:
            parsedPrice,
        }
      );

    if (
      rpcError
    ) {
      console.error(
        "Erro ao criar produto:",
        rpcError
      );

      if (
        rpcError.message.includes(
          "INVALID_CATEGORY"
        )
      ) {
        setError(
          "A categoria escolhida é inválida para esta loja."
        );
      } else if (
        rpcError.message.includes(
          "RESTAURANT_NOT_FOUND"
        )
      ) {
        setError(
          "Essa loja não foi encontrada ou não pertence à sua conta."
        );
      } else {
        setError(
          "Não foi possível cadastrar o produto."
        );
      }

      setSavingProduct(
        false
      );

      return;
    }

    if (
      parsedDiscount > 0
    ) {
      const {
        data:
          createdProducts,
        error:
          createdProductsError,
      } =
        await supabase.rpc(
          "get_my_restaurant_products_v2",
          {
            p_restaurant_id:
              restaurantId,
          }
        );

      if (
        createdProductsError
      ) {
        console.error(
          "Erro ao localizar produto criado para desconto:",
          createdProductsError
        );
      } else {
        const createdProduct =
          (
            (createdProducts ??
              []) as Product[]
          )
            .filter(
              (product) =>
                product.restaurant_id === restaurantId &&
                product.category_id === categoryId &&
                product.name.trim() === name.trim()
            )
            .sort(
              (a, b) =>
                new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime()
            )[0];

        if (
          createdProduct
        ) {
          const {
            error:
              discountError,
          } =
            await supabase.rpc(
              "set_my_restaurant_product_discount",
              {
                p_restaurant_id:
                  restaurantId,

                p_product_id:
                  createdProduct.id,

                p_discount_percent:
                  parsedDiscount,
              }
            );

          if (
            discountError
          ) {
            console.error(
              "Erro ao salvar desconto do produto novo:",
              discountError
            );
          }
        }
      }
    }

    clearProductForm();

    await Promise.all([
      loadProducts(),
      loadCategories(),
    ]);

    setSuccess(
      "Produto cadastrado com sucesso!"
    );

    setSavingProduct(
      false
    );
  }

  // ==========================================
  // DESTAQUE / SELO DO PRODUTO
  // ==========================================

  function openBadgeEditor(
    product: Product
  ) {
    clearMessages();

    setEditingBadgeProductId(
      product.id
    );

    setBadgeText(
      product.badge_text ??
        ""
    );

    setBadgeColor(
      product.badge_color ??
        "red"
    );
  }

  function closeBadgeEditor() {
    if (
      savingBadge
    ) {
      return;
    }

    setEditingBadgeProductId(
      ""
    );

    setBadgeText(
      ""
    );

    setBadgeColor(
      "red"
    );
  }

  async function saveProductBadge(
    product: Product
  ) {
    if (
      savingBadge
    ) {
      return;
    }

    clearMessages();

    const cleanText =
      badgeText.trim();

    if (
      cleanText.length >
      40
    ) {
      setError(
        "O destaque pode ter no máximo 40 caracteres."
      );

      return;
    }

    setSavingBadge(
      true
    );

    const {
      error:
        rpcError,
    } =
      await supabase.rpc(
        "set_my_restaurant_product_badge",
        {
          p_restaurant_id:
            restaurantId,

          p_product_id:
            product.id,

          p_badge_text:
            cleanText ||
            null,

          p_badge_color:
            badgeColor,
        }
      );

    if (
      rpcError
    ) {
      console.error(
        "Erro ao salvar destaque:",
        rpcError
      );

      setError(
        "Não foi possível salvar o destaque do produto."
      );

      setSavingBadge(
        false
      );

      return;
    }

    setProducts(
      (
        current
      ) =>
        current.map(
          (
            item
          ) =>
            item.id ===
            product.id
              ? {
                  ...item,

                  badge_text:
                    cleanText ||
                    null,

                  badge_color:
                    badgeColor,
                }
              : item
        )
    );

    setSuccess(
      cleanText
        ? `Destaque "${cleanText}" salvo em ${product.name}.`
        : `Destaque removido de ${product.name}.`
    );

    setEditingBadgeProductId(
      ""
    );

    setBadgeText(
      ""
    );

    setBadgeColor(
      "red"
    );

    setSavingBadge(
      false
    );
  }

  // ==========================================
  // DISPONIBILIDADE
  // ==========================================

  async function toggleAvailability(
    product: Product
  ) {
    clearMessages();

    if (
      !ensureRestaurant()
    ) {
      return;
    }

    if (
      product.restaurant_id !==
      restaurantId
    ) {
      setError(
        "Esse produto não pertence à loja aberta."
      );

      return;
    }

    setChangingActive(
      product.id
    );

    const newActive =
      !product.active;

    const {
      error:
        rpcError,
    } =
      await supabase.rpc(
        "set_my_restaurant_product_active",
        {
          p_restaurant_id:
            restaurantId,

          p_product_id:
            product.id,

          p_active:
            newActive,
        }
      );

    if (
      rpcError
    ) {
      console.error(
        "Erro disponibilidade:",
        rpcError
      );

      setError(
        "Não foi possível alterar a disponibilidade."
      );

      setChangingActive(
        ""
      );

      return;
    }

    setProducts(
      (
        current
      ) =>
        current.map(
          (
            item
          ) =>
            item.id ===
            product.id
              ? {
                  ...item,
                  active:
                    newActive,
                }
              : item
        )
    );

    setSuccess(
      newActive
        ? `${product.name} está disponível novamente.`
        : `${product.name} foi marcado como indisponível.`
    );

    setChangingActive(
      ""
    );
  }

  // ==========================================
  // FOTO DO PRODUTO
  // ==========================================

  async function uploadProductImage(
    product: Product,
    file: File
  ) {
    clearMessages();

    if (
      !ensureRestaurant()
    ) {
      return;
    }

    if (
      product.restaurant_id !==
      restaurantId
    ) {
      setError(
        "Esse produto não pertence à loja aberta."
      );

      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (
      !allowedTypes.includes(
        file.type
      )
    ) {
      setError(
        "Escolha uma imagem JPG, PNG ou WEBP."
      );

      return;
    }

    const maxSize =
      5 *
      1024 *
      1024;

    if (
      file.size >
      maxSize
    ) {
      setError(
        "A imagem precisa ter no máximo 5 MB."
      );

      return;
    }

    setUploadingImage(
      product.id
    );

    const extension =
      imageExtension(
        file.type
      );

    const filePath =
      `${restaurantId}/${product.id}/${Date.now()}.${extension}`;

    const {
      error:
        uploadError,
    } =
      await supabase.storage
        .from(
          "product-images"
        )
        .upload(
          filePath,
          file,
          {
            cacheControl:
              "3600",

            upsert:
              false,

            contentType:
              file.type,
          }
        );

    if (
      uploadError
    ) {
      console.error(
        "Erro ao enviar imagem:",
        uploadError
      );

      setError(
        "Não foi possível enviar a foto."
      );

      setUploadingImage(
        ""
      );

      return;
    }

    const {
      data:
        publicUrlData,
    } =
      supabase.storage
        .from(
          "product-images"
        )
        .getPublicUrl(
          filePath
        );

    const publicUrl =
      publicUrlData.publicUrl;

    const {
      error:
        rpcError,
    } =
      await supabase.rpc(
        "update_my_restaurant_product_image",
        {
          p_restaurant_id:
            restaurantId,

          p_product_id:
            product.id,

          p_image_url:
            publicUrl,
        }
      );

    if (
      rpcError
    ) {
      console.error(
        "Erro ao salvar foto:",
        rpcError
      );

      await supabase.storage
        .from(
          "product-images"
        )
        .remove([
          filePath,
        ]);

      setError(
        "Não foi possível vincular a foto ao produto."
      );

      setUploadingImage(
        ""
      );

      return;
    }

    // ======================================
    // APAGAR FOTO ANTIGA
    // ======================================

    if (
      product.image_url
    ) {
      const oldPath =
        storagePathFromUrl(
          product.image_url
        );

      if (
        oldPath &&
        oldPath !==
          filePath
      ) {
        const {
          error:
            deleteError,
        } =
          await supabase.storage
            .from(
              "product-images"
            )
            .remove([
              oldPath,
            ]);

        if (
          deleteError
        ) {
          console.error(
            "Erro ao apagar foto antiga:",
            deleteError
          );
        }
      }
    }

    setProducts(
      (
        current
      ) =>
        current.map(
          (
            item
          ) =>
            item.id ===
            product.id
              ? {
                  ...item,
                  image_url:
                    publicUrl,
                }
              : item
        )
    );

    setSuccess(
      product.image_url
        ? `Foto de ${product.name} alterada com sucesso!`
        : `Foto de ${product.name} adicionada com sucesso!`
    );

    setUploadingImage(
      ""
    );
  }

  // ==========================================
  // PESQUISA DE PRODUTOS
  // ==========================================

  const normalizedProductSearch =
    normalizeSearchText(
      searchTerm
    );

  const filteredProducts =
    normalizedProductSearch
      ? products.filter(
          (
            product
          ) =>
            normalizeSearchText(
              product.name
            ).includes(
              normalizedProductSearch
            ) ||
            normalizeSearchText(
              product.category
            ).includes(
              normalizedProductSearch
            )
        )
      : products;

  // ==========================================
  // TELA
  // ==========================================

  return (
    <div>
      {/* CABEÇALHO */}

      <div>
        <p className="text-sm font-black text-red-600">
          CARDÁPIO
        </p>

        <h2 className="mt-1 text-3xl font-black">
          Gerenciar cardápio
        </h2>

        <p className="mt-1 text-zinc-500">
          Organize as categorias e produtos somente da loja aberta.
        </p>
      </div>

      {/* ABAS */}

      <div className="mt-6 inline-flex rounded-2xl bg-zinc-200 p-1">
        <button
          type="button"
          onClick={() => {
            setTab(
              "categories"
            );

            clearMessages();
          }}
          className={`rounded-xl px-6 py-3 text-sm font-black transition ${
            tab ===
            "categories"
              ? "bg-white text-red-600 shadow-sm"
              : "text-zinc-500"
          }`}
        >
          Categorias
        </button>

        <button
          type="button"
          onClick={() => {
            setTab(
              "products"
            );

            clearMessages();
          }}
          className={`rounded-xl px-6 py-3 text-sm font-black transition ${
            tab ===
            "products"
              ? "bg-white text-red-600 shadow-sm"
              : "text-zinc-500"
          }`}
        >
          Produtos
        </button>
      </div>

      {/* MENSAGENS */}

      {success && (
        <div className="mt-5 rounded-xl bg-green-50 p-4 text-sm font-bold text-green-700">
          ✅ {success}
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">
          ⚠️ {error}
        </div>
      )}

      {/* =====================================
          CATEGORIAS
      ===================================== */}

      {tab ===
        "categories" && (
        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-2xl font-black">
                Categorias
              </h3>

              <p className="mt-1 text-sm text-zinc-500">
                Separe seus produtos em grupos para organizar o cardápio.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowCategoryForm(
                  !showCategoryForm
                );

                clearMessages();
              }}
              className="rounded-xl bg-red-600 px-5 py-3 font-black text-white"
            >
              {showCategoryForm
                ? "✕ Fechar"
                : "+ Nova categoria"}
            </button>
          </div>

          {showCategoryForm && (
            <form
              onSubmit={
                handleCreateCategory
              }
              className="mt-5 rounded-3xl bg-white p-6 shadow-sm"
            >
              <p className="text-xs font-black uppercase text-red-600">
                NOVA CATEGORIA
              </p>

              <h4 className="mt-1 text-xl font-black">
                Criar categoria
              </h4>

              <div className="mt-5">
                <label className="mb-2 block text-sm font-bold">
                  Nome da categoria *
                </label>

                <input
                  required
                  value={
                    categoryName
                  }
                  onChange={(event) =>
                    setCategoryName(
                      event.target.value
                    )
                  }
                  placeholder="Ex: Hambúrgueres"
                  className="w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-red-500"
                />
              </div>

              <button
                type="submit"
                disabled={
                  creatingCategory
                }
                className="mt-5 w-full rounded-xl bg-red-600 px-5 py-4 font-black text-white disabled:bg-zinc-300"
              >
                {creatingCategory
                  ? "Criando..."
                  : "Criar categoria"}
              </button>
            </form>
          )}

          {categoriesLoading && (
            <div className="mt-5 rounded-3xl bg-white p-10 text-center shadow-sm">
              <p className="font-bold">
                Carregando categorias...
              </p>
            </div>
          )}

          {!categoriesLoading &&
            categories.length ===
              0 && (
              <div className="mt-5 rounded-3xl bg-white p-10 text-center shadow-sm">
                <div className="text-5xl">
                  📂
                </div>

                <h4 className="mt-4 text-xl font-black">
                  Nenhuma categoria criada
                </h4>

                <p className="mt-2 text-zinc-500">
                  Crie categorias como Hambúrgueres, Bebidas, Porções ou Sobremesas.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setShowCategoryForm(
                      true
                    )
                  }
                  className="mt-5 rounded-xl bg-red-600 px-5 py-3 font-black text-white"
                >
                  + Criar primeira categoria
                </button>
              </div>
            )}

          {!categoriesLoading &&
            categories.length >
              0 && (
              <div className="mt-5 space-y-3">
                {categories.map(
                  (
                    category,
                    index
                  ) => {
                    const count =
                      Number(
                        category.product_count
                      );

                    return (
                      <div
                        key={
                          category.id
                        }
                        onDragOver={(event) =>
                          dragCategoryOver(
                            event,
                            category.id
                          )
                        }
                        onDrop={
                          finishCategoryDrop
                        }
                        className={`flex flex-wrap items-center justify-between gap-5 rounded-2xl bg-white p-5 shadow-sm transition ${
                          draggingCategoryId ===
                          category.id
                            ? "opacity-60 ring-2 ring-red-100"
                            : ""
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            role="button"
                            tabIndex={0}
                            draggable={
                              !reorderingCategory &&
                              !savingCategory &&
                              !deletingCategory &&
                              !editingCategory
                            }
                            onDragStart={(event) =>
                              startCategoryDrag(
                                event,
                                category
                              )
                            }
                            onDragEnd={
                              endCategoryDrag
                            }
                            title="Segure e arraste para mudar a posição"
                            aria-label={`Arrastar ${category.name} para outra posição`}
                            className={`flex h-11 w-8 shrink-0 select-none items-center justify-center rounded-xl border border-zinc-200 bg-white text-lg font-black text-zinc-400 transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-700 ${
                              reorderingCategory ||
                              savingCategory ||
                              deletingCategory ||
                              editingCategory
                                ? "cursor-not-allowed opacity-30"
                                : "cursor-grab active:cursor-grabbing"
                            }`}
                          >
                            ⠿
                          </div>

                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 font-black text-zinc-500">
                            {index +
                              1}
                          </div>

                          <div>
                            {editingCategory?.id ===
                            category.id ? (
                              <div className="min-w-[280px]">
                                <label className="mb-1 block text-xs font-black uppercase text-zinc-400">
                                  Nome da categoria
                                </label>

                                <input
                                  autoFocus
                                  value={
                                    editingCategoryName
                                  }
                                  disabled={
                                    savingCategory
                                  }
                                  onChange={(event) =>
                                    setEditingCategoryName(
                                      event.target.value
                                    )
                                  }
                                  onKeyDown={(event) => {
                                    if (
                                      event.key ===
                                      "Enter"
                                    ) {
                                      event.preventDefault();
                                      saveCategoryName();
                                    }

                                    if (
                                      event.key ===
                                      "Escape"
                                    ) {
                                      cancelEditCategory();
                                    }
                                  }}
                                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 font-bold outline-none transition focus:border-red-500 disabled:bg-zinc-100"
                                />

                                <p className="mt-1 text-sm text-zinc-500">
                                  {count}{" "}
                                  {count ===
                                  1
                                    ? "produto"
                                    : "produtos"}
                                </p>
                              </div>
                            ) : (
                              <div>
                                <p className="text-lg font-black">
                                  {
                                    category.name
                                  }
                                </p>

                                <p className="mt-1 text-sm text-zinc-500">
                                  {count}{" "}
                                  {count ===
                                  1
                                    ? "produto"
                                    : "produtos"}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-black ${
                              category.active
                                ? "bg-green-50 text-green-700"
                                : "bg-zinc-100 text-zinc-500"
                            }`}
                          >
                            {category.active
                              ? "● Ativa"
                              : "● Inativa"}
                          </span>

                          {editingCategory?.id ===
                          category.id ? (
                            <>
                              <button
                                type="button"
                                disabled={
                                  savingCategory
                                }
                                onClick={
                                  saveCategoryName
                                }
                                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-black text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
                              >
                                {savingCategory
                                  ? "Salvando..."
                                  : "Salvar"}
                              </button>

                              <button
                                type="button"
                                disabled={
                                  savingCategory
                                }
                                onClick={
                                  cancelEditCategory
                                }
                                className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-bold text-zinc-600 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-300"
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={
                                  deletingCategory ===
                                  category.id ||
                                  savingCategory ||
                                  reorderingCategory
                                }
                                onClick={() =>
                                  openEditCategory(
                                    category
                                  )
                                }
                                className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-bold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-300"
                              >
                                ✏️ Editar
                              </button>

                              <button
                                type="button"
                                disabled={
                                  deletingCategory ===
                                  category.id ||
                                  savingCategory ||
                                  reorderingCategory
                                }
                                onClick={() =>
                                  deleteCategory(
                                    category
                                  )
                                }
                                className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
                              >
                                {deletingCategory ===
                                category.id
                                  ? "Apagando..."
                                  : "🗑️ Apagar"}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}
        </div>
      )}

      {/* =====================================
          PRODUTOS
      ===================================== */}

      {tab ===
        "products" && (
        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-2xl font-black">
                Produtos
              </h3>

              <p className="mt-1 text-sm text-zinc-500">
                Cadastre os itens vendidos por esta loja.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                title="Pesquisar produtos"
                aria-label="Pesquisar produtos"
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
                className={`flex h-12 w-12 items-center justify-center rounded-xl border text-xl font-black transition ${
                  searchOpen
                    ? "border-red-600 bg-red-600 text-white"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                🔍
              </button>

              <button
                type="button"
                onClick={() => {
                  if (
                    showProductForm
                  ) {
                    clearProductForm();
                  } else {
                    openCreateProduct();
                  }
                }}
                className="rounded-xl bg-red-600 px-5 py-3 font-black text-white"
              >
                {showProductForm
                  ? "✕ Fechar"
                  : "+ Novo produto"}
              </button>
            </div>
          </div>

          {searchOpen && (
            <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
                  🔍
                </span>

                <input
                  type="text"
                  value={
                    searchTerm
                  }
                  onChange={(
                    event
                  ) =>
                    setSearchTerm(
                      event.target.value
                    )
                  }
                  placeholder="Pesquisar produto"
                  autoFocus
                  className="w-full rounded-xl border border-zinc-200 bg-white py-3 pl-11 pr-12 font-semibold outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
                />

                {searchTerm && (
                  <button
                    type="button"
                    onClick={() =>
                      setSearchTerm(
                        ""
                      )
                    }
                    className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-zinc-400 hover:text-red-600"
                    aria-label="Limpar pesquisa"
                    title="Limpar pesquisa"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          )}

          {showProductForm && (
            <form
              onSubmit={
                handleSaveProduct
              }
              className="mt-5 rounded-3xl bg-white p-6 shadow-sm"
            >
              <p className="text-xs font-black uppercase text-red-600">
                {editingProduct
                  ? "EDITAR PRODUTO"
                  : "NOVO PRODUTO"}
              </p>

              <h4 className="mt-1 text-2xl font-black">
                {editingProduct
                  ? editingProduct.name
                  : "Cadastrar produto"}
              </h4>

              <div className="mt-6 grid gap-5 md:grid-cols-3">
                <div className="md:col-span-3">
                  <label className="mb-2 block text-sm font-bold">
                    Nome do produto *
                  </label>

                  <input
                    required
                    value={
                      name
                    }
                    onChange={(event) =>
                      setName(
                        event.target.value
                      )
                    }
                    placeholder=""
                    className="w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold">
                    Categoria *
                  </label>

                  <select
                    required
                    value={
                      categoryId
                    }
                    onChange={(event) =>
                      setCategoryId(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 outline-none focus:border-red-500"
                  >
                    <option value="">
                      Selecione
                    </option>

                    {categories
                      .filter(
                        (
                          category
                        ) =>
                          category.active
                      )
                      .map(
                        (
                          category
                        ) => (
                          <option
                            key={
                              category.id
                            }
                            value={
                              category.id
                            }
                          >
                            {
                              category.name
                            }
                          </option>
                        )
                      )}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold">
                    Preço *
                  </label>

                  <div className="flex overflow-hidden rounded-xl border border-zinc-200">
                    <span className="flex items-center bg-zinc-50 px-4 font-bold text-zinc-500">
                      R$
                    </span>

                    <input
                      required
                      inputMode="decimal"
                      value={
                        price
                      }
                      onChange={(event) =>
                        setPrice(
                          event.target.value
                        )
                      }
                      placeholder="19,90"
                      className="min-w-0 flex-1 px-4 py-3 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold">
                    Desconto (%)
                  </label>

                  <div className="flex overflow-hidden rounded-xl border border-zinc-200">
                    <input
                      inputMode="decimal"
                      value={
                        discountPercent
                      }
                      onChange={(event) =>
                        setDiscountPercent(
                          event.target.value
                        )
                      }
                      placeholder="0"
                      className="min-w-0 flex-1 px-4 py-3 outline-none"
                    />

                    <span className="flex items-center bg-zinc-50 px-4 font-black text-zinc-500">
                      %
                    </span>
                  </div>

                  {Number(
                    (discountPercent || "0").replace(
                      ",",
                      "."
                    )
                  ) > 0 &&
                    Number.isFinite(
                      Number(
                        price.replace(
                          ",",
                          "."
                        )
                      )
                    ) && (
                    <p className="mt-2 text-xs font-bold text-green-700">
                      Cliente paga {money(
                        Math.round(
                          Number(
                            price.replace(
                              ",",
                              "."
                            )
                          ) *
                            (1 -
                              Number(
                                (discountPercent || "0").replace(
                                  ",",
                                  "."
                                )
                              ) /
                                100) *
                            100
                        ) / 100
                      )}
                    </p>
                  )}
                </div>

                <div className="md:col-span-3">
                  <label className="mb-2 block text-sm font-bold">
                    Descrição
                  </label>

                  <textarea
                    rows={4}
                    value={
                      description
                    }
                    onChange={(event) =>
                      setDescription(
                        event.target.value
                      )
                    }
                    placeholder="Ex: Pão, carne, queijo e molho especial"
                    className="w-full resize-none rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={
                    savingProduct
                  }
                  className="flex-1 rounded-xl bg-red-600 px-5 py-4 font-black text-white disabled:bg-zinc-300"
                >
                  {savingProduct
                    ? "Salvando..."
                    : editingProduct
                      ? "Salvar alterações"
                      : "Cadastrar produto"}
                </button>

                {editingProduct && (
                  <button
                    type="button"
                    onClick={
                      clearProductForm
                    }
                    className="rounded-xl border border-zinc-200 px-6 py-4 font-black text-zinc-600"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          )}

          {productsLoading && (
            <div className="mt-5 rounded-3xl bg-white p-10 text-center shadow-sm">
              <p className="font-bold">
                Carregando produtos...
              </p>
            </div>
          )}

          {!productsLoading &&
            products.length ===
              0 && (
              <div className="mt-5 rounded-3xl bg-white p-10 text-center shadow-sm">
                <div className="text-5xl">
                  🍔
                </div>

                <h4 className="mt-4 text-xl font-black">
                  Seu cardápio está vazio
                </h4>

                <p className="mt-2 text-zinc-500">
                  Cadastre o primeiro produto desta loja.
                </p>

                <button
                  type="button"
                  onClick={
                    openCreateProduct
                  }
                  className="mt-5 rounded-xl bg-red-600 px-5 py-3 font-black text-white"
                >
                  + Cadastrar produto
                </button>
              </div>
            )}

          {!productsLoading &&
            products.length >
              0 &&
            searchOpen &&
            normalizedProductSearch &&
            filteredProducts.length ===
              0 && (
              <div className="mt-5 rounded-3xl bg-white p-10 text-center shadow-sm">
                <div className="text-5xl">
                  🔍
                </div>

                <h4 className="mt-4 text-xl font-black">
                  Nenhum produto encontrado
                </h4>

                <p className="mt-2 text-zinc-500">
                  Tente pesquisar outro nome de produto.
                </p>
              </div>
            )}

          {!productsLoading &&
            products.length >
              0 &&
            filteredProducts.length >
              0 && (
              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                {filteredProducts.map(
                  (
                    product
                  ) => (
                    <article
                      key={
                        product.id
                      }
                      className={`overflow-hidden rounded-3xl bg-white shadow-sm transition ${
                        product.active
                          ? ""
                          : "opacity-70"
                      }`}
                    >
                      <div className="flex">
                        <div className="flex h-44 w-44 shrink-0 items-center justify-center overflow-hidden bg-zinc-100 text-5xl">
                          {product.image_url ? (
                            <img
                              src={
                                product.image_url
                              }
                              alt={
                                product.name
                              }
                              className="h-full w-full object-cover"
                            />
                          ) : product.category ===
                            "Bebidas" ? (
                            "🥤"
                          ) : product.category ===
                            "Pizzas" ? (
                            "🍕"
                          ) : product.category ===
                            "Doces" ? (
                            "🍰"
                          ) : (
                            "🍔"
                          )}
                        </div>

                        <div className="min-w-0 flex-1 p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              {product.badge_text && (
                                <span
                                  className={`mb-2 inline-flex rounded-md px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ring-1 ${badgeClass(
                                    product.badge_color
                                  )}`}
                                >
                                  {
                                    product.badge_text
                                  }
                                </span>
                              )}

                              {product.category && (
                                <p className="text-xs font-black uppercase text-red-600">
                                  {
                                    product.category
                                  }
                                </p>
                              )}

                              <h4 className="mt-1 text-xl font-black">
                                {
                                  product.name
                                }
                              </h4>
                            </div>

                            <span
                              className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${
                                product.active
                                  ? "bg-green-50 text-green-700"
                                  : "bg-zinc-100 text-zinc-500"
                              }`}
                            >
                              {product.active
                                ? "● Disponível"
                                : "● Indisponível"}
                            </span>
                          </div>

                          {product.description && (
                            <p className="mt-3 line-clamp-2 text-sm text-zinc-500">
                              {
                                product.description
                              }
                            </p>
                          )}

                          <div className="mt-5">
                            {productDiscountPercent(
                              product
                            ) > 0 ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-bold text-zinc-400 line-through">
                                  {money(
                                    product.price
                                  )}
                                </span>

                                <span className="text-xl font-black text-green-700">
                                  {money(
                                    discountedProductPrice(
                                      product
                                    )
                                  )}
                                </span>

                                <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-black text-green-700">
                                  🔥 {productDiscountPercent(
                                    product
                                  )}% OFF
                                </span>
                              </div>
                            ) : (
                              <p className="text-xl font-black">
                                {money(
                                  product.price
                                )}
                              </p>
                            )}
                          </div>

                          {editingBadgeProductId ===
                            product.id && (
                            <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="font-black">
                                    Destaque do produto
                                  </p>

                                  <p className="mt-1 text-xs text-zinc-500">
                                    Use qualquer texto, como Recomendado, Edição limitada, Mais pedido ou Novidade.
                                  </p>
                                </div>

                                {badgeText.trim() && (
                                  <span
                                    className={`inline-flex rounded-md px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ring-1 ${badgeClass(
                                      badgeColor
                                    )}`}
                                  >
                                    {
                                      badgeText.trim()
                                    }
                                  </span>
                                )}
                              </div>

                              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px]">
                                <div>
                                  <label className="mb-1 block text-xs font-bold text-zinc-500">
                                    Texto
                                  </label>

                                  <input
                                    value={
                                      badgeText
                                    }
                                    maxLength={
                                      40
                                    }
                                    onChange={(event) =>
                                      setBadgeText(
                                        event.target.value
                                      )
                                    }
                                    placeholder=""
                                    className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 outline-none focus:border-red-500"
                                  />
                                </div>

                                <div>
                                  <label className="mb-1 block text-xs font-bold text-zinc-500">
                                    Cor
                                  </label>

                                  <select
                                    value={
                                      badgeColor
                                    }
                                    onChange={(event) =>
                                      setBadgeColor(
                                        event.target.value
                                      )
                                    }
                                    className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 outline-none focus:border-red-500"
                                  >
                                    <option value="red">
                                      Vermelho
                                    </option>

                                    <option value="pink">
                                      Rosa
                                    </option>

                                    <option value="blue">
                                      Azul
                                    </option>

                                    <option value="green">
                                      Verde
                                    </option>

                                    <option value="orange">
                                      Laranja
                                    </option>

                                    <option value="purple">
                                      Roxo
                                    </option>

                                    <option value="gray">
                                      Cinza
                                    </option>
                                  </select>
                                </div>
                              </div>

                              <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  disabled={
                                    savingBadge
                                  }
                                  onClick={() =>
                                    saveProductBadge(
                                      product
                                    )
                                  }
                                  className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-black text-white disabled:bg-zinc-300"
                                >
                                  {savingBadge
                                    ? "Salvando..."
                                    : badgeText.trim()
                                      ? "Salvar destaque"
                                      : "Remover destaque"}
                                </button>

                                <button
                                  type="button"
                                  disabled={
                                    savingBadge
                                  }
                                  onClick={
                                    closeBadgeEditor
                                  }
                                  className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-bold text-zinc-600 disabled:opacity-50"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          )}

                          <div className="mt-4">
                            <label
                              className={`inline-flex cursor-pointer items-center rounded-xl border border-zinc-200 px-4 py-2 text-sm font-bold ${
                                uploadingImage ===
                                product.id
                                  ? "pointer-events-none opacity-50"
                                  : ""
                              }`}
                            >
                              {uploadingImage ===
                              product.id
                                ? "⏳ Enviando..."
                                : product.image_url
                                  ? "📷 Trocar foto"
                                  : "📷 Adicionar foto"}

                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                disabled={
                                  uploadingImage ===
                                  product.id
                                }
                                onChange={async (
                                  event
                                ) => {
                                  const input =
                                    event.currentTarget;

                                  const file =
                                    input.files?.[0];

                                  if (
                                    file
                                  ) {
                                    await uploadProductImage(
                                      product,
                                      file
                                    );
                                  }

                                  input.value =
                                    "";
                                }}
                              />
                            </label>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                openEditProduct(
                                  product
                                )
                              }
                              className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-bold"
                            >
                              ✏️ Editar
                            </button>

                            <button
                              type="button"
                              disabled={
                                savingBadge
                              }
                              onClick={() =>
                                editingBadgeProductId ===
                                product.id
                                  ? closeBadgeEditor()
                                  : openBadgeEditor(
                                      product
                                    )
                              }
                              className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-bold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
                            >
                              🏷️{" "}
                              {product.badge_text
                                ? "Editar destaque"
                                : "Adicionar destaque"}
                            </button>

                            <button
                              type="button"
                              disabled={
                                changingActive ===
                                product.id
                              }
                              onClick={() =>
                                toggleAvailability(
                                  product
                                )
                              }
                              className={`rounded-xl px-4 py-2 text-sm font-bold ${
                                product.active
                                  ? "border border-red-200 text-red-600"
                                  : "bg-green-600 text-white"
                              }`}
                            >
                              {changingActive ===
                              product.id
                                ? "Alterando..."
                                : product.active
                                  ? "⏸ Deixar indisponível"
                                  : "▶ Tornar disponível"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  )
                )}
              </div>
            )}
        </div>
      )}
    </div>
  );
}
