import { useEffect, useState } from "react";
import { api } from "../api/client";
import { ListingCard } from "../components/ListingCard";
import type { Listing } from "../types";

type Favorite = { id: string; listing: Listing };

export function FavoritesPage() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  useEffect(() => {
    api.get("/favorites").then((response) => setFavorites(response.data.favorites));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Saved listings</h1>
      {favorites.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {favorites.map((favorite) => <ListingCard key={favorite.id} listing={favorite.listing} />)}
        </div>
      ) : (
        <div className="panel p-6 text-ink/65">No saved listings yet.</div>
      )}
    </div>
  );
}
