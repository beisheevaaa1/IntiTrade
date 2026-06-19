import { BadgeCheck, Heart, MapPin, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { mediaUrl } from "../api/client";
import type { Listing } from "../types";

export function ListingCard({ listing, onFavorite }: { listing: Listing; onFavorite?: (id: string) => void }) {
  const image = listing.images[0]?.url;
  return (
    <article className="listing-card group">
      <div className="campus-strip" />
      <Link to={`/listings/${listing.id}`} className="block">
        <div className="aspect-[4/3] overflow-hidden rounded-md bg-white">
          {image ? (
            <img src={mediaUrl(image)} alt="" className="h-full w-full object-cover transition group-hover:scale-[1.03]" />
          ) : (
            <div className="grid h-full place-items-center bg-gradient-to-br from-lake/10 via-white to-signal/20 text-sm font-semibold text-ink/45">Campus listing</div>
          )}
        </div>
      </Link>
      <div className="mt-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-campus">
            <span>{listing.type.toLowerCase()}</span>
            <span className="h-1 w-1 rounded-full bg-line" />
            <span>{listing.category.name}</span>
          </div>
          <Link to={`/listings/${listing.id}`} className="mt-1 block text-lg font-semibold leading-tight hover:text-campus">
            {listing.title}
          </Link>
        </div>
        <div className="rounded-md bg-white px-2 py-1 text-sm font-semibold">${Number(listing.price).toFixed(2)}</div>
      </div>
      <p className="mt-2 line-clamp-2 min-h-[40px] text-sm text-ink/65">{listing.description}</p>
      <div className="mt-3 flex items-center gap-2 rounded-md bg-white px-2.5 py-2 text-xs font-medium text-campus">
        <BadgeCheck size={15} />
        Verified student seller
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-ink/60">
        <span className="flex items-center gap-1"><MapPin size={15} /> {listing.location}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1"><MessageSquare size={15} /> Chat</span>
          {onFavorite && (
            <button className="icon-button h-8 w-8" onClick={() => onFavorite(listing.id)} aria-label="Save listing" title="Save listing">
              <Heart size={16} />
            </button>
          )}
        </span>
      </div>
    </article>
  );
}
