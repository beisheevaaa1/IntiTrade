import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Shield, Users, MessageCircle, Star, Search, ArrowRight, Book, Laptop, Shirt, Sofa, GraduationCap, Home as HomeIcon, Dumbbell, Briefcase, Gift, MoreHorizontal, MapPin, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { ProductCard } from "../components/ProductCard";
import { api } from "../../api/client";
import { useAuth } from "../../state/AuthContext";
import type { Listing } from "../../types";

const categories = [
  { name: "Textbooks", slug: "textbooks", icon: Book },
  { name: "Electronics", slug: "electronics", icon: Laptop },
  { name: "Clothing", slug: "clothing", icon: Shirt },
  { name: "Furniture", slug: "furniture", icon: Sofa },
  { name: "Academic", slug: "academic-materials", icon: GraduationCap },
  { name: "Room", slug: "room-essentials", icon: HomeIcon },
  { name: "Sports", slug: "sports-equipment", icon: Dumbbell },
  { name: "Services", slug: "services", icon: Briefcase },
  { name: "Free Items", slug: "free-items", icon: Gift },
  { name: "Others", slug: "others", icon: MoreHorizontal },
];

export function Home() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      navigate("/browse", { replace: true });
      return;
    }

    api.get("/listings", { params: { limit: 5 } })
      .then((res) => {
        // filter or limit active listings
        const activeListings = res.data.listings.filter((l: Listing) => l.status === "ACTIVE");
        setListings(activeListings.slice(0, 5));
      })
      .catch((err) => console.error("Error fetching homepage listings:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50">
      {/* Hero Section */}
      <section className="bg-white border-b border-border py-16 md:py-24 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5 bg-[url('https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=2070')] bg-cover bg-center"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-6">
              Buy and Sell Safely Within the <span className="text-primary">INTI Community</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              A trusted marketplace exclusively for verified INTI students, staff, and professors. No strangers, no scams.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <Link to="/browse">
                <Button size="lg" className="w-full sm:w-auto px-8 py-6 text-lg rounded-xl gap-2 font-semibold">
                  Explore Listings
                </Button>
              </Link>
              <Link to="/create-listing">
                <Button variant="outline" size="lg" className="w-full sm:w-auto px-8 py-6 text-lg rounded-xl font-semibold border-2 bg-white">
                  Start Selling
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
              <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-gray-50 border border-border/50">
                <Shield className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-semibold text-sm">Verified Users</h3>
                <p className="text-xs text-muted-foreground mt-1">INTI email required</p>
              </div>
              <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-gray-50 border border-border/50">
                <MapPin className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-semibold text-sm">Safe Trading</h3>
                <p className="text-xs text-muted-foreground mt-1">Meet up on campus</p>
              </div>
              <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-gray-50 border border-border/50">
                <MessageCircle className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-semibold text-sm">Real-time Chat</h3>
                <p className="text-xs text-muted-foreground mt-1">Communicate instantly</p>
              </div>
              <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-gray-50 border border-border/50">
                <Star className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-semibold text-sm">Reviews</h3>
                <p className="text-xs text-muted-foreground mt-1">Trusted community</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-12 bg-white border-b border-border">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold mb-8 text-foreground">Categories</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10 gap-4">
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <Link 
                  key={category.name} 
                  to={`/browse?category=${category.slug}`}
                  className="flex flex-col items-center justify-center p-4 rounded-[16px] hover:bg-gray-50 border border-transparent hover:border-border transition-all group"
                >
                  <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3 group-hover:bg-red-50 group-hover:text-primary transition-colors">
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="text-xs font-medium text-center text-gray-700">{category.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* New Listings */}
      <section className="py-16 container mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-foreground">Fresh on Campus</h2>
          <Link to="/browse" className="text-primary font-medium hover:underline flex items-center gap-1 text-sm">
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No active listings found on campus yet. Be the first to post!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {listings.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* How It Works */}
      <section className="py-16 bg-white border-y border-border">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">How IntiTrade Works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">A simple, safe, and secure way to buy and sell items within your campus.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="flex flex-col items-center text-center p-6">
              <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-6 shadow-sm border border-red-100">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3">1. Verify Identity</h3>
              <p className="text-muted-foreground text-sm">Sign up using your valid INTI institutional email address to prove you belong to the community.</p>
            </div>
            <div className="flex flex-col items-center text-center p-6 relative">
              <div className="hidden md:block absolute top-14 -left-12 w-24 h-px border-t-2 border-dashed border-gray-300"></div>
              <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-6 shadow-sm border border-red-100">
                <Search className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3">2. List or Find Items</h3>
              <p className="text-muted-foreground text-sm">Post what you want to sell with photos and details, or search for what you need.</p>
            </div>
            <div className="flex flex-col items-center text-center p-6 relative">
              <div className="hidden md:block absolute top-14 -left-12 w-24 h-px border-t-2 border-dashed border-gray-300"></div>
              <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-6 shadow-sm border border-red-100">
                <MessageCircle className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3">3. Meet Safely</h3>
              <p className="text-muted-foreground text-sm">Chat securely in the app and arrange a safe meet-up on campus to complete the trade.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Want Ads Preview */}
      <section className="py-16 container mx-auto px-4 mb-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-1">Want Ads</h2>
            <p className="text-sm text-muted-foreground">Help fellow students find what they need.</p>
          </div>
          <Link to="/want-ads" className="text-primary font-medium hover:underline flex items-center gap-1 text-sm">
            View Requests <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { title: "Lab Coat (Size M)", price: 30, desc: "Need a standard white lab coat for chemistry practicals. Good condition please. Needed by next week." },
            { title: "Calculus Textbook", price: 40, desc: "Looking for Calculus Early Transcendentals 8th Edition. Willing to collect on campus anytime." },
            { title: "Kettle for Hostel", price: 25, desc: "Electric kettle needed for my room in Block B. Must be in working condition with safety plug." }
          ].map((ad, i) => (
            <div key={i} className="bg-white border border-border p-5 rounded-2xl shadow-sm hover:border-gray-300 transition-colors">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-bold text-lg text-foreground">Looking for: {ad.title}</h3>
                <span className="text-primary font-semibold">Max: RM {ad.price}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                {ad.desc}
              </p>
              <div className="flex items-center justify-between mt-auto pt-4 border-t border-border">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold">JD</div>
                  <span className="text-xs font-medium text-gray-600">Posted recently</span>
                </div>
                <Button size="sm" variant="outline" className="h-8 text-xs">I Have This</Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
