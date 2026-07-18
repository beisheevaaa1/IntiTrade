import React from "react";
import { Skeleton } from "./ui/skeleton";
import { Card, CardContent, CardFooter } from "./ui/card";

export function ProductCardSkeleton() {
  return (
    <Card className="overflow-hidden flex flex-col h-full border-border bg-white shadow-sm">
      {/* Image Thumbnail Skeleton */}
      <div className="relative aspect-square overflow-hidden bg-gray-100">
        <Skeleton className="w-full h-full rounded-none" />
        <div className="absolute top-2.5 left-2.5 flex gap-1.5">
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="absolute top-2.5 right-2.5">
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>

      {/* Content Skeleton */}
      <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-2">
          {/* Title */}
          <Skeleton className="h-4 w-4/5 rounded" />
          <Skeleton className="h-4 w-2/3 rounded" />
        </div>

        {/* Price & Badge */}
        <div className="flex items-baseline justify-between pt-1">
          <Skeleton className="h-6 w-24 rounded" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      </CardContent>

      {/* Footer Seller Info Skeleton */}
      <CardFooter className="p-3.5 bg-gray-50/70 border-t border-border/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-3 w-20 rounded" />
        </div>
        <Skeleton className="h-3 w-16 rounded" />
      </CardFooter>
    </Card>
  );
}

interface ProductGridSkeletonProps {
  count?: number;
}

export function ProductGridSkeleton({ count = 8 }: ProductGridSkeletonProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 mb-10">
      {Array.from({ length: count }).map((_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}
