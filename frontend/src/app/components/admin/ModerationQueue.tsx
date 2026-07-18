import { CheckCircle, XCircle } from "lucide-react";
import { mediaUrl } from "../../../api/client";
import type { Listing } from "../../../types";
import { formatPrice } from "../../../utils/format";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader } from "../ui/card";

type ModerationQueueProps = {
  listings: Listing[];
  actionLoading: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
};

const isVideoUrl = (url: string) => /\.(mp4|mov|webm|ogg)$/i.test(url);

export function ModerationQueue({ listings, actionLoading, onApprove, onReject }: ModerationQueueProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Pending Review ({listings.length})</h2>

      {listings.length === 0 ? (
        <div className="bg-white text-center py-12 rounded-2xl border border-border shadow-sm text-muted-foreground">
          No listings require moderation. All caught up!
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {listings.map((item) => (
            <Card key={item.id} className="bg-white border-border shadow-sm overflow-hidden flex flex-col h-full">
              <CardHeader className="bg-gray-50/50 border-b border-border py-4 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <Avatar className="w-8 h-8 border">
                    <AvatarFallback className="text-xs font-bold">US</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-xs font-semibold text-gray-900">{item.seller?.name}</p>
                    <p className="text-[10px] text-muted-foreground">{item.seller?.email}</p>
                  </div>
                </div>
                <Badge variant="outline">{item.type}</Badge>
              </CardHeader>

              <CardContent className="p-6 flex-1 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-4">
                    <h3 className="font-bold text-lg text-foreground">{item.title}</h3>
                    <span className="text-primary font-bold text-lg whitespace-nowrap">{formatPrice(item.price)}</span>
                  </div>

                  <div className="rounded-2xl border border-border bg-gray-50 p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-gray-600">Listing media</p>
                      <span className="text-[11px] text-muted-foreground">
                        {item.images?.length || 0} file{item.images?.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    {item.images?.length ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {item.images.map((image, index) => {
                          const src = mediaUrl(image.url);
                          return (
                            <a
                              key={image.id || image.url}
                              href={src}
                              target="_blank"
                              rel="noreferrer"
                              className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-white"
                              title={`Open media ${index + 1}`}
                            >
                              {isVideoUrl(image.url) ? (
                                <video src={src} className="w-full h-full object-cover" muted playsInline />
                              ) : (
                                <img src={src} alt={`${item.title} media ${index + 1}`} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                              )}
                              <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                                {index === 0 ? "Cover" : `#${index + 1}`}
                              </span>
                            </a>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-8 text-xs text-muted-foreground">
                        No media uploaded for this listing.
                      </div>
                    )}
                  </div>

                  <p className="text-sm text-gray-600 line-clamp-3">{item.description}</p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p><strong>Campus Location:</strong> {item.location}</p>
                    <p><strong>Meetup Preference:</strong> {item.meetupPreference || "Not specified"}</p>
                  </div>
                </div>

                <div className="flex gap-3 mt-6 border-t pt-4">
                  <Button
                    onClick={() => onApprove(item.id)}
                    disabled={actionLoading}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl h-10 gap-1.5"
                  >
                    <CheckCircle className="w-4 h-4" /> Approve
                  </Button>
                  <Button
                    onClick={() => onReject(item.id)}
                    disabled={actionLoading}
                    variant="destructive"
                    className="flex-1 font-semibold rounded-xl h-10 gap-1.5"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
