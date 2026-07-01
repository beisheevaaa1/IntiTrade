import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { Filter, Search, ChevronDown, Check, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { ProductCard } from "../components/ProductCard";
import { api } from "../../api/client";
import type { Listing, Category } from "../../types";

const staticCategories = [
  { name: "Textbooks", slug: "textbooks" },
  { name: "Electronics", slug: "electronics" },
  { name: "Clothing", slug: "clothing" },
  { name: "Furniture", slug: "furniture" },
  { name: "Academic Materials", slug: "academic-materials" },
  { name: "Room Essentials", slug: "room-essentials" },
  { name: "Sports Equipment", slug: "sports-equipment" },
  { name: "Services", slug: "services" },
  { name: "Free Items", slug: "free-items" },
  { name: "Others", slug: "others" }
];

export function BrowseListings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [listings, setListings] = useState<Listing[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Filter States
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") ?? "");
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get("category") ?? "");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Fetch categories
  useEffect(() => {
    api.get("/listings/categories")
      .then((res) => setCategories(res.data.categories))
      .catch((err) => console.error("Error fetching categories:", err));
  }, []);

  // Sync with URL params
  useEffect(() => {
    const search = searchParams.get("search");
    const category = searchParams.get("category");
    if (search !== null) setSearchQuery(search);
    if (category !== null) setSelectedCategory(category);
  }, [searchParams]);

  // Fetch Listings with filters
  const fetchListings = () => {
    setLoading(true);
    const params: any = {
      page,
      limit: 12,
      status: "ACTIVE",
    };

    if (searchQuery.trim()) params.search = searchQuery.trim();
    if (selectedCategory) params.category = selectedCategory;
    if (minPrice) params.minPrice = parseFloat(minPrice);
    if (maxPrice) params.maxPrice = parseFloat(maxPrice);
    if (selectedConditions.length > 0) params.condition = selectedConditions.join(",");
    
    // Sort
    if (sortBy === "price_asc") {
      params.sortBy = "price";
      params.sortOrder = "asc";
    } else if (sortBy === "price_desc") {
      params.sortBy = "price";
      params.sortOrder = "desc";
    } else if (sortBy === "popularity") {
      params.sortBy = "viewsCount";
      params.sortOrder = "desc";
    } else {
      params.sortBy = "createdAt";
      params.sortOrder = "desc";
    }

    api.get("/listings", { params })
      .then((res) => {
        setListings(res.data.listings || []);
        setTotalPages(res.data.totalPages || 1);
      })
      .catch((err) => console.error("Error fetching listings:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchListings();
  }, [selectedCategory, selectedConditions, sortBy, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams({ search: searchQuery, category: selectedCategory });
    fetchListings();
  };

  const handleConditionToggle = (cond: string) => {
    if (selectedConditions.includes(cond)) {
      setSelectedConditions(selectedConditions.filter(c => c !== cond));
    } else {
      setSelectedConditions([...selectedConditions, cond]);
    }
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedCategory("");
    setMinPrice("");
    setMaxPrice("");
    setSelectedConditions([]);
    setSortBy("newest");
    setPage(1);
    setSearchParams({});
  };

  return (
    <div className="bg-gray-50 flex-1">
      <div className="container mx-auto px-4 py-8 flex flex-col lg:flex-row gap-8">
        
        {/* Mobile Filter Toggle */}
        <div className="lg:hidden flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-foreground">Browse Listings</h1>
          <Button variant="outline" onClick={() => setIsFilterOpen(!isFilterOpen)} className="gap-2">
            <Filter className="w-4 h-4" /> Filters
          </Button>
        </div>

        {/* Sidebar Filters */}
        <aside className={`w-full lg:w-64 shrink-0 ${isFilterOpen ? 'block' : 'hidden lg:block'}`}>
          <div className="bg-white p-6 rounded-2xl border border-border sticky top-24">
            <div className="mb-6 flex justify-between items-center lg:hidden">
              <h2 className="font-bold text-lg">Filters</h2>
              <Button variant="ghost" size="sm" onClick={() => setIsFilterOpen(false)}>Close</Button>
            </div>
            
            {/* Search Input for Mobile/Sidebar */}
            <form onSubmit={handleSearchSubmit} className="mb-6 block md:hidden">
              <div className="relative">
                <Input 
                  placeholder="Search..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pr-10"
                />
                <button type="submit" className="absolute right-3 top-2.5">
                  <Search className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </form>

            {/* Categories */}
            <div className="mb-8">
              <h3 className="font-semibold mb-4 text-foreground">Categories</h3>
              <ul className="space-y-3">
                <li className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="category"
                      checked={selectedCategory === ""}
                      onChange={() => setSelectedCategory("")}
                      className="text-primary focus:ring-primary border-gray-300"
                    />
                    <span className={`text-sm ${selectedCategory === "" ? 'font-medium text-primary' : 'text-gray-600'}`}>All Categories</span>
                  </label>
                </li>
                {staticCategories.map(cat => (
                  <li key={cat.slug} className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="category"
                        checked={selectedCategory === cat.slug}
                        onChange={() => setSelectedCategory(cat.slug)}
                        className="text-primary focus:ring-primary border-gray-300"
                      />
                      <span className={`text-sm ${selectedCategory === cat.slug ? 'font-medium text-primary' : 'text-gray-600'}`}>{cat.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            {/* Price Range */}
            <div className="mb-8">
              <h3 className="font-semibold mb-4 text-foreground">Price Range (RM)</h3>
              <div className="flex items-center gap-2">
                <Input 
                  type="number" 
                  placeholder="Min" 
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="h-10 text-sm" 
                />
                <span className="text-gray-400">-</span>
                <Input 
                  type="number" 
                  placeholder="Max" 
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="h-10 text-sm" 
                />
              </div>
              <Button variant="outline" onClick={fetchListings} className="w-full mt-3 h-9 text-xs">Apply</Button>
            </div>

            {/* Condition */}
            <div className="mb-8">
              <h3 className="font-semibold mb-4 text-foreground">Condition</h3>
              <ul className="space-y-3">
                {[
                  { name: "New", code: "NEW" },
                  { name: "Like New", code: "LIKE_NEW" },
                  { name: "Good", code: "GOOD" },
                  { name: "Fair", code: "FAIR" }
                ].map(cond => (
                  <li key={cond.code}>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={selectedConditions.includes(cond.code)}
                        onChange={() => handleConditionToggle(cond.code)}
                        className="rounded text-primary focus:ring-primary border-gray-300" 
                      />
                      <span className="text-sm text-gray-600">{cond.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            <Button 
              variant="ghost" 
              onClick={clearAllFilters}
              className="w-full text-primary hover:text-primary-foreground font-semibold text-xs"
            >
              Clear All Filters
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1">
          <div className="hidden lg:flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-foreground">
              {selectedCategory 
                ? staticCategories.find(c => c.slug === selectedCategory)?.name 
                : "All Listings"}
            </h1>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Sort by:</span>
                <select 
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="h-9 px-3 bg-white text-sm font-normal border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="newest">Newest First</option>
                  <option value="popularity">Most Viewed</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                </select>
              </div>
            </div>
          </div>

          {/* Active Badges */}
          <div className="flex flex-wrap gap-2 mb-6">
            {selectedCategory && (
              <Badge variant="outline" className="bg-white border-gray-200 px-3 py-1 text-sm font-normal flex items-center gap-1">
                Category: {staticCategories.find(c => c.slug === selectedCategory)?.name}
                <button onClick={() => setSelectedCategory("")} className="ml-1 hover:bg-gray-100 rounded-full p-0.5">×</button>
              </Badge>
            )}
            {selectedConditions.map(cond => (
              <Badge key={cond} variant="outline" className="bg-white border-gray-200 px-3 py-1 text-sm font-normal flex items-center gap-1">
                Condition: {cond.replace("_", " ")}
                <button onClick={() => handleConditionToggle(cond)} className="ml-1 hover:bg-gray-100 rounded-full p-0.5">×</button>
              </Badge>
            ))}
            {(selectedCategory || selectedConditions.length > 0) && (
              <Button variant="ghost" onClick={clearAllFilters} size="sm" className="h-8 text-primary font-medium text-xs">Clear All</Button>
            )}
          </div>

          {/* Grid or Loader */}
          {loading ? (
            <div className="flex justify-center items-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : listings.length === 0 ? (
            <div className="text-center py-24 bg-white rounded-2xl border border-border">
              <h3 className="text-lg font-bold text-gray-900 mb-1">No items found</h3>
              <p className="text-muted-foreground text-sm">Try adjusting your filters or search keywords.</p>
              <Button onClick={clearAllFilters} className="mt-4">Reset Filters</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 mb-10">
              {listings.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex justify-center items-center gap-2">
              <Button 
                variant="outline" 
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="w-10 h-10 p-0 rounded-lg"
              >
                &lt;
              </Button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <Button 
                  key={i}
                  variant={page === i + 1 ? "default" : "outline"}
                  onClick={() => setPage(i + 1)}
                  className="w-10 h-10 p-0 rounded-lg"
                >
                  {i + 1}
                </Button>
              ))}
              <Button 
                variant="outline" 
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
                className="w-10 h-10 p-0 rounded-lg"
              >
                &gt;
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
