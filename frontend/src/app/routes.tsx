import { createBrowserRouter } from "react-router";
import { AppLayout } from "./components/AppLayout";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { VerifyEmail } from "./pages/VerifyEmail";
import { BrowseListings } from "./pages/BrowseListings";
import { ProductDetail } from "./pages/ProductDetail";
import { CreateListing } from "./pages/CreateListing";
import { Inbox } from "./pages/Inbox";
import { Dashboard } from "./pages/Dashboard";
import { WantAds } from "./pages/WantAds";
import { AdminPage } from "./pages/AdminPage";
import { AdminLogin } from "./pages/AdminLogin";
import { Announcements } from "./pages/Announcements";
import { Wishlist } from "./pages/Wishlist";
import { ProtectedRoute } from "./components/ProtectedRoute";

function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
      <div className="text-center max-w-md">
        <h2 className="text-2xl font-bold mb-4">{title}</h2>
        <p className="text-muted-foreground">This page is under construction. It will feature the {title.toLowerCase()} functionality as specified in the IntiTrade design system.</p>
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: AppLayout,
    children: [
      { index: true, Component: Home },
      { path: "browse", Component: BrowseListings },
      { path: "product/:id", Component: ProductDetail },
      { path: "want-ads", Component: WantAds },
      { path: "announcements", Component: Announcements },
      { path: "verify-email", Component: VerifyEmail },
      
      // Protected Routes
      {
        element: <ProtectedRoute />,
        children: [
          { path: "create-listing", Component: CreateListing },
          { path: "edit-listing/:id", Component: CreateListing },
          { path: "inbox", Component: Inbox },
          { path: "dashboard", Component: Dashboard },
          { path: "admin", Component: AdminPage },
          { path: "wishlist", Component: Wishlist },
        ]
      }
    ],
  },
  {
    path: "/login",
    Component: Login
  },
  {
    path: "/register",
    Component: Register
  },
  {
    path: "/admin/login",
    Component: AdminLogin
  }
]);
