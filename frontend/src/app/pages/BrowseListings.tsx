import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { Filter, Search, ChevronDown, Check, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { ProductCard } from "../components/ProductCard";
import { ProductGridSkeleton } from "../components/ProductCardSkeleton";
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
  { name: "Tutoring", slug: "tutoring" },
  { name: "Courses", slug: "courses" },
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
  const [listingType, setListingType] = useState("");
  const [sellerType, setSellerType] = useState("");
  const [location, setLocation] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [isbn, setIsbn] = useState("");
  const [minRating, setMinRating] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const selectedCategorySlugs = selectedCategory.split(",").filter(Boolean);

  const setCategoryFilter = (slugs: string[]) => {
    const value = slugs.join(",");
    setSelectedCategory(value);
    const newParams = new URLSearchParams(searchParams);
    if (value) newParams.set("category", value);
    else newParams.delete("category");
    newParams.delete("page");
    setSearchParams(newParams);
  };

  const toggleCategory = (slug: string) => {
    setCategoryFilter(
      selectedCategorySlugs.includes(slug)
        ? selectedCategorySlugs.filter((selected) => selected !== slug)
        : [...selectedCategorySlugs, slug]
    );
  };

  // Fetch categories
  useEffect(() => {
    api.get("/listings/categories")
      .then((res) => setCategories(res.data.categories))
      .catch((err) => console.error("Error fetching categories:"));
  }, []);

  // Sync with URL params
  useEffect(() => {
    const search = searchParams.get("search") ?? "";
    const category = searchParams.get("category") ?? "";
    setSearchQuery(search);
    setSelectedCategory(category);
  }, [searchParams]);

  // Live search debounce (350ms)
  useEffect(() => {
    const currentParam = searchParams.get("search") ?? "";
    if (searchQuery !== currentParam) {
      const timer = setTimeout(() => {
        const newParams = new URLSearchParams(searchParams);
        if (searchQuery.trim()) newParams.set("search", searchQuery.trim());
        else newParams.delete("search");
        newParams.delete("page");
        setSearchParams(newParams);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, searchParams]);

  // Fetch Listings with filters
  const fetchListings = (currentPage = page, append = false) => {
    setLoading(true);
    const params: any = {
      page: currentPage,
      limit: 12,
      status: "ACTIVE",
    };

    const searchVal = searchParams.get("search") || "";
    const categoryVal = searchParams.get("category") || "";

    if (searchVal.trim()) params.search = searchVal.trim();
    if (categoryVal) params.category = categoryVal;
    if (minPrice) params.minPrice = parseFloat(minPrice);
    if (maxPrice) params.maxPrice = parseFloat(maxPrice);
    if (selectedConditions.length > 0) params.condition = selectedConditions.join(",");
    if (listingType) params.type = listingType;
    if (sellerType) params.sellerType = sellerType;
    if (location) params.location = location;
    if (courseCode) params.courseCode = courseCode;
    if (isbn) params.isbn = isbn;
    if (minRating) params.minRating = minRating;
    
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
        const newListings = res.data.listings || [];
        setListings((prev) => append ? [...prev, ...newListings] : newListings);
        setTotalPages(res.data.pagination?.totalPages || 1);
      })
      .catch((err) => console.error("Error fetching listings:"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setPage(1);
    fetchListings(1, false);
  }, [searchParams, selectedConditions, listingType, sellerType, minRating, sortBy]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams({ search: searchQuery, category: selectedCategory });
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchListings(nextPage, true);
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
    setListingType("");
    setSellerType("");
    setLocation("");
    setCourseCode("");
    setIsbn("");
    setMinRating("");
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
                      onChange={() => {
                        setCategoryFilter([]);
                      }}
                      className="text-primary focus:ring-primary border-gray-300"
                    />
                    <span className={`text-sm ${selectedCategory === "" ? 'font-medium text-primary' : 'text-gray-600'}`}>All Categories</span>
                  </label>
                </li>
                {(categories.length ? categories : staticCategories).map(cat => (
                  <li key={cat.slug} className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                      type="checkbox"
                        name="category"
                        checked={selectedCategorySlugs.includes(cat.slug)}
                        onChange={() => toggleCategory(cat.slug)}
                        className="text-primary focus:ring-primary border-gray-300"
                      />
                      <span className={`text-sm ${selectedCategorySlugs.includes(cat.slug) ? 'font-medium text-primary' : 'text-gray-600'}`}>{cat.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mb-8 space-y-3">
              <h3 className="font-semibold text-foreground">Listing type</h3>
              <select value={listingType} onChange={(e) => setListingType(e.target.value)} className="w-full h-10 px-3 bg-white border border-border rounded-md text-sm">
                <option value="">All</option>
                <option value="PRODUCT">Products</option>
                <option value="SERVICE">Services</option>
                <option value="COURSE">Courses</option>
              </select>
              <select value={sellerType} onChange={(e) => setSellerType(e.target.value)} className="w-full h-10 px-3 bg-white border border-border rounded-md text-sm">
                <option value="">Any seller</option>
                <option value="CASUAL">Casual sellers</option>
                <option value="SHOP">Campus shops</option>
                <option value="SERVICE_PROVIDER">Service providers</option>
              </select>
              <select value={minRating} onChange={(e) => setMinRating(e.target.value)} className="w-full h-10 px-3 bg-white border border-border rounded-md text-sm">
                <option value="">Any rating</option>
                <option value="4">4★ and above</option>
                <option value="5">5★ sellers</option>
              </select>
            </div>

            <div className="mb-8 space-y-3">
              <h3 className="font-semibold text-foreground">Campus & academic</h3>
              <Input placeholder="Campus location" value={location} onChange={(e) => setLocation(e.target.value)} />
              <Input placeholder="Course code" value={courseCode} onChange={(e) => setCourseCode(e.target.value)} />
              <Input placeholder="ISBN" value={isbn} onChange={(e) => setIsbn(e.target.value)} />
              <Button variant="outline" onClick={() => fetchListings(1, false)} className="w-full">Apply advanced filters</Button>
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
              <Button variant="outline" onClick={() => fetchListings(1, false)} className="w-full mt-3 h-9 text-xs">Apply</Button>
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
        <div className="flex-1 min-w-0">
          <div className="hidden lg:flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-foreground">
              {selectedCategory 
                ? selectedCategorySlugs.map((slug) => (categories.length ? categories : staticCategories).find(c => c.slug === slug)?.name ?? slug).join(", ")
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
            {selectedCategorySlugs.map((slug) => (
              <Badge key={slug} variant="outline" className="bg-white border-gray-200 px-3 py-1 text-sm font-normal flex items-center gap-1">
                Category: {(categories.length ? categories : staticCategories).find(c => c.slug === slug)?.name ?? slug}
                <button onClick={() => toggleCategory(slug)} className="ml-1 hover:bg-gray-100 rounded-full p-0.5">×</button>
              </Badge>
            ))}
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

          {/* Categories Horizontal Chips */}
          <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-none shrink-0 mb-6 border-b">
            <button
              onClick={() => setCategoryFilter([])}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                selectedCategory === "" 
                  ? "bg-primary text-white border-primary shadow-sm" 
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              All Categories
            </button>
            {(categories.length ? categories : staticCategories).map((cat) => {
              const isSelected = selectedCategorySlugs.includes(cat.slug);
              return (
                <button
                  key={cat.slug}
                  onClick={() => toggleCategory(cat.slug)}
                  className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                    isSelected 
                      ? "bg-primary text-white border-primary shadow-sm" 
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>

          {/* Grid or Loader */}
          {loading && page === 1 ? (
            <ProductGridSkeleton count={8} />
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

          {/* Load More Button */}
          {page < totalPages && (
            <div className="flex justify-center mt-10">
              <Button 
                onClick={loadMore}
                disabled={loading}
                className="rounded-full px-8 py-3 font-semibold text-sm shadow-md"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Load More Items
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
