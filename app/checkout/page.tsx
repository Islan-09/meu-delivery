"use client";

import Link from "next/link";

import {
  FormEvent,
  Suspense,
  useEffect,
  useState,
} from "react";

import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import { supabase } from "@/lib/supabase";

type CheckoutAddon = {
  group_id: string;
  group_name: string;

  option_id: string;
  option_name: string;

  price: number;
  quantity: number;
};

type CheckoutItem = {
  cart_key: string;

  id: string;
  name: string;

  original_base_price: number;
  base_price: number;
  discount_percent: number;
  unit_price: number;

  quantity: number;

  addons: CheckoutAddon[];

  notes: string;
};

type Restaurant = {
  id: string;
  name: string;

  delivery_base_fee:
    | number
    | string;

  minimum_order:
    | number
    | string;

  orders_paused: boolean;
  pickup_paused: boolean;

  street: string | null;
  number: string | null;
  neighborhood: string | null;

  city: string | null;
  state: string | null;
};

type SavedAddress = {
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
};

type StoredCartAddon = {
  group_id?: string;
  group_name?: string;

  option_id?: string;
  option_name?: string;

  price?: number | string;
  quantity?: number;
};

type StoredCartItem = {
  product?: {
    id?: string;
    name?: string;
    price?: number | string;
  };

  quantity?: number;

  cart_key?: string;

  addons?: StoredCartAddon[];

  notes?: string;

  unit_price?: number | string;
};

type CurrentAddonOption = {
  id: string;
  name: string;
  price: number | string;
};

type CurrentAddonGroup = {
  group_id: string;
  name: string;

  options: CurrentAddonOption[];
};

type RestaurantOpenStatus = {
  is_open: boolean;

  current_day:
    | number
    | null;

  opens_at:
    | string
    | null;

  closes_at:
    | string
    | null;

  next_day:
    | number
    | null;

  next_opens_at:
    | string
    | null;
};

type FulfillmentMethod =
  | "delivery"
  | "pickup";

type PaymentMethod =
  | "pix"
  | "card";

type CouponPreview = {
  valid: boolean;
  message: string;

  coupon_id: string | null;
  code: string | null;

  discount_type:
    | "percent"
    | "fixed"
    | null;

  discount_value:
    | number
    | string
    | null;

  minimum_order:
    | number
    | string
    | null;

  discount_amount:
    | number
    | string;

  subtotal_after_coupon:
    | number
    | string;
};

const dayNames: Record<
  number,
  string
> = {
  0: "domingo",
  1: "segunda-feira",
  2: "terça-feira",
  3: "quarta-feira",
  4: "quinta-feira",
  5: "sexta-feira",
  6: "sábado",
};

