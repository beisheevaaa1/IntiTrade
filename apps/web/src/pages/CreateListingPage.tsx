import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { Category, ListingCondition, ListingType } from "../types";

export function CreateListingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    isNegotiable: false,
    type: "PRODUCT" as ListingType,
    condition: "GOOD" as ListingCondition,
    location: "Main Campus - Student Center",
    meetupPreference: "Campus Library / Cafeteria",
    categoryId: ""
  });
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  useEffect(() => {
    api.get("/listings/categories").then((response) => {
      setCategories(response.data.categories);
      if (response.data.categories.length > 0) {
        setForm((current) => ({ ...current, categoryId: response.data.categories[0].id }));
      }
    });
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...selected]);
      const urls = selected.map((f) => URL.createObjectURL(f));
      setPreviewUrls((prev) => [...prev, ...urls]);
    }
  };

  const removePhoto = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      let imageUrls: string[] = [];
      if (files.length > 0) {
        const data = new FormData();
        files.forEach((file) => data.append("images", file));
        const upload = await api.post("/uploads", data, { headers: { "Content-Type": "multipart/form-data" } });
        imageUrls = upload.data.urls;
      }
      const payload = {
        ...form,
        price: Number(form.price) || 0,
        imageUrls
      };
      const response = await api.post("/listings", payload);
      navigate(`/listings/${response.data.listing.id}`);
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { message?: string } } };
      setError(apiError.response?.data?.message ?? "Could not create listing");
      setLoading(false);
    }
  }

  const canNext = () => {
    if (step === 1) return Boolean(form.categoryId);
    if (step === 2) return form.title.trim().length >= 4 && form.description.trim().length >= 10;
    if (step === 3) return form.price !== "" && Number(form.price) >= 0;
    if (step === 4) return form.location.trim().length >= 2;
    return true;
  };

  return (
    <div className="mx-auto max-w-3xl py-6">
      {/* Header & Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-campus">Fast Posting Wizard</span>
          <span className="text-xs font-medium text-ink/60">Step {step} of 5</span>
        </div>
        <h1 className="mt-1 text-2xl font-bold text-ink">List an Item or Service</h1>
        <div className="mt-3 flex gap-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                s <= step ? "bg-gradient-to-r from-campus to-lake" : "bg-line/60"
              }`}
            />
          ))}
        </div>
      </div>

      <form onSubmit={step === 5 ? submit : (e) => { e.preventDefault(); setStep(step + 1); }} className="panel p-6 shadow-lg">
        {/* Step 1: Type & Category */}
        {step === 1 && (
          <div className="space-y-6 animate-fadeIn">
            <h2 className="text-lg font-semibold text-ink">What are you offering?</h2>
            
            <div>
              <label className="field mb-2"><span>Listing Type</span></label>
              <div className="grid grid-cols-2 gap-4">
                {(["PRODUCT", "SERVICE"] as ListingType[]).map((t) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => setForm({ ...form, type: t })}
                    className={`flex flex-col items-center justify-center rounded-xl border-2 p-4 transition ${
                      form.type === t
                        ? "border-campus bg-campus/10 font-bold text-campus shadow-sm"
                        : "border-line bg-white text-ink/70 hover:border-campus/40"
                    }`}
                  >
                    <span className="text-xl mb-1">{t === "PRODUCT" ? "📦" : "🛠️"}</span>
                    <span>{t === "PRODUCT" ? "Physical Item" : "Student Service"}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="field mb-2"><span>Select Category</span></label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {categories.map((cat) => (
                  <button
                    type="button"
                    key={cat.id}
                    onClick={() => setForm({ ...form, categoryId: cat.id })}
                    className={`rounded-lg border px-3 py-2 text-left text-sm font-medium transition ${
                      form.categoryId === cat.id
                        ? "border-campus bg-campus text-white shadow-sm"
                        : "border-line bg-white text-ink hover:border-campus/50"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Title & Description */}
        {step === 2 && (
          <div className="space-y-5 animate-fadeIn">
            <h2 className="text-lg font-semibold text-ink">Describe your listing</h2>
            
            <label className="field">
              <span>Title <small className="text-ink/40">({form.title.length}/120)</small></span>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g., Calculus 8th Edition Textbook (Like New)"
                required
                minLength={4}
                maxLength={120}
              />
            </label>

            <label className="field">
              <span>Description <small className="text-ink/40">({form.description.length}/2000)</small></span>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Include details like author, course code, usage history, or reason for selling..."
                required
                minLength={10}
                maxLength={2000}
                rows={6}
              />
            </label>
          </div>
        )}

        {/* Step 3: Pricing & Condition */}
        {step === 3 && (
          <div className="space-y-6 animate-fadeIn">
            <h2 className="text-lg font-semibold text-ink">Price & Condition</h2>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <label className="field">
                <span>Price (MYR / RM)</span>
                <div className="relative mt-1">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 font-semibold text-ink/50">RM</span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    className="pl-10 text-lg font-bold"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>
              </label>

              <div className="flex flex-col justify-end pb-1">
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-white p-3 hover:border-campus/40">
                  <input
                    type="checkbox"
                    checked={form.isNegotiable}
                    onChange={(e) => setForm({ ...form, isNegotiable: e.target.checked })}
                    className="h-5 w-5 rounded border-line text-campus focus:ring-campus"
                  />
                  <div>
                    <span className="block text-sm font-bold text-ink">Price is negotiable</span>
                    <span className="text-xs text-ink/60">Allow buyers to send reasonable offers</span>
                  </div>
                </label>
              </div>
            </div>

            {form.type === "PRODUCT" && (
              <div>
                <label className="field mb-2"><span>Item Condition</span></label>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { val: "NEW", label: "✨ Brand New" },
                    { val: "LIKE_NEW", label: "🌟 Like New" },
                    { val: "GOOD", label: "👍 Good" },
                    { val: "FAIR", label: "👌 Fair" }
                  ].map((c) => (
                    <button
                      type="button"
                      key={c.val}
                      onClick={() => setForm({ ...form, condition: c.val as ListingCondition })}
                      className={`rounded-lg border px-3 py-2.5 text-center text-sm font-semibold transition ${
                        form.condition === c.val
                          ? "border-campus bg-campus/10 text-campus shadow-sm ring-1 ring-campus"
                          : "border-line bg-white text-ink/80 hover:border-campus/40"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Campus Location & Meetup */}
        {step === 4 && (
          <div className="space-y-5 animate-fadeIn">
            <h2 className="text-lg font-semibold text-ink">Meetup & Location</h2>

            <label className="field">
              <span>Campus Zone / Building</span>
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="e.g., INTI International University - Block B"
                required
              />
            </label>

            <label className="field">
              <span>Preferred Meetup Spots (Optional)</span>
              <input
                value={form.meetupPreference}
                onChange={(e) => setForm({ ...form, meetupPreference: e.target.value })}
                placeholder="e.g., Campus Cafeteria, Library Entrance, Student Lounge"
              />
              <span className="mt-1 text-xs text-ink/50">Safe meeting spots on campus ensure trusted exchanges.</span>
            </label>
          </div>
        )}

        {/* Step 5: Photos & Review */}
        {step === 5 && (
          <div className="space-y-6 animate-fadeIn">
            <h2 className="text-lg font-semibold text-ink">Upload Photos & Final Review</h2>

            <div>
              <label className="field mb-2"><span>Item Photos ({files.length})</span></label>
              <div className="flex flex-wrap gap-4">
                {previewUrls.map((url, i) => (
                  <div key={i} className="relative h-24 w-24 overflow-hidden rounded-lg border border-line shadow-sm">
                    <img src={url} alt="preview" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs font-bold text-white hover:bg-danger"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-line bg-white text-ink/60 transition hover:border-campus hover:text-campus">
                  <span className="text-2xl">+</span>
                  <span className="text-xs font-semibold">Add Photo</span>
                  <input type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />
                </label>
              </div>
            </div>

            <div className="rounded-xl border border-line bg-paper p-4 text-sm">
              <h3 className="mb-2 font-bold text-ink uppercase text-xs tracking-wider">Summary Preview</h3>
              <p className="font-semibold text-lg text-ink">{form.title || "Untitled Listing"}</p>
              <p className="font-bold text-campus text-md">
                RM {form.price || "0"} {form.isNegotiable && <span className="text-xs font-normal text-ink/60">(Negotiable)</span>}
              </p>
              <p className="mt-2 text-ink/70 line-clamp-2">{form.description}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded bg-white px-2 py-1 font-semibold border border-line">📍 {form.location}</span>
                <span className="rounded bg-white px-2 py-1 font-semibold border border-line">🤝 {form.meetupPreference || "Flexible"}</span>
              </div>
            </div>
          </div>
        )}

        {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm font-medium text-danger">{error}</p>}

        {/* Wizard Controls */}
        <div className="mt-8 flex justify-between border-t border-line/60 pt-5">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="button-secondary"
            >
              ← Back
            </button>
          ) : <div />}

          {step < 5 ? (
            <button
              type="submit"
              disabled={!canNext()}
              className={`button-primary ${!canNext() ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              Continue →
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading}
              className="button-primary bg-gradient-to-r from-campus to-lake px-6 py-2.5 text-base shadow-md hover:shadow-lg"
            >
              {loading ? "Publishing..." : "🚀 Publish Listing"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
