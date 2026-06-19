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
  sellerId: string;
  categoryId: string;
  createdAt: string;
  seller: Pick<User, "id" | "name" | "email">;
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
