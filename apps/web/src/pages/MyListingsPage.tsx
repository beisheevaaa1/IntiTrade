import { AlertTriangle, Archive, CheckCircle, Eye, Heart, Package } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { ListingCard } from "../components/ListingCard";
import type { Listing, ListingStatus } from "../types";

export function MyListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [activeTab, setActiveTab] = useState<ListingStatus | "ALL">("ACTIVE");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get("/listings/mine")
      .then((response) => setListings(response.data.listings))
      .finally(() => setLoading(false));
  }, []);

  async function updateStatus(id: string, status: ListingStatus) {
    try {
      const response = await api.patch(`/listings/${id}/status`, { status });
      setListings((current) => current.map((listing) => listing.id === id ? response.data.listing : listing));
    } catch (e) {
      alert("Status update failed. Check permissions.");
    }
  }

  const filteredListings = activeTab === "ALL" ? listings : listings.filter((l) => l.status === activeTab);

  const getStatusCount = (status: ListingStatus) => listings.filter((l) => l.status === status).length;

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-ink">My Student Dashboard</h1>
          <p className="text-sm text-ink/60 mt-1">Manage your posted items, track view statistics, and review moderation status.</p>
        </div>
        <Link to="/listings/new" className="button-primary bg-gradient-to-r from-campus to-lake shadow-md hover:shadow-lg">
          + Post New Listing
        </Link>
      </div>

      {/* Status Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-line/60 pb-3">
        {[
          { key: "ACTIVE" as const, label: "🟢 Active", count: getStatusCount("ACTIVE") },
          { key: "PENDING" as const, label: "⏳ Pending Review", count: getStatusCount("PENDING") },
          { key: "SOLD" as const, label: "🤝 Sold", count: getStatusCount("SOLD") },
          { key: "REJECTED" as const, label: "❌ Rejected", count: getStatusCount("REJECTED") },
          { key: "ARCHIVED" as const, label: "📁 Archived", count: getStatusCount("ARCHIVED") },
          { key: "ALL" as const, label: "All Items", count: listings.length }
        ].map((tab) => (
          <button
            type="button"
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition flex items-center gap-2 ${
              activeTab === tab.key
                ? "bg-campus text-white shadow-sm"
                : "bg-white border border-line text-ink/70 hover:border-campus/40"
            }`}
          >
            <span>{tab.label}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] ${activeTab === tab.key ? "bg-white/20 text-white" : "bg-paper text-ink"}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 animate-pulse">
          {[1, 2, 3].map((n) => <div key={n} className="panel h-80 bg-line/20 rounded-xl" />)}
        </div>
      ) : filteredListings.length ? (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {filteredListings.map((listing) => (
            <div key={listing.id} className="panel p-4 flex flex-col justify-between shadow-soft bg-white border border-line/80 relative overflow-hidden">
              <div>
                {/* Rejection Alert Box */}
                {listing.status === "REJECTED" && (
                  <div className="mb-3 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-danger flex items-start gap-2">
                    <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">Moderation Notice: Rejected</strong>
                      <span>{listing.rejectionReason || "Listing did not meet university marketplace guidelines."}</span>
                    </div>
                  </div>
                )}

                {/* Status Badge */}
                <div className="mb-2 flex items-center justify-between text-xs font-bold">
                  <span className={`rounded-md px-2 py-1 uppercase tracking-wider text-[10px] ${
                    listing.status === "ACTIVE" ? "bg-green-100 text-green-800" :
                    listing.status === "PENDING" ? "bg-yellow-100 text-yellow-800" :
                    listing.status === "SOLD" ? "bg-blue-100 text-blue-800" :
                    listing.status === "REJECTED" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-800"
                  }`}>
                    {listing.status}
                  </span>
                  <div className="flex items-center gap-3 text-ink/50">
                    <span className="flex items-center gap-1" title="Views"><Eye size={14} /> {listing.viewsCount ?? 0}</span>
                    <span className="flex items-center gap-1" title="Favorites"><Heart size={14} /> {listing._count?.favorites ?? 0}</span>
                  </div>
                </div>

                <ListingCard listing={listing} />
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-line/50 flex gap-2">
                {listing.status === "ACTIVE" && (
                  <>
                    <button
                      type="button"
                      className="button-primary flex-1 bg-lake text-xs py-1.5"
                      onClick={() => updateStatus(listing.id, "SOLD")}
                    >
                      <CheckCircle size={14} /> Mark Sold
                    </button>
                    <button
                      type="button"
                      className="button-secondary flex-1 text-xs py-1.5"
                      onClick={() => updateStatus(listing.id, "ARCHIVED")}
                    >
                      <Archive size={14} /> Archive
                    </button>
                  </>
                )}
                {(listing.status === "SOLD" || listing.status === "ARCHIVED") && (
                  <button
                    type="button"
                    className="button-secondary w-full text-xs py-1.5"
                    onClick={() => updateStatus(listing.id, "ACTIVE")}
                  >
                    🔄 Relist Item
                  </button>
                )}
                {listing.status === "REJECTED" && (
                  <Link to={`/listings/${listing.id}`} className="button-secondary w-full text-center text-xs py-1.5 text-danger border-danger/30">
                    ✏️ Edit & Resubmit
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="panel p-12 text-center bg-white/60">
          <Package size={48} className="mx-auto text-ink/30 mb-3" />
          <h3 className="text-lg font-bold text-ink">No items in "{activeTab}" status</h3>
          <p className="text-sm text-ink/60 mt-1">You haven't posted any listings matching this status filter yet.</p>
          <Link to="/listings/new" className="button-primary mt-4 text-xs">
            Post Your First Listing
          </Link>
        </div>
      )}
    </div>
  );
}
