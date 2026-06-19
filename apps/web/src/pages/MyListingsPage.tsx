import { useEffect, useState } from "react";
import { api } from "../api/client";
import { ListingCard } from "../components/ListingCard";
import type { Listing, ListingStatus } from "../types";

export function MyListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  useEffect(() => {
    api.get("/listings/mine").then((response) => setListings(response.data.listings));
  }, []);

  async function updateStatus(id: string, status: ListingStatus) {
    const response = await api.patch(`/listings/${id}/status`, { status });
    setListings((current) => current.map((listing) => listing.id === id ? response.data.listing : listing));
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">My listings</h1>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {listings.map((listing) => (
          <div key={listing.id} className="space-y-2">
            <ListingCard listing={listing} />
            <div className="flex gap-2">
              <button className="button-secondary flex-1" onClick={() => updateStatus(listing.id, "SOLD")}>Mark sold</button>
              <button className="button-secondary flex-1" onClick={() => updateStatus(listing.id, "ARCHIVED")}>Archive</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
