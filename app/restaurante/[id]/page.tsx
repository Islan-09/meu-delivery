import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import RestaurantClient from "./RestaurantClient";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function RestaurantPage({
  params,
}: PageProps) {
  const { id } = await params;

  const {
    data: restaurant,
    error: restaurantError,
  } = await supabase
    .from("restaurants")
    .select(`
  id,
  name,
  description,
  neighborhood,
  cover_url,
  minimum_order,
  delivery_base_fee,
  estimated_delivery_minutes
`)
    .eq("id", id)
    .eq("active", true)
    .single();

  if (restaurantError || !restaurant) {
    notFound();
  }

  const {
    data: products,
    error: productsError,
  } = await supabase
    .from("products")
    .select(`
      id,
      name,
      description,
      category,
      price,
      image_url
    `)
    .eq("restaurant_id", id)
    .eq("active", true)
    .order("category", {
      ascending: true,
    })
    .order("name", {
      ascending: true,
    });

  if (productsError) {
    console.error(productsError);
  }

  return (
    <RestaurantClient
      restaurant={restaurant}
      products={products ?? []}
    />
  );
}