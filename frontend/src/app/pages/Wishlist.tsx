import React, { useEffect, useState } from "react";
import { Heart, Loader2 } from "lucide-react";
import { Link } from "react-router";
import { api } from "../../api/client";
import type { Listing } from "../../types";
import { ProductCard } from "../components/ProductCard";
import { Button } from "../components/ui/button";

type Favorite = {
  id: string;
  listingId: string;
  listing: Listing;
};

export function Wishlist() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState("");

  useEffect(() => {
    api.get("/favorites")
      .then((response) => setFavorites(response.data.favorites ?? []))
      .finally(() => setLoading(false));
  }, []);

  const removeFavorite = async (listingId: string) => {
    setRemovingId(listingId);
    try {
      await api.delete(`/favorites/${listingId}`);
      setFavorites((current) => current.filter((favorite) => favorite.listingId !== listingId));
    } finally {
      setRemovingId("");
    }
  };

  if (loading) {
    return <div className="flex flex-1 items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <main className="container mx-auto flex-1 px-4 py-8">
      <div className="mb-8">
        <h1 className="flex items-center gap-2 text-3xl font-bold"><Heart className="h-7 w-7 text-primary" /> Saved listings</h1>
        <p className="mt-2 text-muted-foreground">Listings you saved for later.</p>
      </div>

      {favorites.length === 0 ? (
        <div className="rounded-2xl border bg-white p-10 text-center">
          <p className="font-semibold">Your wishlist is empty.</p>
          <Button asChild className="mt-4"><Link to="/browse">Browse listings</Link></Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {favorites.map((favorite) => (
            <div key={favorite.id} className="space-y-2">
              <ProductCard product={favorite.listing} />
              <Button
                variant="outline"
                className="w-full"
                disabled={removingId === favorite.listingId}
                onClick={() => removeFavorite(favorite.listingId)}
              >
                Remove from saved
              </Button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
