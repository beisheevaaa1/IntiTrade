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
import { api, mediaUrl } from "../../api/client";
import type { Listing } from "../../types";

export function Dashboard() {
  const navigate = useNavigate();
  const { user, logout, updateUser } = useAuth();
  
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [conversationsCount, setConversationsCount] = useState(0);
  const [transactions, setTransactions] = useState<import("../../types").Transaction[]>([]);
  const [privacy, setPrivacy] = useState({ showEmail: user?.showEmail ?? false, showCampusArea: user?.showCampusArea ?? true, allowMessages: user?.allowMessages ?? true, showOnlineStatus: user?.showOnlineStatus ?? true });

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch user's listings
      const listingsRes = await api.get("/listings/mine");
      setListings(listingsRes.data.listings || []);

      // Fetch conversations count
      const convsRes = await api.get("/conversations");
      setConversationsCount(convsRes.data.conversations?.length || 0);
      const transactionsRes = await api.get("/transactions");
      setTransactions(transactionsRes.data.transactions || []);
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (localStorage.getItem("isLoggedIn") !== "true") {
      navigate("/login");
      return;
    }
    fetchDashboardData();
  }, [navigate]);

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/listings/${id}/status`, { status });
      // Update local state
      setListings(listings.map(l => l.id === id ? { ...l, status: status as any } : l));
    } catch (err) {
      console.error("Error updating status:", err);
      alert("Failed to update status.");
    }
  };

  const updateTransaction = async (id: string, status: "COMPLETED" | "CANCELLED" | "DISPUTED") => {
    const reason = status === "DISPUTED" ? window.prompt("What went wrong?") : undefined;
    if (status === "DISPUTED" && !reason) return;
    const response = await api.patch(`/transactions/${id}/status`, { status, reason });
    setTransactions((current) => current.map((transaction) => transaction.id === id ? response.data.transaction : transaction));
    void fetchDashboardData();
  };

  const leaveReview = async (transactionId: string) => {
    const value = window.prompt("Rate this seller from 1 to 5");
    const rating = Number(value);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return;
    const comment = window.prompt("Add a short comment (optional)") || undefined;
    await api.post(`/transactions/${transactionId}/review`, { rating, comment });
    void fetchDashboardData();
  };

  const savePrivacy = async () => {
    const response = await api.patch("/auth/profile", privacy);
    updateUser(response.data.user);
    alert("Privacy preferences saved.");
  };

  // Calculations
  const activeListings = listings.filter(l => l.status === "ACTIVE");
  const pendingListings = listings.filter(l => l.status === "PENDING");
  const rejectedListings = listings.filter(l => l.status === "REJECTED");
  const soldListings = listings.filter(l => l.status === "SOLD");
  const totalViews = listings.reduce((sum, item) => sum + (item.viewsCount || 0), 0);
  const totalInterests = listings.reduce((sum, item) => sum + (item.interestCount || 0), 0);

  if (loading) {
    return (
      <div className="flex-grow flex items-center justify-center py-24 bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
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
            <div>
              <h3 className="font-bold text-sm text-foreground">{user?.name}</h3>
              <p className="text-xs text-muted-foreground">{user?.faculty || "Student"}</p>
            </div>
          </div>
        </div>
        <nav className="p-4 flex flex-row md:flex-col overflow-x-auto md:overflow-visible gap-1 hide-scrollbar">
          <button className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-red-50 text-primary font-semibold text-sm shrink-0 w-full text-left">
            <LayoutDashboard className="h-5 w-5" />
            <span>Overview</span>
          </button>
          <Link to="/inbox" className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-100 text-gray-700 font-medium text-sm shrink-0">
            <MessageSquare className="h-5 w-5" />
            <span>Messages</span>
            {conversationsCount > 0 && (
              <span className="ml-auto bg-primary text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full">
                {conversationsCount}
              </span>
            )}
          </Link>
          <div className="my-2 border-t border-border hidden md:block"></div>
          <button 
            onClick={() => { logout(); navigate("/login"); }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-100 text-gray-700 font-medium text-sm shrink-0 w-full text-left"
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
            <h1 className="text-2xl font-bold text-foreground">Dashboard Overview</h1>
            <p className="text-muted-foreground text-sm">Welcome back! Here's how your listings are doing.</p>
          </div>
          <Link to="/create-listing">
            <Button className="font-semibold rounded-xl gap-2 h-10 shadow-sm">
              <PlusCircle className="h-4 w-4" /> Post New Item
            </Button>
          </Link>
        </div>

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
                <p className="text-sm font-medium text-muted-foreground">Pending Approval</p>
                <h3 className="text-3xl font-bold text-foreground">{pendingListings.length}</h3>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Listings List */}
        <Card className="shadow-sm border-border bg-white mb-8">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-lg">My Listings</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {listings.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                You haven't posted any listings yet.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {listings.map(item => {
                  const firstImg = item.images?.[0]?.url 
                    ? mediaUrl(item.images[0].url)
                    : "https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=100&q=80";

                  return (
                    <div key={item.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 hover:bg-gray-50 transition-colors">
                      <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden border border-border shrink-0">
                        <img src={firstImg} className="w-full h-full object-cover" alt="Item" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-foreground text-sm truncate">{item.title}</h4>
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
                      
                      <div className="flex gap-2 sm:self-center self-end mt-2 sm:mt-0">
                        {item.status === "ACTIVE" && (
                          <>
                            <Button 
                              onClick={() => handleUpdateStatus(item.id, "SOLD")}
                              variant="outline" 
                              size="sm" 
                              className="h-8 text-xs gap-1 border-green-200 text-green-700 hover:bg-green-50"
                            >
                              <CheckCircle className="w-3.5 h-3.5" /> Mark Sold
                            </Button>
                            <Button 
                              onClick={() => handleUpdateStatus(item.id, "ARCHIVED")}
                              variant="outline" 
                              size="sm" 
                              className="h-8 text-xs gap-1"
                            >
                              <Archive className="w-3.5 h-3.5" /> Archive
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border bg-white mb-8">
          <CardHeader className="border-b border-border pb-4"><CardTitle className="text-lg">Reservations, bookings & purchases</CardTitle></CardHeader>
          <CardContent className="p-0">
            {transactions.length === 0 ? <div className="text-center py-10 text-muted-foreground">No reservations or bookings yet.</div> : <div className="divide-y divide-border">{transactions.map((transaction) => {
              const isSeller = transaction.sellerId === user?.id;
              return <div key={transaction.id} className="p-5 flex flex-col md:flex-row gap-4 md:items-center">
                <div className="flex-1"><p className="font-semibold">{transaction.listing?.title}</p><p className="text-sm text-muted-foreground">{isSeller ? `Buyer: ${transaction.buyer?.name}` : `Seller: ${transaction.seller?.name}`} · RM {Number(transaction.price).toFixed(2)}{transaction.quantity > 1 ? ` × ${transaction.quantity}` : ""}</p>{transaction.meetupPoint && <p className="text-xs text-green-700 mt-1">Meet at {transaction.meetupPoint.name}</p>}</div>
                <span className={`text-xs font-bold px-3 py-1 rounded-full self-start ${transaction.status === "COMPLETED" ? "bg-green-100 text-green-700" : transaction.status === "DISPUTED" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{transaction.status}</span>
                {transaction.status === "RESERVED" && <div className="flex gap-2">{isSeller && <Button size="sm" onClick={() => updateTransaction(transaction.id, "COMPLETED")}>Complete handoff</Button>}<Button size="sm" variant="outline" onClick={() => updateTransaction(transaction.id, "CANCELLED")}>Cancel</Button><Button size="sm" variant="ghost" onClick={() => updateTransaction(transaction.id, "DISPUTED")}>Dispute</Button></div>}
                {transaction.status === "COMPLETED" && !isSeller && !transaction.review && <Button size="sm" variant="outline" className="gap-1" onClick={() => leaveReview(transaction.id)}><Star className="w-4 h-4" /> Rate seller</Button>}
              </div>;
            })}</div>}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border bg-white mb-8">
          <CardHeader className="border-b border-border pb-4"><CardTitle className="text-lg">Privacy & contact</CardTitle></CardHeader>
          <CardContent className="p-6 space-y-4">
            {[
              ["showEmail", "Show my email on listings"],
              ["showCampusArea", "Show my campus area"],
              ["allowMessages", "Allow new buyer messages"],
              ["showOnlineStatus", "Show when I am online"]
            ].map(([key, label]) => <label key={key} className="flex items-center justify-between border rounded-xl p-4"><span className="text-sm font-medium">{label}</span><input type="checkbox" checked={privacy[key as keyof typeof privacy]} onChange={(event) => setPrivacy((current) => ({ ...current, [key]: event.target.checked }))} className="h-5 w-5 accent-red-600" /></label>)}
            <div className="flex justify-end"><Button onClick={savePrivacy}>Save privacy settings</Button></div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
