import React, { useState } from "react";
import { Outlet, Link, useNavigate } from "react-router";
import { Search, Bell, MessageSquare, Heart, MapPin, LogOut, PlusCircle, User } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { useAuth } from "../../state/AuthContext";
import { mediaUrl } from "../../api/client";

export function AppLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

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
            <div className="w-10 h-10 bg-primary text-white flex items-center justify-center rounded-xl font-bold text-xl">
              I
            </div>
            <span className="font-bold text-2xl text-foreground hidden sm:block">IntiTrade</span>
          </Link>

          <form onSubmit={handleSearchSubmit} className="flex-1 max-w-2xl hidden md:flex items-center relative">
            <Input 
              placeholder="Search for textbooks, furniture..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-full pl-12 h-12 bg-gray-50 border-gray-200"
            />
            <Search className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground" />
            <Button type="submit" className="absolute right-1 top-1 h-10 rounded-full px-6">
              Search
            </Button>
          </form>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden lg:flex items-center text-sm text-muted-foreground mr-2 font-medium">
              <MapPin className="h-4 w-4 mr-1" />
              INTI International University
            </div>

            <Button variant="ghost" size="icon" className="relative hidden sm:flex text-foreground" onClick={() => navigate('/wishlist')}>
              <Heart className="h-5 w-5" />
            </Button>
            
            <Button variant="ghost" size="icon" className="relative text-foreground" onClick={() => navigate('/inbox')}>
              <MessageSquare className="h-5 w-5" />
              {user && <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full"></span>}
            </Button>
            
            <Button variant="ghost" size="icon" className="relative text-foreground">
              <Bell className="h-5 w-5" />
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
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-primary text-white flex items-center justify-center rounded-lg font-bold">
                  I
                </div>
                <span className="font-bold text-xl text-foreground">IntiTrade</span>
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
