import { BadgeCheck, Clock, Search, ShieldCheck, SlidersHorizontal, Sparkles } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";
import { ListingCard } from "../components/ListingCard";
import { useAuth } from "../state/AuthContext";
import type { Category, Listing, ListingCondition, ListingType } from "../types";

export function MarketplacePage() {
  const { user } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ q: "", type: "", category: "", condition: "", sort: "newest", page: 1 });
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });

  const activeProducts = listings.filter((listing) => listing.type === "PRODUCT").length;
  const activeServices = listings.filter((listing) => listing.type === "SERVICE").length;

  async function loadListings(customFilters?: typeof filters) {
    setLoading(true);
    setError("");
    const queryParams = customFilters ?? filters;
    try {
      const response = await api.get("/listings", { params: queryParams });
      setListings(response.data.listings);
      if (response.data.pagination) {
        setPagination(response.data.pagination);
      }
    } catch {
      setListings([]);
      setError("Marketplace data is unavailable. Check that PostgreSQL is running and migrations have been applied.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api.get("/listings/categories")
      .then((response) => setCategories(response.data.categories))
      .catch(() => setError("Marketplace data is unavailable. Check that PostgreSQL is running and migrations have been applied."));
    loadListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    const updated = { ...filters, page: 1 };
    setFilters(updated);
    loadListings(updated);
  }

  function handleChipClick(chipType: string, val: string) {
    let updated = { ...filters, page: 1 };
    if (chipType === "all") {
      updated = { ...updated, type: "", category: "" };
    } else if (chipType === "type") {
      updated = { ...updated, type: val === filters.type ? "" : val, category: "" };
    } else if (chipType === "category") {
      updated = { ...updated, category: val === filters.category ? "" : val };
    }
    setFilters(updated);
    loadListings(updated);
  }

  function handlePageChange(newPage: number) {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    const updated = { ...filters, page: newPage };
    setFilters(updated);
    loadListings(updated);
    window.scrollTo({ top: 400, behavior: "smooth" });
  }

  async function saveFavorite(id: string) {
    if (!user) return;
    await api.post(`/favorites/${id}`);
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Hero Banner */}
      <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="panel overflow-hidden p-6 md:p-8 bg-gradient-to-br from-surface via-white to-paper border-campus/20">
          <div className="grid gap-6 lg:grid-cols-[1fr_310px] lg:items-end">
            <div>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-campus">
                <Sparkles size={16} /> Campus exchange
              </p>
              <h1 className="mt-2 max-w-3xl text-3xl font-extrabold leading-tight md:text-5xl text-ink">Find trusted student deals fast.</h1>
              <p className="mt-3 max-w-2xl text-base text-ink/70">
                Search products and services, save listings, and start a conversation with verified students on campus.
              </p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <span className="trust-pill shadow-xs"><BadgeCheck size={16} className="text-campus" /> Verified email</span>
                <span className="trust-pill shadow-xs"><ShieldCheck size={16} className="text-lake" /> Admin moderated</span>
                <span className="trust-pill shadow-xs"><Clock size={16} className="text-signal" /> Fast chat</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center lg:grid-cols-1">
              <div className="metric shadow-xs"><strong>{pagination.total || listings.length}</strong><span>Total Items</span></div>
              <div className="metric shadow-xs"><strong>{activeProducts}</strong><span>Products</span></div>
              <div className="metric shadow-xs"><strong>{activeServices}</strong><span>Services</span></div>
            </div>
          </div>
        </div>
        <aside className="panel p-6 flex flex-col justify-between bg-white/80">
          <div>
            <div className="campus-strip mb-4" />
            <h2 className="text-xl font-bold text-ink">Safe campus trading</h2>
            <p className="mt-2 text-sm leading-6 text-ink/70">
              Meet in public university areas, keep payments offline for v1, and report suspicious listings for admin review.
            </p>
          </div>
          <div className="mt-5 space-y-2.5 text-sm">
            <div className="rounded-lg border border-line/60 bg-paper/60 p-3">
              <strong className="text-ink">Student-only access</strong><br />
              <span className="text-xs text-ink/60">Verified university domains</span>
            </div>
            <div className="rounded-lg border border-line/60 bg-paper/60 p-3">
              <strong className="text-ink">Zero Platform Fees</strong><br />
              <span className="text-xs text-ink/60">Direct peer-to-peer deals</span>
            </div>
          </div>
        </aside>
      </section>

      {/* Quick Category Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 scrollbar-none">
        <button
          type="button"
          onClick={() => handleChipClick("all", "")}
          className={`category-chip cursor-pointer whitespace-nowrap transition ${
            !filters.type && !filters.category ? "bg-campus text-white font-bold border-campus shadow-sm" : "hover:border-campus/50"
          }`}
        >
          ✨ All Items
        </button>
        <button
          type="button"
          onClick={() => handleChipClick("type", "PRODUCT")}
          className={`category-chip cursor-pointer whitespace-nowrap transition ${
            filters.type === "PRODUCT" ? "bg-campus text-white font-bold border-campus shadow-sm" : "hover:border-campus/50"
          }`}
        >
          📦 Products Only
        </button>
        <button
          type="button"
          onClick={() => handleChipClick("type", "SERVICE")}
          className={`category-chip cursor-pointer whitespace-nowrap transition ${
            filters.type === "SERVICE" ? "bg-campus text-white font-bold border-campus shadow-sm" : "hover:border-campus/50"
          }`}
        >
          🛠️ Services Only
        </button>
        {categories.map((cat) => (
          <button
            type="button"
            key={cat.id}
            onClick={() => handleChipClick("category", cat.slug)}
            className={`category-chip cursor-pointer whitespace-nowrap transition ${
              filters.category === cat.slug ? "bg-lake text-white font-bold border-lake shadow-sm" : "hover:border-lake/50"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <section className="grid gap-6 xl:grid-cols-[280px_1fr]">
        {/* Filters Sidebar */}
        <form onSubmit={applyFilters} className="panel h-fit p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between font-bold text-ink border-b border-line/60 pb-3">
            <span className="flex items-center gap-2"><SlidersHorizontal size={18} /> Filters</span>
            {(filters.q || filters.type || filters.category || filters.condition) && (
              <button
                type="button"
                onClick={() => { const reset = { q: "", type: "", category: "", condition: "", sort: "newest", page: 1 }; setFilters(reset); loadListings(reset); }}
                className="text-xs text-campus hover:underline"
              >
                Reset
              </button>
            )}
          </div>

          <label className="field">
            <span>Search Keywords</span>
            <div className="input-with-icon mt-1">
              <Search size={17} className="text-ink/40" />
              <input value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} placeholder="Textbooks, tech..." />
            </div>
          </label>

          <label className="field">
            <span>Listing Type</span>
            <select className="mt-1" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value as ListingType | "" })}>
              <option value="">All Types</option>
              <option value="PRODUCT">Products</option>
              <option value="SERVICE">Services</option>
            </select>
          </label>

          <label className="field">
            <span>Category</span>
            <select className="mt-1" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
              <option value="">All Categories</option>
              {categories.map((category) => <option key={category.id} value={category.slug}>{category.name}</option>)}
            </select>
          </label>

          <label className="field">
            <span>Condition</span>
            <select className="mt-1" value={filters.condition} onChange={(e) => setFilters({ ...filters, condition: e.target.value as ListingCondition | "" })}>
              <option value="">Any Condition</option>
              <option value="NEW">✨ Brand New</option>
              <option value="LIKE_NEW">🌟 Like New</option>
              <option value="GOOD">👍 Good</option>
              <option value="FAIR">👌 Fair</option>
            </select>
          </label>

          <label className="field">
            <span>Sort By</span>
            <select className="mt-1" value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })}>
              <option value="newest">Newest First</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
          </label>

          <button className="button-primary w-full mt-2 shadow-sm" type="submit">Apply Filters</button>
        </form>

        {/* Feed & Grid */}
        <div className="space-y-4">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-2xl font-extrabold text-ink">
                {filters.category ? categories.find((c) => c.slug === filters.category)?.name || "Filtered Listings" : "Fresh Listings"}
              </h2>
              <p className="text-sm text-ink/60">Showing {listings.length} of {pagination.total || listings.length} items</p>
            </div>
          </div>

          {error && <div className="panel border-danger/30 bg-red-50 p-4 text-sm text-danger">{error}</div>}

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3 animate-pulse">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="panel h-80 bg-line/20 rounded-xl" />
              ))}
            </div>
          ) : !error && listings.length ? (
            <>
              <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {listings.map((listing) => <ListingCard key={listing.id} listing={listing} onFavorite={user ? saveFavorite : undefined} />)}
              </section>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2 pt-4 border-t border-line/60">
                  <button
                    type="button"
                    disabled={pagination.page <= 1}
                    onClick={() => handlePageChange(pagination.page - 1)}
                    className="button-secondary disabled:opacity-40 disabled:cursor-not-allowed text-xs py-1.5 px-3"
                  >
                    ← Prev
                  </button>
                  <span className="text-xs font-semibold text-ink px-2">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => handlePageChange(pagination.page + 1)}
                    className="button-secondary disabled:opacity-40 disabled:cursor-not-allowed text-xs py-1.5 px-3"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          ) : !error ? (
            <div className="panel p-12 text-center">
              <span className="text-4xl block mb-2">🔍</span>
              <h3 className="text-lg font-bold text-ink">No matching listings found</h3>
              <p className="text-sm text-ink/60 mt-1">Try broadening your search keywords or resetting the filters.</p>
              <button
                type="button"
                onClick={() => { const reset = { q: "", type: "", category: "", condition: "", sort: "newest", page: 1 }; setFilters(reset); loadListings(reset); }}
                className="button-primary mt-4 text-xs"
              >
                Reset All Filters
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