function money(
  value:
    | number
    | string
    | null
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

function formatHour(
  value:
    | string
    | null
) {
  if (!value) {
    return "";
  }

  return value.slice(
    0,
    5
  );
}

function nextOpeningText(
  status:
    | RestaurantOpenStatus
    | null
) {
  if (
    !status ||
    status.is_open
  ) {
    return "";
  }

  if (
    status.next_day ===
      null ||
    !status.next_opens_at
  ) {
    return "O próximo horário de abertura ainda não foi informado.";
  }

  const dayName =
    dayNames[
      Number(
        status.next_day
      )
    ] ??
    "próximo dia";

  return `Abre novamente ${dayName} às ${formatHour(
    status.next_opens_at
  )}`;
}

function couponMessage(
  code: string,
  minimumOrder:
    | number
    | string
    | null =
      null
) {
  if (
    code ===
    "COUPON_NOT_FOUND"
  ) {
    return "Cupom não encontrado para esta loja.";
  }

  if (
    code ===
    "COUPON_INACTIVE"
  ) {
    return "Este cupom está desativado.";
  }

  if (
    code ===
    "COUPON_NOT_STARTED"
  ) {
    return "Este cupom ainda não começou.";
  }

  if (
    code ===
    "COUPON_EXPIRED"
  ) {
    return "Este cupom já expirou.";
  }

  if (
    code ===
      "MINIMUM_ORDER_NOT_REACHED" ||
    code ===
      "COUPON_MINIMUM_ORDER_NOT_REACHED"
  ) {
    return minimumOrder !==
      null
      ? `Este cupom exige pelo menos ${money(
          minimumOrder
        )} em produtos.`
      : "O valor mínimo deste cupom não foi atingido.";
  }

  if (
    code ===
    "COUPON_USAGE_LIMIT_REACHED"
  ) {
    return "Este cupom atingiu o limite de usos.";
  }

  if (
    code ===
    "COUPON_CUSTOMER_LIMIT_REACHED"
  ) {
    return "Você já utilizou este cupom.";
  }

  if (
    code ===
    "COUPON_FIRST_ORDER_ONLY"
  ) {
    return "Este cupom é válido somente para a primeira compra nesta loja.";
  }

  if (
    code ===
    "COUPON_CODE_REQUIRED"
  ) {
    return "Digite um cupom.";
  }

  return "Não foi possível aplicar este cupom.";
}

function restaurantAddressText(
  restaurant:
    | Restaurant
    | null
) {
  if (!restaurant) {
    return "";
  }

  const firstLine = [
    restaurant.street,
    restaurant.number,
  ]
    .filter(Boolean)
    .join(", ");

  const secondLine = [
    restaurant.neighborhood,
    restaurant.city,
    restaurant.state,
  ]
    .filter(Boolean)
    .join(" • ");

  return [
    firstLine,
    secondLine,
  ]
    .filter(Boolean)
    .join(" — ");
}

function CheckoutContent() {
  const router =
    useRouter();

  const searchParams =
    useSearchParams();

  const restaurantId =
    searchParams.get(
      "restaurant"
    );

  const [
    restaurant,
    setRestaurant,
  ] =
    useState<Restaurant | null>(
      null
    );

  const [
    items,
    setItems,
  ] =
    useState<CheckoutItem[]>(
      []
    );

  const [
    addresses,
    setAddresses,
  ] =
    useState<SavedAddress[]>(
      []
    );

  const [
    selectedAddressId,
    setSelectedAddressId,
  ] =
    useState("");

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
    cartIssue,
    setCartIssue,
  ] =
    useState("");

  // ==========================================
  // HORÁRIO
  // ==========================================

  const [
    openStatus,
    setOpenStatus,
  ] =
    useState<
      RestaurantOpenStatus | null
    >(null);

  const [
    openStatusLoading,
    setOpenStatusLoading,
  ] =
    useState(true);

  // ==========================================
  // PAGAMENTO
  // ==========================================

  const [
    paymentMethod,
    setPaymentMethod,
  ] =
    useState<PaymentMethod>(
      "pix"
    );

  // ==========================================
  // CUPOM
  // ==========================================

  const [
    couponInput,
    setCouponInput,
  ] =
    useState("");

  const [
    appliedCoupon,
    setAppliedCoupon,
  ] =
    useState<CouponPreview | null>(
      null
    );

  const [
    couponLoading,
    setCouponLoading,
  ] =
    useState(false);

  const [
    couponError,
    setCouponError,
  ] =
    useState("");

  // ==========================================
  // ENTREGA / RETIRADA
  // ==========================================

  const [
    fulfillmentMethod,
    setFulfillmentMethod,
  ] =
    useState<FulfillmentMethod>(
      "delivery"
    );

  // ==========================================
  // CARREGAR CHECKOUT
  // ==========================================

  useEffect(() => {
    async function loadCheckout() {
      setLoading(
        true
      );

      setOpenStatusLoading(
        true
      );

      setError(
        ""
      );

      setCartIssue(
        ""
      );

      setOpenStatus(
        null
      );

      setRestaurant(
        null
      );

      setItems(
        []
      );

      if (!restaurantId) {
        setError(
          "Restaurante não informado."
        );

        setOpenStatusLoading(
          false
        );

        setLoading(
          false
        );

        return;
      }

      // ======================================
      // LOGIN
      // ======================================

      const {
        data: {
          session,
        },
      } =
        await supabase.auth.getSession();

      if (!session) {
        sessionStorage.setItem(
          "after-login",
          `/checkout?restaurant=${restaurantId}`
        );

        router.replace(
          "/login"
        );

        return;
      }

      // ======================================
      // RESTAURANTE
      // ======================================

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
          .select(`
            id,
            name,
            delivery_base_fee,
            minimum_order,
            orders_paused,
            pickup_paused,
            street,
            number,
            neighborhood,
            city,
            state
          `)
          .eq(
            "id",
            restaurantId
          )
          .eq(
            "active",
            true
          )
          .single();

      if (
        restaurantError ||
        !restaurantData
      ) {
        console.error(
          "Erro restaurante:",
          restaurantError
        );

        setError(
          "Restaurante não encontrado ou indisponível."
        );

        setOpenStatusLoading(
          false
        );

        setLoading(
          false
        );

        return;
      }

      const loadedRestaurant =
        restaurantData as Restaurant;

      setRestaurant(
        loadedRestaurant
      );

      // ======================================
      // ESCOLHER UMA MODALIDADE DISPONÍVEL
      // ======================================

      if (
        loadedRestaurant.orders_paused &&
        !loadedRestaurant.pickup_paused
      ) {
        setFulfillmentMethod(
          "pickup"
        );
      } else if (
        loadedRestaurant.pickup_paused &&
        !loadedRestaurant.orders_paused
      ) {
        setFulfillmentMethod(
          "delivery"
        );
      }

      // ======================================
      // HORÁRIO DA LOJA
      // ======================================

      const {
        data:
          statusData,

        error:
          statusError,
      } =
        await supabase.rpc(
          "get_restaurant_open_status",
          {
            p_restaurant_id:
              restaurantId,
          }
        );

      if (
        statusError
      ) {
        console.error(
          "Erro ao verificar horário:",
          statusError
        );

        setError(
          "Não foi possível verificar o horário da loja."
        );

        setOpenStatus(
          null
        );

        setOpenStatusLoading(
          false
        );

        setLoading(
          false
        );

        return;
      }

      const currentOpenStatus =
        Array.isArray(
          statusData
        ) &&
        statusData.length >
          0
          ? (
              statusData[0] as RestaurantOpenStatus
            )
          : null;

      if (
        !currentOpenStatus
      ) {
        setError(
          "Não foi possível verificar o horário da loja."
        );

        setOpenStatus(
          null
        );

        setOpenStatusLoading(
          false
        );

        setLoading(
          false
        );

        return;
      }

      setOpenStatus(
        currentOpenStatus
      );

      setOpenStatusLoading(
        false
      );

      // ======================================
      // ENDEREÇOS
      // ======================================

      const {
        data:
          addressData,

        error:
          addressError,
      } =
        await supabase
          .from(
            "addresses"
          )
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
            is_default
          `)
          .eq(
            "user_id",
            session.user.id
          )
          .order(
            "is_default",
            {
              ascending:
                false,
            }
          )
          .order(
            "created_at",
            {
              ascending:
                false,
            }
          );

      if (
        addressError
      ) {
        console.error(
          "Erro endereços:",
          addressError
        );

        setError(
          "Não foi possível carregar seus endereços."
        );

        setLoading(
          false
        );

        return;
      }

      const savedAddresses =
        (
          addressData ??
          []
        ) as SavedAddress[];

      setAddresses(
        savedAddresses
      );

      const defaultAddress =
        savedAddresses.find(
          (
            address
          ) =>
            address.is_default
        );

      if (
        defaultAddress
      ) {
        setSelectedAddressId(
          defaultAddress.id
        );
      } else if (
        savedAddresses.length >
        0
      ) {
        setSelectedAddressId(
          savedAddresses[0].id
        );
      }

      // ======================================
      // CARRINHO
      // ======================================

      const storageKey =
        `cart-${restaurantId}`;

      const saved =
        localStorage.getItem(
          storageKey
        );

      if (!saved) {
        setError(
          "Seu carrinho está vazio."
        );

        setLoading(
          false
        );

        return;
      }

      let parsed:
        StoredCartItem[];

      try {
        const result =
          JSON.parse(
            saved
          );

        if (
          !Array.isArray(
            result
          ) ||
          result.length ===
            0
        ) {
          setError(
            "Seu carrinho está vazio."
          );

          setLoading(
            false
          );

          return;
        }

        parsed =
          result as StoredCartItem[];
      } catch {
        setError(
          "Não foi possível carregar seu carrinho."
        );

        setLoading(
          false
        );

        return;
      }

      // ======================================
      // IDs DOS PRODUTOS
      // ======================================

      const productIds =
        Array.from(
          new Set(
            parsed
              .map(
                (
                  item
                ) =>
                  item.product?.id
              )
              .filter(
                (
                  value
                ): value is string =>
                  Boolean(
                    value
                  )
              )
          )
        );

      if (
        productIds.length ===
        0
      ) {
        setError(
          "Seu carrinho está vazio."
        );

        setLoading(
          false
        );

        return;
      }

      // ======================================
      // PRODUTOS
      // ======================================

      const {
        data:
          productData,

        error:
          productError,
      } =
        await supabase
          .from(
            "products"
          )
          .select(`
            id,
            name,
            price,
            discount_percent
          `)
          .eq(
            "restaurant_id",
            restaurantId
          )
          .eq(
            "active",
            true
          )
          .in(
            "id",
            productIds
          );

      if (
        productError
      ) {
        console.error(
          "Erro produtos:",
          productError
        );

        setError(
          "Erro ao carregar produtos."
        );

        setLoading(
          false
        );

        return;
      }

      const currentProductMap =
        new Map<
          string,
          {
            id: string;

            name: string;

            price:
              | number
              | string;

            discount_percent:
              | number
              | string
              | null;
          }
        >(
          (
            productData ??
            []
          ).map(
            (
              product
            ) => [
              product.id,
              product,
            ]
          )
        );

      // ======================================
      // ADICIONAIS
      // ======================================

      const productsWithAddons =
        Array.from(
          new Set(
            parsed
              .filter(
                (
                  item
                ) =>
                  Array.isArray(
                    item.addons
                  ) &&
                  (
                    item.addons ??
                    []
                  ).length >
                    0
              )
              .map(
                (
                  item
                ) =>
                  item.product?.id
              )
              .filter(
                (
                  value
                ): value is string =>
                  Boolean(
                    value
                  )
              )
          )
        );

      const addonOptionMaps =
        new Map<
          string,
          Map<
            string,
            {
              id: string;

              name: string;

              price: number;

              group_id: string;

              group_name: string;
            }
          >
        >();

      if (
        productsWithAddons.length >
        0
      ) {
        const addonResults =
          await Promise.all(
            productsWithAddons.map(
              async (
                productId
              ) => {
                const {
                  data,
                  error,
                } =
                  await supabase.rpc(
                    "get_product_addons",
                    {
                      p_product_id:
                        productId,
                    }
                  );

                return {
                  productId,
                  data,
                  error,
                };
              }
            )
          );

        for (
          const result
          of addonResults
        ) {
          if (
            result.error
          ) {
            console.error(
              "Erro adicionais:",
              result.error
            );

            setError(
              "Não foi possível atualizar os adicionais do carrinho."
            );

            setLoading(
              false
            );

            return;
          }

          const optionMap =
            new Map<
              string,
              {
                id: string;

                name: string;

                price: number;

                group_id: string;

                group_name: string;
              }
            >();

          const groups =
            Array.isArray(
              result.data
            )
              ? (
                  result.data as CurrentAddonGroup[]
                )
              : [];

          for (
            const group
            of groups
          ) {
            for (
              const option
              of group.options ??
              []
            ) {
              optionMap.set(
                option.id,
                {
                  id:
                    option.id,

                  name:
                    option.name,

                  price:
                    Number(
                      option.price
                    ),

                  group_id:
                    group.group_id,

                  group_name:
                    group.name,
                }
              );
            }
          }

          addonOptionMaps.set(
            result.productId,
            optionMap
          );
        }
      }

      // ======================================
      // MONTAR ITENS
      // ======================================

      const currentItems:
        CheckoutItem[] =
          [];

      let hasProblem =
        false;

      for (
        let index = 0;
        index <
        parsed.length;
        index++
      ) {
        const storedItem =
          parsed[index];

        const productId =
          storedItem.product
            ?.id;

        if (
          !productId
        ) {
          hasProblem =
            true;

          continue;
        }

        const product =
          currentProductMap.get(
            productId
          );

        if (!product) {
          hasProblem =
            true;

          continue;
        }

        const quantity =
          Math.max(
            1,

            Number(
              storedItem.quantity ??
                1
            )
          );

        const originalBasePrice =
          Number(
            product.price
          );

        const discountPercent =
          Math.min(
            100,
            Math.max(
              0,
              Number(
                product.discount_percent ?? 0
              ) || 0
            )
          );

        const basePrice =
          Math.round(
            originalBasePrice *
              (1 - discountPercent / 100) *
              100
          ) / 100;

        const normalizedAddons:
          CheckoutAddon[] =
            [];

        let addonTotal =
          0;

        const storedAddons =
          Array.isArray(
            storedItem.addons
          )
            ? storedItem.addons
            : [];

        const currentOptionMap =
          addonOptionMaps.get(
            productId
          );

        for (
          const storedAddon
          of storedAddons
        ) {
          const optionId =
            storedAddon.option_id;

          if (
            !optionId ||
            !currentOptionMap
          ) {
            hasProblem =
              true;

            continue;
          }

          const currentOption =
            currentOptionMap.get(
              optionId
            );

          if (
            !currentOption
          ) {
            hasProblem =
              true;

            continue;
          }

          const addonQuantity =
            Math.max(
              1,

              Number(
                storedAddon.quantity ??
                  1
              )
            );

          normalizedAddons.push({
            group_id:
              currentOption.group_id,

            group_name:
              currentOption.group_name,

            option_id:
              currentOption.id,

            option_name:
              currentOption.name,

            price:
              currentOption.price,

            quantity:
              addonQuantity,
          });

          addonTotal +=
            currentOption.price *
            addonQuantity;
        }

        const unitPrice =
          basePrice +
          addonTotal;

        currentItems.push({
          cart_key:
            storedItem.cart_key ||
            `${productId}|checkout|${index}`,

          id:
            product.id,

          name:
            product.name,

          original_base_price:
            originalBasePrice,

          base_price:
            basePrice,

          discount_percent:
            discountPercent,

          unit_price:
            unitPrice,

          quantity,

          addons:
            normalizedAddons,

          notes:
            (
              storedItem.notes ??
              ""
            )
              .trim()
              .slice(
                0,
                140
              ),
        });
      }

      if (
        currentItems.length ===
        0
      ) {
        setError(
          "Nenhum produto do carrinho está disponível."
        );

        setLoading(
          false
        );

        return;
      }

      if (
        hasProblem
      ) {
        setCartIssue(
          "Um produto ou adicional do seu carrinho não está mais disponível. Volte ao carrinho e monte o item novamente antes de finalizar."
        );
      }

      setItems(
        currentItems
      );

      setLoading(
        false
      );
    }

    loadCheckout();
  }, [
    restaurantId,
    router,
  ]);

  // ==========================================
  // MANTER UMA MODALIDADE DISPONÍVEL SE POSSÍVEL
  // ==========================================

  useEffect(() => {
    if (!restaurant) {
      return;
    }

    if (
      restaurant.orders_paused &&
      !restaurant.pickup_paused &&
      fulfillmentMethod ===
        "delivery"
    ) {
      setFulfillmentMethod(
        "pickup"
      );

      return;
    }

    if (
      restaurant.pickup_paused &&
      !restaurant.orders_paused &&
      fulfillmentMethod ===
        "pickup"
    ) {
      setFulfillmentMethod(
        "delivery"
      );
    }
  }, [
    restaurant,
    fulfillmentMethod,
  ]);

  // ==========================================
  // ATUALIZAR HORÁRIO + PAUSA
  // ==========================================

  useEffect(() => {
    if (
      !restaurantId
    ) {
      return;
    }

    async function refreshStoreState() {
      const [
        statusResponse,
        restaurantResponse,
      ] =
        await Promise.all([
          supabase.rpc(
            "get_restaurant_open_status",
            {
              p_restaurant_id:
                restaurantId,
            }
          ),

          supabase
            .from(
              "restaurants"
            )
            .select(`
              orders_paused,
              pickup_paused
            `)
            .eq(
              "id",
              restaurantId
            )
            .maybeSingle(),
        ]);

      if (
        statusResponse.error
      ) {
        console.error(
          "Erro ao atualizar horário:",
          statusResponse.error
        );
      } else {
        const result =
          Array.isArray(
            statusResponse.data
          ) &&
          statusResponse.data.length >
            0
            ? (
                statusResponse.data[0] as RestaurantOpenStatus
              )
            : null;

        if (
          result
        ) {
          setOpenStatus(
            result
          );

          setOpenStatusLoading(
            false
          );
        }
      }

      if (
        restaurantResponse.error
      ) {
        console.error(
          "Erro ao atualizar pausa:",
          restaurantResponse.error
        );
      } else if (
        restaurantResponse.data
      ) {
        const deliveryIsPaused =
          Boolean(
            restaurantResponse
              .data
              .orders_paused
          );

        const pickupIsPaused =
          Boolean(
            restaurantResponse
              .data
              .pickup_paused
          );

        setRestaurant(
          (
            current
          ) =>
            current
              ? {
                  ...current,

                  orders_paused:
                    deliveryIsPaused,

                  pickup_paused:
                    pickupIsPaused,
                }
              : current
        );
      }
    }

    const interval =
      window.setInterval(
        refreshStoreState,
        15000
      );

    return () => {
      window.clearInterval(
        interval
      );
    };
  }, [
    restaurantId,
  ]);

  // ==========================================
  // VALORES
  // ==========================================

  const subtotal =
    items.reduce(
      (
        sum,
        item
      ) =>
        sum +
        item.unit_price *
          item.quantity,
      0
    );

  const productDiscountTotal =
    items.reduce(
      (
        sum,
        item
      ) =>
        sum +
        Math.max(
          0,
          item.original_base_price -
            item.base_price
        ) *
          item.quantity,
      0
    );

  const couponDiscount =
    appliedCoupon
      ? Number(
          appliedCoupon
            .discount_amount ??
            0
        )
      : 0;

  const subtotalAfterCoupon =
    Math.max(
      0,
      subtotal -
        couponDiscount
    );

  const deliveryFee =
    fulfillmentMethod ===
    "pickup"
      ? 0
      : Number(
          restaurant
            ?.delivery_base_fee ??
            0
        );

  const total =
    subtotalAfterCoupon +
    deliveryFee;

  const minimumOrder =
    Number(
      restaurant
        ?.minimum_order ??
        0
    );

  const minimumReached =
    subtotal >=
    minimumOrder;

  // ==========================================
  // STATUS
  // ==========================================

  const storeIsOpen =
    openStatus
      ?.is_open ===
    true;

  const storeIsClosed =
    openStatus !==
      null &&
    !storeIsOpen;

  const nextOpening =
    nextOpeningText(
      openStatus
    );

  const deliveryPaused =
    Boolean(
      restaurant
        ?.orders_paused
    );

  const pickupPaused =
    Boolean(
      restaurant
        ?.pickup_paused
    );

  const allFulfillmentPaused =
    deliveryPaused &&
    pickupPaused;

  const selectedFulfillmentPaused =
    fulfillmentMethod ===
      "delivery"
      ? deliveryPaused
      : pickupPaused;

  // ==========================================
  // ENDEREÇO
  // ==========================================

  const selectedAddress =
    addresses.find(
      (
        address
      ) =>
        address.id ===
        selectedAddressId
    ) ??
    null;

  const selectedAddressHasLocation =
    selectedAddress?.lat !==
      null &&
    selectedAddress?.lat !==
      undefined &&
    selectedAddress?.long !==
      null &&
    selectedAddress?.long !==
      undefined;

  const needsAddress =
    fulfillmentMethod ===
    "delivery";

  // ==========================================
  // CUPOM
  // ==========================================

  async function applyCoupon() {
    if (
      !restaurantId
    ) {
      return;
    }

    const code =
      couponInput
        .trim()
        .toUpperCase();

    setCouponError(
      ""
    );

    if (!code) {
      setAppliedCoupon(
        null
      );

      setCouponError(
        "Digite um cupom."
      );

      return;
    }

    setCouponLoading(
      true
    );

    const {
      data,
      error:
        previewError,
    } =
      await supabase.rpc(
        "preview_restaurant_coupon",
        {
          p_restaurant_id:
            restaurantId,

          p_code:
            code,

          p_subtotal:
            Number(
              subtotal.toFixed(
                2
              )
            ),
        }
      );

    setCouponLoading(
      false
    );

    if (
      previewError
    ) {
      console.error(
        "Erro ao validar cupom:",
        previewError
      );

      setAppliedCoupon(
        null
      );

      setCouponError(
        "Não foi possível validar o cupom agora."
      );

      return;
    }

    const result =
      Array.isArray(
        data
      )
        ? (
            data[0] as
              | CouponPreview
              | undefined
          )
        : (
            data as
              | CouponPreview
              | null
          );

    if (
      !result ||
      result.valid !==
        true
    ) {
      setAppliedCoupon(
        null
      );

      setCouponError(
        couponMessage(
          result?.message ??
            "COUPON_NOT_FOUND",
          result?.minimum_order ??
            null
        )
      );

      return;
    }

    setCouponInput(
      result.code ??
        code
    );

    setAppliedCoupon(
      result
    );

    setCouponError(
      ""
    );
  }

  function removeCoupon() {
    setAppliedCoupon(
      null
    );

    setCouponInput(
      ""
    );

    setCouponError(
      ""
    );
  }

  // ==========================================
  // CONFIRMAR PEDIDO
  // ==========================================

  async function handleSubmit(
    event: FormEvent
  ) {
    event.preventDefault();

    if (
      !restaurantId ||
      !restaurant
    ) {
      return;
    }

    setError(
      ""
    );

    // ======================================
    // VERIFICAR HORÁRIO NOVAMENTE
    // ======================================

    const {
      data:
        latestStatusData,

      error:
        latestStatusError,
    } =
      await supabase.rpc(
        "get_restaurant_open_status",
        {
          p_restaurant_id:
            restaurantId,
        }
      );

    if (
      latestStatusError
    ) {
      console.error(
        "Erro verificando horário antes do pedido:",
        latestStatusError
      );

      setError(
        "Não foi possível verificar o horário da loja. Tente novamente."
      );

      return;
    }

    const latestStatus =
      Array.isArray(
        latestStatusData
      ) &&
      latestStatusData.length >
        0
        ? (
            latestStatusData[0] as RestaurantOpenStatus
          )
        : null;

    if (
      !latestStatus
    ) {
      setError(
        "Não foi possível verificar o horário da loja."
      );

      return;
    }

    setOpenStatus(
      latestStatus
    );

    if (
      !latestStatus.is_open
    ) {
      const openingText =
        nextOpeningText(
          latestStatus
        );

      setError(
        openingText
          ? `Esta loja está fechada. ${openingText}.`
          : "Esta loja está fechada no momento."
      );

      return;
    }

    // ======================================
    // VERIFICAR PAUSA NOVAMENTE
    // ======================================

    const {
      data:
        latestRestaurant,

      error:
        latestRestaurantError,
    } =
      await supabase
        .from(
          "restaurants"
        )
        .select(`
          orders_paused,
          pickup_paused
        `)
        .eq(
          "id",
          restaurantId
        )
        .maybeSingle();

    if (
      latestRestaurantError
    ) {
      console.error(
        "Erro verificando pausa:",
        latestRestaurantError
      );

      setError(
        "Não foi possível verificar se a loja está recebendo entregas. Tente novamente."
      );

      return;
    }

    const latestDeliveryPaused =
      Boolean(
        latestRestaurant
          ?.orders_paused
      );

    const latestPickupPaused =
      Boolean(
        latestRestaurant
          ?.pickup_paused
      );

    setRestaurant(
      (
        current
      ) =>
        current
          ? {
              ...current,

              orders_paused:
                latestDeliveryPaused,

              pickup_paused:
                latestPickupPaused,
            }
          : current
    );

    if (
      latestDeliveryPaused &&
      latestPickupPaused
    ) {
      setError(
        "A loja pausou entregas e retiradas temporariamente. Não é possível finalizar um novo pedido agora."
      );

      return;
    }

    if (
      latestDeliveryPaused &&
      fulfillmentMethod ===
        "delivery"
    ) {
      setFulfillmentMethod(
        "pickup"
      );

      setError(
        "A entrega foi pausada pela loja. Retirada na loja foi selecionada automaticamente."
      );

      return;
    }

    if (
      latestPickupPaused &&
      fulfillmentMethod ===
        "pickup"
    ) {
      setFulfillmentMethod(
        "delivery"
      );

      setError(
        "A retirada foi pausada pela loja. Entrega foi selecionada automaticamente."
      );

      return;
    }

    // ======================================
    // CARRINHO
    // ======================================

    if (
      cartIssue
    ) {
      setError(
        cartIssue
      );

      return;
    }

    if (
      items.length ===
      0
    ) {
      setError(
        "Seu carrinho está vazio."
      );

      return;
    }

    if (
      !minimumReached
    ) {
      setError(
        `O pedido mínimo desta loja é ${money(
          minimumOrder
        )}.`
      );

      return;
    }

    // ======================================
    // ENDEREÇO SÓ PARA ENTREGA
    // ======================================

    if (
      needsAddress &&
      !selectedAddress
    ) {
      setError(
        "Escolha um endereço de entrega."
      );

      return;
    }

    if (
      needsAddress &&
      !selectedAddressHasLocation
    ) {
      setError(
        "Ajuste a localização deste endereço no mapa antes de fazer o pedido."
      );

      return;
    }

    setSending(
      true
    );

    // ======================================
    // LOGIN
    // ======================================

    const {
      data: {
        session,
      },
    } =
      await supabase.auth.getSession();

    if (
      !session
    ) {
      sessionStorage.setItem(
        "after-login",
        `/checkout?restaurant=${restaurantId}`
      );

      router.push(
        "/login"
      );

      setSending(
        false
      );

      return;
    }

    // ======================================
    // ITENS
    //
    // NÃO MANDAMOS PREÇOS.
    // O SUPABASE RECALCULA.
    // ======================================

    const cartItems =
      items.map(
        (
          item
        ) => ({
          product_id:
            item.id,

          quantity:
            item.quantity,

          notes:
            item.notes ||
            null,

          addons:
            item.addons.map(
              (
                addon
              ) => ({
                option_id:
                  addon.option_id,

                quantity:
                  addon.quantity,
              })
            ),
        })
      );

    // ======================================
    // CRIAR PEDIDO
    // ======================================

    const {
      data,

      error:
        orderError,
    } =
      await supabase.rpc(
        "create_order_from_saved_address_with_coupon",
        {
          p_restaurant_id:
            restaurantId,

          p_address_id:
            fulfillmentMethod ===
              "delivery"
              ? selectedAddress
                  ?.id ??
                null
              : null,

          p_payment_method:
            paymentMethod,

          p_items:
            cartItems,

          p_fulfillment_method:
            fulfillmentMethod,

          p_coupon_code:
            appliedCoupon
              ?.code ??
            null,
        }
      );

    if (
      orderError
    ) {
      console.error(
        "Erro pedido:",
        orderError
      );

      const message =
        orderError.message;

      if (
        message.includes(
          "ADDRESS_REQUIRED"
        )
      ) {
        setError(
          "Escolha um endereço de entrega."
        );
      } else if (
        message.includes(
          "ADDRESS_LOCATION_REQUIRED"
        )
      ) {
        setError(
          "Esse endereço ainda precisa ter a localização ajustada no mapa."
        );
      } else if (
        message.includes(
          "ADDRESS_NOT_FOUND"
        )
      ) {
        setError(
          "O endereço escolhido não foi encontrado."
        );
      } else if (
        message.includes(
          "RESTAURANT_PAUSED_FOR_DELIVERY"
        )
      ) {
        setRestaurant(
          (
            current
          ) =>
            current
              ? {
                  ...current,

                  orders_paused:
                    true,
                }
              : current
        );

        if (
          !restaurant.pickup_paused
        ) {
          setFulfillmentMethod(
            "pickup"
          );

          setError(
            "A loja pausou as entregas. Você ainda pode finalizar escolhendo Retirada na loja."
          );
        } else {
          setError(
            "A loja pausou entregas e retiradas temporariamente. Não é possível finalizar um novo pedido agora."
          );
        }
      } else if (
        message.includes(
          "RESTAURANT_PAUSED_FOR_PICKUP"
        )
      ) {
        setRestaurant(
          (
            current
          ) =>
            current
              ? {
                  ...current,

                  pickup_paused:
                    true,
                }
              : current
        );

        if (
          !restaurant.orders_paused
        ) {
          setFulfillmentMethod(
            "delivery"
          );

          setError(
            "A loja pausou as retiradas. Você ainda pode finalizar escolhendo Entrega."
          );
        } else {
          setError(
            "A loja pausou entregas e retiradas temporariamente. Não é possível finalizar um novo pedido agora."
          );
        }
      } else if (
        message.includes(
          "RESTAURANT_CLOSED"
        )
      ) {
        setError(
          "Esta loja está fechada no momento."
        );
      } else if (
        message.includes(
          "INVALID_FULFILLMENT_METHOD"
        )
      ) {
        setError(
          "Escolha Entrega ou Retirada na loja."
        );
      } else if (
        message.includes(
          "PRODUCT_NOT_AVAILABLE"
        )
      ) {
        setError(
          "Um produto do carrinho ficou indisponível. Volte ao carrinho e tente novamente."
        );
      } else if (
        message.includes(
          "ADDON_NOT_AVAILABLE_FOR_PRODUCT"
        )
      ) {
        setError(
          "Um adicional escolhido não está mais disponível para este produto."
        );
      } else if (
        message.includes(
          "ADDON_MAX_QUANTITY_EXCEEDED"
        )
      ) {
        setError(
          "A quantidade de um adicional ultrapassou o máximo permitido."
        );
      } else if (
        message.includes(
          "ADDON_GROUP_MAXIMUM_EXCEEDED"
        )
      ) {
        setError(
          "Você ultrapassou o máximo de adicionais permitido."
        );
      } else if (
        message.includes(
          "ADDON_GROUP_MINIMUM_NOT_REACHED"
        )
      ) {
        setError(
          "Falta escolher um adicional obrigatório."
        );
      } else if (
        message.includes(
          "MINIMUM_ORDER_NOT_REACHED"
        )
      ) {
        setError(
          "O valor do pedido ficou abaixo do pedido mínimo da loja."
        );
      } else if (
        message.includes(
          "COUPON_NOT_FOUND"
        )
      ) {
        setAppliedCoupon(
          null
        );

        setCouponError(
          "Cupom não encontrado para esta loja."
        );

        setError(
          "O cupom não está mais disponível. Confira o cupom e tente novamente."
        );
      } else if (
        message.includes(
          "COUPON_INACTIVE"
        )
      ) {
        setAppliedCoupon(
          null
        );

        setCouponError(
          "Este cupom foi desativado."
        );

        setError(
          "O cupom foi desativado antes da finalização."
        );
      } else if (
        message.includes(
          "COUPON_NOT_STARTED"
        )
      ) {
        setAppliedCoupon(
          null
        );

        setCouponError(
          "Este cupom ainda não começou."
        );

        setError(
          "Este cupom ainda não pode ser utilizado."
        );
      } else if (
        message.includes(
          "COUPON_EXPIRED"
        )
      ) {
        setAppliedCoupon(
          null
        );

        setCouponError(
          "Este cupom já expirou."
        );

        setError(
          "O cupom expirou antes da finalização."
        );
      } else if (
        message.includes(
          "COUPON_MINIMUM_ORDER_NOT_REACHED"
        )
      ) {
        setAppliedCoupon(
          null
        );

        setCouponError(
          "O pedido não atingiu mais o valor mínimo do cupom."
        );

        setError(
          "O valor mínimo necessário para usar o cupom não foi atingido."
        );
      } else if (
        message.includes(
          "COUPON_USAGE_LIMIT_REACHED"
        )
      ) {
        setAppliedCoupon(
          null
        );

        setCouponError(
          "Este cupom atingiu o limite de usos."
        );

        setError(
          "O cupom atingiu o limite de utilizações."
        );
      } else if (
        message.includes(
          "COUPON_CUSTOMER_LIMIT_REACHED"
        )
      ) {
        setAppliedCoupon(
          null
        );

        setCouponError(
          "Você já utilizou este cupom."
        );

        setError(
          "Este cupom pode ser usado somente uma vez por cliente."
        );
      } else if (
        message.includes(
          "COUPON_FIRST_ORDER_ONLY"
        )
      ) {
        setAppliedCoupon(
          null
        );

        setCouponError(
          "Este cupom é válido somente para a primeira compra nesta loja."
        );

        setError(
          "Você já possui uma compra paga nesta loja e não pode usar este cupom."
        );
      } else if (
        message.includes(
          "NOTES_TOO_LONG"
        )
      ) {
        setError(
          "A observação de um produto está muito grande."
        );
      } else {
        setError(
          "Não foi possível finalizar o pedido. Tente novamente."
        );
      }

      setSending(
        false
      );

      return;
    }

    // ======================================
    // LIMPAR CARRINHO
    // ======================================

    localStorage.removeItem(
      `cart-${restaurantId}`
    );

    window.dispatchEvent(
      new Event(
        "cart-updated"
      )
    );

    const createdOrderId =
      String(
        data
      );

    setSending(
      false
    );

    router.push(
      `/pagamento?order=${createdOrderId}`
    );
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
          Carregando seu pedido...
        </p>
      </main>
    );
  }

  // ==========================================
  // LOJA FECHADA PELO HORÁRIO
  // ==========================================

  if (
    storeIsClosed
  ) {
    return (
      <main className="min-h-screen bg-[#f7f7f7] text-zinc-900">
        <header className="border-b border-zinc-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
            <button
              type="button"
              onClick={() =>
                router.back()
              }
              className="font-semibold text-red-600"
            >
              ← Voltar
            </button>

            <p className="font-black text-red-600">
              Entrega Paudalho
            </p>
          </div>
        </header>

        <div className="mx-auto flex max-w-xl items-center justify-center px-4 py-16">
          <section className="w-full rounded-3xl bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-red-50 text-5xl">
              🔒
            </div>

            <p className="mt-6 text-sm font-black uppercase tracking-wide text-red-600">
              LOJA FECHADA
            </p>

            <h1 className="mt-2 text-3xl font-black">
              {restaurant?.name}
              {" "}
              está fechada
            </h1>

            <p className="mt-3 leading-6 text-zinc-500">
              No momento esta loja não está
              recebendo novos pedidos.
              Você ainda pode olhar o cardápio
              normalmente.
            </p>

            <div className="mt-6 rounded-2xl bg-red-50 p-5">
              <p className="text-sm font-bold text-red-700">
                🕐 Próxima abertura
              </p>

              <p className="mt-2 text-xl font-black text-red-700">
                {
                  nextOpening
                }
              </p>
            </div>

            <Link
              href={`/restaurante/${restaurantId}`}
              className="mt-6 block rounded-xl bg-red-600 px-5 py-4 font-black text-white transition hover:bg-red-700"
            >
              Ver cardápio
            </Link>

            <Link
              href="/carrinho"
              className="mt-3 block rounded-xl border border-zinc-200 px-5 py-4 font-black text-zinc-700 transition hover:bg-zinc-50"
            >
              🛒 Voltar ao carrinho
            </Link>
          </section>
        </div>
      </main>
    );
  }

  // ==========================================
  // ERRO SEM HORÁRIO
  // ==========================================

  if (
    !openStatus &&
    error
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7] px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
          <div className="text-5xl">
            ⚠️
          </div>

          <h1 className="mt-4 text-xl font-black">
            Não foi possível abrir o checkout
          </h1>

          <p className="mt-2 text-zinc-500">
            {
              error
            }
          </p>

          <Link
            href="/"
            className="mt-6 block rounded-xl bg-red-600 px-5 py-4 font-black text-white"
          >
            Voltar ao início
          </Link>
        </div>
      </main>
    );
  }

  const storeAddress =
    restaurantAddressText(
      restaurant
    );

  return (
    <main className="min-h-screen bg-[#f7f7f7] text-zinc-900">
      {/* ==================================
          CABEÇALHO
      ================================== */}

      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <button
            type="button"
            onClick={() =>
              router.back()
            }
            className="font-semibold text-red-600"
          >
            ← Voltar
          </button>

          <p className="font-black text-red-600">
            Entrega Paudalho
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 lg:grid-cols-[1fr_360px]">
        <form
          onSubmit={
            handleSubmit
          }
          className="space-y-6"
        >
          {/* ==================================
              STATUS
          ================================== */}

          {storeIsOpen && (
            allFulfillmentPaused ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <p className="font-black text-red-700">
                  ⛔ Entrega e retirada indisponíveis
                </p>

                <p className="mt-1 text-sm font-semibold text-red-600">
                  A loja pausou temporariamente as
                  duas formas de receber pedidos.
                </p>
              </div>
            ) : deliveryPaused ? (
              <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
                <p className="font-black text-orange-700">
                  🏪 Somente retirada disponível
                </p>

                <p className="mt-1 text-sm font-semibold text-orange-600">
                  A loja pausou as entregas
                  temporariamente, mas você ainda
                  pode pagar online e retirar o
                  pedido no local.
                </p>
              </div>
            ) : pickupPaused ? (
              <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
                <p className="font-black text-orange-700">
                  🛵 Somente entrega disponível
                </p>

                <p className="mt-1 text-sm font-semibold text-orange-600">
                  A loja pausou as retiradas
                  temporariamente, mas ainda está
                  recebendo pedidos para entrega.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-green-100 bg-green-50 p-4">
                <p className="font-black text-green-700">
                  ● Loja aberta
                </p>

                {openStatus
                  ?.closes_at && (
                  <p className="mt-1 text-sm font-semibold text-green-600">
                    Fecha às{" "}
                    {formatHour(
                      openStatus.closes_at
                    )}
                  </p>
                )}
              </div>
            )
          )}

          {/* ==================================
              COMO RECEBER
          ================================== */}

          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-black">
              Como você quer receber?
            </h1>

            <p className="mt-1 text-sm text-zinc-500">
              Escolha entre entrega ou retirada
              na loja.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {/* ENTREGA */}

              <label
                className={`relative rounded-2xl border p-4 transition ${
                  deliveryPaused
                    ? "cursor-not-allowed border-zinc-200 bg-zinc-100 opacity-60"
                    : fulfillmentMethod ===
                        "delivery"
                      ? "cursor-pointer border-red-500 bg-red-50"
                      : "cursor-pointer border-zinc-200 bg-white hover:bg-zinc-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="fulfillment"
                    value="delivery"
                    disabled={
                      deliveryPaused
                    }
                    checked={
                      fulfillmentMethod ===
                      "delivery"
                    }
                    onChange={() =>
                      setFulfillmentMethod(
                        "delivery"
                      )
                    }
                    className="mt-1"
                  />

                  <div>
                    <p className="font-black">
                      🛵 Entrega
                    </p>

                    <p className="mt-1 text-sm text-zinc-500">
                      Receber no seu endereço.
                    </p>

                    <p className="mt-3 text-sm font-black text-zinc-800">
                      Taxa{" "}
                      {money(
                        restaurant
                          ?.delivery_base_fee ??
                          0
                      )}
                    </p>
                  </div>
                </div>

                {deliveryPaused && (
                  <div className="mt-3 rounded-lg bg-red-100 px-3 py-2 text-xs font-black text-red-700">
                    Temporariamente indisponível
                  </div>
                )}
              </label>

              {/* RETIRADA */}

              <label
                className={`relative rounded-2xl border p-4 transition ${
                  pickupPaused
                    ? "cursor-not-allowed border-zinc-200 bg-zinc-100 opacity-60"
                    : fulfillmentMethod ===
                        "pickup"
                      ? "cursor-pointer border-red-500 bg-red-50"
                      : "cursor-pointer border-zinc-200 bg-white hover:bg-zinc-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="fulfillment"
                    value="pickup"
                    disabled={
                      pickupPaused
                    }
                    checked={
                      fulfillmentMethod ===
                      "pickup"
                    }
                    onChange={() =>
                      setFulfillmentMethod(
                        "pickup"
                      )
                    }
                    className="mt-1"
                  />

                  <div>
                    <p className="font-black">
                      🏪 Retirada na loja
                    </p>

                    <p className="mt-1 text-sm text-zinc-500">
                      Você busca o pedido no
                      restaurante.
                    </p>

                    <p className="mt-3 text-sm font-black text-green-700">
                      Taxa R$ 0,00
                    </p>
                  </div>
                </div>

                {pickupPaused && (
                  <div className="mt-3 rounded-lg bg-red-100 px-3 py-2 text-xs font-black text-red-700">
                    Temporariamente indisponível
                  </div>
                )}
              </label>
            </div>

            {/* RETIRADA SELECIONADA */}

            {fulfillmentMethod ===
              "pickup" &&
              !pickupPaused && (
              <div className="mt-4 rounded-2xl bg-green-50 p-4">
                <p className="font-black text-green-700">
                  🏪 Retirada selecionada
                </p>

                <p className="mt-1 text-sm leading-5 text-green-700">
                  Não será cobrada taxa de
                  entrega e você não precisa
                  informar endereço de entrega.
                </p>

                {storeAddress && (
                  <p className="mt-3 text-sm font-bold text-green-800">
                    📍 {storeAddress}
                  </p>
                )}
              </div>
            )}
          </section>

          {/* ==================================
              PAGAMENTO
          ================================== */}

          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-black">
              Forma de pagamento
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Pagamento somente online.
            </p>

            <div className="mt-5 space-y-3">
              {/* PIX */}

              <label
                className={`flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition ${
                  paymentMethod ===
                  "pix"
                    ? "border-red-500 bg-red-50"
                    : "border-zinc-200 bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={
                    paymentMethod ===
                    "pix"
                  }
                  onChange={() =>
                    setPaymentMethod(
                      "pix"
                    )
                  }
                />

                <span className="text-3xl">
                  💠
                </span>

                <div>
                  <p className="font-bold">
                    PIX
                  </p>

                  <p className="text-sm text-zinc-500">
                    QR Code e PIX Copia e Cola
                  </p>
                </div>
              </label>

              {/* CARTÃO */}

              <label
                className={`flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition ${
                  paymentMethod ===
                  "card"
                    ? "border-red-500 bg-red-50"
                    : "border-zinc-200 bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={
                    paymentMethod ===
                    "card"
                  }
                  onChange={() =>
                    setPaymentMethod(
                      "card"
                    )
                  }
                />

                <span className="text-3xl">
                  💳
                </span>

                <div>
                  <p className="font-bold">
                    Cartão
                  </p>

                  <p className="text-sm text-zinc-500">
                    Crédito ou débito online
                  </p>
                </div>
              </label>
            </div>

            <div className="mt-4 rounded-xl bg-zinc-50 p-4 text-sm text-zinc-500">
              🔒 O Entrega Paudalho não terá
              pagamento em dinheiro.
            </div>
          </section>

          {/* ==================================
              ENDEREÇO
              SÓ APARECE PARA ENTREGA
          ================================== */}

          {needsAddress && (
            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black">
                Endereço de entrega
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                Escolha um dos seus endereços
                cadastrados.
              </p>

              <div className="mt-6 flex items-center justify-between gap-4">
                <h3 className="font-black">
                  Meus endereços
                </h3>

                <Link
                  href="/meus-enderecos"
                  className="text-sm font-bold text-red-600"
                >
                  Gerenciar
                </Link>
              </div>

              {/* SEM ENDEREÇO */}

              {addresses.length ===
                0 && (
                <div className="mt-4 rounded-2xl bg-zinc-50 p-6 text-center">
                  <div className="text-5xl">
                    🏠
                  </div>

                  <h3 className="mt-3 text-lg font-black">
                    Nenhum endereço salvo
                  </h3>

                  <p className="mt-2 text-sm text-zinc-500">
                    Cadastre um endereço antes
                    de pedir entrega.
                  </p>

                  <Link
                    href="/meus-enderecos"
                    className="mt-5 inline-block rounded-xl bg-red-600 px-5 py-3 font-black text-white"
                  >
                    + Cadastrar endereço
                  </Link>
                </div>
              )}

              {/* LISTA DE ENDEREÇOS */}

              {addresses.length >
                0 && (
                <div className="mt-4 space-y-3">
                  {addresses.map(
                    (
                      address
                    ) => {
                      const selected =
                        selectedAddressId ===
                        address.id;

                      const hasLocation =
                        address.lat !==
                          null &&
                        address.long !==
                          null;

                      return (
                        <label
                          key={
                            address.id
                          }
                          className={`block cursor-pointer rounded-2xl border p-4 transition ${
                            selected
                              ? "border-red-500 bg-red-50"
                              : "border-zinc-200 hover:bg-zinc-50"
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            <input
                              type="radio"
                              name="delivery-address"
                              checked={
                                selected
                              }
                              onChange={() =>
                                setSelectedAddressId(
                                  address.id
                                )
                              }
                              className="mt-2"
                            />

                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-2xl">
                              {address.label
                                ?.toLowerCase()
                                .includes(
                                  "trabalho"
                                )
                                ? "💼"
                                : "🏠"}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-black">
                                  {address.label ||
                                    "Endereço"}
                                </p>

                                {address.is_default && (
                                  <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-black text-red-600">
                                    Principal
                                  </span>
                                )}

                                {selected && (
                                  <span className="rounded-full border border-red-300 bg-white px-2 py-1 text-xs font-black text-red-600">
                                    Usar neste pedido
                                  </span>
                                )}
                              </div>

                              <p className="mt-2 text-sm font-semibold text-zinc-700">
                                {
                                  address.street
                                }

                                {address.number
                                  ? `, ${address.number}`
                                  : ""}
                              </p>

                              {address.complement && (
                                <p className="mt-1 text-sm text-zinc-500">
                                  {
                                    address.complement
                                  }
                                </p>
                              )}

                              <p className="mt-1 text-sm text-zinc-500">
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

                              {hasLocation ? (
                                <p className="mt-3 text-xs font-bold text-green-600">
                                  ✅ Localização ajustada
                                  no mapa
                                </p>
                              ) : (
                                <div className="mt-3">
                                  <p className="text-xs font-bold text-orange-600">
                                    ⚠️ Falta ajustar a
                                    localização
                                  </p>

                                  <Link
                                    href={`/meus-enderecos/${address.id}/localizacao`}
                                    onClick={(
                                      event
                                    ) =>
                                      event.stopPropagation()
                                    }
                                    className="mt-2 inline-block rounded-lg bg-orange-100 px-3 py-2 text-xs font-black text-orange-700"
                                  >
                                    📍 Ajustar localização
                                  </Link>
                                </div>
                              )}
                            </div>
                          </div>
                        </label>
                      );
                    }
                  )}
                </div>
              )}

              {addresses.length >
                0 && (
                <Link
                  href="/meus-enderecos"
                  className="mt-4 block rounded-xl border border-red-200 px-4 py-3 text-center text-sm font-black text-red-600 transition hover:bg-red-50"
                >
                  + Adicionar novo endereço
                </Link>
              )}
            </section>
          )}

          {/* ==================================
              PROBLEMA NO CARRINHO
          ================================== */}

          {cartIssue && (
            <div className="rounded-2xl bg-yellow-50 p-4 text-sm font-bold text-yellow-800">
              ⚠️ {cartIssue}

              <Link
                href="/carrinho"
                className="mt-3 block font-black text-red-600"
              >
                ← Voltar ao carrinho
              </Link>
            </div>
          )}

          {/* ==================================
              PEDIDO MÍNIMO
          ================================== */}

          {!minimumReached &&
            !cartIssue &&
            items.length >
              0 && (
              <div className="rounded-2xl bg-yellow-50 p-4 text-sm text-yellow-800">
                Faltam{" "}
                <strong>
                  {money(
                    minimumOrder -
                      subtotal
                  )}
                </strong>{" "}
                para atingir o pedido mínimo.
              </div>
            )}

          {/* ==================================
              ERRO
          ================================== */}

          {error && (
            <div className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">
              {
                error
              }

              {error.includes(
                "carrinho"
              ) && (
                <Link
                  href={`/restaurante/${restaurantId}`}
                  className="mt-3 block font-black text-red-600"
                >
                  ← Voltar ao cardápio
                </Link>
              )}
            </div>
          )}

          {/* ==================================
              CONFIRMAR
          ================================== */}

          <button
            type="submit"
            disabled={
              sending ||
              openStatusLoading ||
              !storeIsOpen ||
              selectedFulfillmentPaused ||
              Boolean(
                cartIssue
              ) ||
              items.length ===
                0 ||
              !minimumReached ||
              (
                needsAddress &&
                (
                  !selectedAddress ||
                  !selectedAddressHasLocation
                )
              )
            }
            className="w-full rounded-xl bg-red-600 px-5 py-4 font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {sending
              ? "Enviando pedido..."
              : openStatusLoading
                ? "Verificando horário..."
                : !openStatus
                  ? "Horário indisponível"
                  : !storeIsOpen
                    ? "🔒 Loja fechada"
                    : allFulfillmentPaused
                      ? "Entrega e retirada pausadas"
                      : selectedFulfillmentPaused
                        ? fulfillmentMethod ===
                            "pickup"
                          ? "Retirada temporariamente pausada"
                          : "Entrega temporariamente pausada"
                        : cartIssue
                      ? "Revise seu carrinho"
                      : items.length ===
                          0
                        ? "Seu carrinho está vazio"
                        : !minimumReached
                          ? "Pedido mínimo não atingido"
                          : needsAddress &&
                              !selectedAddress
                            ? "Escolha um endereço"
                            : needsAddress &&
                                !selectedAddressHasLocation
                              ? "Ajuste a localização do endereço"
                              : fulfillmentMethod ===
                                  "pickup"
                                ? `Continuar pagamento • Retirada • ${money(
                                    total
                                  )}`
                                : `Continuar pagamento • Entrega • ${money(
                                    total
                                  )}`}
          </button>
        </form>

        {/* ==================================
            RESUMO
        ================================== */}

        <aside>
          <div className="sticky top-6 rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black">
              Resumo
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              {
                restaurant?.name
              }
            </p>

            {/* TIPO */}

            <div
              className={`mt-4 rounded-xl p-3 text-sm font-bold ${
                fulfillmentMethod ===
                "pickup"
                  ? "bg-green-50 text-green-700"
                  : "bg-blue-50 text-blue-700"
              }`}
            >
              {fulfillmentMethod ===
              "pickup"
                ? "🏪 Retirada na loja"
                : "🛵 Entrega"}
            </div>

            {/* ITENS */}

            <div className="mt-5 space-y-5">
              {items.map(
                (
                  item
                ) => (
                  <div
                    key={
                      item.cart_key
                    }
                    className="border-b border-zinc-100 pb-5 last:border-b-0"
                  >
                    <div className="flex justify-between gap-4">
                      <div>
                        <p className="font-black">
                          {
                            item.quantity
                          }
                          x{" "}
                          {
                            item.name
                          }
                        </p>

                        {item.discount_percent > 0 ? (
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-bold text-zinc-400 line-through">
                              {money(
                                item.original_base_price
                              )}
                            </span>

                            <span className="font-black text-green-700">
                              {money(
                                item.base_price
                              )}
                            </span>

                            <span className="rounded-full bg-green-100 px-2 py-0.5 font-black text-green-700">
                              {item.discount_percent}% OFF
                            </span>
                          </div>
                        ) : (
                          <p className="mt-1 text-xs text-zinc-500">
                            Produto{" "}
                            {money(
                              item.base_price
                            )}
                          </p>
                        )}
                      </div>

                      <span className="shrink-0 font-black">
                        {money(
                          item.unit_price *
                            item.quantity
                        )}
                      </span>
                    </div>

                    {/* ADICIONAIS */}

                    {item.addons.length >
                      0 && (
                      <div className="mt-3 rounded-xl bg-zinc-50 p-3">
                        <p className="text-xs font-black uppercase text-zinc-400">
                          Adicionais
                        </p>

                        <div className="mt-2 space-y-1">
                          {item.addons.map(
                            (
                              addon
                            ) => (
                              <div
                                key={
                                  addon.option_id
                                }
                                className="flex justify-between gap-3 text-xs"
                              >
                                <span className="text-zinc-600">
                                  {
                                    addon.quantity
                                  }
                                  x{" "}
                                  {
                                    addon.option_name
                                  }
                                </span>

                                <span className="font-bold">
                                  +{" "}
                                  {money(
                                    addon.price *
                                      addon.quantity
                                  )}
                                </span>
                              </div>
                            )
                          )}
                        </div>

                        {item.quantity >
                          1 && (
                          <p className="mt-2 text-[11px] text-zinc-400">
                            Adicionais em cada unidade.
                          </p>
                        )}
                      </div>
                    )}

                    {/* OBSERVAÇÃO */}

                    {item.notes && (
                      <div className="mt-3 rounded-xl bg-yellow-50 p-3">
                        <p className="text-xs font-black text-yellow-700">
                          OBSERVAÇÃO
                        </p>

                        <p className="mt-1 text-xs text-yellow-900">
                          {
                            item.notes
                          }
                        </p>
                      </div>
                    )}

                    {item.addons.length >
                      0 && (
                      <p className="mt-3 text-xs text-zinc-500">
                        Unidade configurada:{" "}
                        <strong className="text-zinc-900">
                          {money(
                            item.unit_price
                          )}
                        </strong>
                      </p>
                    )}
                  </div>
                )
              )}
            </div>

            {/* ==================================
                CUPOM
            ================================== */}

            <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black">
                    🎟️ Cupom de desconto
                  </p>

                  <p className="mt-1 text-xs text-zinc-500">
                    O cupom não desconta a taxa de entrega.
                  </p>
                </div>

                {appliedCoupon && (
                  <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-black text-green-700">
                    Aplicado
                  </span>
                )}
              </div>

              {appliedCoupon ? (
                <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-black text-green-800">
                        {
                          appliedCoupon.code
                        }
                      </p>

                      <p className="mt-1 text-xs text-green-700">
                        Você economizou{" "}
                        <strong>
                          {money(
                            couponDiscount
                          )}
                        </strong>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={
                        removeCoupon
                      }
                      className="rounded-lg border border-green-300 bg-white px-3 py-2 text-xs font-black text-green-700 transition hover:bg-green-100"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex gap-2">
                  <input
                    type="text"
                    value={
                      couponInput
                    }
                    onChange={(
                      event
                    ) => {
                      setCouponInput(
                        event.target.value
                          .toUpperCase()
                      );

                      if (
                        couponError
                      ) {
                        setCouponError(
                          ""
                        );
                      }
                    }}
                    onKeyDown={(
                      event
                    ) => {
                      if (
                        event.key ===
                        "Enter"
                      ) {
                        event.preventDefault();

                        void applyCoupon();
                      }
                    }}
                    placeholder="Digite seu cupom"
                    maxLength={
                      40
                    }
                    className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm font-bold uppercase outline-none transition focus:border-red-400"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      void applyCoupon()
                    }
                    disabled={
                      couponLoading
                    }
                    className="rounded-xl bg-zinc-900 px-4 py-3 text-sm font-black text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-zinc-400"
                  >
                    {couponLoading
                      ? "..."
                      : "Aplicar"}
                  </button>
                </div>
              )}

              {couponError && (
                <p className="mt-2 text-xs font-bold text-red-600">
                  {
                    couponError
                  }
                </p>
              )}
            </div>

            {/* ==================================
                VALORES
            ================================== */}

            <div className="mt-6 space-y-3 border-t border-zinc-200 pt-5 text-sm">
              {productDiscountTotal > 0 && (
                <div className="flex justify-between font-bold text-green-700">
                  <span>
                    Desconto nos produtos
                  </span>

                  <span>
                    -{money(
                      productDiscountTotal
                    )}
                  </span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-zinc-500">
                  Subtotal
                </span>

                <span>
                  {money(
                    subtotal
                  )}
                </span>
              </div>

              {couponDiscount > 0 && (
                <div className="flex justify-between font-bold text-green-700">
                  <span>
                    Cupom{" "}
                    {
                      appliedCoupon
                        ?.code
                    }
                  </span>

                  <span>
                    -{money(
                      couponDiscount
                    )}
                  </span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-zinc-500">
                  {fulfillmentMethod ===
                  "pickup"
                    ? "Retirada"
                    : "Entrega"}
                </span>

                <span>
                  {money(
                    deliveryFee
                  )}
                </span>
              </div>

              <div className="flex justify-between border-t border-zinc-200 pt-4 text-lg font-black">
                <span>
                  Total
                </span>

                <span>
                  {money(
                    total
                  )}
                </span>
              </div>
            </div>

            {/* ==================================
                ENDEREÇO DE ENTREGA
            ================================== */}

            {fulfillmentMethod ===
              "delivery" &&
              selectedAddress && (
                <div className="mt-5 rounded-xl bg-zinc-50 p-4">
                  <p className="text-xs font-black text-zinc-400">
                    ENTREGA EM
                  </p>

                  <p className="mt-2 text-sm font-bold">
                    📍{" "}
                    {
                      selectedAddress.street
                    }

                    {selectedAddress.number
                      ? `, ${selectedAddress.number}`
                      : ""}
                  </p>

                  <p className="mt-1 text-xs text-zinc-500">
                    {
                      selectedAddress.neighborhood
                    }
                  </p>
                </div>
              )}

            {/* ==================================
                RETIRADA
            ================================== */}

            {fulfillmentMethod ===
              "pickup" && (
              <div className="mt-5 rounded-xl bg-green-50 p-4">
                <p className="text-xs font-black text-green-600">
                  RETIRADA NA LOJA
                </p>

                <p className="mt-2 text-sm font-bold text-green-800">
                  🏪{" "}
                  {
                    restaurant?.name
                  }
                </p>

                {storeAddress && (
                  <p className="mt-1 text-xs leading-5 text-green-700">
                    📍 {storeAddress}
                  </p>
                )}
              </div>
            )}

            <div className="mt-5 rounded-xl bg-green-50 p-3 text-sm font-medium text-green-700">
              🔒 Pagamento online e seguro
            </div>
          </div>  
        </aside>
      </div>
    </main>
  );
}
export default function CheckoutPage() {
  return (
    <Suspense fallback={<div>Carregando checkout...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}