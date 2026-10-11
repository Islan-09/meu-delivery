"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Product = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  category_id?: string | null;
  price: number | string;
  image_url: string | null;
};
type Restaurant = {
  id: string;
  name: string;
  description: string | null;
  neighborhood: string | null;
  cover_url: string | null;
  minimum_order: number | string;
  delivery_base_fee: number | string;
  estimated_delivery_minutes: number | null;
};
type MenuCategory = { id: string; name: string; sort_order: number; };
type ProductBadge = { product_id: string; badge_text: string | null; badge_color: string | null; };
type ProductDiscount = { product_id: string; discount_percent: number | string | null; };
type AddonOption = { id: string; name: string; price: number | string; max_quantity: number; };
type AddonGroup = { group_id: string; name: string; min_select: number; max_select: number; required: boolean; sort_order?: number; options: AddonOption[]; };
type AddonGroupOrder = { group_id: string; sort_order: number; };
type CartAddon = { group_id: string; group_name: string; option_id: string; option_name: string; price: number; quantity: number; };
type CartItem = { product: Product; quantity: number; cart_key?: string; addons?: CartAddon[]; notes?: string; unit_price?: number; };
type Props = { restaurant: Restaurant; products: Product[]; };
type RestaurantOpenStatus = { is_open: boolean; current_day: number | null; opens_at: string | null; closes_at: string | null; next_day: number | null; next_opens_at: string | null; };
type RestaurantOrderOptions = { delivery_available: boolean; pickup_available: boolean; };
type RestaurantCnpjSalesStatus = { sales_allowed: boolean; cnpj_required: boolean; deadline_at: string | null; };
type RestaurantReviewSummary = { average_rating: number | string; review_count: number | string; };
type RestaurantReviewDistribution = { star: number; review_count: number | string; };
type PublicRestaurantReview = { review_id: string; rating: number | string; comment: string | null; customer_name: string; created_at: string; };

