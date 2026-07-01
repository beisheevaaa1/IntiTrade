export type Role = "STUDENT" | "ADMIN";
export type ListingType = "PRODUCT" | "SERVICE";
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
  sellerId: string;
  categoryId: string;
  createdAt: string;
  seller: Pick<User, "id" | "name" | "email" | "faculty" | "campusArea" | "avatarUrl">;
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
};

export type Conversation = {
  id: string;
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
  createdAt: string;
  listing?: Pick<Listing, "id" | "title" | "price">;
  buyer?: Pick<User, "id" | "name" | "email">;
  seller?: Pick<User, "id" | "name" | "email">;
};
