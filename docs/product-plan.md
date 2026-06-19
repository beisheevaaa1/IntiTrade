# IntiTrade Full Product Plan

## Product Positioning

IntiTrade is a closed university marketplace for students to buy, sell, request services, and coordinate safe campus meetups. The project should feel like a complete working product, not a demo: marketplace discovery, trusted student identity, seller tools, buyer chat, moderation, and deployment are all first-class parts of the system.

Design references:

- Vinted and Depop: fast listing creation, clear item cards, seller profiles, saved items, and strong photo-first browsing.
- Facebook Marketplace and OfferUp: local discovery, category filters, price/location context, and in-person transaction safety.
- Student-specific marketplaces such as StudySoup/Flashnotes: university identity, student-generated services/content, and institution-scoped trust.

## Core User Roles

- Guest: can browse active listings, view listing details, and see trust/safety messaging, but must sign in to save, chat, create, or report.
- Student: verified by university email, can create listings, manage own listings, favorite items, chat, report listings, and manage profile.
- Admin: can approve/reject listings, review reports, block/unblock users, inspect activity, and manage categories.

## Information Architecture

Main navigation:

- Market: default page, discovery-first marketplace feed.
- Sell: guided listing creation.
- Messages: realtime conversations connected to listings.
- Saved: favorite listings.
- My Listings: seller dashboard and listing status management.
- Profile: identity, verification, safety, and account settings.
- Admin: moderation dashboard for admins only.

## Page-by-Page UX Specification

### 1. Market Feed

Purpose: help students quickly find useful listings and services.

Must include:

- Hero command area with search, trust chips, and marketplace stats.
- Filter panel for type, category, campus location, condition, min/max price, and sort.
- Category chips for fast browsing.
- Listing grid with photo, title, price, category, type, condition, campus area, seller verified indicator, favorite action, and chat CTA.
- States: loading skeletons, no results, API/database unavailable, unauthenticated favorite prompt.

Success criteria:

- A user can understand the product within 5 seconds.
- A user can filter to a category/type in one interaction.
- Cards show enough trust and price context without opening detail.

### 2. Listing Detail

Purpose: help buyers evaluate trust, quality, and next action.

Must include:

- Image gallery with main image and thumbnails.
- Title, price, type, category, status, condition, location.
- Description with clear formatting.
- Seller card with verified badge, joined date, response hint, and listing count.
- Primary CTA: Start chat.
- Secondary actions: Save, Report.
- Safety block: meet on campus, inspect item, avoid advance payment.
- Similar listings.

Success criteria:

- Buyer knows who sells it, where to meet, and how to start a deal.
- Report action is visible but not more prominent than chat.

### 3. Auth and Email Verification

Purpose: make the marketplace student-only.

Must include:

- Login page.
- Register page.
- Email verification page.
- Domain validation using `ALLOWED_EMAIL_DOMAIN`.
- Clear messages for unverified, blocked, invalid domain, wrong password.

Success criteria:

- Student can register, verify, and log in.
- Non-allowed domains are blocked with a clear explanation.

### 4. Create Listing Wizard

Purpose: make posting fast while collecting enough data for moderation.

Steps:

- Offer: title, product/service, category.
- Price: price, negotiable flag, condition.
- Details: description, campus location, availability notes.
- Photos: upload, preview, remove/reorder.
- Review: listing preview before submit.

Rules:

- Product listings require condition.
- Service listings use `NOT_APPLICABLE` condition.
- New listings default to `PENDING`.
- User sees a post-submit status: waiting for admin approval.

Success criteria:

- Student can post a complete listing in under 2 minutes.
- Admin receives enough context to approve/reject safely.

### 5. My Listings

Purpose: give sellers control after posting.

Must include:

- Tabs: Pending, Active, Sold, Archived, Rejected.
- Listing rows/cards with status, views/favorites/conversations where available.
- Actions: edit, mark sold, archive, duplicate/repost, view chat.
- Rejection reason when admin rejects.

Success criteria:

- Seller always understands why a listing is not public.
- Sold/archive flows do not require admin.

### 6. Messages

Purpose: make the deal happen inside the product.

Must include:

- Conversation inbox.
- Active chat thread.
- Listing summary pinned at top.
- Realtime Socket.io messages.
- Timestamps and sender identity.
- Empty state when no conversations exist.
- Prevent self-chat.

