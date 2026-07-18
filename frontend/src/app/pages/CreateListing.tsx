import React, { useState, useEffect } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { renderMarkdown } from "../../utils/renderMarkdown";
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
import type { CategoriesResponse, ListingResponse, MeetupPointsResponse, UploadResponse } from "../../api/responses";
import { useAuth } from "../../state/AuthContext";
import { useToast } from "../../state/ToastContext";
import type { Category, Listing, ListingImage, ListingType, MeetupPoint, SellerType } from "../../types";
import { getApiErrorMessage } from "../../utils/errors";

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
  "Online"
];

export function CreateListing() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user, reloadUser, updateUser } = useAuth();
  const { toast } = useToast();
  
  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [type, setType] = useState<ListingType>("PRODUCT");
  const [condition, setCondition] = useState("GOOD");
  const [location, setLocation] = useState("Student Center");
  const [meetupPreference, setMeetupPreference] = useState(locationsList[0]);
  const [isNegotiable, setIsNegotiable] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [sellerType, setSellerType] = useState<SellerType>(user?.sellerType ?? "CASUAL");
  const [quantity, setQuantity] = useState("1");
  const [isbn, setIsbn] = useState("");
  const [author, setAuthor] = useState("");
  const [edition, setEdition] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [serviceDuration, setServiceDuration] = useState("60");
  const [pricingUnit, setPricingUnit] = useState<"ITEM" | "HOUR" | "SESSION" | "COURSE">("ITEM");
  const [availabilityNote, setAvailabilityNote] = useState("");
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [meetupPoints, setMeetupPoints] = useState<MeetupPoint[]>([]);
  const [meetupPointId, setMeetupPointId] = useState("");
  const [images, setImages] = useState<string[]>([]); // URLs from API uploads
  
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [hideTipLocal, setHideTipLocal] = useState(false);
  const [descriptionFormat, setDescriptionFormat] = useState<"plain" | "markdown">("plain");
  const [showPreview, setShowPreview] = useState(false);
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId);
  const isFreeListing = selectedCategory?.slug === "for-free";

  const handleEnableAcademicTip = async () => {
    try {
      await api.patch("/auth/profile", {
        showAcademicProfile: true,
        academicTipShown: true
      });
      updateUser({ showAcademicProfile: true, academicTipShown: true });
      setHideTipLocal(true);
      alert("Academic Portfolio enabled successfully! You can customize your resume and projects in Settings.");
    } catch (err) {
      console.error("Request failed");
      alert("Failed to enable academic profile.");
    }
  };

  const handleDismissAcademicTip = async () => {
    try {
      await api.patch("/auth/profile", {
        academicTipShown: true
      });
      updateUser({ academicTipShown: true });
      setHideTipLocal(true);
    } catch (err) {
      console.error("Request failed");
    }
  };

  useEffect(() => {
    if (!user) {
      navigate("/login");
    }
    // Fetch active categories
    api.get<CategoriesResponse>("/listings/categories")
      .then((res) => {
        setCategories(res.data.categories);
        if (res.data.categories.length > 0 && !id) {
          setSelectedCategoryId(res.data.categories[0].id);
        }
      })
      .catch((err) => console.error("Error fetching categories:"));
    api.get<MeetupPointsResponse>("/community/meetup-points").then((res) => {
      setMeetupPoints(res.data.meetupPoints);
      if (res.data.meetupPoints.length > 0 && !id) {
        setMeetupPointId(res.data.meetupPoints[0].id);
      }
    }).catch(() => undefined);

    if (id) {
      api.get<ListingResponse>(`/listings/${id}`)
        .then((res) => {
          const l: Listing = res.data.listing;
          setTitle(l.title);
          setDescription(l.description);
          setPrice(String(l.price));
          setType(l.type);
          setCondition(l.condition);
          setLocation(l.location);
          setMeetupPreference(l.meetupPreference || "");
          setShowPhone(Boolean(l.showPhone));
          setMeetupPointId(l.meetupPointId || "");
          setQuantity(String(l.quantity || 1));
          setIsbn(l.isbn || "");
          setAuthor(l.author || "");
          setEdition(l.edition || "");
          setCourseCode(l.courseCode || "");
          setServiceDuration(String(l.serviceDuration || 60));
          setPricingUnit(l.pricingUnit || "ITEM");
          setAvailabilityNote(l.availabilityNote || "");
          setSelectedCategoryId(l.categoryId);
          setImages(l.images.map((img: ListingImage) => img.url));
        })
        .catch((err) => {
          console.error("Error loading listing for edit:");
          setError("Failed to load listing details.");
        });
    } else {
      const wantedTitle = searchParams.get("wanted")?.trim();
      if (wantedTitle) setTitle(wantedTitle.slice(0, 120));
    }
  }, [navigate, id, searchParams]);

  useEffect(() => {
    if (isFreeListing) {
      setPrice("0");
      setIsNegotiable(false);
    }
  }, [isFreeListing]);

  const convertPngToJpg = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Canvas context is not available"));
            return;
          }
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const newFile = new File([blob], file.name.replace(/\.png$/i, ".jpg"), {
                  type: "image/jpeg",
                  lastModified: Date.now()
                });
                resolve(newFile);
              } else {
                reject(new Error("Canvas blob conversion failed"));
              }
            },
            "image/jpeg",
            0.92
          );
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = event.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  };

  const isVideoFile = (file: File) => file.type.startsWith("video/");
  const isImageFile = (file: File) => file.type.startsWith("image/");
  const isVideoUrl = (url: string) => /\.(mp4|webm|ogg|mov)$/i.test(url) || url.includes("video");

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files ?? []);
    if (!selectedFiles.length) return;

    setUploadingImage(true);
    setError("");
    const uploadedUrls = [...images];

    try {
      for (const selectedFile of selectedFiles) {
        if (uploadedUrls.length >= 25) {
          setError("A listing can contain up to 20 photos and 5 videos.");
          break;
        }

        let file = selectedFile;
        const photoCount = uploadedUrls.filter((url) => !isVideoUrl(url)).length;
        const videoCount = uploadedUrls.filter(isVideoUrl).length;

        if (isVideoFile(file)) {
          if (videoCount >= 5) {
            setError("A listing can contain up to 5 videos.");
            continue;
          }
          if (file.size > 25 * 1024 * 1024) {
            setError(`${file.name}: video size must be less than 25MB.`);
            continue;
          }
        } else if (isImageFile(file)) {
          if (photoCount >= 20) {
            setError("A listing can contain up to 20 photos.");
            continue;
          }
          if (file.size > 5 * 1024 * 1024) {
            if (file.type !== "image/png") {
              setError(`${file.name}: photo size must be less than 5MB.`);
              continue;
            }
            const shouldConvert = window.confirm(`${file.name} is larger than 5MB. Convert it to an optimized JPG?`);
            if (!shouldConvert) continue;
            try {
              file = await convertPngToJpg(file);
            } catch {
              setError(`${file.name}: conversion failed. Please upload a smaller image.`);
              continue;
            }
          }
        } else {
          setError(`${file.name}: only images and videos are allowed.`);
          continue;
        }

        const formData = new FormData();
        formData.append("file", file);
        try {
          const response = await api.post<UploadResponse>("/uploads", formData, { headers: { "Content-Type": "multipart/form-data" } });
          uploadedUrls.push(response.data.url);
          setImages([...uploadedUrls]);
        } catch (err) {
          setError(getApiErrorMessage(err, `${file.name}: upload failed.`));
        }
      }
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    setImages(newImages);
  };

  const setAsCover = (index: number) => {
    if (index === 0) return;
    const newImages = [...images];
    const [selected] = newImages.splice(index, 1);
    newImages.unshift(selected);
    setImages(newImages);
    toast.success("Cover photo updated. Selected photo is now the cover image for your listing.");
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
      if (sellerType !== user?.sellerType) await api.patch("/auth/profile", { sellerType });
      
      const payload = {
        title,
        description,
        price: isFreeListing ? 0 : parseFloat(price),
        type,
        condition: type === "PRODUCT" ? condition : "NOT_APPLICABLE",
        location,
        meetupPreference,
        isNegotiable: isFreeListing ? false : isNegotiable,
        showPhone,
        meetupPointId: meetupPointId || null,
        quantity: type === "PRODUCT" ? Number(quantity) : 1,
        isbn: isbn || undefined,
        author: author || undefined,
        edition: edition || undefined,
        courseCode: courseCode || undefined,
        serviceDuration: type !== "PRODUCT" ? Number(serviceDuration) : undefined,
        pricingUnit: type === "PRODUCT" ? "ITEM" : pricingUnit,
        availabilityNote: type !== "PRODUCT" ? availabilityNote || undefined : undefined,
        categoryId: selectedCategoryId,
        imageUrls: images
      };

      if (id) {
        await api.patch(`/listings/${id}`, payload);
      } else {
        await api.post("/listings", payload);
      }

      setIsSuccess(true);
      setTimeout(() => {
        navigate("/dashboard");
      }, 2000);
    } catch (err) {
      console.error("Request failed");
      setError(getApiErrorMessage(err, "Failed to publish listing. Please verify inputs."));
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
          <h2 className="text-2xl font-bold text-foreground mb-2">Sent for review!</h2>
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
            <h1 className="text-xl font-bold text-foreground">{id ? "Edit listing" : "Create a listing"}</h1>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => document.getElementById("submit-listing-btn")?.click()} disabled={isPublishing}>
              {isPublishing ? "Saving..." : id ? "Save changes" : "Submit for approval"}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Academic Profile Recommendation Tip */}
        {(type === "COURSE" || type === "SERVICE") && !user?.showAcademicProfile && !user?.academicTipShown && !hideTipLocal && (
          <div className="bg-gradient-to-r from-amber-50 to-amber-100/50 p-5 rounded-2xl border-2 border-amber-200 mb-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="font-extrabold text-amber-900 text-sm flex items-center gap-1.5">
                <span>💡</span> Boost Your Course Sales!
              </h4>
              <p className="text-xs text-amber-800 leading-relaxed max-w-xl">
                Сделайте ваш академический профиль (GPA и успеваемость) публичным. Это подтвердит вашу экспертизу перед студентами, повысит доверие к вашим курсам и увеличит продажи!
              </p>
            </div>
            <div className="flex gap-2 shrink-0 w-full sm:w-auto justify-end">
              <Button type="button" variant="outline" size="sm" onClick={handleDismissAcademicTip} className="bg-white hover:bg-gray-50 text-xs border-amber-300 text-amber-950 font-bold">
                Dismiss
              </Button>
              <Button type="button" size="sm" onClick={handleEnableAcademicTip} className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold">
                Enable Public Profile
              </Button>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 mb-6 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Photos Section */}
          <section>
            <h2 className="text-lg font-bold text-foreground mb-4">Media (Photos & Videos)</h2>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground mb-4">
                  Add up to 20 photos (under 5MB each) and 5 videos (under 25MB). The first image will be your listing cover.
                </p>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {images.map((img, index) => {
                    const isVideo = isVideoUrl(img);
                    return (
                      <div key={index} className="relative aspect-square rounded-xl overflow-hidden group border border-border bg-black/5">
                        {isVideo ? (
                          <div className="w-full h-full relative">
                            <video src={mediaUrl(img)} className="w-full h-full object-cover" muted playsInline />
                            <div className="absolute top-2 right-2 bg-black/75 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                              VIDEO
                            </div>
                          </div>
                        ) : (
                          <img src={mediaUrl(img)} alt={`Upload ${index + 1}`} className="w-full h-full object-cover" />
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2 z-10">
                          {index !== 0 && !isVideo && (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="h-7 px-2.5 text-xs font-bold bg-white text-gray-900 hover:bg-primary hover:text-white shadow gap-1"
                              onClick={() => setAsCover(index)}
                            >
                              Make Cover
                            </Button>
                          )}
                          <Button 
                            type="button" 
                            variant="destructive" 
                            size="icon" 
                            className="h-8 w-8 rounded-full shadow"
                            onClick={() => removeImage(index)}
                            title="Remove media"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        {index === 0 && !isVideo && (
                          <div className="absolute bottom-2 left-2 bg-primary text-white text-[10px] font-bold px-2 py-1 rounded shadow z-20">
                            COVER
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {images.length < 25 && (
                    <label className="relative aspect-square rounded-xl border-2 border-dashed border-gray-300 hover:border-primary hover:bg-red-50/50 transition-colors flex flex-col items-center justify-center cursor-pointer">
                      <input 
                        type="file" 
                        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,video/ogg"
                        multiple
                        className="hidden" 
                        disabled={uploadingImage}
                        onChange={handleImageUpload}
                      />
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                        {uploadingImage ? (
                          <Loader2 className="h-5 w-5 text-gray-500 animate-spin" />
                        ) : (
                          <Upload className="h-5 w-5 text-gray-500" />
                        )}
                      </div>
                      <span className="text-sm font-medium text-gray-600">
                        {uploadingImage ? "Uploading..." : "Add Media"}
                      </span>
                      <span className="text-xs text-gray-400 mt-1">{images.length}/25</span>
                    </label>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Details Section */}
          <section>
            <h2 className="text-lg font-bold text-foreground mb-4">Listing details</h2>
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
                      onChange={(e) => {
                        const value = e.target.value as ListingType;
                        setType(value);
                        setPricingUnit(value === "COURSE" ? "COURSE" : value === "SERVICE" ? "SESSION" : "ITEM");
                      }}
                      className="w-full h-10 px-3 bg-white border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                    >
                      <option value="PRODUCT">Physical Product</option>
                      <option value="SERVICE">Service</option>
                      <option value="COURSE">Course or tutoring program</option>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    <div className="space-y-2">
                      <Label htmlFor="quantity">Quantity available *</Label>
                      <Input id="quantity" type="number" min="1" max="10000" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
                      <p className="text-xs text-muted-foreground">Use 1 for a one-off item, or your actual stock for a shop.</p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="sellerType">How are you selling?</Label>
                  <select id="sellerType" value={sellerType} onChange={(e) => setSellerType(e.target.value as SellerType)} className="w-full h-10 px-3 bg-white border border-border rounded-md text-sm">
                    <option value="CASUAL">Casual seller — occasional personal items</option>
                    <option value="SHOP">Campus shop — multiple products or stock</option>
                    <option value="SERVICE_PROVIDER">Service or course provider</option>
                  </select>
                </div>

                {(type === "COURSE" || selectedCategory?.slug === "textbooks") && (
                  <div className="rounded-xl border bg-gray-50 p-4 space-y-4">
                    <p className="font-semibold text-sm">Academic details</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input placeholder="Course code (e.g. MAT110)" value={courseCode} onChange={(e) => setCourseCode(e.target.value)} />
                      <Input placeholder="Author" value={author} onChange={(e) => setAuthor(e.target.value)} />
                      <Input placeholder="ISBN" value={isbn} onChange={(e) => setIsbn(e.target.value)} />
                      <Input placeholder="Edition" value={edition} onChange={(e) => setEdition(e.target.value)} />
                    </div>
                  </div>
                )}

                {type !== "PRODUCT" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Duration in minutes</Label>
                      <Input type="number" min="15" value={serviceDuration} onChange={(e) => setServiceDuration(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Price is per</Label>
                      <select value={pricingUnit} onChange={(e) => setPricingUnit(e.target.value as typeof pricingUnit)} className="w-full h-10 px-3 bg-white border border-border rounded-md text-sm">
                        <option value="HOUR">Hour</option>
                        <option value="SESSION">Session</option>
                        <option value="COURSE">Whole course</option>
                      </select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Availability</Label>
                      <Input value={availabilityNote} onChange={(e) => setAvailabilityNote(e.target.value)} placeholder="Weekdays after 4 PM, Saturday mornings, or contact me to arrange" />
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="description">Description *</Label>
                    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                      <button
                        type="button"
                        onClick={() => { setDescriptionFormat("plain"); setShowPreview(false); }}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                          descriptionFormat === "plain"
                            ? "bg-white text-gray-900 shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        Plain Text
                      </button>
                      <button
                        type="button"
                        onClick={() => setDescriptionFormat("markdown")}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                          descriptionFormat === "markdown"
                            ? "bg-white text-gray-900 shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        Markdown
                      </button>
                    </div>
                  </div>

                  {descriptionFormat === "markdown" && (
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Use <code className="bg-gray-100 px-1 rounded text-[10px] font-mono">**bold**</code>, <code className="bg-gray-100 px-1 rounded text-[10px] font-mono">*italic*</code>, <code className="bg-gray-100 px-1 rounded text-[10px] font-mono"># Heading</code>, <code className="bg-gray-100 px-1 rounded text-[10px] font-mono">- list</code>, <code className="bg-gray-100 px-1 rounded text-[10px] font-mono">```code```</code>
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowPreview(!showPreview)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                          showPreview
                            ? "bg-primary text-white border-primary shadow-sm"
                            : "bg-white text-primary border-primary/30 hover:border-primary hover:bg-red-50"
                        }`}
                      >
                        {showPreview ? "✎ Edit" : "👁 Preview"}
                      </button>
                    </div>
                  )}

                  {showPreview && descriptionFormat === "markdown" ? (
                    <div className="min-h-[120px] bg-white border border-border rounded-xl p-4 prose max-w-none">
                      {description.trim() ? (
                        renderMarkdown(description)
                      ) : (
                        <p className="text-muted-foreground text-sm italic">Nothing to preview yet. Write some markdown above to see it rendered here.</p>
                      )}
                    </div>
                  ) : (
                    <Textarea 
                      id="description" 
                      placeholder={descriptionFormat === "markdown"
                        ? "# My Item\n\nDescribe your item using **Markdown** formatting.\n\n- Feature one\n- Feature two\n\n```\nCode example\n```"
                        : "Describe your item or service details, meet-up times, features, etc."
                      }
                      className={`min-h-[120px] font-mono ${descriptionFormat === "markdown" ? "text-sm" : ""}`}
                      required
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  )}
                </div>

              </CardContent>
            </Card>
          </section>

          {/* Pricing Section */}
          <section>
            <h2 className="text-lg font-bold text-foreground mb-4">Pricing</h2>
            <Card>
              <CardContent className="p-6 space-y-6">

                {isFreeListing ? (
                  <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                    <p className="font-bold text-green-800">Free item</p>
                    <p className="text-sm text-green-700 mt-1">
                      This listing is in the For free category, so buyers will see it as free and no price is required.
                    </p>
                  </div>
                ) : (
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
                )}

              </CardContent>
            </Card>
          </section>

          {/* Meeting & Contact */}
          <section>
            <h2 className="text-lg font-bold text-foreground mb-4">Meet-up & Contact</h2>
            <Card>
              <CardContent className="p-6 space-y-6">
                
                <div className="space-y-3">
                  <Label>Verified safe meetup point</Label>
                  <select value={meetupPointId} onChange={(e) => setMeetupPointId(e.target.value)} className="w-full h-10 px-3 bg-white border border-border rounded-md text-sm">
                    <option value="">Choose later</option>
                    {meetupPoints.map((point) => <option key={point.id} value={point.id}>{point.name}</option>)}
                  </select>
                  {meetupPoints.find((point) => point.id === meetupPointId)?.description && <p className="text-xs text-green-700">{meetupPoints.find((point) => point.id === meetupPointId)?.description}</p>}
                  <Label>Other preferred location</Label>
                  <RadioGroup 
                    value={meetupPreference}
                    onValueChange={(val) => {
                      setMeetupPreference(val);
                      if (val === "Online") {
                        setLocation("Online");
                      } else if (location === "Online") {
                        setLocation("");
                      }
                    }}
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
                  <div className="flex items-center justify-between rounded-lg border p-4 shadow-sm">
                    <div className="pr-4">
                      <Label className="text-base font-semibold">Show my phone number</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Off by default. When enabled, your registered phone is visible on this listing.
                      </p>
                    </div>
                    <Switch checked={showPhone} onCheckedChange={setShowPhone} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">
                    {meetupPreference === "Online" 
                      ? "Online meeting platform or contact method (e.g. MS Teams, Zoom, WhatsApp) *" 
                      : "Specific Spot Details (e.g. Block B Table 4) *"}
                  </Label>
                  <Input 
                    id="location" 
                    placeholder={meetupPreference === "Online" ? "e.g., Zoom, MS Teams, or via chat" : "Cafeteria seating area near the drinks counter"} 
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
              {isPublishing ? "Saving..." : id ? "Save changes" : "Submit for approval"}
            </Button>
          </div>

        </form>
      </main>
    </div>
  );
}
