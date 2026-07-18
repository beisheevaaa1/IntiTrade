import React, { useEffect, useState } from "react";
import { Outlet, Link, useNavigate } from "react-router";
import { Search, Bell, MessageSquare, Heart, MapPin, LogOut, PlusCircle, Megaphone, Package, Star, CheckCircle, AlertTriangle, HelpCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { useAuth } from "../../state/AuthContext";
import { api, mediaUrl } from "../../api/client";

function getNotificationDetails(notification: any, userRole?: string) {
  let parsed: any = {};
  if (notification.payload) {
    try {
      parsed = typeof notification.payload === "string" ? JSON.parse(notification.payload) : notification.payload;
    } catch {
      parsed = {};
    }
  }

  const type = notification.type || "";
  if (type.startsWith("LISTING_")) {
    const status = type.replace("LISTING_", "");
    return {
      icon: <Package className="h-4 w-4 text-primary shrink-0 mt-0.5" />,
      title: status === "APPROVED" ? "Listing Approved 🎉" : `Listing ${status.charAt(0) + status.slice(1).toLowerCase()}`,
      description: parsed.reason ? `Reason: ${parsed.reason}` : status === "APPROVED" ? "Your item is now live on the campus marketplace." : "Click to check your listings.",
      targetUrl: parsed.listingId && status === "APPROVED" ? `/product/${parsed.listingId}` : "/dashboard?tab=listings"
    };
  }
  if (type.startsWith("ANNOUNCEMENT_")) {
    const status = type.replace("ANNOUNCEMENT_", "");
    return {
      icon: <Megaphone className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />,
      title: `Announcement ${status.charAt(0) + status.slice(1).toLowerCase()}`,
      description: parsed.reason ? `Feedback: ${parsed.reason}` : "Your campus announcement has been processed by moderators.",
      targetUrl: "/announcements"
    };
  }
  if (type === "RESERVATION_CREATED") {
    return {
      icon: <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />,
      title: "New Item Reservation 📦",
      description: "A student has requested to reserve one of your listed items.",
      targetUrl: "/dashboard?tab=transactions"
    };
  }
  if (type.startsWith("TRANSACTION_")) {
    const status = type.replace("TRANSACTION_", "");
    return {
      icon: <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />,
      title: `Transaction ${status.charAt(0) + status.slice(1).toLowerCase()}`,
      description: "Click to view updated meetup details and status.",
      targetUrl: "/dashboard?tab=transactions"
    };
  }
  if (type === "REVIEW_RECEIVED") {
    return {
      icon: <Star className="h-4 w-4 text-amber-500 shrink-0 mt-0.5 fill-amber-500" />,
      title: "New Review & Rating ⭐",
      description: "You just received new feedback for a completed campus meetup!",
      targetUrl: "/dashboard?tab=transactions"
    };
  }
  if (type === "DISPUTE_RESOLVED") {
    return {
      icon: <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />,
      title: parsed.verdict ? `Dispute Resolved (${parsed.verdict})` : "Dispute Resolved",
      description: parsed.reason ? `Admin Note: ${parsed.reason}` : "Moderation team has issued a final decision on your transaction.",
      targetUrl: "/dashboard?tab=transactions"
    };
  }
  if (type.startsWith("SUPPORT_TICKET")) {
    return {
      icon: <HelpCircle className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />,
      title: type === "SUPPORT_TICKET_CREATED" ? "Support Ticket Created" : type === "SUPPORT_TICKET_REPLIED" ? "New Support Reply 💬" : "Support Ticket Updated",
      description: parsed.hasNewReply ? "A moderator replied to your inquiry." : `Status updated to: ${parsed.status || "In Progress"}`,
      targetUrl: userRole === "ADMIN" ? "/admin?tab=support" : "/support"
    };
  }

  return {
    icon: <Bell className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />,
    title: type.replaceAll("_", " "),
    description: "Click to check details.",
    targetUrl: null
  };
}

export function AppLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const dropdownRef = React.useRef<HTMLFormElement | null>(null);
  const notificationRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const delayDebounce = setTimeout(() => {
      api.get("/listings/autocomplete", { params: { q: searchQuery } })
        .then((res) => setSuggestions(res.data.suggestions || []))
        .catch((err) => console.error("Request failed"));
    }, 250);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowSuggestions(false);
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!user) { setNotifications([]); setUnreadMessages(0); return; }
    const refreshIndicators = () => {
      void Promise.all([api.get("/community/notifications"), api.get("/conversations")]).then(([notificationResponse, conversationResponse]) => {
        setNotifications(notificationResponse.data.notifications || []);
        const unread = (conversationResponse.data.conversations || []).flatMap((conversation: any) => conversation.messages || []).filter((message: any) => !message.readAt && message.sender?.id !== user.id).length;
        setUnreadMessages(unread);
      }).catch(() => undefined);
    };
    refreshIndicators();
    const intervalId = window.setInterval(refreshIndicators, 20_000);
    window.addEventListener("focus", refreshIndicators);
    window.addEventListener("intitrade:messages-changed", refreshIndicators);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshIndicators);
      window.removeEventListener("intitrade:messages-changed", refreshIndicators);
    };
  }, [user?.id]);

  const openNotifications = async () => {
    const willOpen = !showNotifications;
    setShowNotifications(willOpen);
    if (willOpen && notifications.some((notification) => !notification.readAt)) {
      try {
        await api.patch("/community/notifications/read");
        setNotifications((current) => current.map((notification) => ({ ...notification, readAt: notification.readAt || new Date().toISOString() })));
      } catch {
        // Keep the panel usable and retry marking notifications on next open.
      }
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/browse?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-white shadow-sm">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between gap-3 lg:gap-6">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img 
              src="/assets/INTI-40.png" 
              alt="INTI Logo" 
              className="h-8 sm:h-10 lg:h-12 w-auto object-contain" 
            />
          </Link>

          <form onSubmit={handleSearchSubmit} className="flex-1 max-w-2xl hidden lg:flex items-center relative" ref={dropdownRef}>
            <Input 
              placeholder="Search for textbooks, furniture..." 
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              className="w-full rounded-full pl-12 pr-20 h-12 bg-gray-50 border-gray-200"
            />
            <Search className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground" />
            <Button type="submit" className="absolute right-1 top-1 h-10 rounded-full px-4">
              Go
            </Button>
            
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-14 left-0 w-full bg-white border border-border shadow-2xl rounded-2xl p-2 z-50 animate-in fade-in duration-100">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => {
                      setSearchQuery(suggestion);
                      setShowSuggestions(false);
                      navigate(`/browse?search=${encodeURIComponent(suggestion)}`);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 rounded-xl text-sm font-semibold text-gray-700 hover:text-primary transition-colors flex items-center gap-2"
                  >
                    <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span>{suggestion}</span>
                  </button>
                ))}
              </div>
            )}
          </form>

          <div className="flex items-center gap-1.5 sm:gap-3">
            <div className="hidden 2xl:flex items-center text-sm text-muted-foreground mr-2 font-medium">
              <MapPin className="h-4 w-4 mr-1" />
              INTI International University
            </div>

            <Button variant="ghost" size="icon" className="relative hidden sm:flex text-foreground" onClick={() => navigate('/wishlist')}>
              <Heart className="h-5 w-5" />
            </Button>
            
            <Button variant="ghost" size="icon" className="relative text-foreground" onClick={() => navigate('/inbox')}>
              <MessageSquare className="h-5 w-5" />
              {unreadMessages > 0 && <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-primary text-white text-[10px] rounded-full flex items-center justify-center">{unreadMessages}</span>}
            </Button>
            
            <div className="relative" ref={notificationRef}>
              <Button variant="ghost" size="icon" className="relative text-foreground" onClick={openNotifications} title="Notifications">
                <Bell className="h-5 w-5" />
                {notifications.some((notification) => !notification.readAt) && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-primary border-2 border-white rounded-full animate-pulse" />}
              </Button>
              {showNotifications && (
                <div className="absolute right-0 top-12 w-96 max-w-[90vw] bg-white border border-border shadow-2xl rounded-2xl p-3 z-50 animate-in fade-in-0 sm:zoom-in-95 duration-150">
                  <div className="flex items-center justify-between px-2 py-2 border-b border-border/60 mb-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-foreground">Notifications</p>
                      {notifications.some((n) => !n.readAt) && (
                        <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full">New</span>
                      )}
                    </div>
                    {notifications.some((n) => !n.readAt) && (
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await api.patch("/community/notifications/read");
                            setNotifications((current) => current.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
                          } catch {}
                        }}
                        className="text-xs text-primary hover:underline font-semibold"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <div className="max-h-[420px] overflow-y-auto pr-1 divide-y divide-border/40">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center">
                        <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-sm font-medium text-foreground">No notifications yet</p>
                        <p className="text-xs text-muted-foreground mt-0.5">When you trade or receive messages, updates will appear here.</p>
                      </div>
                    ) : (
                      notifications.slice(0, 10).map((notification) => {
                        const details = getNotificationDetails(notification, user?.role);
                        const isUnread = !notification.readAt;
                        return (
                          <div
                            key={notification.id}
                            onClick={() => {
                              if (details.targetUrl) {
                                navigate(details.targetUrl);
                                setShowNotifications(false);
                              }
                            }}
                            className={`p-3 text-sm w-full text-left rounded-xl transition-all flex items-start gap-3 my-0.5 ${
                              details.targetUrl ? "hover:bg-gray-50 cursor-pointer" : "cursor-default"
                            } ${isUnread ? "bg-red-50/40 font-medium" : ""}`}
                          >
                            <div className="p-2 bg-gray-100 rounded-xl shrink-0">
                              {details.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline justify-between gap-2">
                                <p className={`text-sm truncate ${isUnread ? "font-bold text-foreground" : "font-semibold text-foreground/90"}`}>
                                  {details.title}
                                </p>
                                {isUnread && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                              </div>
                              {details.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                  {details.description}
                                </p>
                              )}
                              <p className="text-[10px] text-muted-foreground/80 mt-1.5 font-mono">
                                {new Date(notification.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <Button variant="ghost" size="icon" className="relative text-foreground" onClick={() => navigate('/announcements')} title="Campus announcements">
              <Megaphone className="h-5 w-5" />
            </Button>

            <div className="h-8 w-px bg-border mx-1 hidden sm:block"></div>

            <div className="flex items-center gap-2">
              {user ? (
                <>
                  {user.role === "ADMIN" && (
                    <Link to="/admin" className="hidden sm:block">
                      <Button variant="outline" className="font-semibold rounded-full border-primary text-primary hover:bg-red-50 px-3 xl:px-4">
                        <span className="hidden xl:inline">Admin Panel</span>
                        <span className="xl:hidden">Admin</span>
                      </Button>
                    </Link>
                  )}
                  <Link to="/create-listing" className="hidden sm:block">
                    <Button className="font-semibold rounded-full gap-2 px-3 xl:px-4">
                      <PlusCircle className="h-4 w-4" />
                      <span className="hidden xl:inline">Post an Item</span>
                    </Button>
                  </Link>
                  <Link to="/dashboard" className="hidden sm:block">
                    <Avatar className="h-9 w-9 border border-border shadow-sm">
                      <AvatarImage src={mediaUrl(user.avatarUrl || undefined)} />
                      <AvatarFallback className="text-xs bg-red-50 text-primary font-bold">
                        {user.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => { logout(); navigate("/login"); }}
                    className="text-muted-foreground hover:text-primary hidden sm:flex"
                    title="Log Out"
                  >
                    <LogOut className="h-5 w-5" />
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/login" className="hidden sm:block">
                    <Button variant="ghost" className="font-semibold text-foreground">Log In</Button>
                  </Link>
                  <Link to="/login" className="hidden sm:block">
                    <Button className="font-semibold rounded-full gap-2 px-3 xl:px-4">
                      <PlusCircle className="h-4 w-4" />
                      <span className="hidden xl:inline">Post an Item</span>
                    </Button>
                  </Link>
                </>
              )}
              
              <Link to={user ? "/dashboard" : "/login"} className="block sm:hidden">
                <Avatar className="h-9 w-9 border border-border">
                  <AvatarImage src={mediaUrl(user?.avatarUrl || undefined)} />
                  <AvatarFallback className="text-xs bg-red-50 text-primary font-bold">
                    {user?.name?.substring(0, 2).toUpperCase() || "IT"}
                  </AvatarFallback>
                </Avatar>
              </Link>
            </div>
          </div>
        </div>
        
        {/* Mobile Search - Shows on mobile and tablet/small laptop */}
        <form onSubmit={handleSearchSubmit} className="lg:hidden px-4 pb-4 bg-white">
          <div className="relative">
            <Input 
              placeholder="Search items..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-full pl-10 h-10 bg-gray-50"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
          </div>
        </form>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-border mt-auto">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img src="/assets/logo.png" alt="INTI Logo" className="w-12 h-12 object-contain rounded-xl" />
                <span className="font-bold text-2xl text-foreground">IntiTrade</span>
              </div>
              <p className="text-muted-foreground text-sm mb-4 leading-relaxed">
                A campus marketplace for the INTI community. Discover listings, connect with sellers, and trade more confidently in one place.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold text-foreground mb-4">Categories</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/browse?category=textbooks" className="hover:text-primary transition-colors">Textbooks</Link></li>
                <li><Link to="/browse?category=electronics" className="hover:text-primary transition-colors">Electronics</Link></li>
                <li><Link to="/browse?category=furniture" className="hover:text-primary transition-colors">Furniture</Link></li>
                <li><Link to="/browse?category=room-essentials" className="hover:text-primary transition-colors">Room Essentials</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-foreground mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/support" className="hover:text-primary transition-colors">Help Centre</Link></li>
                <li><Link to="/support" className="hover:text-primary transition-colors">Contact Support</Link></li>
                <li><Link to="/announcements" className="hover:text-primary transition-colors">Campus announcements</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-border mt-8 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} IntiTrade. Exclusive to INTI International University.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
