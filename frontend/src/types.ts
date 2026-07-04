export type Role = "STUDENT" | "ADMIN";
export type SellerType = "CASUAL" | "SHOP" | "SERVICE_PROVIDER";
export type ListingType = "PRODUCT" | "SERVICE" | "COURSE";
export type ListingCondition = "NEW" | "LIKE_NEW" | "GOOD" | "FAIR" | "NOT_APPLICABLE";
export type ListingStatus = "PENDING" | "ACTIVE" | "SOLD" | "ARCHIVED" | "REJECTED";
export type ReportStatus = "OPEN" | "REVIEWED" | "DISMISSED" | "ACTIONED";

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  isVerified: boolean;
  isBlocked: boolean;
  faculty?: string | null;
  campusArea?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  autoReplyEnabled?: boolean;
  autoReplyMessage?: string;
  autoReplyDelay?: number;
  lastActiveAt?: string;
  showOnlineStatus?: boolean;
  sellerType?: SellerType;
  showEmail?: boolean;
  showCampusArea?: boolean;
  allowMessages?: boolean;
  rating?: number;
  ratingCount?: number;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
};

export type ListingImage = {
  id: string;
  url: string;
};

export type Listing = {
  id: string;
  title: string;
  description: string;
  price: string;
  type: ListingType;
  condition: ListingCondition;
  status: ListingStatus;
  location: string;
  rejectionReason?: string | null;
  viewsCount?: number;
  isNegotiable?: boolean;
  meetupPreference?: string | null;
  meetupPointId?: string | null;
  meetupPoint?: MeetupPoint | null;
  quantity?: number;
  isRecurring?: boolean;
  isbn?: string | null;
  author?: string | null;
  edition?: string | null;
  courseCode?: string | null;
  serviceDuration?: number | null;
  pricingUnit?: "ITEM" | "HOUR" | "SESSION" | "COURSE" | null;
  availabilityNote?: string | null;
  sellerId: string;
  categoryId: string;
  createdAt: string;
  seller: Pick<User, "id" | "name" | "email" | "faculty" | "campusArea" | "avatarUrl" | "sellerType" | "rating" | "ratingCount"> & { isVerified?: boolean };
  category: Category;
  images: ListingImage[];
  _count?: { favorites: number; reports: number };
};

export type Message = {
  id: string;
  body: string;
  createdAt: string;
  sender: Pick<User, "id" | "name">;
  senderId?: string;
  readAt?: string | null;
  attachmentUrl?: string | null;
  offerAmount?: string | null;
};

export type Conversation = {
  id: string;
  buyerId: string;
  sellerId: string;
  listing: Listing;
  buyer: Pick<User, "id" | "name">;
  seller: Pick<User, "id" | "name">;
  messages: Message[];
  updatedAt: string;
};

export type Report = {
  id: string;
  reason: string;
  details?: string;
  status: ReportStatus;
  listing: Listing;
  reporter: Pick<User, "id" | "name" | "email">;
};

export type WantAd = {
  id: string;
  title: string;
  description: string;
  maxPrice: number;
  createdAt: string;
  userId: string;
  user: Pick<User, "id" | "name">;
};

export type Transaction = {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  price: string;
  quantity: number;
  status: "RESERVED" | "COMPLETED" | "CANCELLED" | "DISPUTED";
  meetupPoint?: MeetupPoint | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  disputeReason?: string | null;
  review?: Review | null;
  createdAt: string;
  listing?: Pick<Listing, "id" | "title" | "price">;
  buyer?: Pick<User, "id" | "name" | "email">;
  seller?: Pick<User, "id" | "name" | "email">;
};

export type Review = {
  id: string;
  transactionId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  reviewer?: Pick<User, "id" | "name" | "avatarUrl">;
};

export type MeetupPoint = {
  id: string;
  name: string;
  description?: string | null;
  campusArea?: string | null;
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  imageUrl?: string | null;
  location?: string | null;
  eventDate?: string | null;
  expiresAt?: string | null;
  status: "PENDING" | "ACTIVE" | "REJECTED" | "EXPIRED";
  rejectionReason?: string | null;
  author?: Pick<User, "id" | "name" | "avatarUrl" | "faculty">;
  createdAt: string;
};
