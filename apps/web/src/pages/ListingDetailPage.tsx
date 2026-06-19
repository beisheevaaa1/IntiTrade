import { Flag, Heart, MessageSquare } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, mediaUrl } from "../api/client";
import { useAuth } from "../state/AuthContext";
import type { Listing } from "../types";

export function ListingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("Suspicious listing");

  useEffect(() => {
    api.get(`/listings/${id}`).then((response) => setListing(response.data.listing));
  }, [id]);

  async function startChat() {
    if (!user) return navigate("/login");
    const response = await api.post("/conversations", { listingId: id });
    navigate(`/messages?conversation=${response.data.conversation.id}`);
  }

  async function saveFavorite() {
    if (!user || !id) return navigate("/login");
    await api.post(`/favorites/${id}`);
  }

  async function report(event: FormEvent) {
    event.preventDefault();
    await api.post("/reports", { listingId: id, reason });
    setReportOpen(false);
  }

  if (!listing) return <div className="panel p-6">Loading listing...</div>;
  const image = listing.images[0]?.url;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="panel p-4">
        <div className="aspect-[16/11] overflow-hidden rounded-md bg-white">
          {image ? <img src={mediaUrl(image)} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-ink/45">No photo</div>}
        </div>
        {listing.images.length > 1 && (
          <div className="mt-3 grid grid-cols-5 gap-2">
            {listing.images.slice(1).map((item) => <img key={item.id} src={mediaUrl(item.url)} alt="" className="aspect-square rounded-md object-cover" />)}
          </div>
        )}
      </section>
      <aside className="panel p-6">
        <div className="campus-strip mb-5" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-campus">{listing.type.toLowerCase()} · {listing.category.name}</p>
            <h1 className="mt-1 text-3xl font-semibold">{listing.title}</h1>
          </div>
          <strong className="rounded-md bg-white px-3 py-2 text-xl">${Number(listing.price).toFixed(2)}</strong>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-md bg-white p-3"><dt className="text-ink/55">Location</dt><dd className="font-semibold">{listing.location}</dd></div>
          <div className="rounded-md bg-white p-3"><dt className="text-ink/55">Condition</dt><dd className="font-semibold">{listing.condition.replace("_", " ").toLowerCase()}</dd></div>
          <div className="rounded-md bg-white p-3"><dt className="text-ink/55">Seller</dt><dd className="font-semibold">{listing.seller.name}</dd></div>
          <div className="rounded-md bg-white p-3"><dt className="text-ink/55">Status</dt><dd className="font-semibold">{listing.status.toLowerCase()}</dd></div>
        </dl>
        <p className="mt-5 whitespace-pre-wrap text-ink/75">{listing.description}</p>
        <div className="mt-6 grid gap-2 sm:grid-cols-3">
          <button className="button-primary" onClick={startChat}><MessageSquare size={17} /> Start chat</button>
          <button className="button-secondary" onClick={saveFavorite}><Heart size={17} /> Save</button>
          <button className="button-secondary" onClick={() => setReportOpen((value) => !value)}><Flag size={17} /> Report</button>
        </div>
        {reportOpen && (
          <form onSubmit={report} className="mt-4 rounded-md border border-line bg-white p-4">
            <label className="field">
              <span>Reason</span>
              <input value={reason} onChange={(event) => setReason(event.target.value)} required />
            </label>
            <button className="button-primary mt-3" type="submit">Submit report</button>
          </form>
        )}
        <Link className="mt-5 inline-block text-sm font-semibold text-campus" to="/">Back to marketplace</Link>
      </aside>
    </div>
  );
}