Future upgrade:

- Unread count.
- Quick replies.
- Meeting time/location suggestion.
- Mark listing sold from chat.

Success criteria:

- Buyer can start chat from any active listing.
- Both users see new messages without refresh.

### 7. Saved Listings

Purpose: support browsing and comparison.

Must include:

- Saved listing grid.
- Remove from saved.
- Filter saved by product/service.
- Empty state with CTA back to marketplace.

Success criteria:

- Student can return to interesting listings without searching again.

### 8. Profile and Settings

Purpose: show identity, trust, and account control.

Must include:

- Name, email, verification status, role.
- Account status: active/blocked.
- Stats: active listings, sold listings, saved listings, conversations.
- Optional profile fields: faculty, campus area, bio.
- Password change.

Success criteria:

- Users can see whether they are verified and eligible to post.

### 9. Admin Dashboard

Purpose: make the university marketplace controlled and safe.

Must include:

- Metrics: pending listings, open reports, active users, active listings.
- Pending listing queue.
- Listing detail preview for moderation.
- Approve/reject with reason.
- Report queue with reporter, listing, reason, status.
- User management: block/unblock.
- Category management.

Success criteria:

- Admin can keep public marketplace quality high.
- Every rejected/report action has a reason trail.

## Backend Scope

Existing base:

- Express API.
- Prisma PostgreSQL schema.
- JWT auth.
- Nodemailer verification.
- Socket.io chat.
- Uploads stored on server.

Next backend upgrades:

- Add profile fields to `User`.
- Add `rejectionReason`, `viewsCount`, `isNegotiable`, `availability`, and `meetupPreference` to `Listing`.
- Add read/unread support to `Message`.
- Add admin audit log.
- Add category management endpoints.
- Add pagination for listings and messages.
- Add rate limiting for auth and messaging.
- Add production-safe upload validation and cleanup.

## Frontend Scope

Next frontend upgrades:

- Replace current forms with wizard components.
- Add skeleton loaders to data pages.
- Add toast notifications.
- Add profile page.
- Add listing edit page.
- Add listing preview component reused in create/detail/admin.
- Add admin detail drawer/modal.
- Add mobile-first refinements for filters and chat.

## Database Plan

Current entities:

- User
- EmailVerificationToken
- Category
- Listing
- ListingImage
- Favorite
- Conversation
- Message
- Report

Recommended additions:

- AdminActionLog: adminId, action, entityType, entityId, reason, createdAt.
- ListingView: userId nullable, listingId, createdAt, IP hash optional.
- UserProfile fields on User or separate Profile table.
- Notification: userId, type, payload, readAt.

## Development Phases

### Phase 1: Stabilize Product Foundation

- Ensure PostgreSQL local setup works.
- Run migrations and seed.
- Add error format consistency.
- Add pagination helpers.
- Add toast and skeleton UI.
- Push after every completed slice.

### Phase 2: Marketplace and Detail Quality

- Finish full marketplace filtering.
- Improve listing detail gallery and seller card.
- Add similar listings.
- Track listing views.
- Add mobile filter drawer.

### Phase 3: Seller Workflow

- Build create listing wizard.
- Build edit listing.
- Improve My Listings dashboard.
- Add rejected reason display.
- Add duplicate/repost listing.

### Phase 4: Buyer Workflow

- Improve saved listings.
- Improve chat UX.
- Add unread counts.
- Add meeting suggestion UI.
- Add report flow confirmation.

### Phase 5: Admin Workflow

- Build moderation queues.
- Add reject reason.
- Add report status workflow.
- Add user blocking flow.
- Add admin action log.

### Phase 6: Production Readiness

- Add rate limiting.
- Add secure headers.
- Add upload cleanup.
- Add server backup notes.
- Deploy with PM2, Nginx, PostgreSQL.
- Add smoke test checklist.

## Acceptance Criteria

- A new student can register, verify email, browse, save, create a listing, and start chat.
- A seller can manage listing lifecycle from pending to active to sold/archive.
- An admin can approve/reject listings and process reports.
- The UI works on desktop and mobile.
- The app runs on local PostgreSQL and on the self-managed server.
- Repository is pushed to `beisheevaaa1/IntiTrade` after each meaningful change.