const dayNames: Record<number, string> = { 0: "domingo", 1: "segunda-feira", 2: "terça-feira", 3: "quarta-feira", 4: "quinta-feira", 5: "sexta-feira", 6: "sábado" };
function formatHour(value: string | null) { if (!value) return ""; return value.slice(0, 5); }
function nextOpeningText(status: RestaurantOpenStatus | null) {
  if (!status || status.is_open) return "";
  if (status.next_day === null ||!status.next_opens_at) return "O próximo horário de abertura ainda não foi informado.";
  const dayName = dayNames[Number(status.next_day)]?? "próximo dia";
  return `Abre novamente ${dayName} às ${formatHour(status.next_opens_at)}`;
}
function money(value: number | string | null) { return Number(value?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function normalizeCategory(value: string | null) { return (value?? "").trim().toLocaleLowerCase("pt-BR"); }
function productBadgeClass(color: string | null | undefined) {
  switch (color) {
    case "pink": return "bg-pink-50 text-pink-700";
    case "blue": return "bg-blue-50 text-blue-700";
    case "green": return "bg-green-50 text-green-700";
    case "orange": return "bg-orange-50 text-orange-700";
    case "purple": return "bg-purple-50 text-purple-700";
    case "gray": return "bg-zinc-100 text-zinc-700";
    default: return "bg-red-50 text-red-700";
  }
}
function reviewDate(value: string) { return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }); }
function ratingNumberText(value: number) { return value.toFixed(1).replace(".", ","); }
function Stars({ value, size = "text-xl" }: { value: number; size?: string }) {
  return (
    <div className={`flex items-center gap-0.5 ${size}`} aria-label={`${ratingNumberText(value)} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const fill = value >= star? 100 : value >= star - 0.5? 50 : 0;
        return (
          <span key={star} className="relative inline-block leading-none">
            <span className="text-zinc-200">★</span>
            <span className="absolute left-0 top-0 overflow-hidden text-yellow-400" style={{ width: `${fill}%` }}>
              <span className="inline-block">★</span>
            </span>
          </span>
        );
      })}
    </div>
  );
}
function fallbackEmoji(category: string | null) {
  const value = normalizeCategory(category);
  if (value.includes("bebida")) return "🥤";
  if (value.includes("pizza")) return "🍕";
  if (value.includes("açaí")) return "🥤";
  if (value.includes("doce") || value.includes("sobremesa")) return "🍰";
  if (value.includes("porção") || value.includes("porcoes") || value.includes("porções")) return "🍟";
  return "🍔";
}

export default function RestaurantClient({ restaurant, products }: Props) {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [visibleProducts, setVisibleProducts] = useState<Product[]>(products);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [productBadges, setProductBadges] = useState<Record<string, ProductBadge>>({});
  const [productDiscounts, setProductDiscounts] = useState<Record<string, number>>({});
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [reviewSummary, setReviewSummary] = useState<RestaurantReviewSummary | null>(null);
  const [reviewDistribution, setReviewDistribution] = useState<RestaurantReviewDistribution[]>([]);
  const [publicReviews, setPublicReviews] = useState<PublicRestaurantReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsExpanded, setReviewsExpanded] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [addonGroups, setAddonGroups] = useState<AddonGroup[]>([]);
  const [loadingAddons, setLoadingAddons] = useState(false);
  const [addonLoadError, setAddonLoadError] = useState("");
  const [addonQuantities, setAddonQuantities] = useState<Record<string, Record<string, number>>>({});
  const [modalQuantity, setModalQuantity] = useState(1);
  const [observation, setObservation] = useState("");
  const [modalError, setModalError] = useState("");
  const [openStatus, setOpenStatus] = useState<RestaurantOpenStatus | null>(null);
  const [openStatusLoading, setOpenStatusLoading] = useState(true);
  const [closedNoticeOpen, setClosedNoticeOpen] = useState(false);
  const [orderOptions, setOrderOptions] = useState<RestaurantOrderOptions | null>(null);
  const [orderOptionsLoading, setOrderOptionsLoading] = useState(true);
  const [operationNoticeOpen, setOperationNoticeOpen] = useState(false);
  const [cnpjSalesStatus, setCnpjSalesStatus] = useState<RestaurantCnpjSalesStatus | null>(null);
  const [cnpjSalesStatusLoading, setCnpjSalesStatusLoading] = useState(true);
  const [cnpjBlockedNoticeOpen, setCnpjBlockedNoticeOpen] = useState(false);
  const storageKey = `cart-${restaurant.id}`;

  useEffect(() => {
    let cancelled = false;
    async function loadOpenStatus() {
      const { data, error } = await supabase.rpc("get_restaurant_open_status", { p_restaurant_id: restaurant.id });
      if (cancelled) return;
      if (error) { setOpenStatus(null); setOpenStatusLoading(false); return; }
      const result = Array.isArray(data) && data.length > 0? (data[0] as RestaurantOpenStatus) : null;
      setOpenStatus(result); setOpenStatusLoading(false);
      if (result?.is_open) setClosedNoticeOpen(false);
    }
    setOpenStatusLoading(true); loadOpenStatus();
    const interval = window.setInterval(loadOpenStatus, 60000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [restaurant.id]);

  useEffect(() => {
    let cancelled = false;
    async function loadCnpjSalesStatus() {
      const { data, error } = await supabase.rpc("get_restaurant_cnpj_sales_status", { p_restaurant_id: restaurant.id });
      if (cancelled) return;
      if (error) { setCnpjSalesStatus(null); setCnpjSalesStatusLoading(false); return; }
      const result = Array.isArray(data) && data.length > 0? (data[0] as RestaurantCnpjSalesStatus) : null;
      setCnpjSalesStatus(result); setCnpjSalesStatusLoading(false);
      if (result?.sales_allowed) setCnpjBlockedNoticeOpen(false);
    }
    setCnpjSalesStatusLoading(true); loadCnpjSalesStatus();
    const interval = window.setInterval(loadCnpjSalesStatus, 60000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [restaurant.id]);

  useEffect(() => {
    let cancelled = false;
    async function loadOrderOptions() {
      const { data, error } = await supabase.rpc("get_restaurant_order_options", { p_restaurant_id: restaurant.id });
      if (cancelled) return;
      if (error) { setOrderOptions(null); setOrderOptionsLoading(false); return; }
      const result = Array.isArray(data) && data.length > 0? (data[0] as RestaurantOrderOptions) : null;
      setOrderOptions(result); setOrderOptionsLoading(false);
      if (result && (result.delivery_available || result.pickup_available)) setOperationNoticeOpen(false);
    }
    setOrderOptionsLoading(true); loadOrderOptions();
    const interval = window.setInterval(loadOrderOptions, 15000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [restaurant.id]);

  useEffect(() => {
    let cancelled = false;
    async function loadCategories() {
      const { data, error } = await supabase.rpc("get_restaurant_menu_categories", { p_restaurant_id: restaurant.id });
      if (error) return;
      if (cancelled) return;
      const orderedCategories = ((data?? []) as MenuCategory[]).slice().sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
      setCategories(orderedCategories);
    }
    loadCategories();
    const interval = window.setInterval(loadCategories, 5000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [restaurant.id]);

  useEffect(() => {
    let cancelled = false;
    async function loadProductBadges() {
      const { data, error } = await supabase.rpc("get_restaurant_product_badges", { p_restaurant_id: restaurant.id });
      if (error) return;
      if (cancelled) return;
      const nextBadges: Record<string, ProductBadge> = {};
      for (const item of ((data?? []) as ProductBadge[])) { nextBadges[item.product_id] = item; }
      setProductBadges(nextBadges);
    }
    loadProductBadges();
    const interval = window.setInterval(loadProductBadges, 5000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [restaurant.id]);

  useEffect(() => {
    let cancelled = false;
    async function loadProductDiscounts() {
      const { data, error } = await supabase.rpc("get_restaurant_product_discounts", { p_restaurant_id: restaurant.id });
      if (error) return;
      if (cancelled) return;
      const nextDiscounts: Record<string, number> = {};
      for (const item of ((data?? []) as ProductDiscount[])) {
        const value = Number(item.discount_percent?? 0);
        nextDiscounts[item.product_id] = Number.isFinite(value)? Math.min(100, Math.max(0, value)) : 0;
      }
      setProductDiscounts(nextDiscounts);
    }
    loadProductDiscounts();
    const interval = window.setInterval(loadProductDiscounts, 5000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [restaurant.id]);

  useEffect(() => {
    let cancelled = false;
    async function refreshProducts() {
      const { data, error } = await supabase.from("products").select(`id,name,description,category,category_id,price,image_url`).eq("restaurant_id", restaurant.id).eq("active", true).order("created_at", { ascending: true });
      if (error) return;
      if (!cancelled) setVisibleProducts((data?? []) as Product[]);
    }
    const interval = window.setInterval(refreshProducts, 5000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [restaurant.id]);

  useEffect(() => {
    if (!loaded) return;
    const availableIds = new Set(visibleProducts.map((product) => product.id));
    setCart((currentCart) => {
      const filtered = currentCart.filter((item) => availableIds.has(item.product.id));
      if (filtered.length === currentCart.length) return currentCart;
      return filtered;
    });
  }, [visibleProducts, loaded]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) { setCart([]); return; }
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) { setCart([]); return; }
      const availableIds = new Set(products.map((product) => product.id));
      const validItems = parsed.filter((item) => item?.product?.id && availableIds.has(item.product.id));
      setCart(validItems);
    } catch (error) { setCart([]); } finally { setLoaded(true); }
  }, [storageKey, products]);

  useEffect(() => {
    if (!loaded) return;
    if (cart.length === 0) localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, JSON.stringify(cart));
    window.dispatchEvent(new Event("cart-updated"));
  }, [cart, loaded, storageKey]);

  useEffect(() => {
    if (!selectedProduct &&!closedNoticeOpen &&!operationNoticeOpen) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (operationNoticeOpen) { setOperationNoticeOpen(false); return; }
        if (closedNoticeOpen) { setClosedNoticeOpen(false); return; }
        closeProduct();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => { document.body.style.overflow = oldOverflow; window.removeEventListener("keydown", handleKeyDown); };
  }, [selectedProduct, closedNoticeOpen, operationNoticeOpen]);

  useEffect(() => {
    let cancelled = false;
    async function loadReviews() {
      setReviewsLoading(true);
      const [summaryResponse, distributionResponse, reviewsResponse] = await Promise.all([
        supabase.rpc("get_restaurant_review_summary", { p_restaurant_id: restaurant.id }),
        supabase.rpc("get_restaurant_review_distribution", { p_restaurant_id: restaurant.id }),
        supabase.rpc("get_restaurant_public_reviews", { p_restaurant_id: restaurant.id, p_limit: 50, p_offset: 0 }),
      ]);
      if (cancelled) return;
      if (!summaryResponse.error) {
        const summary = Array.isArray(summaryResponse.data)? summaryResponse.data[0] : summaryResponse.data;
        setReviewSummary(summary?? { average_rating: 0, review_count: 0 });
      }
      if (!distributionResponse.error) setReviewDistribution((distributionResponse.data?? []) as RestaurantReviewDistribution[]);
      if (!reviewsResponse.error) setPublicReviews((reviewsResponse.data?? []) as PublicRestaurantReview[]);
      setReviewsLoading(false);
    }
    loadReviews();
    return () => { cancelled = true; };
  }, [restaurant.id]);

  useEffect(() => {
    async function loadFavorite() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setIsFavorite(false); return; }
      const { data, error } = await supabase.from("restaurant_favorites").select("restaurant_id").eq("user_id", session.user.id).eq("restaurant_id", restaurant.id).maybeSingle();
      if (error) return;
      setIsFavorite(Boolean(data));
    }
    loadFavorite();
  }, [restaurant.id]);

  async function toggleFavorite() {
    if (favoriteLoading) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { sessionStorage.setItem("after-login", `/restaurante/${restaurant.id}`); router.push("/login"); return; }
    setFavoriteLoading(true);
    if (isFavorite) {
      const { error } = await supabase.from("restaurant_favorites").delete().eq("user_id", session.user.id).eq("restaurant_id", restaurant.id);
      if (!error) setIsFavorite(false);
      setFavoriteLoading(false); return;
    }
    const { error } = await supabase.from("restaurant_favorites").insert({ user_id: session.user.id, restaurant_id: restaurant.id });
    if (!error) setIsFavorite(true);
    setFavoriteLoading(false);
  }

  const menuSections = useMemo(() => {
    const matchedIds = new Set<string>();
    const sections = categories.map((category) => {
      const categoryProducts = visibleProducts.filter((product) => {
        const matchById = product.category_id === category.id;
        const matchByName = normalizeCategory(product.category) === normalizeCategory(category.name);
        const matches = matchById || matchByName;
        if (matches) matchedIds.add(product.id);
        return matches;
      });
      return { id: category.id, name: category.name, sort_order: category.sort_order, products: categoryProducts };
    }).filter((section) => section.products.length > 0);
    const unmatched = visibleProducts.filter((product) =>!matchedIds.has(product.id));
    if (unmatched.length > 0) sections.push({ id: "other", name: "Outros", sort_order: 999999, products: unmatched });
    return sections.sort((a, b) => a.sort_order - b.sort_order);
  }, [categories, visibleProducts]);

  function discountForProduct(productId: string) {
    const value = Number(productDiscounts[productId]?? 0);
    if (!Number.isFinite(value)) return 0;
    return Math.min(100, Math.max(0, value));
  }
  function priceForProduct(product: Product) {
    const base = Number(product.price?? 0);
    const discount = discountForProduct(product.id);
    return Math.round(base * (1 - discount / 100) * 100) / 100;
  }

  async function openProduct(product: Product) {
    if (cnpjSalesStatus &&!cnpjSalesStatus.sales_allowed) { setCnpjBlockedNoticeOpen(true); return; }
    if (openStatus &&!openStatus.is_open) { setClosedNoticeOpen(true); return; }
    if (orderOptions &&!orderOptions.delivery_available &&!orderOptions.pickup_available) { setOperationNoticeOpen(true); return; }
    setSelectedProduct(product); setAddonGroups([]); setAddonQuantities({}); setModalQuantity(1); setObservation(""); setModalError(""); setAddonLoadError(""); setLoadingAddons(true);
    const [addonsResponse, orderResponse] = await Promise.all([
      supabase.rpc("get_product_addons", { p_product_id: product.id }),
      supabase.rpc("get_product_addon_group_order", { p_product_id: product.id }),
    ]);
    if (addonsResponse.error) { setAddonLoadError("Não foi possível carregar os adicionais deste produto."); setLoadingAddons(false); return; }
    const result = Array.isArray(addonsResponse.data)? addonsResponse.data : [];
    const orderMap = new Map<string, number>(((orderResponse.data?? []) as AddonGroupOrder[]).map((item) => [item.group_id, Number(item.sort_order?? 0)]));
    const normalized = result.map((group: any) => ({
     ...group,
      min_select: Number(group.min_select?? 0),
      max_select: Number(group.max_select?? 1),
      sort_order: orderMap.get(group.group_id)?? 999999,
      options: Array.isArray(group.options)? group.options.map((option: AddonOption) => ({...option, max_quantity: Number(option.max_quantity?? 1) })) : [],
    })).sort((a: any, b: any) => Number(a.sort_order) - Number(b.sort_order));
    setAddonGroups(normalized as AddonGroup[]); setLoadingAddons(false);
  }
  function closeProduct() { setSelectedProduct(null); setAddonGroups([]); setAddonQuantities({}); setModalQuantity(1); setObservation(""); setModalError(""); setAddonLoadError(""); }
  function getGroupQuantity(groupId: string) {
    const quantities = addonQuantities[groupId]?? {};
    return Object.values(quantities).reduce((sum, quantity) => sum + Number(quantity), 0);
  }
  function changeAddonQuantity(group: AddonGroup, option: AddonOption, change: number) {
    setModalError("");
    setAddonQuantities((current) => {
      const groupValues = current[group.group_id]?? {};
      const currentQuantity = Number(groupValues[option.id]?? 0);
      const groupTotal = Object.values(groupValues).reduce((sum, quantity) => sum + Number(quantity), 0);
      if (change < 0) {
        if (currentQuantity <= 0) return current;
        return {...current, [group.group_id]: {...groupValues, [option.id]: currentQuantity - 1 } };
      }
      const optionMaximum = Number(option.max_quantity?? 1);
      if (currentQuantity >= optionMaximum) { setModalError(`O máximo de "${option.name}" é ${optionMaximum}.`); return current; }
      const groupMaximum = Number(group.max_select?? 1);
      if (groupTotal >= groupMaximum) { setModalError(`Você pode adicionar no máximo ${groupMaximum} adicionais em "${group.name}".`); return current; }
      return {...current, [group.group_id]: {...groupValues, [option.id]: currentQuantity + 1 } };
    });
  }
  const selectedAddonItems = useMemo(() => {
    const result: CartAddon[] = [];
    for (const group of addonGroups) {
      const quantities = addonQuantities[group.group_id]?? {};
      for (const option of group.options?? []) {
        const quantity = Number(quantities[option.id]?? 0);
        if (quantity > 0) result.push({ group_id: group.group_id, group_name: group.name, option_id: option.id, option_name: option.name, price: Number(option.price), quantity });
      }
    }
    return result;
  }, [addonGroups, addonQuantities]);
  const selectedAddonTotal = selectedAddonItems.reduce((sum, addon) => sum + Number(addon.price) * Number(addon.quantity), 0);
  const selectedUnitPrice = selectedProduct? priceForProduct(selectedProduct) + selectedAddonTotal : 0;
  const selectedTotal = selectedUnitPrice * modalQuantity;
  function validateAddons() {
    for (const group of addonGroups) {
      const amount = getGroupQuantity(group.group_id);
      let minimum = Number(group.min_select?? 0);
      if (group.required && minimum === 0) minimum = 1;
      const maximum = Number(group.max_select?? 1);
      if (amount < minimum) { setModalError(minimum === 1? `Adicione pelo menos 1 item em "${group.name}".` : `Adicione pelo menos ${minimum} itens em "${group.name}".`); return false; }
      if (amount > maximum) { setModalError(`Adicione no máximo ${maximum} itens em "${group.name}".`); return false; }
    }
    return true;
  }
  function addConfiguredProduct() {
    if (!selectedProduct) return;
    if (cnpjSalesStatus &&!cnpjSalesStatus.sales_allowed) { closeProduct(); setCnpjBlockedNoticeOpen(true); return; }
    if (openStatus &&!openStatus.is_open) { closeProduct(); setClosedNoticeOpen(true); return; }
    if (orderOptions &&!orderOptions.delivery_available &&!orderOptions.pickup_available) { closeProduct(); setOperationNoticeOpen(true); return; }
    if (loadingAddons || addonLoadError) return;
    if (!validateAddons()) return;
    const addonKey = selectedAddonItems.map((addon) => `${addon.option_id}:${addon.quantity}`).sort().join(",");
    const cleanObservation = observation.trim();
    const cartKey = `${selectedProduct.id}|${addonKey}|${cleanObservation}`;
    setCart((currentCart) => {
      const existing = currentCart.find((item) => item.cart_key === cartKey);
      if (existing) {
        return currentCart.map((item) => item.cart_key === cartKey? {...item, product: selectedProduct, quantity: item.quantity + modalQuantity, addons: selectedAddonItems, notes: cleanObservation, unit_price: selectedUnitPrice } : item);
      }
      return [...currentCart, { product: selectedProduct, quantity: modalQuantity, cart_key: cartKey, addons: selectedAddonItems, notes: cleanObservation, unit_price: selectedUnitPrice }];
    });
    closeProduct();
  }

  const itemCount = cart.reduce((sum, item) => sum + Number(item.quantity), 0);
  const cnpjSalesBlocked = cnpjSalesStatus!== null &&!cnpjSalesStatus.sales_allowed;
  const storeIsOpen = openStatus?.is_open === true &&!cnpjSalesBlocked;
  const storeIsClosed = openStatus!== null &&!storeIsOpen;
  const nextOpening = nextOpeningText(openStatus);
  const deliveryAvailable = orderOptions?.delivery_available === true;
  const pickupAvailable = orderOptions?.pickup_available === true;
  const noOrderOptionsAvailable = orderOptions!== null &&!deliveryAvailable &&!pickupAvailable;
  const averageRating = Number(reviewSummary?.average_rating?? 0);
  const reviewCount = Number(reviewSummary?.review_count?? 0);
  const visibleReviews = reviewsExpanded? publicReviews : publicReviews.slice(0, 4);

  return (
    <main className="min-h-screen bg-[#f7f7f7] text-zinc-900">
      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="font-semibold text-red-600">← Voltar</Link>
          <p className="font-black text-red-600">Entrega Paudalho</p>
          <Link href="/carrinho" className="rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white">🛒 {itemCount}</Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* LOJA */}
        <section>
          <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
            {restaurant.cover_url? (
              <div className="h-80 w-full overflow-hidden bg-zinc-100">
                <img src={restaurant.cover_url} alt={`Capa da ${restaurant.name}`} className="h-full w-full object-cover object-[center_30%]" />
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center bg-gradient-to-r from-red-600 to-red-500 text-8xl">🍕</div>
            )}
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="text-3xl font-black">{restaurant.name}</h1>
                  <p className="mt-2 text-zinc-500">{restaurant.description || "Restaurante em Paudalho"}</p>
                </div>
                <button type="button" disabled={favoriteLoading} onClick={toggleFavorite} className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-3xl transition ${isFavorite? "border-red-200 bg-red-50 text-red-600" : "border-zinc-200 bg-white text-zinc-400 hover:border-red-200 hover:bg-red-50 hover:text-red-500"} disabled:opacity-50`}>
                  {favoriteLoading? "..." : isFavorite? "♥" : "♡"}
                </button>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-zinc-600">
                {!reviewsLoading && (
                  <button type="button" onClick={() => document.getElementById("avaliacoes")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="inline-flex items-center gap-2 rounded-full bg-yellow-50 px-3 py-1.5 font-black text-yellow-800 transition hover:bg-yellow-100">
                    <span>⭐</span>
                    {reviewCount > 0? (<><span>{ratingNumberText(averageRating)}</span><span className="font-bold text-yellow-700">({reviewCount} {reviewCount === 1? "avaliação" : "avaliações"})</span></>) : (<span>Ainda sem avaliações</span>)}
                  </button>
                )}
                {restaurant.neighborhood && <span>📍 {restaurant.neighborhood}</span>}
                <span>⏱ {restaurant.estimated_delivery_minutes?? 40} min</span>
                <span>🛵 Entrega {money(restaurant.delivery_base_fee)}</span>
                <span>🛒 Pedido mínimo {money(restaurant.minimum_order)}</span>
              </div>
              {!cnpjSalesStatusLoading && cnpjSalesBlocked && (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-4">
                  <p className="font-black text-red-700">🔴 Loja temporariamente indisponível para vendas</p>
                  <p className="mt-1 text-sm font-semibold leading-5 text-red-600">Esta loja precisa regularizar o CNPJ antes de voltar a receber novos pedidos.</p>
                </div>
              )}
              <div className="mt-5">
                {openStatusLoading? (
                  <div className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm font-bold text-zinc-500">🕐 Verificando horário da loja...</div>
                ) : openStatus? (
                  <div className={`rounded-2xl px-4 py-3 ${storeIsOpen? "bg-green-50" : "bg-red-50"}`}>
                    <p className={`font-black ${storeIsOpen? "text-green-700" : "text-red-700"}`}>{storeIsOpen? "● Aberto agora" : "● Fechado agora"}</p>
                    <p className={`mt-1 text-sm ${storeIsOpen? "text-green-600" : "text-red-600"}`}>{storeIsOpen? openStatus.closes_at? `Fecha às ${formatHour(openStatus.closes_at)}` : "Recebendo pedidos agora." : nextOpening}</p>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-500">Horário de funcionamento indisponível.</div>
                )}
              </div>
              <div className="mt-4">
                {orderOptionsLoading? (
                  <div className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm font-bold text-zinc-500">Verificando entrega e retirada...</div>
                ) : orderOptions? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className={`rounded-2xl border px-4 py-3 ${deliveryAvailable? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
                      <p className={`font-black ${deliveryAvailable? "text-green-700" : "text-red-700"}`}>🛵 Entrega</p>
                      <p className={`mt-1 text-sm font-bold ${deliveryAvailable? "text-green-600" : "text-red-600"}`}>{deliveryAvailable? "Disponível" : "Temporariamente pausada"}</p>
                    </div>
                    <div className={`rounded-2xl border px-4 py-3 ${pickupAvailable? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
                      <p className={`font-black ${pickupAvailable? "text-green-700" : "text-red-700"}`}>🏪 Retirada na loja</p>
                      <p className={`mt-1 text-sm font-bold ${pickupAvailable? "text-green-600" : "text-red-600"}`}>{pickupAvailable? "Disponível" : "Temporariamente pausada"}</p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-500">Formas de pedido indisponíveis no momento.</div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* PRODUTOS - AGORA UM EMBAIXO DO OUTRO */}
        <div className="mt-8">
          {menuSections.length === 0? (
            <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
              <div className="text-5xl">🍔</div>
              <p className="mt-4 font-black">Nenhum produto disponível no momento</p>
            </div>
          ) : (
            menuSections.map((section) => (
              <section key={section.id} className="mt-8">
                <div className="mb-4 flex items-center gap-3">
                  <h2 className="text-xl font-black uppercase tracking-wide">{section.name}</h2>
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-black text-zinc-500">{section.products.length}</span>
                </div>
                {/* AQUI MUDANÇA PRINCIPAL: flex-col = um embaixo do outro */}
                <div className="flex flex-col gap-3">
                  {section.products.map((product) => {
                    const badge = productBadges[product.id];
                    const discount = discountForProduct(product.id);
                    const hasDiscount = discount > 0;
                    const finalPrice = priceForProduct(product);
                    return (
                      <button key={product.id} onClick={() => openProduct(product)} className="flex w-full items-center gap-4 rounded-2xl bg-white p-4 text-left shadow-sm transition hover:shadow-md border border-zinc-100">
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-50 text-3xl">
                          {product.image_url? <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" /> : <span>{fallbackEmoji(product.category)}</span>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate font-black text-[15px]">{product.name}</h3>
                            {badge?.badge_text && <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${productBadgeClass(badge.badge_color)}`}>{badge.badge_text}</span>}
                            {hasDiscount && <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black text-white">-{discount}%</span>}
                          </div>
                          {product.description && <p className="mt-1 line-clamp-2 text-sm text-zinc-500">{product.description}</p>}
                          <div className="mt-2 flex items-center gap-2">
                            {hasDiscount? (
                              <>
                                <span className="font-black text-red-600">{money(finalPrice)}</span>
                                <span className="text-xs text-zinc-400 line-through">{money(product.price)}</span>
                              </>
                            ) : (
                              <span className="font-black text-zinc-900">{money(product.price)}</span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>

        {/* AVALIAÇÕES - AGORA POR ÚLTIMO LÁ EMBAIXO */}
        <section id="avaliacoes" className="scroll-mt-28 mt-12 overflow-hidden rounded-3xl bg-white shadow-sm">
          <div className="border-b border-zinc-100 p-6 md:p-7">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-red-600">EXPERIÊNCIAS REAIS</p>
                <h2 className="mt-1 text-2xl font-black md:text-3xl">Avaliações dos clientes</h2>
                <p className="mt-2 text-sm text-zinc-500">Somente clientes com pedido pago e concluído podem avaliar.</p>
              </div>
              {reviewCount > 0 && <div className="rounded-full bg-green-50 px-3 py-2 text-xs font-black text-green-700">✓ Compra verificada</div>}
            </div>
          </div>
          {reviewsLoading? (
            <div className="p-8 text-center font-bold text-zinc-500">Carregando avaliações...</div>
          ) : reviewCount === 0? (
            <div className="p-8 text-center md:p-10">
              <div className="text-5xl">⭐</div>
              <h3 className="mt-4 text-xl font-black">Este restaurante ainda não recebeu avaliações</h3>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-zinc-500">Depois de um pedido pago e concluído, o cliente poderá deixar sua nota e comentário.</p>
            </div>
          ) : (
            <>
              <div className="grid gap-6 border-b border-zinc-100 p-6 md:grid-cols-[220px_1fr] md:p-7">
                <div className="flex flex-col items-center justify-center rounded-3xl bg-yellow-50 p-6 text-center">
                  <p className="text-6xl font-black leading-none text-zinc-900">{ratingNumberText(averageRating)}</p>
                  <div className="mt-4"><Stars value={averageRating} size="text-3xl" /></div>
                  <p className="mt-3 text-sm font-bold text-zinc-600">{reviewCount} {reviewCount === 1? "avaliação" : "avaliações"}</p>
                </div>
                <div className="space-y-3">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const current = reviewDistribution.find((item) => Number(item.star) === star);
                    const amount = Number(current?.review_count?? 0);
                    const percent = reviewCount > 0? Math.round((amount / reviewCount) * 100) : 0;
                    return (
                      <div key={star} className="grid grid-cols-[38px_1fr_42px] items-center gap-3">
                        <span className="text-sm font-black text-zinc-700">{star} ★</span>
                        <div className="h-2.5 overflow-hidden rounded-full bg-zinc-100"><div className="h-full rounded-full bg-yellow-400" style={{ width: `${percent}%` }} /></div>
                        <span className="text-right text-xs font-bold text-zinc-400">{amount}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="p-6 md:p-7">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-xl font-black">O que os clientes estão dizendo</h3>
                  <span className="text-sm font-bold text-zinc-400">Mais recentes</span>
                </div>
                <div className="mt-5 flex flex-col gap-4">
                  {visibleReviews.map((review) => (
                    <article key={review.review_id} className="rounded-2xl border border-zinc-200 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50 text-lg font-black text-red-600">{(review.customer_name || "C").slice(0, 1).toUpperCase()}</div>
                          <div className="min-w-0"><p className="truncate font-black">{review.customer_name}</p><p className="mt-0.5 text-xs font-bold text-green-700">✓ Pedido verificado</p></div>
                        </div>
                        <time className="shrink-0 text-xs font-bold text-zinc-400">{reviewDate(review.created_at)}</time>
                      </div>
                      <div className="mt-4 flex items-center gap-3"><Stars value={Number(review.rating)} /><span className="text-sm font-black text-zinc-700">{ratingNumberText(Number(review.rating))}</span></div>
                      {review.comment? <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-600">{review.comment}</p> : <p className="mt-4 text-sm italic text-zinc-400">Cliente deixou apenas a nota.</p>}
                    </article>
                  ))}
                </div>
                {publicReviews.length > 4 && (
                  <button type="button" onClick={() => setReviewsExpanded((current) =>!current)} className="mt-5 w-full rounded-xl border-2 border-zinc-200 px-5 py-4 font-black text-zinc-700 transition hover:bg-zinc-50">
                    {reviewsExpanded? "Mostrar menos" : `Ver todas as ${reviewCount} avaliações`}
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {/* MODAIS (mantive igual) */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={closeProduct}>
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-6 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div><h3 className="text-xl font-black">{selectedProduct.name}</h3><p className="mt-1 text-sm text-zinc-500">{selectedProduct.description}</p></div>
              <button onClick={closeProduct} className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 font-black">✕</button>
            </div>
            {loadingAddons? <div className="py-10 text-center font-bold text-zinc-500">Carregando adicionais...</div> : addonLoadError? <div className="mt-6 rounded-2xl bg-red-50 p-4 font-bold text-red-600">{addonLoadError}</div> : (
              <>
                {addonGroups.map((group) => (
                  <div key={group.group_id} className="mt-6 rounded-2xl border border-zinc-200 p-4">
                    <div className="flex justify-between"><p className="font-black">{group.name}</p><p className="text-xs font-bold text-zinc-500">{group.required? "Obrigatório" : "Opcional"} • {group.min_select}-{group.max_select}</p></div>
                    <div className="mt-3 space-y-2">
                      {group.options.map((option) => {
                        const qty = addonQuantities[group.group_id]?.[option.id]?? 0;
                        return (
                          <div key={option.id} className="flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2">
                            <div><p className="text-sm font-bold">{option.name}</p><p className="text-xs text-zinc-500">{money(option.price)}</p></div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => changeAddonQuantity(group, option, -1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white border font-black">-</button>
                              <span className="w-6 text-center font-black text-sm">{qty}</span>
                              <button onClick={() => changeAddonQuantity(group, option, 1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white font-black">+</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div className="mt-6">
                  <label className="text-sm font-black">Observação</label>
                  <textarea value={observation} onChange={(e) => setObservation(e.target.value)} placeholder="Ex: sem cebola" className="mt-2 w-full rounded-xl border border-zinc-200 p-3 text-sm" rows={2} />
                </div>
                {modalError && <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-600">{modalError}</div>}
                <div className="mt-6 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setModalQuantity((q) => Math.max(1, q - 1))} className="flex h-10 w-10 items-center justify-center rounded-full border font-black">-</button>
                    <span className="font-black">{modalQuantity}</span>
                    <button onClick={() => setModalQuantity((q) => q + 1)} className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-white font-black">+</button>
                  </div>
                  <button onClick={addConfiguredProduct} className="flex-1 rounded-full bg-red-600 py-3 font-black text-white">Adicionar {money(selectedTotal)}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {closedNoticeOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" onClick={() => setClosedNoticeOpen(false)}>
          <div className="w-full max-w-md rounded-3xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-black">Loja fechada</h3><p className="mt-2 text-sm text-zinc-600">{nextOpening || "No momento não estamos recebendo pedidos."}</p>
            <button onClick={() => setClosedNoticeOpen(false)} className="mt-6 w-full rounded-full bg-zinc-900 py-3 font-black text-white">Entendi</button>
          </div>
        </div>
      )}
      {operationNoticeOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" onClick={() => setOperationNoticeOpen(false)}>
          <div className="w-full max-w-md rounded-3xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-black">Pedidos pausados</h3><p className="mt-2 text-sm text-zinc-600">Entrega e retirada estão pausadas no momento.</p>
            <button onClick={() => setOperationNoticeOpen(false)} className="mt-6 w-full rounded-full bg-zinc-900 py-3 font-black text-white">Entendi</button>
          </div>
        </div>
      )}
      {cnpjBlockedNoticeOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" onClick={() => setCnpjBlockedNoticeOpen(false)}>
          <div className="w-full max-w-md rounded-3xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-black">Loja indisponível</h3><p className="mt-2 text-sm text-zinc-600">Esta loja precisa regularizar o CNPJ.</p>
            <button onClick={() => setCnpjBlockedNoticeOpen(false)} className="mt-6 w-full rounded-full bg-zinc-900 py-3 font-black text-white">Entendi</button>
          </div>
        </div>
      )}
    </main>
  );
}