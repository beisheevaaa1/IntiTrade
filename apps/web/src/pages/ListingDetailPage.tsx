import { BadgeCheck, Eye, Flag, Heart, MapPin, MessageSquare, ShieldAlert, Sparkles, UserCheck } from "lucide-react";
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
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("Suspicious listing");
  const [reported, setReported] = useState(false);

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
    setReported(true);
  }

  if (!listing) return <div className="panel p-12 text-center animate-pulse">Loading listing details...</div>;
  const activeImageUrl = listing.images[activeImageIndex]?.url;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-semibold text-ink/60">
        <Link to="/" className="hover:text-campus">Marketplace</Link>
        <span>/</span>
        <span className="uppercase text-campus">{listing.type}</span>
        <span>/</span>
        <span className="text-ink">{listing.title}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
        {/* Left Column: Gallery & Description */}
        <div className="space-y-6">
          <section className="panel p-5 overflow-hidden shadow-md">
            <div className="aspect-[16/10] overflow-hidden rounded-xl bg-paper border border-line/60 relative">
              {activeImageUrl ? (
                <img src={mediaUrl(activeImageUrl)} alt="" className="h-full w-full object-contain bg-black/5" />
              ) : (
                <div className="grid h-full place-items-center text-ink/40 font-bold text-lg">📷 No Photo Available</div>
              )}
              {listing.viewsCount !== undefined && (
                <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm">
                  <Eye size={13} /> {listing.viewsCount} views
                </div>
              )}
            </div>

            {listing.images.length > 1 && (
              <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
                {listing.images.map((item, idx) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border-2 transition ${
                      activeImageIndex === idx ? "border-campus ring-2 ring-campus/30 scale-95" : "border-line opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img src={mediaUrl(item.url)} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="panel p-6 shadow-sm">
            <h2 className="text-xl font-bold text-ink mb-3">Item Description</h2>
            <p className="whitespace-pre-wrap text-base leading-relaxed text-ink/80">{listing.description}</p>
            
            <div className="mt-6 border-t border-line/60 pt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-xs text-ink/50 uppercase font-bold block">Category</span>
                <span className="font-semibold text-ink">{listing.category.name}</span>
              </div>
              <div>
                <span className="text-xs text-ink/50 uppercase font-bold block">Condition</span>
                <span className="font-semibold text-ink">{listing.condition.replace("_", " ")}</span>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Price, Seller & Meetup Info */}
        <aside className="space-y-6">
          <div className="panel p-6 shadow-lg bg-white relative overflow-hidden">
            <div className="campus-strip mb-4" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="inline-block rounded-full bg-campus/10 px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wide text-campus mb-1">
                  {listing.type}
                </span>
                <h1 className="text-2xl font-extrabold text-ink leading-tight">{listing.title}</h1>
              </div>
            </div>

            <div className="mt-5 rounded-xl bg-paper p-4 border border-line/60 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase text-ink/60">Price</span>
                <div className="text-3xl font-black text-campus">RM {Number(listing.price).toFixed(2)}</div>
              </div>
              {listing.isNegotiable && (
                <span className="rounded-full bg-signal/20 border border-signal px-3 py-1 text-xs font-bold text-ink">
                  🤝 Negotiable
                </span>
              )}
            </div>

            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={startChat}
                className="button-primary w-full py-3 text-base shadow-md hover:shadow-lg bg-gradient-to-r from-campus to-lake"
              >
                <MessageSquare size={19} /> Message Student Seller
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="button-secondary w-full" onClick={saveFavorite}>
                  <Heart size={16} /> Save to Favorites
                </button>
                <button type="button" className="button-secondary w-full text-danger hover:border-danger/30" onClick={() => setReportOpen(!reportOpen)}>
                  <Flag size={16} /> Report Item
                </button>
              </div>
            </div>

            {reported && <p className="mt-3 rounded bg-green-50 p-2 text-center text-xs font-bold text-campus">Report submitted. Thank you for keeping IntiTrade safe!</p>}

            {reportOpen && !reported && (
              <form onSubmit={report} className="mt-4 rounded-lg border border-line bg-paper p-3 animate-fadeIn">
                <label className="field text-xs">
                  <span>Report Reason</span>
                  <input value={reason} onChange={(event) => setReason(event.target.value)} required className="mt-1" />
                </label>
                <button className="button-primary mt-2 w-full text-xs py-1.5" type="submit">Submit Report</button>
              </form>
            )}
          </div>

          {/* Seller Card */}
          <div className="panel p-5 shadow-sm border-l-4 border-l-lake">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink/60 mb-3 flex items-center gap-1.5">
              <UserCheck size={16} className="text-lake" /> Seller Profile
            </h3>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-campus to-lake flex items-center justify-center text-white font-bold text-lg shadow-inner">
                {listing.seller.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-ink text-base">{listing.seller.name}</p>
                <p className="text-xs font-semibold text-campus flex items-center gap-1 mt-0.5">
                  <BadgeCheck size={14} /> Verified INTI Student
                </p>
                {listing.seller.faculty && <p className="text-xs text-ink/60 mt-0.5">🎓 {listing.seller.faculty}</p>}
              </div>
            </div>
          </div>

          {/* Safe Campus Meetup Zone */}
          <div className="panel p-5 shadow-sm bg-gradient-to-br from-white to-paper">
            <h3 className="text-xs font-bold uppercase tracking-wider text-campus mb-3 flex items-center gap-1.5">
              <Sparkles size={16} /> Campus Meetup Zone
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2.5">
                <MapPin size={18} className="text-campus flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-ink">Primary Zone</strong>
                  <span className="text-ink/75">{listing.location}</span>
                </div>
              </div>
              {listing.meetupPreference && (
                <div className="flex items-start gap-2.5 pt-2 border-t border-line/50">
                  <span className="text-lg leading-none">🤝</span>
                  <div>
                    <strong className="block text-ink">Preferred Meetup Spots</strong>
                    <span className="text-ink/75">{listing.meetupPreference}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4 rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-xs text-ink/80 flex gap-2">
              <ShieldAlert size={16} className="text-signal flex-shrink-0 mt-0.5" />
              <span>Always exchange items in well-lit public campus areas like libraries or cafeterias. Inspect items before completing offline cash transactions.</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
