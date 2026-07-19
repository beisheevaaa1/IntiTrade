import type {
  AdminReview,
  Announcement,
  AuditLog,
  BlockedUser,
  Category,
  Conversation,
  Listing,
  MeetupPoint,
  Notification,
  Pagination,
  PresentedListing,
  Report,
  SupportTicket,
  SupportTicketMessage,
  SystemSnapshot,
  Transaction,
  User,
  WantAd
} from "../types";

export type AuthUserResponse = {
  user: User;
};

export type RegisterResponse = {
  user?: User;
  requiresVerification?: boolean;
  verificationToken?: string;
  verificationCode?: string;
};

export type VerificationChallengeResponse = {
  message: string;
  verificationToken?: string;
  verificationCode?: string;
};

export type AutocompleteResponse = {
  suggestions?: string[];
};

export type UploadResponse = {
  url: string;
};

export type CategoriesResponse = {
  categories: Category[];
};

export type MeetupPointsResponse = {
  meetupPoints: MeetupPoint[];
};

export type ListingsResponse = {
  listings: Listing[];
  pagination?: Pagination;
};

export type ListingResponse = {
  listing: Listing;
};

export type WantAdsResponse = {
  wantAds: WantAd[];
};

export type WantAdResponse = {
  wantAd: WantAd;
};

export type Favorite = {
  id: string;
  listingId: string;
  listing: PresentedListing | null;
};

export type FavoritesResponse = {
  favorites: Favorite[];
};

export type NotificationsResponse = {
  notifications: Notification[];
};

export type ConversationApi = Conversation & {
  listingSnapshot?: PresentedListing | null;
};

export type ConversationsResponse = {
  conversations: ConversationApi[];
};

export type ConversationResponse = {
  conversation: ConversationApi;
};

export type TransactionsResponse = {
  transactions: Transaction[];
};

export type TransactionResponse = {
  transaction: Transaction;
};

export type BlocksResponse = {
  blocks: BlockedUser[];
};

export type ProfileResponse = {
  user: User;
};

export type AnnouncementsResponse = {
  announcements: Announcement[];
};

export type AdminUsersResponse = {
  users: User[];
};

export type ReportsResponse = {
  reports: Report[];
};

export type AdminReviewsResponse = {
  reviews: AdminReview[];
};

export type AdminDisputesResponse = {
  disputes: Transaction[];
};

export type AuditLogsResponse = {
  logs: AuditLog[];
  pagination?: Pagination;
};

export type AdminOverviewResponse = {
  openSupportTickets?: number;
};

export type SupportTicketsResponse = {
  tickets: SupportTicket[];
  pagination?: Pagination;
  openCount?: number;
};

export type SupportMessagesResponse = {
  messages: SupportTicketMessage[];
  pagination?: Pagination;
};

export type SupportTicketResponse = {
  ticket: SupportTicket;
};

export type SupportMessageResponse = {
  message: SupportTicketMessage;
};
