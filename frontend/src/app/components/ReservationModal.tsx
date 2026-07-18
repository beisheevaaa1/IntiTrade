import React, { useState, useEffect } from "react";
import { Loader2, MapPin, Clock, ShieldCheck, Calendar, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Input } from "./ui/input";
import { api } from "../../api/client";
import type { ConversationResponse, MeetupPointsResponse } from "../../api/responses";
import { useToast } from "../../state/ToastContext";
import type { Listing, MeetupPoint } from "../../types";
import { getApiErrorMessage } from "../../utils/errors";

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Listing;
  initialQuantity: number;
  onSuccess: (conversationId?: string) => void;
}

export const ReservationModal: React.FC<ReservationModalProps> = ({
  isOpen,
  onClose,
  product,
  initialQuantity,
  onSuccess
}) => {
  const { toast } = useToast();
  const [meetupPoints, setMeetupPoints] = useState<MeetupPoint[]>([]);
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [selectedPointId, setSelectedPointId] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(initialQuantity || 1);
  const [preferredTime, setPreferredTime] = useState<string>("Today Afternoon (2:00 PM - 5:00 PM)");
  const [customTime, setCustomTime] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  const timeSlots = [
    "Today Afternoon (2:00 PM - 5:00 PM)",
    "Today Evening (5:00 PM - 8:00 PM)",
    "Tomorrow Morning (9:00 AM - 12:00 PM)",
    "Tomorrow Afternoon (2:00 PM - 5:00 PM)",
    "Custom Time..."
  ];

  useEffect(() => {
    if (isOpen) {
      setQuantity(initialQuantity || 1);
      setNote("");
      setPreferredTime("Today Afternoon (2:00 PM - 5:00 PM)");
      setCustomTime("");
      fetchMeetupPoints();
    }
  }, [isOpen, initialQuantity, product.id]);

  const fetchMeetupPoints = async () => {
    setLoadingPoints(true);
    try {
      const res = await api.get<MeetupPointsResponse>("/community/meetup-points");
      const points: MeetupPoint[] = res.data.meetupPoints || [];
      setMeetupPoints(points);
      if (product.meetupPointId && points.some((p) => p.id === product.meetupPointId)) {
        setSelectedPointId(product.meetupPointId);
      } else if (points.length > 0) {
        setSelectedPointId(points[0].id);
      }
    } catch (err) {
      console.error("Failed to fetch meetup points:", err);
    } finally {
      setLoadingPoints(false);
    }
  };

  const handleConfirm = async () => {
    if (preferredTime === "Custom Time..." && !customTime.trim()) {
      toast.error("Please specify your custom preferred time.");
      return;
    }
    setSubmitting(true);
    try {
      // 1. Create the reservation transaction
      await api.post("/transactions", {
        listingId: product.id,
        quantity,
        meetupPointId: selectedPointId || null
      });

      // 2. Open or get conversation
      const convRes = await api.post<ConversationResponse>("/conversations", { listingId: product.id });
      const conversationId = convRes.data?.conversation?.id;

      // 3. Send structured initial meetup note if conversation created
      if (conversationId) {
        const selectedPoint = meetupPoints.find((p) => p.id === selectedPointId);
        const timeText = preferredTime === "Custom Time..." ? customTime.trim() : preferredTime;
        const locationText = selectedPoint ? `${selectedPoint.name} (${selectedPoint.campusArea || "Main Campus"})` : "To be discussed";

        const messageBody = `🗓️ **Meetup Reservation Request**\n📍 **Location:** ${locationText}\n⏰ **Preferred Time:** ${timeText}\n📦 **Quantity:** ${quantity}\n${note.trim() ? `\n💬 **Note for seller:** ${note.trim()}` : ""}`;

        await api.post(`/conversations/${conversationId}/messages`, {
          body: messageBody
        });
      }

      toast.success("Item successfully reserved! Meetup details sent to seller.");
      onSuccess(conversationId);
      onClose();
    } catch (err) {
      console.error("Error reserving item:", err);
      toast.error(getApiErrorMessage(err, "Could not complete the reservation."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !submitting && !open && onClose()}>
      <DialogContent className="max-w-md p-6 overflow-hidden rounded-2xl shadow-2xl border-0 bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2 text-green-600 font-bold text-xs uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" /> INTI Campus Meetup Reservation
          </div>
          <DialogTitle className="text-xl font-extrabold text-gray-900">
            Reserve "{product.title}"
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            Select a verified INTI campus meetup spot and preferred time slot for safety and convenience.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 my-3">
          {/* Quantity selector if applicable */}
          {product.type === "PRODUCT" && (product.quantity ?? 1) > 1 && (
            <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-200">
              <span className="text-sm font-semibold text-gray-800">Quantity to reserve:</span>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={product.quantity || 1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Math.min(product.quantity || 1, Number(e.target.value))))}
                  className="w-20 text-center font-bold bg-white"
                />
                <span className="text-xs text-gray-500">/ {product.quantity} max</span>
              </div>
            </div>
          )}

          {/* Campus Meetup Point Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-primary" /> Select INTI Meetup Point
            </label>
            {loadingPoints ? (
              <div className="flex items-center justify-center p-6 bg-gray-50 rounded-xl border border-gray-200 text-gray-500 gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-primary" /> Loading campus locations...
              </div>
            ) : meetupPoints.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {meetupPoints.map((point) => {
                  const isSelected = point.id === selectedPointId;
                  return (
                    <div
                      key={point.id}
                      onClick={() => setSelectedPointId(point.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start justify-between gap-3 ${
                        isSelected
                          ? "bg-primary/5 border-primary shadow-sm"
                          : "bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2 font-bold text-sm text-gray-900">
                          {point.name}
                          {point.campusArea && (
                            <span className="text-[10px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-semibold">
                              {point.campusArea}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 mt-1 leading-snug">{point.description}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        isSelected ? "bg-primary border-primary text-white" : "border-gray-300"
                      }`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-500 p-3 bg-gray-50 rounded-xl">Standard campus location: INTI Main Campus</p>
            )}
          </div>

          {/* Preferred Day & Time */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary" /> Preferred Meetup Time Slot
            </label>
            <select
              value={preferredTime}
              onChange={(e) => setPreferredTime(e.target.value)}
              className="w-full h-11 px-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              {timeSlots.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
            {preferredTime === "Custom Time..." && (
              <Input
                placeholder="e.g., Friday at 1:30 PM after class"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="w-full h-10 text-sm mt-2"
              />
            )}
          </div>

          {/* Note for Seller */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              💬 Note for Seller (Optional)
            </label>
            <Textarea
              placeholder="e.g., I will be near the library entrance wearing a black hoodie. Please message me when you arrive!"
              value={note}
              onChange={(e) => setNote(e.target.value)}
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
            onClick={handleConfirm}
            disabled={submitting}
            className="w-full sm:w-auto h-11 px-6 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold shadow-md flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Confirming...
              </>
            ) : (
              "Confirm Reservation"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
