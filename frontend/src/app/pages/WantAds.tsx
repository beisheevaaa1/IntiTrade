import React, { useEffect, useState } from "react";
import { ArrowRight, Clock, Loader2, Plus, Search } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { api } from "../../api/client";
import { useAuth } from "../../state/AuthContext";
import type { Category, WantAd } from "../../types";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";

export function WantAds() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [wantAds, setWantAds] = useState<WantAd[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadWantAds = async () => {
    setLoading(true);
    try {
      const response = await api.get("/want-ads", { params: { q: query || undefined, sort: sort === "budget" ? "budget" : undefined } });
      setWantAds(response.data.wantAds ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadWantAds();
  }, [sort]);

  useEffect(() => {
    api.get("/listings/categories").then((response) => {
      const nextCategories = response.data.categories ?? [];
      setCategories(nextCategories);
      if (nextCategories.length) setCategoryId((current) => current || nextCategories[0].id);
    });
  }, []);

  const openForm = () => {
    if (!user) return navigate("/login");
    setShowForm(true);
  };

  const createWantAd = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await api.post("/want-ads", { title, description, maxPrice: Number(maxPrice), categoryId });
      setWantAds((current) => [response.data.wantAd, ...current]);
      setTitle("");
      setDescription("");
      setMaxPrice("");
      setShowForm(false);
    } catch (err: any) {
      setError(err.response?.data?.message || "Could not post the request.");
    } finally {
      setSaving(false);
    }
  };

  const closeWantAd = async (id: string) => {
    await api.patch(`/want-ads/${id}/status`, { status: "CLOSED" });
    setWantAds((current) => current.filter((wantAd) => wantAd.id !== id));
  };

  return (
    <main className="flex-1 bg-gray-50/50">
      <section className="border-b bg-white py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h1 className="text-3xl font-bold">Want Ads</h1>
              <p className="mt-2 text-muted-foreground">Ask the community for an item, course, or service you need.</p>
            </div>
            <Button onClick={openForm} className="gap-2"><Plus className="h-4 w-4" /> Post a request</Button>
          </div>

          <form className="mt-8 flex max-w-2xl flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void loadWantAds(); }}>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search requests..." className="pl-9" />
            </div>
            <Button type="submit" variant="outline">Search</Button>
            <select value={sort} onChange={(event) => setSort(event.target.value)} className="h-11 rounded-xl border bg-white px-3 text-sm">
              <option value="newest">Newest first</option>
              <option value="budget">Highest budget</option>
            </select>
          </form>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8">
        {showForm && (
          <form onSubmit={createWantAd} className="mb-8 space-y-4 rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Post a request</h2><Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button></div>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <Input required minLength={4} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What are you looking for?" />
            <Textarea required minLength={10} maxLength={1500} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe condition, timing, or other details." />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input required type="number" min="0.01" step="0.01" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="Maximum budget (RM)" />
              <select required value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="h-11 rounded-xl border bg-white px-3 text-sm">
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </div>
            <Button disabled={saving || !categoryId}>{saving ? "Posting..." : "Post request"}</Button>
          </form>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : wantAds.length === 0 ? (
          <div className="rounded-2xl border bg-white p-10 text-center"><p className="font-semibold">No matching requests yet.</p></div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {wantAds.map((ad) => (
              <article key={ad.id} className="flex h-full flex-col rounded-xl border bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-lg font-bold leading-tight">{ad.title}</h2>
                  <span className="whitespace-nowrap rounded-full bg-red-50 px-3 py-1 text-sm font-bold text-primary">Max RM {Number(ad.maxPrice).toFixed(2)}</span>
                </div>
                <Badge variant="secondary" className="mt-3 w-fit">{ad.category.name}</Badge>
                <p className="mt-4 flex-1 whitespace-pre-line text-sm text-muted-foreground">{ad.description}</p>
                <div className="mt-5 flex items-center gap-2 border-t pt-4 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" /> {new Date(ad.createdAt).toLocaleDateString()} · {ad.user.name}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button asChild className="flex-1"><Link to={`/create-listing?wanted=${encodeURIComponent(ad.title)}`}>I have this <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
                  {user?.id === ad.userId && <Button variant="outline" onClick={() => closeWantAd(ad.id)}>Close</Button>}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
