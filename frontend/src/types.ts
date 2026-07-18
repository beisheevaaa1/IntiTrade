export type Role = "STUDENT" | "ADMIN";
export type SellerType = "CASUAL" | "SHOP" | "SERVICE_PROVIDER";
export type ListingType = "PRODUCT" | "SERVICE" | "COURSE";
export type ListingCondition = "NEW" | "LIKE_NEW" | "GOOD" | "FAIR" | "NOT_APPLICABLE";
export type ListingStatus = "PENDING" | "ACTIVE" | "SOLD" | "ARCHIVED" | "REJECTED";
export type ReportStatus = "OPEN" | "REVIEWED" | "DISMISSED" | "ACTIONED";
export type SupportTicketCategory = "ACCOUNT" | "LISTING" | "TRANSACTION" | "SAFETY" | "TECHNICAL" | "OTHER";
export type SupportTicketStatus = "OPEN" | "IN_PROGRESS" | "WAITING_FOR_USER" | "RESOLVED" | "CLOSED";
export type SupportTicketPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

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
  phone?: string | null;
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
  showAcademicProfile?: boolean;
  gpa?: number | null;
  academicGrades?: string | null;
  resume?: string | null;
  projects?: string | null;
  academicTipShown?: boolean;
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
  interestCount?: number;
  isNegotiable?: boolean;
  showPhone?: boolean;
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
  seller: Pick<User, "id" | "name" | "email" | "phone" | "faculty" | "campusArea" | "avatarUrl" | "sellerType" | "rating" | "ratingCount" | "showAcademicProfile" | "gpa" | "academicGrades" | "resume" | "projects"> & { isVerified?: boolean };
  category: Category;
  images: ListingImage[];
  _count?: { favorites: number; reports: number };
  transactions?: Transaction[];
};

/**
 * Relationship APIs may intentionally return the last approved listing snapshot,
 * or a redacted placeholder, after the live listing leaves the marketplace.
 * Fields that are required on a public Listing can therefore be absent or null.
 */
export type PresentedListing = Partial<Omit<Listing,
  | "id"
  | "title"
  | "description"
  | "price"
  | "type"
  | "condition"
  | "status"
  | "location"
  | "sellerId"
  | "categoryId"
  | "createdAt"
  | "category"
  | "images"
>> & {
  id: string;
  title: string;
  description?: string | null;
  price?: string | null;
  type?: ListingType | null;
  condition?: ListingCondition | null;
  status: ListingStatus;
  location?: string | null;
  sellerId?: string | null;
  categoryId?: string | null;
  createdAt?: string | null;
  category?: Category | null;
  images: ListingImage[];
  isSnapshot?: boolean;
  unavailable?: boolean;
};

export type Message = {
  id: string;
  body: string;
  createdAt: string;
  sender: Pick<User, "id" | "name">;
  senderId?: string;
  readAt?: string | null;
  deliveredAt?: string | null;
  attachmentUrl?: string | null;
  offerAmount?: string | null;
  offerStatus?: "PENDING" | "ACCEPTED" | "DECLINED" | null;
};

export type Conversation = {
  id: string;
  buyerId: string;
  sellerId: string;
  listing: PresentedListing | null;
  buyer: Pick<User, "id" | "name" | "avatarUrl" | "lastActiveAt" | "showOnlineStatus">;
  seller: Pick<User, "id" | "name" | "avatarUrl" | "lastActiveAt" | "showOnlineStatus">;
  messages: Message[];
  updatedAt: string;
  isBlockedByMe?: boolean;
  hasBlockedMe?: boolean;
};

export type Report = {
  id: string;
  reason: string;
  details?: string;
  status: ReportStatus;
  listing: PresentedListing & { seller?: Pick<User, "id" | "name" | "email"> };
  reporter: Pick<User, "id" | "name" | "email">;
};

export type WantAd = {
  id: string;
  title: string;
  description: string;
  maxPrice: string;
  status: "ACTIVE" | "FULFILLED" | "CLOSED";
  createdAt: string;
  userId: string;
  user: Pick<User, "id" | "name">;
  category: Category;
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
  otpCode?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  disputeReason?: string | null;
  review?: Review | null;
  reviews?: Review[];
  createdAt: string;
  listing?: PresentedListing;
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

export type SupportTicket = {
  id: string;
  subject: string;
  description: string;
  category: SupportTicketCategory;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  resolvedAt?: string | null;
  lastMessageAt: string;
  userId: string;
  assignedAdminId?: string | null;
  user?: Pick<User, "id" | "name" | "email">;
  assignedAdmin?: Pick<User, "id" | "name"> | null;
  messages?: SupportTicketMessage[];
  _count?: { messages: number };
  createdAt: string;
  updatedAt: string;
};

export type SupportTicketMessage = {
  id: string;
  body: string;
  isAdmin: boolean;
  ticketId: string;
  authorId: string;
  author?: Pick<User, "id" | "name"> | null;
  createdAt: string;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
