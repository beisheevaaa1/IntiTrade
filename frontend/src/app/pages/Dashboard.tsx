import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { 
  LayoutDashboard, 
  Package, 
  ShoppingBag, 
  MessageSquare, 
  Star, 
  Heart, 
  Bell, 
  Settings, 
  TrendingUp,
  Eye,
  PlusCircle,
  Copy,
  Loader2,
  Trash2,
  CheckCircle,
  Archive,
  AlertTriangle
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { useAuth } from "../../state/AuthContext";
import { useToast } from "../../state/ToastContext";
import { PromptModal } from "../components/PromptModal";
import { DashboardSkeleton } from "../components/DashboardSkeleton";
import { api, mediaUrl } from "../../api/client";
import type { Listing } from "../../types";

export function Dashboard() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, logout, updateUser } = useAuth();
  
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [transactions, setTransactions] = useState<import("../../types").Transaction[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [privacy, setPrivacy] = useState({ showEmail: user?.showEmail ?? false, showCampusArea: user?.showCampusArea ?? true, allowMessages: user?.allowMessages ?? true, showOnlineStatus: user?.showOnlineStatus ?? true });
  const [activeTab, setActiveTab] = useState<"overview" | "listings" | "transactions" | "archived" | "privacy">("overview");
  const [promptConfig, setPromptConfig] = useState<any>({ isOpen: false, title: "", onSubmit: () => {} });

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch user's listings
      const listingsRes = await api.get("/listings/mine");
      setListings(listingsRes.data.listings || []);

      // Fetch unread messages count
      const convsRes = await api.get("/conversations");
      const unread = (convsRes.data.conversations || [])
        .flatMap((conversation: any) => conversation.messages || [])
        .filter((message: any) => !message.readAt && message.sender?.id !== user?.id)
        .length;
      setUnreadMessagesCount(unread);
      const transactionsRes = await api.get("/transactions");
      setTransactions(transactionsRes.data.transactions || []);

      // Fetch blocked users
      const blocksRes = await api.get("/community/blocks");
      setBlockedUsers(blocksRes.data.blocks || []);
    } catch (err) {
      console.error("Error fetching dashboard data:");
    } finally {
      setLoading(false);
    }
  };

  const handleUnblockUser = async (userId: string) => {
    try {
      await api.delete(`/community/blocks/${userId}`);
      setBlockedUsers((current) => current.filter((block) => block.blockedId !== userId));
      toast.success("User unblocked successfully.");
    } catch (err) {
      console.error("Error unblocking user:");
      toast.error("Failed to unblock user.");
    }
  };

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    fetchDashboardData();
    window.addEventListener("intitrade:messages-changed", fetchDashboardData);
    return () => window.removeEventListener("intitrade:messages-changed", fetchDashboardData);
  }, [navigate, user?.id]);

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/listings/${id}/status`, { status });
      // Update local state
      setListings(listings.map(l => l.id === id ? { ...l, status: status as any } : l));
    } catch (err) {
      console.error("Error updating status:");
      toast.error("Failed to update status.");
    }
  };

  const updateTransaction = async (id: string, status: "COMPLETED" | "CANCELLED" | "DISPUTED") => {
    if (status === "DISPUTED") {
      setPromptConfig({
        isOpen: true,
        title: "Report Issue / Dispute",
        description: "What went wrong with this transaction? Moderation will review.",
        placeholder: "Describe the meetup or item problem...",
        onSubmit: async (reason: string) => {
          const response = await api.patch(`/transactions/${id}/status`, { status, reason });
          setTransactions((current) => current.map((transaction) => transaction.id === id ? response.data.transaction : transaction));
          void fetchDashboardData();
        }
      });
      return;
    }
    const response = await api.patch(`/transactions/${id}/status`, { status });
    setTransactions((current) => current.map((transaction) => transaction.id === id ? response.data.transaction : transaction));
    void fetchDashboardData();
  };

  const leaveReview = (transactionId: string) => {
    setPromptConfig({
      isOpen: true,
      title: "Rate Seller (1 to 5)",
      description: "Enter a number from 1 (Poor) to 5 (Excellent)",
      placeholder: "5",
      isTextarea: false,
      onSubmit: async (value: string) => {
        const rating = Number(value);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
          toast.error("Please enter a valid rating between 1 and 5");
          return;
        }
        setPromptConfig({
          isOpen: true,
          title: "Leave a Review Comment",
          description: "Share a short note about your meetup or item (optional)",
          placeholder: "Great communication, item exactly as described!",
          isTextarea: true,
          required: false,
          onSubmit: async (comment: string) => {
            try {
              await api.post(`/transactions/${transactionId}/review`, { rating, comment: comment || undefined });
              toast.success("Review submitted! Thank you for feedback.");
              void fetchDashboardData();
            } catch (err) {
              toast.error("Failed to submit review.");
            }
          }
        });
      }
    });
  };

  const savePrivacy = async () => {
    const response = await api.patch("/auth/profile", privacy);
    updateUser(response.data.user);
    toast.success("Privacy preferences saved.");
  };

  // Calculations
  const activeListings = listings.filter(l => l.status === "ACTIVE");
  const pendingListings = listings.filter(l => l.status === "PENDING");
  const rejectedListings = listings.filter(l => l.status === "REJECTED");
  const soldListings = listings.filter(l => l.status === "SOLD");
  const totalViews = listings.reduce((sum, item) => sum + (item.viewsCount || 0), 0);
  const totalInterests = listings.reduce((sum, item) => sum + (item.interestCount || 0), 0);
  const profileSubtitle = user?.role === "ADMIN" ? "Administrator" : user?.faculty || "Student";

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="bg-gray-50 flex-grow flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-border shrink-0 md:min-h-[calc(100vh-80px)]">
        <div className="p-6 hidden md:block border-b border-border">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 border-2 border-primary/20 bg-white">
              <AvatarImage src={mediaUrl(user?.avatarUrl || undefined)} />
              <AvatarFallback className="bg-red-50 text-primary font-bold">
                {user?.name.substring(0, 2).toUpperCase() || "US"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-sm text-foreground truncate" title={user?.name}>{user?.name}</h3>
              <p className="text-xs text-muted-foreground truncate">{profileSubtitle}</p>
              <p className="text-[11px] text-gray-500 truncate mt-0.5" title={user?.email}>{user?.email}</p>
            </div>
          </div>
        </div>
        <nav className="p-4 flex flex-row md:flex-col overflow-x-auto md:overflow-visible gap-1 hide-scrollbar w-full">
          <button 
            onClick={() => setActiveTab("overview")} 
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm shrink-0 w-full text-left transition-colors ${activeTab === "overview" ? "bg-red-50 text-primary font-bold" : "hover:bg-gray-100 text-gray-700"}`}
          >
            <LayoutDashboard className="h-5 w-5" />
            <span>Overview</span>
          </button>
          <button 
            onClick={() => setActiveTab("listings")} 
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm shrink-0 w-full text-left transition-colors ${activeTab === "listings" ? "bg-red-50 text-primary font-bold" : "hover:bg-gray-100 text-gray-700"}`}
          >
            <Package className="h-5 w-5" />
            <span>My Listings</span>
          </button>
          <button 
            onClick={() => setActiveTab("transactions")} 
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm shrink-0 w-full text-left transition-colors ${activeTab === "transactions" ? "bg-red-50 text-primary font-bold" : "hover:bg-gray-100 text-gray-700"}`}
          >
            <ShoppingBag className="h-5 w-5" />
            <span>Transactions & History</span>
          </button>
          <button 
            onClick={() => setActiveTab("archived")} 
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm shrink-0 w-full text-left transition-colors ${activeTab === "archived" ? "bg-red-50 text-primary font-bold" : "hover:bg-gray-100 text-gray-700"}`}
          >
            <Archive className="h-5 w-5" />
            <span>Archived Items</span>
          </button>
          <button 
            onClick={() => setActiveTab("privacy")} 
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm shrink-0 w-full text-left transition-colors ${activeTab === "privacy" ? "bg-red-50 text-primary font-bold" : "hover:bg-gray-100 text-gray-700"}`}
          >
            <Settings className="h-5 w-5" />
            <span>Privacy & Settings</span>
          </button>
          <div className="my-2 border-t border-border hidden md:block"></div>
          <Link to="/inbox" className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-100 text-gray-700 font-medium text-sm shrink-0">
            <MessageSquare className="h-5 w-5" />
            <span>Messages</span>
            {unreadMessagesCount > 0 && (
              <span className="ml-auto bg-primary text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full">
                {unreadMessagesCount}
              </span>
            )}
          </Link>
          <button 
            onClick={() => { logout(); navigate("/login"); }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-100 text-gray-700 font-medium text-sm shrink-0 w-full text-left mt-auto"
          >
            <Settings className="h-5 w-5" />
            <span>Log Out</span>
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-grow p-4 md:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground capitalize">Dashboard {activeTab}</h1>
            <p className="text-muted-foreground text-sm">Welcome back! Manage your campus trade activity here.</p>
          </div>
          <Link to="/create-listing">
            <Button className="font-semibold rounded-xl gap-2 h-10 shadow-sm">
              <PlusCircle className="h-4 w-4" /> Post New Item
            </Button>
          </Link>
        </div>

        {/* 1. OVERVIEW TAB */}
        {activeTab === "overview" && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
              <Card className="shadow-sm border-transparent bg-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                      <Package className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Active Listings</p>
                    <h3 className="text-3xl font-bold text-foreground">{activeListings.length}</h3>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="shadow-sm border-transparent bg-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                      <ShoppingBag className="h-5 w-5 text-green-600" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Sold Items</p>
                    <h3 className="text-3xl font-bold text-foreground">{soldListings.length}</h3>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-transparent bg-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
                      <Eye className="h-5 w-5 text-purple-600" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Views</p>
                    <h3 className="text-3xl font-bold text-foreground">{totalViews}</h3>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-transparent bg-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                      <MessageSquare className="h-5 w-5 text-green-600" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Interested Buyers</p>
                    <h3 className="text-3xl font-bold text-foreground">{totalInterests}</h3>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-transparent bg-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-full bg-yellow-50 flex items-center justify-center">
                      <Star className="h-5 w-5 text-yellow-600" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Pending</p>
                    <h3 className="text-3xl font-bold text-foreground">{pendingListings.length}</h3>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Listings */}
            <Card className="shadow-sm border-border bg-white mb-8">
              <CardHeader className="border-b border-border pb-4 flex flex-row justify-between items-center">
                <CardTitle className="text-lg">Recent Active Listings</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab("listings")} className="text-xs text-primary font-bold">
                  View All
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {activeListings.slice(0, 3).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    You don't have any active listings right now.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {activeListings.slice(0, 3).map(item => renderListingRow(item))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Transactions */}
            <Card className="shadow-sm border-border bg-white">
              <CardHeader className="border-b border-border pb-4 flex flex-row justify-between items-center">
                <CardTitle className="text-lg">Recent Purchases & Bookings</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab("transactions")} className="text-xs text-primary font-bold">
                  View All
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {transactions.slice(0, 3).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No transactions yet.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {transactions.slice(0, 3).map(t => renderTransactionRow(t))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* 2. MY LISTINGS TAB */}
        {activeTab === "listings" && (
          <Card className="shadow-sm border-border bg-white mb-8">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-lg font-bold">My Active & Pending Listings</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {listings.filter(l => l.status !== "ARCHIVED" && l.status !== "SOLD").length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  You don't have any active or pending listings.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {listings.filter(l => l.status !== "ARCHIVED" && l.status !== "SOLD").map(item => renderListingRow(item))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 3. TRANSACTIONS TAB */}
        {activeTab === "transactions" && (
          <Card className="shadow-sm border-border bg-white">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-lg font-bold">Reservations, Bookings & Purchases History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {transactions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No reservations or bookings yet.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {transactions.map(t => renderTransactionRow(t))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 4. ARCHIVED TAB */}
        {activeTab === "archived" && (
          <Card className="shadow-sm border-border bg-white">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-lg font-bold">Archived & Sold Items (History)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {listings.filter(l => l.status === "ARCHIVED" || l.status === "SOLD").length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No archived or sold items found.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {listings.filter(l => l.status === "ARCHIVED" || l.status === "SOLD").map(item => renderListingRow(item))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 5. PRIVACY & SETTINGS TAB */}
        {activeTab === "privacy" && (
          <Card className="shadow-sm border-border bg-white">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-lg font-bold">Privacy Preferences & Contact Settings</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {[
                ["showEmail", "Show my email on listings"],
                ["showCampusArea", "Show my campus area"],
                ["allowMessages", "Allow new buyer messages"],
                ["showOnlineStatus", "Show when I am online"]
              ].map(([key, label]) => (
                <label key={key} className="flex items-center justify-between border rounded-xl p-4 hover:bg-gray-50/50 cursor-pointer">
                  <span className="text-sm font-medium text-gray-800">{label}</span>
                  <input 
                    type="checkbox" 
                    checked={privacy[key as keyof typeof privacy]} 
                    onChange={(event) => setPrivacy((current) => ({ ...current, [key]: event.target.checked }))} 
                    className="h-5 w-5 accent-red-600 cursor-pointer" 
                  />
                </label>
              ))}
              <div className="flex justify-end pt-2 border-b border-border pb-6 mb-6">
                <Button onClick={savePrivacy} className="font-semibold shadow-sm h-11 px-6 rounded-xl">
                  Save privacy settings
                </Button>
              </div>

              {/* Blocked Users Section */}
              <div className="pt-2">
                <h4 className="font-bold text-base text-foreground mb-4 flex items-center gap-2">
                  <span>🚫</span> Blocked Users
                </h4>
                {blockedUsers.length === 0 ? (
                  <p className="text-xs text-muted-foreground bg-gray-50 border border-dashed p-6 rounded-xl text-center">
                    You haven't blocked any users yet.
                  </p>
                ) : (
                  <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                    {blockedUsers.map((block) => (
                      <div key={block.blockedId} className="flex items-center justify-between border rounded-xl p-3 bg-white hover:bg-gray-50/50 transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar className="h-8 w-8 border border-border">
                            <AvatarImage src={mediaUrl(block.blocked?.avatarUrl || undefined)} />
                            <AvatarFallback className="text-[10px] bg-red-50 text-primary font-bold">
                              {block.blocked?.name?.substring(0, 2).toUpperCase() || "US"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-semibold text-gray-800 truncate" title={block.blocked?.name}>
                            {block.blocked?.name}
                          </span>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleUnblockUser(block.blockedId)}
                          className="h-8 text-xs font-semibold text-primary hover:bg-red-50 border-primary/30 hover:border-primary transition-colors shrink-0"
                        >
                          Unblock
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );

  function renderListingRow(item: Listing) {
    const firstImg = item.images?.[0]?.url 
      ? mediaUrl(item.images[0].url)
      : "/placeholder-item.svg";

    return (
      <div key={item.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 hover:bg-gray-50 transition-colors">
        <Link to={`/product/${item.id}`} className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden border border-border shrink-0 hover:opacity-90 transition-opacity">
          <img src={firstImg} className="w-full h-full object-cover" alt="Item" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link to={`/product/${item.id}`} className="font-semibold text-foreground text-sm truncate hover:text-primary transition-colors">
              {item.title}
            </Link>
            <span className={`px-2 py-0.5 text-[9px] font-bold rounded ${
              item.status === "ACTIVE" ? "bg-green-100 text-green-700" :
              item.status === "PENDING" ? "bg-yellow-100 text-yellow-700" :
              item.status === "REJECTED" ? "bg-red-100 text-red-700" :
              "bg-gray-100 text-gray-700"
            }`}>
              {item.status}
            </span>
          </div>
          <div className="text-primary font-bold text-sm mt-0.5">RM {parseFloat(item.price).toFixed(2)}</div>
          
          {item.status === "REJECTED" && item.rejectionReason && (
            <div className="flex items-center gap-1 mt-2 text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-100">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span><strong>Reason:</strong> {item.rejectionReason}</span>
            </div>
          )}
          
          <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5 text-purple-600"/> {item.viewsCount || 0} views</span>
            <span className="flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5 text-green-600"/> {item.interestCount || 0} interested</span>
          </div>
        </div>
        
        <div className="flex gap-2 sm:self-center self-end mt-2 sm:mt-0 items-center">
          {(item.status === "ACTIVE" || item.status === "PENDING" || item.status === "REJECTED") && (
            <>
              <Link to={`/edit-listing/${item.id}`}>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-semibold border-amber-200 text-amber-700 hover:bg-amber-50"
                >
                  Edit
                </Button>
              </Link>
              <Link to={`/create-listing?duplicateId=${item.id}`} title="Duplicate / Repost this listing">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1 border-purple-200 text-purple-700 hover:bg-purple-50 font-semibold"
                >
                  <Copy className="w-3.5 h-3.5" /> Repost
                </Button>
              </Link>
            </>
          )}
          {item.status === "ACTIVE" && (
            <>
              <Button 
                onClick={() => handleUpdateStatus(item.id, "SOLD")}
                variant="outline" 
                size="sm" 
                className="h-8 text-xs gap-1 border-green-200 text-green-700 hover:bg-green-50 font-medium"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Mark Sold
              </Button>
              <Button 
                onClick={() => handleUpdateStatus(item.id, "ARCHIVED")}
                variant="outline" 
                size="sm" 
                className="h-8 text-xs gap-1 text-gray-600 font-medium"
              >
                <Archive className="w-3.5 h-3.5" /> Archive
              </Button>
            </>
          )}
          {(item.status === "ARCHIVED" || item.status === "SOLD") && (
            <Button 
              onClick={() => handleUpdateStatus(item.id, "ACTIVE")}
              variant="outline" 
              size="sm" 
              className="h-8 text-xs gap-1 border-blue-200 text-blue-700 hover:bg-blue-50 font-semibold"
            >
              Activate / Undo
            </Button>
          )}
        </div>
      </div>
    );
  }

  function renderTransactionRow(transaction: any) {
    const isSeller = transaction.sellerId === user?.id;
    return (
      <div key={transaction.id} className="p-5 flex flex-col md:flex-row gap-4 md:items-center">
        <div className="flex-1">
          <p className="font-semibold">{transaction.listing?.title}</p>
          <p className="text-sm text-muted-foreground">
            {isSeller ? `Buyer: ${transaction.buyer?.name}` : `Seller: ${transaction.seller?.name}`} · RM {Number(transaction.price).toFixed(2)}
            {transaction.quantity > 1 ? ` × ${transaction.quantity}` : ""}
          </p>
          {transaction.meetupPoint && (
            <p className="text-xs text-green-700 mt-1">Meet at {transaction.meetupPoint.name}</p>
          )}
        </div>
        <span className={`text-xs font-bold px-3 py-1 rounded-full self-start ${
          transaction.status === "COMPLETED" ? "bg-green-100 text-green-700" : 
          transaction.status === "DISPUTED" ? "bg-red-100 text-red-700" : 
          "bg-amber-100 text-amber-700"
        }`}>
          {transaction.status}
        </span>
        {transaction.status === "RESERVED" && (
          <div className="flex gap-2">
            {isSeller && (
              <Button size="sm" onClick={() => updateTransaction(transaction.id, "COMPLETED")}>
                Complete handoff
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => updateTransaction(transaction.id, "CANCELLED")}>
              Cancel
            </Button>
            <Button size="sm" variant="ghost" onClick={() => updateTransaction(transaction.id, "DISPUTED")}>
              Dispute
            </Button>
          </div>
        )}
        {transaction.status === "COMPLETED" && !isSeller && !transaction.review && (
          <Button size="sm" variant="outline" className="gap-1" onClick={() => leaveReview(transaction.id)}>
            <Star className="w-4 h-4" /> Rate seller
          </Button>
        )}
      </div>
    );
  }
}
