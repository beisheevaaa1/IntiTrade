import { ChevronRight, Loader2, Tag, X } from "lucide-react";
import { mediaUrl } from "../../../api/client";
import type { Listing } from "../../../types";
import { formatPrice } from "../../../utils/format";
import { Button } from "../ui/button";

type AttachmentSwitcherModalProps = {
  listings: Listing[];
  loading: boolean;
  error: string;
  onClose: () => void;
  onSelectListing: (listingId: string) => void;
};

export function AttachmentSwitcherModal({
  listings,
  loading,
  error,
  onClose,
  onSelectListing
}: AttachmentSwitcherModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-border max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4 pb-2 border-b shrink-0">
          <h3 className="font-extrabold text-lg text-foreground flex items-center gap-1.5">
            <Tag className="w-4 h-4 text-primary" /> Attach Another Item
          </h3>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mb-4 shrink-0">
          Select one of the seller's active listings to attach it to this chat conversation thread.
        </p>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {loading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-600 text-sm">
              {error}
            </div>
          ) : listings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              This seller has no other active listings available.
            </div>
          ) : (
            listings.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectListing(item.id)}
                className="w-full text-left p-3 bg-gray-50 border border-border rounded-xl hover:border-primary/40 hover:bg-red-50/10 cursor-pointer flex gap-3 transition-all group"
              >
                <div className="w-12 h-12 rounded overflow-hidden border bg-white shrink-0">
                  <img
                    src={item.images?.[0]?.url ? mediaUrl(item.images[0].url) : "/placeholder-item.svg"}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <h4 className="font-bold text-sm text-gray-900 group-hover:text-primary truncate transition-colors leading-tight">
                    {item.title}
                  </h4>
                  <p className="text-xs text-primary font-extrabold">{formatPrice(item.price)}</p>
                </div>
                <div className="self-center text-gray-400 group-hover:text-primary transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
