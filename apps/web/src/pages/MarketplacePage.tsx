import { BadgeCheck, Clock, Search, ShieldCheck, SlidersHorizontal, Sparkles } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";
import { ListingCard } from "../components/ListingCard";
import { useAuth } from "../state/AuthContext";
import type { Category, Listing, ListingType } from "../types";

export function MarketplacePage() {
  const { user } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ q: "", type: "", category: "", sort: "newest" });
  const activeProducts = listings.filter((listing) => listing.type === "PRODUCT").length;
  const activeServices = listings.filter((listing) => listing.type === "SERVICE").length;

  async function loadListings() {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/listings", { params: filters });
      setListings(response.data.listings);
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
    loadListings();
  }

  async function saveFavorite(id: string) {
    if (!user) return;
    await api.post(`/favorites/${id}`);
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="panel overflow-hidden p-5 md:p-7">
          <div className="grid gap-6 lg:grid-cols-[1fr_310px] lg:items-end">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-campus">
                <Sparkles size={16} /> Campus exchange
              </p>
              <h1 className="mt-2 max-w-3xl text-4xl font-bold leading-tight md:text-5xl">Find trusted student deals fast.</h1>
              <p className="mt-4 max-w-2xl text-lg text-ink/65">
                Search products and services, save listings, and start a conversation with verified students on campus.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <span className="trust-pill"><BadgeCheck size={16} /> Verified email</span>
                <span className="trust-pill"><ShieldCheck size={16} /> Admin moderated</span>
                <span className="trust-pill"><Clock size={16} /> Fast chat</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center lg:grid-cols-1">
              <div className="metric"><strong>{listings.length}</strong><span>Active</span></div>
              <div className="metric"><strong>{activeProducts}</strong><span>Products</span></div>
              <div className="metric"><strong>{activeServices}</strong><span>Services</span></div>
            </div>
          </div>
        </div>
        <aside className="panel p-5">
          <div className="campus-strip mb-4" />
          <h2 className="text-xl font-bold">Safe campus trading</h2>
          <p className="mt-2 text-sm leading-6 text-ink/65">
            Meet in public university areas, keep payments offline for v1, and report suspicious listings for admin review.
          </p>
          <div className="mt-4 space-y-2 text-sm">
            <div className="rounded-md bg-white p-3"><strong>Student-only access</strong><br /><span className="text-ink/55">Email domain verification</span></div>
            <div className="rounded-md bg-white p-3"><strong>No platform fees</strong><br /><span className="text-ink/55">Arrange deals directly</span></div>
          </div>
        </aside>
      </section>

      <section className="grid gap-5 xl:grid-cols-[280px_1fr]">
        <form onSubmit={applyFilters} className="panel h-fit p-5">
          <div className="mb-4 flex items-center gap-2 font-semibold"><SlidersHorizontal size={18} /> Filters</div>
          <label className="field">
            <span>Search</span>
            <div className="input-with-icon">
              <Search size={17} />
              <input value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} placeholder="Textbooks, laptops, tutoring..." />
            </div>
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-1">
            <label className="field">
              <span>Type</span>
              <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value as ListingType | "" })}>
                <option value="">All</option>
                <option value="PRODUCT">Products</option>
                <option value="SERVICE">Services</option>
              </select>
            </label>
            <label className="field">
              <span>Sort</span>
              <select value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })}>
                <option value="newest">Newest</option>
                <option value="price_asc">Price low</option>
                <option value="price_desc">Price high</option>
              </select>
            </label>
          </div>
          <label className="field mt-3">
            <span>Category</span>
            <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
              <option value="">All categories</option>
              {categories.map((category) => <option key={category.id} value={category.slug}>{category.name}</option>)}
            </select>
          </label>
          <button className="button-primary mt-4 w-full" type="submit">Apply filters</button>
        </form>

        <div className="space-y-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-2xl font-bold">Fresh listings</h2>
              <p className="text-sm text-ink/60">Products and services from verified students.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {["All", "Products", "Services", "Textbooks", "Tutoring"].map((item) => <span className="category-chip" key={item}>{item}</span>)}
            </div>
          </div>

          {error && <div className="panel border-danger/30 bg-red-50 p-4 text-sm text-danger">{error}</div>}

          {loading ? (
            <div className="panel p-6">Loading listings...</div>
          ) : !error && listings.length ? (
            <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {listings.map((listing) => <ListingCard key={listing.id} listing={listing} onFavorite={user ? saveFavorite : undefined} />)}
            </section>
          ) : !error ? (
            <div className="panel p-8 text-center text-ink/65">No active listings match these filters.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
