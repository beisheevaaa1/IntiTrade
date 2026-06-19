import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { Category, ListingCondition, ListingType } from "../types";

export function CreateListingPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "0",
    type: "PRODUCT" as ListingType,
    condition: "GOOD" as ListingCondition,
    location: "",
    categoryId: "",
    imageUrls: [] as string[]
  });
  const [files, setFiles] = useState<FileList | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/listings/categories").then((response) => {
      setCategories(response.data.categories);
      setForm((current) => ({ ...current, categoryId: response.data.categories[0]?.id ?? "" }));
    });
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      let imageUrls: string[] = [];
      if (files?.length) {
        const data = new FormData();
        Array.from(files).forEach((file) => data.append("images", file));
        const upload = await api.post("/uploads", data, { headers: { "Content-Type": "multipart/form-data" } });
        imageUrls = upload.data.urls;
      }
      const response = await api.post("/listings", { ...form, imageUrls });
      navigate(`/listings/${response.data.listing.id}`);
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { message?: string } } };
      setError(apiError.response?.data?.message ?? "Could not create listing");
    }
  }

  return (
    <form className="panel mx-auto max-w-3xl p-6" onSubmit={submit}>
      <p className="text-sm font-semibold uppercase tracking-wide text-campus">New listing</p>
      <h1 className="mt-1 text-2xl font-semibold">Post an item or service</h1>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="field md:col-span-2"><span>Title</span><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required minLength={4} /></label>
        <label className="field"><span>Type</span><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ListingType })}><option value="PRODUCT">Product</option><option value="SERVICE">Service</option></select></label>
        <label className="field"><span>Category</span><select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label className="field"><span>Price</span><input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required /></label>
        <label className="field"><span>Condition</span><select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value as ListingCondition })}><option value="NEW">New</option><option value="LIKE_NEW">Like new</option><option value="GOOD">Good</option><option value="FAIR">Fair</option><option value="NOT_APPLICABLE">Not applicable</option></select></label>
        <label className="field md:col-span-2"><span>Campus location</span><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} required /></label>
        <label className="field md:col-span-2"><span>Description</span><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required minLength={10} rows={6} /></label>
        <label className="field md:col-span-2"><span>Images</span><input type="file" accept="image/*" multiple onChange={(e) => setFiles(e.target.files)} /></label>
      </div>
      {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-danger">{error}</p>}
      <button className="button-primary mt-5" type="submit">Publish for review</button>
    </form>
  );
}
