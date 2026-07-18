import React, { useState, useEffect } from "react";
import { Loader2, Tag, DollarSign, MessageSquare, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Input } from "./ui/input";
import { api } from "../../api/client";
import type { ConversationResponse } from "../../api/responses";
import { useToast } from "../../state/ToastContext";
import type { Listing } from "../../types";
import { formatPrice } from "../../utils/format";
import { getApiErrorMessage } from "../../utils/errors";

interface MakeOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Listing;
  onSuccess: (conversationId: string) => void;
}

export const MakeOfferModal: React.FC<MakeOfferModalProps> = ({
  isOpen,
  onClose,
  product,
  onSuccess
}) => {
  const { toast } = useToast();
  const currentPrice = Number(product.price) || 0;
  const [offerAmount, setOfferAmount] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      // Default suggestion: 10% lower if negotiable or rounded
      const defaultOffer = currentPrice > 10 ? Math.round(currentPrice * 0.9) : currentPrice;
      setOfferAmount(defaultOffer ? String(defaultOffer) : "");
      setMessage("");
    }
  }, [isOpen, currentPrice]);

  const applyDiscount = (percent: number) => {
    const discounted = Math.round((currentPrice * (100 - percent)) / 100);
    setOfferAmount(String(Math.max(1, discounted)));
  };

  const handleSendOffer = async () => {
    const numOffer = Number(offerAmount);
    if (!numOffer || isNaN(numOffer) || numOffer <= 0) {
      toast.error("Please enter a valid positive offer amount in RM.");
      return;
    }
    if (numOffer > currentPrice * 2) {
      toast.error("Offer amount cannot exceed twice the listed price.");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Get or create conversation for this listing
      const convRes = await api.post<ConversationResponse>("/conversations", { listingId: product.id });
      const conversationId = convRes.data?.conversation?.id;
      if (!conversationId) throw new Error("Could not initialize chat");

      // 2. Send structured offer message
      const defaultMsg = `👋 Hi! I'd like to make an offer of **${formatPrice(numOffer)}** for "${product.title}". Let me know if that works for you!`;
      await api.post(`/conversations/${conversationId}/messages`, {
        body: message.trim() || defaultMsg,
        offerAmount: numOffer
      });

      toast.success("Offer sent successfully! The seller can accept or decline in chat.");
      onSuccess(conversationId);
      onClose();
    } catch (err) {
      console.error("Error sending offer:", err);
      toast.error(getApiErrorMessage(err, "Could not submit your offer."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !submitting && !open && onClose()}>
      <DialogContent className="max-w-md p-6 overflow-hidden rounded-2xl shadow-2xl border-0 bg-white">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <Tag className="w-4 h-4" /> Negotiate Price
          </div>
          <DialogTitle className="text-xl font-extrabold text-gray-900">
            Make an Offer for "{product.title}"
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            Suggest your fair price in RM. The seller will review and can immediately accept or counter-offer in chat.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 my-4">
          {/* Price comparison banner */}
          <div className="flex items-center justify-between p-4 bg-primary/5 rounded-xl border border-primary/10">
            <div>
              <span className="text-xs text-gray-500 font-semibold uppercase block">Listed Price</span>
              <span className="text-lg font-extrabold text-gray-900">{formatPrice(currentPrice)}</span>
            </div>
            <div className="text-right">
              <span className="text-xs text-primary font-bold uppercase block">Your Offer</span>
              <span className="text-xl font-black text-primary">
                {formatPrice(Number(offerAmount) || 0, { freeLabel: "RM 0.00" })}
              </span>
            </div>
          </div>

          {/* Quick Discount Pills */}
          {currentPrice > 5 && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                Quick Suggestions
              </label>
              <div className="flex flex-wrap gap-2">
                {[10, 15, 20].map((pct) => {
                  const calc = Math.round((currentPrice * (100 - pct)) / 100);
                  return (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => applyDiscount(pct)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors border border-gray-200 flex items-center gap-1"
                    >
                      -{pct}% <span className="text-primary">(RM {calc})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Offer Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-primary" /> Enter Your Offer (RM)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-extrabold text-gray-500">RM</span>
              <Input
                type="number"
                min="0.5"
                step="0.5"
                placeholder="e.g., 45.00"
                value={offerAmount}
                onChange={(e) => setOfferAmount(e.target.value)}
                className="pl-11 h-12 text-lg font-extrabold bg-white border-2 border-gray-200 focus:border-primary rounded-xl"
              />
            </div>
          </div>

          {/* Message Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-primary" /> Optional Message
            </label>
            <Textarea
              placeholder={`Hi! I'm very interested in "${product.title}". Would you accept RM ${offerAmount || "..."}?`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="resize-none h-20 text-sm rounded-xl"
            />
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="w-full sm:w-auto h-11 rounded-xl border-gray-300 font-semibold"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSendOffer}
            disabled={submitting}
            className="w-full sm:w-auto h-11 px-6 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold shadow-md flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Sending Offer...
              </>
            ) : (
              <>
                Send Offer <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
