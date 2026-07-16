import React, { useEffect, useState } from "react";
import { Heart, Loader2 } from "lucide-react";
import { Link } from "react-router";
import { api, mediaUrl } from "../../api/client";
import type { Listing, ListingStatus, PresentedListing } from "../../types";
import { ProductCard } from "../components/ProductCard";
import { Button } from "../components/ui/button";

type Favorite = {
  id: string;
  listingId: string;
  listing: PresentedListing | null;
};

function isPublicListing(listing: PresentedListing | null): listing is Listing {
  return Boolean(listing && listing.status === "ACTIVE" && !listing.unavailable && typeof listing.price === "string");
}

function availabilityMessage(status?: ListingStatus) {
  switch (status) {
    case "PENDING": return "This listing is awaiting moderation and cannot be opened right now.";
    case "REJECTED": return "This listing was not approved for the marketplace.";
    case "SOLD": return "This listing has been sold and is no longer available.";
    case "ARCHIVED": return "This listing was archived by its seller.";
    default: return "This listing is no longer available.";
  }
}

export function Wishlist() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    api.get("/favorites")
      .then((response) => setFavorites(Array.isArray(response.data.favorites) ? response.data.favorites : []))
      .catch(() => setLoadError("Saved listings could not be loaded. Please try again."))
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

      {loadError ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-800">{loadError}</div>
      ) : favorites.length === 0 ? (
        <div className="rounded-2xl border bg-white p-10 text-center">
          <p className="font-semibold">Your wishlist is empty.</p>
          <Button asChild className="mt-4"><Link to="/browse">Browse listings</Link></Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {favorites.map((favorite) => (
            <div key={favorite.id} className="space-y-2">
              {isPublicListing(favorite.listing) ? (
                <ProductCard product={favorite.listing} />
              ) : (
                <article className="overflow-hidden rounded-2xl border border-border bg-white" data-testid="unavailable-favorite">
                  <div className="aspect-square bg-muted">
                    <img
                      src={favorite.listing?.images?.[0]?.url ? mediaUrl(favorite.listing.images[0].url) : "/placeholder-item.svg"}
                      alt=""
                      className="h-full w-full object-cover opacity-70"
                      onError={(event) => { (event.currentTarget as HTMLImageElement).src = "/placeholder-item.svg"; }}
                    />
                  </div>
                  <div className="space-y-2 p-4">
                    <h2 className="font-semibold text-foreground">{favorite.listing?.title || "Listing unavailable"}</h2>
                    <p className="text-sm text-muted-foreground">{availabilityMessage(favorite.listing?.status)}</p>
                  </div>
                </article>
              )}
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
