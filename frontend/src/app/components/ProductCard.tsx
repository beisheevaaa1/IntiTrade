import React from "react";
import { Link } from "react-router";
import { Heart, ShieldCheck, Star, Eye } from "lucide-react";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardFooter } from "./ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { mediaUrl } from "../../api/client";
import type { Listing } from "../../types";

interface ProductCardProps {
  product: Listing;
}

export function ProductCard({ product }: ProductCardProps) {
  // Format condition name
  const formatCondition = (cond: string) => {
    switch (cond) {
      case "NEW": return "New";
      case "LIKE_NEW": return "Like New";
      case "GOOD": return "Good";
      case "FAIR": return "Fair";
      default: return "Not Applicable";
    }
  };

  const firstImage = product.images?.[0]?.url 
    ? mediaUrl(product.images[0].url)
    : "/placeholder-item.svg";

  const numericPrice = parseFloat(product.price);
  const isFree = numericPrice <= 0;

  const isVideoUrl = (url: string) => /\.(mp4|webm|ogg|mov)$/i.test(url) || url.includes("video");

  return (
    <Card className="group overflow-hidden flex flex-col h-full border-border hover:border-gray-300 hover:shadow-md transition-all duration-200">
      <Link to={`/product/${product.id}`} className="relative aspect-square overflow-hidden bg-muted block">
        {isVideoUrl(firstImage) ? (
          <video
            src={firstImage}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            muted
            playsInline
          />
        ) : (
          <img
            src={firstImage}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/placeholder-item.svg";
            }}
          />
        )}
        
        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          {product.condition === "NEW" && (
            <Badge className="bg-primary text-white shadow-sm border-none font-bold">NEW</Badge>
          )}
          {product.type !== "PRODUCT" && (
            <Badge className="bg-white/95 text-gray-900 shadow-sm border-none font-bold">{product.type === "COURSE" ? "COURSE" : "SERVICE"}</Badge>
          )}
        </div>
      </Link>

      <CardContent className="p-4 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-2 gap-2">
          <Link to={`/product/${product.id}`} className="hover:text-primary transition-colors line-clamp-2 font-semibold text-lg flex-1 text-foreground leading-tight">
            {product.title}
          </Link>
        </div>
        
        <div className="text-xl font-bold text-primary mb-3">
          {isFree ? "Free" : `RM ${numericPrice.toFixed(2)}`}
          {!isFree && product.isNegotiable && <span className="text-xs font-normal text-muted-foreground ml-2">(Negotiable)</span>}
        </div>

        <div className="flex flex-wrap gap-2 mb-4 mt-auto">
          <Badge variant="secondary" className="bg-gray-100 text-gray-700 font-medium text-[11px] px-2 py-0.5 rounded-md">
            {formatCondition(product.condition)}
          </Badge>
          <Badge variant="secondary" className="bg-gray-100 text-gray-700 font-medium text-[11px] px-2 py-0.5 rounded-md">
            {product.category?.name || "Other"}
          </Badge>
          {product.type === "PRODUCT" && (product.quantity ?? 1) > 1 && <Badge variant="outline" className="text-[11px]">{product.quantity} available</Badge>}
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0 border-t border-border flex items-center justify-between gap-3 mt-auto bg-gray-50/50">
        <div className="flex items-center gap-2 pt-3 min-w-0 flex-1">
          <Avatar className="h-8 w-8 border border-border bg-white shadow-sm shrink-0">
            <AvatarImage src={mediaUrl(product.seller?.avatarUrl || undefined)} />
            <AvatarFallback className="text-xs">{product.seller?.name?.substring(0, 2).toUpperCase() || "US"}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium text-foreground truncate max-w-[100px] leading-none">{product.seller?.name || "User"}</span>
              {product.seller?.isVerified && <ShieldCheck className="w-3 h-3 text-green-600 shrink-0" />}
            </div>
            <div className="flex items-center gap-1 mt-1 min-w-0">
              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 rounded-sm border-gray-200 shrink-0">
                {product.seller?.faculty || "Student"}
              </Badge>
              {product.seller?.campusArea && (
                <span className="text-[11px] text-muted-foreground truncate ml-1">• {product.seller.campusArea}</span>
              )}
            </div>
            <div className="flex items-center gap-1 mt-1 text-[10px] text-amber-700">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span>{product.seller?.rating?.toFixed(1) || "New"}</span>
              <span className="text-muted-foreground">· {product.seller?.sellerType === "SHOP" ? "Campus shop" : product.seller?.sellerType === "SERVICE_PROVIDER" ? "Provider" : "Casual seller"}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-gray-500 font-semibold pt-3 shrink-0">
          <Eye className="w-3.5 h-3.5" />
          <span>{product.viewsCount || 0}</span>
        </div>
      </CardFooter>
    </Card>
  );
}
