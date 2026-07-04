import React, { useEffect, useState } from "react";
import { Outlet, Link, useNavigate } from "react-router";
import { Search, Bell, MessageSquare, Heart, MapPin, LogOut, PlusCircle, Megaphone } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { useAuth } from "../../state/AuthContext";
import { api, mediaUrl } from "../../api/client";

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

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const delayDebounce = setTimeout(() => {
      api.get("/listings/autocomplete", { params: { q: searchQuery } })
        .then((res) => setSuggestions(res.data.suggestions || []))
        .catch((err) => console.error(err));
    }, 250);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    if (!user) { setNotifications([]); setUnreadMessages(0); return; }
    void Promise.all([api.get("/community/notifications"), api.get("/conversations")]).then(([notificationResponse, conversationResponse]) => {
      setNotifications(notificationResponse.data.notifications || []);
      const unread = (conversationResponse.data.conversations || []).flatMap((conversation: any) => conversation.messages || []).filter((message: any) => !message.readAt && message.sender?.id !== user.id).length;
      setUnreadMessages(unread);
    }).catch(() => undefined);
  }, [user?.id]);

  const openNotifications = async () => {
    setShowNotifications((value) => !value);
    if (notifications.some((notification) => !notification.readAt)) {
      await api.patch("/community/notifications/read");
      setNotifications((current) => current.map((notification) => ({ ...notification, readAt: notification.readAt || new Date().toISOString() })));
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
        <div className="container mx-auto px-4 h-20 flex items-center justify-between gap-6">
          <Link to="/" className="flex items-center gap-2">
            <img 
              src="/assets/logo.png" 
              alt="INTI Logo" 
              className="w-10 h-10 object-contain md:hidden rounded-xl" 
            />
            <img 
              src="/assets/INTI-40.png" 
              alt="INTI Logo" 
              className="hidden md:block h-10 lg:h-12 w-auto object-contain" 
            />
          </Link>

          <form onSubmit={handleSearchSubmit} className="flex-1 max-w-2xl hidden md:flex items-center relative" ref={dropdownRef}>
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

          <div className="flex items-center gap-2 sm:gap-4">
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
            
            <div className="relative">
              <Button variant="ghost" size="icon" className="relative text-foreground" onClick={openNotifications}>
                <Bell className="h-5 w-5" />
                {notifications.some((notification) => !notification.readAt) && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />}
              </Button>
              {showNotifications && <div className="absolute right-0 top-12 w-80 max-w-[80vw] bg-white border border-border shadow-xl rounded-2xl p-3 z-50">
                <p className="font-bold px-2 py-2">Notifications</p>
                {notifications.length === 0 ? <p className="text-sm text-muted-foreground px-2 py-5 text-center">No notifications yet.</p> : notifications.slice(0, 8).map((notification) => <div key={notification.id} className="p-3 border-t text-sm"><p className="font-medium">{notification.type === "RESERVATION_CREATED" ? "New reservation or booking" : notification.type.replaceAll("_", " ")}</p><p className="text-xs text-muted-foreground mt-1">{new Date(notification.createdAt).toLocaleString()}</p></div>)}
              </div>}
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
                      <Button variant="outline" className="font-semibold rounded-full border-primary text-primary hover:bg-red-50">
                        Admin Panel
                      </Button>
                    </Link>
                  )}
                  <Link to="/create-listing" className="hidden sm:block">
                    <Button className="font-semibold rounded-full gap-2">
                      <PlusCircle className="h-4 w-4" />
                      Post an Item
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
                    <Button className="font-semibold rounded-full gap-2">
                      <PlusCircle className="h-4 w-4" />
                      Post an Item
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
        
        {/* Mobile Search - Only shows on mobile */}
        <form onSubmit={handleSearchSubmit} className="md:hidden px-4 pb-4 bg-white">
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
                A trusted marketplace exclusively for verified INTI students, staff, and professors. Buy and sell safely within your campus community.
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
                <li><Link to="#" className="hover:text-primary transition-colors">Help Centre</Link></li>
                <li><Link to="#" className="hover:text-primary transition-colors">Contact Us</Link></li>
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
