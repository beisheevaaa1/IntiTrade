import React, { useState } from "react";
import { Star, Loader2, Award, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { api, mediaUrl } from "../../api/client";
import type { TransactionResponse } from "../../api/responses";
import { useAuth } from "../../state/AuthContext";
import type { Transaction, User } from "../../types";
import { getApiErrorMessage } from "../../utils/errors";

type ReviewTransaction = Transaction & {
  buyer?: Pick<User, "id" | "name" | "avatarUrl">;
  seller?: Pick<User, "id" | "name" | "avatarUrl">;
};

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: ReviewTransaction | null;
  onSuccess: () => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  isOpen,
  onClose,
  transaction,
  onSuccess
}) => {
  const { user } = useAuth();
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  if (!transaction) return null;

  const activeRating = hoverRating > 0 ? hoverRating : rating;
  const reviewee = transaction.buyerId === user?.id ? transaction.seller : transaction.buyer;
  const revieweeLabel = transaction.buyerId === user?.id ? "Seller" : "Buyer";

  const getRatingLabel = (stars: number) => {
    switch (stars) {
      case 1:
        return "😞 Poor — Item/service had major issues";
      case 2:
        return "😐 Fair — Could be better";
      case 3:
        return "🙂 Good — Met expectations";
      case 4:
        return "🌟 Very Good — Smooth transaction!";
      case 5:
        return "🏆 Outstanding — Highly Recommended!";
      default:
        return "Select a rating";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1 || rating > 5) {
      setError("Please select a star rating between 1 and 5.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.post<TransactionResponse>(`/transactions/${transaction.id}/review`, {
        rating,
        comment: comment.trim() ? comment.trim() : undefined
      });
      onSuccess();
      onClose();
      // Reset form
      setRating(5);
      setComment("");
    } catch (err) {
      console.error("Failed to submit review:", err);
      setError(getApiErrorMessage(err, "Failed to submit your review. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl p-6 bg-white border border-border shadow-xl">
        <DialogHeader className="text-left">
          <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full w-fit mb-2 text-xs font-bold border border-amber-200">
            <Sparkles className="w-3.5 h-3.5 fill-amber-500" />
            <span>Verified Campus Review</span>
          </div>
          <DialogTitle className="text-xl font-bold text-foreground">
            Rate your experience
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Your review helps build trust and safety in our INTI academic community.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-2">
          {/* Reviewee Card */}
          <div className="flex items-center gap-3.5 bg-gray-50 p-3.5 rounded-xl border border-border">
            <Avatar className="h-12 w-12 border border-border">
              <AvatarImage src={mediaUrl(reviewee?.avatarUrl || undefined)} />
              <AvatarFallback className="bg-primary/10 text-primary font-bold">
                {reviewee?.name?.substring(0, 2).toUpperCase() || "US"}
              </AvatarFallback>
            </Avatar>
            <div className="overflow-hidden flex-grow">
              <h4 className="font-bold text-foreground text-sm truncate">
                {reviewee?.name || revieweeLabel}
              </h4>
              <p className="text-xs text-muted-foreground truncate">
                {revieweeLabel} for <span className="font-medium text-gray-800">{transaction.listing?.title}</span>
              </p>
              <p className="text-[10px] text-primary font-semibold mt-0.5">
                Completed on {new Date(transaction.completedAt || transaction.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Star Selector */}
          <div className="text-center bg-amber-50/50 p-4 rounded-xl border border-amber-100/80">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">
              Overall Rating
            </label>
            <div className="flex justify-center items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => {
                const isSelected = star <= activeRating;
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1.5 transition-transform hover:scale-125 focus:outline-none"
                    title={`${star} Star${star > 1 ? 's' : ''}`}
                  >
                    <Star
                      className={`w-8 h-8 transition-colors duration-150 ${
                        isSelected
                          ? "fill-amber-400 text-amber-400 drop-shadow-sm"
                          : "fill-gray-200 text-gray-300 hover:text-amber-300"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
            <p className="text-xs font-semibold text-amber-800 mt-2 min-h-[1.25rem]">
              {getRatingLabel(activeRating)}
            </p>
          </div>

          {/* Comment Area */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <label className="font-semibold text-foreground">
                Written Feedback <span className="text-muted-foreground font-normal">(Optional)</span>
              </label>
              <span className="text-muted-foreground">
                {comment.length} / 500
              </span>
            </div>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
              rows={4}
              placeholder="How was the communication, item condition, or meetup promptness? Share helpful details for fellow INTI students..."
              className="rounded-xl border-border resize-none text-sm focus:ring-primary/20"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-medium">
              {error}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="w-full sm:w-auto rounded-xl font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto rounded-xl font-bold gap-2 bg-primary hover:bg-primary/90 text-white shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                </>
              ) : (
                <>
                  <Award className="w-4 h-4" /> Submit Verified Review
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
