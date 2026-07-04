import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router";
import { Heart, MessageCircle, Share2, MapPin, ShieldCheck, Flag, Clock, User, Star, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { api, mediaUrl } from "../../api/client";
import { useAuth } from "../../state/AuthContext";
import type { Listing } from "../../types";

export function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [product, setProduct] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isFavorited, setIsFavorited] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [reserveLoading, setReserveLoading] = useState(false);
  const [reserved, setReserved] = useState(false);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.get(`/listings/${id}`)
      .then((res) => {
        setProduct(res.data.listing);
        // If user is logged in, we check if this listing is in their favorites
        // In the simplified backend favorites table is checked via favorites route
      })
      .catch((err) => {
        console.error(err);
        setError("Listing not found or has been deleted.");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleFavoriteToggle = async () => {
    if (!user) {
      navigate("/login");
      return;
    }
    try {
      if (isFavorited) {
        await api.delete(`/favorites/${id}`);
        setIsFavorited(false);
      } else {
        await api.post(`/favorites/${id}`);
        setIsFavorited(true);
      }
    } catch (err) {
      console.error("Error toggling favorite:", err);
    }
  };

  const handleStartChat = async () => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (!product) return;
    
    // Cannot chat with yourself
    if (product.sellerId === user.id) {
      alert("You cannot open a chat on your own listing!");
      return;
    }

    setChatLoading(true);
    try {
      const res = await api.post("/conversations", { listingId: product.id });
      const conversationId = res.data.conversation.id;
      navigate(`/inbox?conversationId=${conversationId}`);
    } catch (err) {
      console.error("Error starting conversation:", err);
      alert("Failed to start chat. Please try again.");
    } finally {
      setChatLoading(false);
    }
  };

  const handleReserve = async () => {
    if (!user) return navigate("/login");
    if (!product || product.sellerId === user.id) return;
    setReserveLoading(true);
    try {
      await api.post("/transactions", { listingId: product.id, quantity, meetupPointId: product.meetupPointId || null });
      setReserved(true);
    } catch (err: any) {
      alert(err.response?.data?.message || "Could not create the reservation.");
    } finally {
      setReserveLoading(false);
    }
  };

  const handleReport = async () => {
    if (!user) return navigate("/login");
    const reason = window.prompt("Why are you reporting this listing?");
    if (!reason) return;
    await api.post("/reports", { listingId: product.id, reason });
    alert("Thanks. The admin team will review your report.");
  };

  const handleBlockSeller = async () => {
    if (!user || !product) return navigate("/login");
    if (!window.confirm(`Block ${product.seller.name}? They will no longer be able to message you.`)) return;
    await api.post(`/community/blocks/${product.sellerId}`);
    alert("Seller blocked.");
  };

  const formatCondition = (cond: string) => {
    switch (cond) {
      case "NEW": return "New";
      case "LIKE_NEW": return "Like New";
      case "GOOD": return "Good";
      case "FAIR": return "Fair";
      default: return "Not Applicable";
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-24 bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 bg-gray-50 text-center px-4">
        <ShieldAlert className="h-16 w-16 text-primary mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{error || "Listing not found"}</h2>
        <p className="text-muted-foreground mb-6">The listing might have been sold, archived, or removed by administrators.</p>
        <Link to="/browse">
          <Button className="rounded-xl">Browse All Listings</Button>
        </Link>
      </div>
    );
  }

  const imagesList = product.images && product.images.length > 0
    ? product.images.map(img => mediaUrl(img.url))
    : ["https://images.unsplash.com/photo-1541963463532-d68292c34b19?q=80&w=1200"];

  const numericPrice = parseFloat(product.price);

  return (
    <div className="bg-gray-50 flex-1 py-8">
      <div className="container mx-auto px-4">
        {/* Breadcrumb */}
        <nav className="flex items-center text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:text-primary">Home</Link>
          <span className="mx-2">/</span>
          <Link to={`/browse?category=${product.category?.slug}`} className="hover:text-primary">{product.category?.name || "Marketplace"}</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground font-medium truncate max-w-[200px] sm:max-w-md">{product.title}</span>
        </nav>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column: Images & Description */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border border-border aspect-video flex items-center justify-center overflow-hidden relative shadow-sm">
              <img 
                src={imagesList[activeImageIndex]} 
                alt={product.title}
                className="w-full h-full object-cover"
              />
            </div>
            
            {imagesList.length > 1 && (
              <div className="grid grid-cols-4 gap-4">
                {imagesList.map((img, i) => (
                  <div 
                    key={i} 
                    onClick={() => setActiveImageIndex(i)}
                    className={`bg-white rounded-xl border ${i === activeImageIndex ? 'border-primary ring-2 ring-primary/20' : 'border-border'} aspect-square flex items-center justify-center overflow-hidden cursor-pointer shadow-sm`}
                  >
                    <img 
                      src={img} 
                      alt={`Thumbnail ${i}`}
                      className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Description Details (Desktop & Mobile) */}
            <div className="bg-white p-8 rounded-2xl border border-border mt-8">
              <h2 className="text-2xl font-bold text-foreground mb-6">Description</h2>
              <div className="prose max-w-none text-gray-600 space-y-4 whitespace-pre-line">
                {product.description}
              </div>
              {(product.isbn || product.author || product.edition || product.courseCode) && (
                <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t text-sm">
                  {product.courseCode && <div><span className="text-muted-foreground block">Course code</span><strong>{product.courseCode}</strong></div>}
                  {product.isbn && <div><span className="text-muted-foreground block">ISBN</span><strong>{product.isbn}</strong></div>}
                  {product.author && <div><span className="text-muted-foreground block">Author</span><strong>{product.author}</strong></div>}
                  {product.edition && <div><span className="text-muted-foreground block">Edition</span><strong>{product.edition}</strong></div>}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Info & Actions */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <Badge className="bg-primary text-white">ACTIVE</Badge>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-gray-100 text-gray-500">
                    <Share2 className="h-5 w-5" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={handleFavoriteToggle}
                    className={`h-10 w-10 rounded-full hover:bg-red-50 ${isFavorited ? 'text-primary fill-primary' : 'text-gray-500 hover:text-primary'}`}
                  >
                    <Heart className="h-5 w-5" />
                  </Button>
                </div>
              </div>
              
              <h1 className="text-2xl font-bold text-foreground mb-2 leading-tight">
                {product.title}
              </h1>
              
              <div className="text-3xl font-extrabold text-primary mb-6">
                RM {numericPrice.toFixed(2)} 
                {product.pricingUnit && product.pricingUnit !== "ITEM" && <span className="text-sm font-normal text-muted-foreground"> / {product.pricingUnit.toLowerCase()}</span>}
                {product.isNegotiable && <span className="text-sm font-normal text-muted-foreground ml-2">(Negotiable)</span>}
              </div>

              <div className="grid grid-cols-2 gap-y-4 gap-x-2 mb-6 text-sm">
                <div>
                  <span className="text-muted-foreground block mb-1">Condition</span>
                  <span className="font-semibold text-gray-900 bg-gray-100 px-2 py-1 rounded-md">
                    {formatCondition(product.condition)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">Category</span>
                  <span className="font-semibold text-gray-900 bg-gray-100 px-2 py-1 rounded-md">
                    {product.category?.name || "Other"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1 flex items-center gap-1"><Clock className="w-4 h-4"/> Posted</span>
                  <span className="font-medium text-gray-900">
                    {new Date(product.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1 flex items-center gap-1"><MapPin className="w-4 h-4"/> Location</span>
                  <span className="font-medium text-gray-900">{product.location || "Main Campus"}</span>
                </div>
                {product.type === "PRODUCT" && <div><span className="text-muted-foreground block mb-1">Available</span><span className="font-medium">{product.quantity ?? 1}</span></div>}
                {product.serviceDuration && <div><span className="text-muted-foreground block mb-1">Duration</span><span className="font-medium">{product.serviceDuration} min</span></div>}
                {product.availabilityNote && <div className="col-span-2"><span className="text-muted-foreground block mb-1">Availability</span><span className="font-medium">{product.availabilityNote}</span></div>}
              </div>

              {product.sellerId !== user?.id && (
                <div className="space-y-3 mb-3">
                  {product.type === "PRODUCT" && (product.quantity ?? 1) > 1 && (
                    <div className="flex items-center gap-3"><span className="text-sm font-medium">Quantity</span><Input className="w-24" type="number" min="1" max={product.quantity} value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))} /></div>
                  )}
                  <Button onClick={handleReserve} disabled={reserveLoading || reserved} className="w-full h-12 rounded-xl font-bold bg-green-600 hover:bg-green-700">
                    {reserved ? "Reserved — seller notified" : reserveLoading ? "Reserving..." : product.type === "PRODUCT" ? "Reserve item" : product.type === "COURSE" ? "Enroll in course" : "Book service"}
                  </Button>
                </div>
              )}

              <Button 
                onClick={handleStartChat}
                disabled={chatLoading}
                className="w-full h-12 text-lg rounded-xl gap-2 font-bold shadow-md"
              >
                {chatLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <MessageCircle className="h-5 w-5" /> Chat with Seller
                  </>
                )}
              </Button>
            </div>

            {/* Seller Info */}
            <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
              <h3 className="font-bold text-lg text-foreground mb-4">Seller Information</h3>
              <div className="flex items-center gap-4 mb-6">
                <Avatar className="h-14 w-14 border-2 border-primary/20 bg-white">
                  <AvatarImage src={mediaUrl(product.seller?.avatarUrl || undefined)} />
                  <AvatarFallback className="text-lg bg-red-50 text-primary font-bold">
                    {product.seller?.name?.substring(0, 2).toUpperCase() || "US"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-bold text-foreground text-lg">{product.seller?.name || "User"}</h4>
                    {product.seller?.isVerified && <ShieldCheck className="w-5 h-5 text-green-600" />}
                  </div>
                  <p className="text-sm text-muted-foreground">{product.seller?.faculty || "Student"}</p>
                  <p className="text-xs font-medium text-primary mt-1">{product.seller?.sellerType === "SHOP" ? "Campus shop" : product.seller?.sellerType === "SERVICE_PROVIDER" ? "Service provider" : "Casual seller"}</p>
                  <p className="text-sm text-amber-700 flex items-center gap-1 mt-1"><Star className="w-4 h-4 fill-amber-400 text-amber-400" /> {product.seller?.rating?.toFixed(1) || "New"} ({product.seller?.ratingCount ?? 0} reviews)</p>
                  {product.seller?.campusArea && (
                    <p className="text-xs text-muted-foreground mt-0.5">{product.seller.campusArea}</p>
                  )}
                </div>
              </div>
              {product.seller?.email && <p className="text-xs text-muted-foreground border-t pt-3">Contact: {product.seller.email}</p>}
              {product.sellerId !== user?.id && <Button variant="ghost" size="sm" onClick={handleBlockSeller} className="mt-2 text-muted-foreground">Block seller</Button>}
            </div>

            {/* Meetup preference / Safety Tips */}
            <div className="bg-red-50 p-6 rounded-2xl border border-red-100 shadow-sm">
              <div className="flex items-center gap-2 mb-3 text-primary font-bold">
                <ShieldCheck className="w-5 h-5" /> Safety & Meetup
              </div>
              <ul className="text-sm text-red-900 space-y-2">
                {product.meetupPoint && <li><strong>Verified point:</strong> {product.meetupPoint.name} — {product.meetupPoint.description}</li>}
                {product.meetupPreference && (
                  <li>
                    <strong>Meetup Area:</strong> {product.meetupPreference}
                  </li>
                )}
                <li>• Always meet in well-lit public campus areas.</li>
                <li>• Inspect the item thoroughly before paying.</li>
                <li>• Do not transfer money in advance.</li>
              </ul>
              <button onClick={handleReport} className="flex items-center gap-1 text-xs text-red-600 font-semibold mt-4 hover:underline">
                <Flag className="w-3 h-3" /> Report this listing
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
