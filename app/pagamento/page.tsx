"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type PaymentMethod = "pix" | "card";
type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

type PaymentOrder = {
  id: string;
  restaurant_id: string;
  customer_id: string;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  status: string;
  total: number | string;
  created_at: string;
};

function money(value: number | string | null) {
  return Number(value?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function PaymentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order")?? "";

  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [restaurantName, setRestaurantName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);

  const loadPayment = useCallback(async (firstLoad = false) => {
    if (!orderId) {
      setError("Pedido não informado.");
      setLoading(false);
      return;
    }
    if (firstLoad) setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      sessionStorage.setItem("after-login", `/pagamento?order=${orderId}`);
      router.replace("/login");
      return;
    }

    const { data: orderData, error: orderError } = await supabase
     .from("orders")
     .select(`id, restaurant_id, customer_id, payment_method, payment_status, status, total, created_at`)
     .eq("id", orderId)
     .eq("customer_id", session.user.id)
     .maybeSingle();

    if (orderError ||!orderData) {
      setError("Não foi possível encontrar este pedido.");
      setLoading(false);
      return;
    }

    const currentOrder = orderData as PaymentOrder;
    setOrder(currentOrder);

    if (currentOrder.restaurant_id) {
      const { data: restaurantData } = await supabase
       .from("restaurants")
       .select("name")
       .eq("id", currentOrder.restaurant_id)
       .maybeSingle();
      if (restaurantData?.name) setRestaurantName(restaurantData.name);
    }
    setError("");
    setLoading(false);
  }, [orderId, router]);

  // CORRIGIDO - AGORA USA A API QUE PASSA PELO RLS
  async function confirmDemoOrder() {
    if (!orderId || confirming) return;
    setConfirming(true);
    try {
      const res = await fetch("/api/demo/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao confirmar");

      await loadPayment();
      router.push(`/pedido/${orderId}`);
    } catch (e: any) {
      alert("Erro: " + e.message);
    } finally {
      setConfirming(false);
    }
  }

  useEffect(() => { loadPayment(true); }, [loadPayment]);

  useEffect(() => {
    if (!orderId) return;
    const interval = window.setInterval(() => loadPayment(), 3000);
    return () => window.clearInterval(interval);
  }, [orderId, loadPayment]);

  useEffect(() => {
    if (order?.payment_status!== "paid") return;
    const timer = window.setTimeout(() => {
      router.replace(`/restaurante/${order.restaurant_id}`);
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [order, router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7] px-4">
        <p className="font-black">Carregando pagamento...</p>
      </main>
    );
  }

  if (error ||!order) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7] px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
          <h1 className="mt-4 text-2xl font-black">Pagamento não encontrado</h1>
          <p className="mt-3 text-zinc-500">{error}</p>
          <Link href="/meus-pedidos" className="mt-6 block rounded-xl bg-red-600 px-5 py-4 font-black text-white">
            Ver meus pedidos
          </Link>
        </div>
      </main>
    );
  }

  if (order.payment_status === "paid") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7] px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
          <div className="text-6xl">✅</div>
          <h1 className="mt-5 text-2xl font-black text-green-700">Pagamento confirmado!</h1>
          <p className="mt-3 text-zinc-500">O pedido foi liberado para {restaurantName || " o restaurante"}.</p>
          <div className="mt-5 rounded-2xl bg-green-50 p-4 text-sm font-bold text-green-700">Redirecionando...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f7f7] px-4 py-8 text-zinc-900">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-3xl bg-white p-6 shadow-sm sm:p-7">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-3xl">💠</div>
            <h1 className="mt-4 text-2xl font-black">Confirmar Pedido</h1>
            <p className="mt-2 text-sm text-zinc-500">Modo demonstração para apresentação</p>
            <p className="mt-1 text-xs text-zinc-400">Pedido para <strong className="text-zinc-600">{restaurantName || "o restaurante"}</strong></p>
          </div>

          <div className="mt-5 rounded-2xl bg-zinc-50 p-4 text-center">
            <p className="text-xs font-black uppercase tracking-wide text-zinc-400">Total a pagar</p>
            <p className="mt-1 text-3xl font-black">{money(order.total)}</p>
          </div>

          <section className="mt-6">
            <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-center">
              <p className="text-sm font-black text-yellow-800">⚠️ Modo Demonstração</p>
              <p className="mt-1 text-xs leading-5 text-yellow-700">O QRCode do PIX foi removido para a apresentação. Clique abaixo para simular o pagamento.</p>
            </div>

            <button
              type="button"
              onClick={confirmDemoOrder}
              disabled={confirming}
              className="mt-4 w-full rounded-xl bg-green-600 px-5 py-4 text-base font-black text-white transition hover:bg-green-700 disabled:opacity-50"
            >
              {confirming? "Confirmando..." : `✅ Confirmar Pedido - ${money(order.total)}`}
            </button>

            <p className="mt-3 text-center text-xs text-zinc-400">
              Ao confirmar, o pedido aparecerá automaticamente no site da loja.
            </p>
          </section>

          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-emerald-50 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white">⏳</div>
            <div>
              <p className="text-sm font-black text-emerald-800">Aguardando confirmação</p>
              <p className="mt-0.5 text-xs text-emerald-700">Clique em confirmar para enviar para a loja.</p>
            </div>
          </div>

          <div className="mt-5 flex justify-between border-t border-zinc-100 pt-4 text-xs text-zinc-400">
            <span>Pedido</span><strong className="text-zinc-500">#{order.id.slice(0, 8).toUpperCase()}</strong>
          </div>

          <Link href="/meus-pedidos" className="mt-4 block text-center text-sm font-bold text-zinc-500">Ver meus pedidos</Link>
        </div>
      </div>
    </main>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-[#f7f7f7]"><p className="font-black">Carregando...</p></main>}>
      <PaymentPageContent />
    </Suspense>
  );
}