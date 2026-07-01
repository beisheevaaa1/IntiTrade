import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, Upload, X, Image as ImageIcon, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { Card, CardContent } from "../components/ui/card";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { api, mediaUrl } from "../../api/client";
import { useAuth } from "../../state/AuthContext";
import type { Category } from "../../types";

const conditionsList = [
  { name: "Brand New", value: "NEW" },
  { name: "Like New", value: "LIKE_NEW" },
  { name: "Good", value: "GOOD" },
  { name: "Fair", value: "FAIR" }
];

const locationsList = [
  "Main Campus Library",
  "Student Center",
  "Cafeteria",
  "Dormitory Block A",
  "Dormitory Block B",
  "Faculty Office Building",
  "Other"
];

export function CreateListing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [type, setType] = useState<"PRODUCT" | "SERVICE">("PRODUCT");
  const [condition, setCondition] = useState("GOOD");
  const [location, setLocation] = useState("Student Center");
  const [meetupPreference, setMeetupPreference] = useState(locationsList[0]);
  const [isNegotiable, setIsNegotiable] = useState(false);
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [images, setImages] = useState<string[]>([]); // URLs from API uploads
  
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("isLoggedIn") !== "true") {
      navigate("/login");
    }
    // Fetch active categories
    api.get("/listings/categories")
      .then((res) => {
        setCategories(res.data.categories);
        if (res.data.categories.length > 0) {
          setSelectedCategoryId(res.data.categories[0].id);
        }
      })
      .catch((err) => console.error("Error fetching categories:", err));
  }, [navigate]);

  // Real Image Upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      if (images.length >= 5) {
        alert("Maximum of 5 images allowed");
        return;
      }
      
      const file = e.target.files[0];
      const formData = new FormData();
      formData.append("file", file);

      setUploadingImage(true);
      setError("");

      try {
        const res = await api.post("/uploads", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        setImages([...images, res.data.url]);
      } catch (err: any) {
        console.error(err);
        setError(err.response?.data?.message || "Failed to upload image. Please try again.");
      } finally {
        setUploadingImage(false);
      }
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    setImages(newImages);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategoryId) {
      setError("Please select a category");
      return;
    }
    
    setIsPublishing(true);
    setError("");

    try {
      await api.post("/listings", {
        title,
        description,
        price: parseFloat(price),
        type,
        condition: type === "SERVICE" ? "NOT_APPLICABLE" : condition,
        location,
        meetupPreference,
        isNegotiable,
        categoryId: selectedCategoryId,
        images // Pass uploaded image urls array
      });

      setIsSuccess(true);
      setTimeout(() => {
        navigate("/dashboard");
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to publish listing. Please verify inputs.");
    } finally {
      setIsPublishing(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] bg-gray-50/50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-border max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Listing Published!</h2>
          <p className="text-muted-foreground mb-6">Your item has been submitted for moderation. You can find it on your dashboard.</p>
          <p className="text-sm text-muted-foreground animate-pulse">Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-border sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors p-2 -ml-2 rounded-full hover:bg-gray-100">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-xl font-bold text-foreground">Post a New Item</h1>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => document.getElementById("submit-listing-btn")?.click()} disabled={isPublishing}>
              {isPublishing ? "Publishing..." : "Publish Item"}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 mb-6 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Photos Section */}
          <section>
            <h2 className="text-lg font-bold text-foreground mb-4">Photos</h2>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground mb-4">
                  Add up to 5 photos. The first photo will be your cover image. Use clear, bright photos for better results.
                </p>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {images.map((img, index) => (
                    <div key={index} className="relative aspect-square rounded-xl overflow-hidden group border border-border">
                      <img src={mediaUrl(img)} alt={`Upload ${index + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button 
                          type="button" 
                          variant="destructive" 
                          size="icon" 
                          className="h-8 w-8 rounded-full"
                          onClick={() => removeImage(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      {index === 0 && (
                        <div className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] font-bold px-2 py-1 rounded">
                          COVER
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {images.length < 5 && (
                    <label className="relative aspect-square rounded-xl border-2 border-dashed border-gray-300 hover:border-primary hover:bg-red-50/50 transition-colors flex flex-col items-center justify-center cursor-pointer">
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        disabled={uploadingImage}
                        onChange={handleImageUpload}
                      />
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                        {uploadingImage ? (
                          <Loader2 className="h-5 w-5 text-gray-500 animate-spin" />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-gray-500" />
                        )}
                      </div>
                      <span className="text-sm font-medium text-gray-600">
                        {uploadingImage ? "Uploading..." : "Add Photo"}
                      </span>
                      <span className="text-xs text-gray-400 mt-1">{images.length}/5</span>
                    </label>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Details Section */}
          <section>
            <h2 className="text-lg font-bold text-foreground mb-4">Item Details</h2>
            <Card>
              <CardContent className="p-6 space-y-6">
                
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input 
                    id="title" 
                    placeholder="e.g., iPhone 13 Pro Max 256GB" 
                    required 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={70}
                  />
                  <p className="text-xs text-muted-foreground text-right">{title.length}/70</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="type">Type *</Label>
                    <select
                      id="type"
                      value={type}
                      onChange={(e) => setType(e.target.value as "PRODUCT" | "SERVICE")}
                      className="w-full h-10 px-3 bg-white border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                    >
                      <option value="PRODUCT">Physical Product</option>
                      <option value="SERVICE">Academic Service</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <select
                      id="category"
                      value={selectedCategoryId}
                      onChange={(e) => setSelectedCategoryId(e.target.value)}
                      className="w-full h-10 px-3 bg-white border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                    >
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {type === "PRODUCT" && (
                  <div className="space-y-2">
                    <Label htmlFor="condition">Condition *</Label>
                    <select
                      id="condition"
                      value={condition}
                      onChange={(e) => setCondition(e.target.value)}
                      className="w-full h-10 px-3 bg-white border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                    >
                      {conditionsList.map((cond) => (
                        <option key={cond.value} value={cond.value}>
                          {cond.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea 
                    id="description" 
                    placeholder="Describe your item or service details, meet-up times, features, etc." 
                    className="min-h-[120px]"
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

              </CardContent>
            </Card>
          </section>

          {/* Pricing Section */}
          <section>
            <h2 className="text-lg font-bold text-foreground mb-4">Pricing</h2>
            <Card>
              <CardContent className="p-6 space-y-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  <div className="space-y-2">
                    <Label htmlFor="price">Price (RM) *</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">RM</span>
                      <Input 
                        id="price" 
                        type="number" 
                        placeholder="0.00" 
                        className="pl-10"
                        min="0"
                        step="0.01"
                        required 
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm h-[72px]">
                    <div className="space-y-0.5">
                      <Label className="text-base font-semibold">Negotiable</Label>
                      <p className="text-xs text-muted-foreground">
                        Allow buyers to make offers
                      </p>
                    </div>
                    <Switch 
                      checked={isNegotiable} 
                      onCheckedChange={(checked) => setIsNegotiable(checked)} 
                    />
                  </div>
                </div>

              </CardContent>
            </Card>
          </section>

          {/* Meeting & Contact */}
          <section>
            <h2 className="text-lg font-bold text-foreground mb-4">Meet-up & Contact</h2>
            <Card>
              <CardContent className="p-6 space-y-6">
                
                <div className="space-y-3">
                  <Label>Preferred Campus Meeting Location *</Label>
                  <RadioGroup 
                    value={meetupPreference}
                    onValueChange={(val) => setMeetupPreference(val)}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                  >
                    {locationsList.map((loc) => {
                      return (
                        <div key={loc} className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                          <RadioGroupItem value={loc} id={loc} />
                          <Label htmlFor={loc} className="cursor-pointer flex-1 font-normal">{loc}</Label>
                        </div>
                      )
                    })}
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Specific Spot Details (e.g. Block B Table 4)</Label>
                  <Input 
                    id="location" 
                    placeholder="Cafeteria seating area near the drinks counter" 
                    required 
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>

              </CardContent>
            </Card>
          </section>

          {/* Hidden Submit for the header button */}
          <button id="submit-listing-btn" type="submit" className="hidden">Submit</button>
          
          <div className="sm:hidden pt-4 pb-8">
             <Button type="submit" className="w-full py-6 text-lg rounded-xl" disabled={isPublishing}>
              {isPublishing ? "Publishing..." : "Publish Listing"}
            </Button>
          </div>

        </form>
      </main>
    </div>
  );
}
