import { createBrowserRouter } from "react-router";
import { AppLayout } from "./components/AppLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";

const lazyHome = async () => ({ Component: (await import("./pages/Home")).Home });
const lazyLogin = async () => ({ Component: (await import("./pages/Login")).Login });
const lazyRegister = async () => ({ Component: (await import("./pages/Register")).Register });
const lazyVerifyEmail = async () => ({ Component: (await import("./pages/VerifyEmail")).VerifyEmail });
const lazyBrowse = async () => ({ Component: (await import("./pages/BrowseListings")).BrowseListings });
const lazyProduct = async () => ({ Component: (await import("./pages/ProductDetail")).ProductDetail });
const lazyCreateListing = async () => ({ Component: (await import("./pages/CreateListing")).CreateListing });
const lazyInbox = async () => ({ Component: (await import("./pages/Inbox")).Inbox });
const lazyDashboard = async () => ({ Component: (await import("./pages/Dashboard")).Dashboard });
const lazyWantAds = async () => ({ Component: (await import("./pages/WantAds")).WantAds });
const lazyAdmin = async () => ({ Component: (await import("./pages/AdminPage")).AdminPage });
const lazyAdminLogin = async () => ({ Component: (await import("./pages/AdminLogin")).AdminLogin });
const lazyAnnouncements = async () => ({ Component: (await import("./pages/Announcements")).Announcements });
const lazyWishlist = async () => ({ Component: (await import("./pages/Wishlist")).Wishlist });
const lazySupport = async () => ({ Component: (await import("./pages/Support")).Support });

export const router = createBrowserRouter([
  {
    path: "/",
    Component: AppLayout,
    children: [
      { index: true, lazy: lazyHome },
      { path: "browse", lazy: lazyBrowse },
      { path: "product/:id", lazy: lazyProduct },
      { path: "want-ads", lazy: lazyWantAds },
      { path: "announcements", lazy: lazyAnnouncements },
      { path: "verify-email", lazy: lazyVerifyEmail },
      {
        element: <ProtectedRoute />,
        children: [
          { path: "create-listing", lazy: lazyCreateListing },
          { path: "edit-listing/:id", lazy: lazyCreateListing },
          { path: "inbox", lazy: lazyInbox },
          { path: "dashboard", lazy: lazyDashboard },
          { path: "admin", lazy: lazyAdmin },
          { path: "wishlist", lazy: lazyWishlist },
          { path: "support", lazy: lazySupport }
        ]
      }
    ]
  },
  { path: "/login", lazy: lazyLogin },
  { path: "/register", lazy: lazyRegister },
  { path: "/admin/login", lazy: lazyAdminLogin }
]);
