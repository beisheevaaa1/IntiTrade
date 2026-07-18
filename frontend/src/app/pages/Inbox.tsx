import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate, Link } from "react-router";
import { 
  Search, 
  Send, 
  Image as ImageIcon, 
  ArrowLeft, 
  MessageSquare, 
  Loader2, 
  Settings, 
  Tag, 
  RefreshCw, 
  ChevronDown,
  X,
  Sparkles,
  Zap,
  Eye,
  Shield,
  ShieldAlert,
  Palette,
  Check
} from "lucide-react";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { io, Socket } from "socket.io-client";
import { api, API_URL, mediaUrl } from "../../api/client";
import type { ConversationApi, ConversationResponse, ConversationsResponse, ListingsResponse, UploadResponse } from "../../api/responses";
import { useAuth } from "../../state/AuthContext";
import { useToast } from "../../state/ToastContext";
import { PromptModal } from "../../app/components/PromptModal";
import { AttachmentSwitcherModal } from "../components/inbox/AttachmentSwitcherModal";
import type { Conversation, Message, Listing, ListingStatus, PresentedListing, PromptConfig } from "../../types";
import { formatPrice } from "../../utils/format";
import { getApiErrorMessage } from "../../utils/errors";

const PRESETS = [
  "How much does it cost?",
  "Is this item still available?",
  "Where on campus can we meet today?",
  "Would you accept a slightly lower price?"
];

const THEME_OPTIONS = [
  { name: "INTI Red", value: "#e11d48", hover: "hover:bg-red-500" },
  { name: "Ocean Blue", value: "#2563eb", hover: "hover:bg-blue-500" },
  { name: "Royal Violet", value: "#7c3aed", hover: "hover:bg-violet-500" },
  { name: "Emerald Green", value: "#059669", hover: "hover:bg-emerald-500" }
];

const MAX_AUTO_REPLY_DELAY_SECONDS = 1440;

function normalizeAutoReplyDelay(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(MAX_AUTO_REPLY_DELAY_SECONDS, Math.max(0, Math.trunc(parsed)));
}

function normalizeConversation(raw: ConversationApi): Conversation {
  return {
    ...raw,
    // Accept the short-lived staged response shape as well as the current
    // `listing` presentation returned for approved snapshots/placeholders.
    listing: raw.listing ?? raw.listingSnapshot ?? null
  };
}

function listingTitle(listing: PresentedListing | null | undefined) {
  return typeof listing?.title === "string" && listing.title.trim() ? listing.title : "Listing unavailable";
}

function listingImage(listing: PresentedListing | null | undefined) {
  const url = Array.isArray(listing?.images) ? listing.images[0]?.url : undefined;
  return url ? mediaUrl(url) : "/placeholder-item.svg";
}

function listingIsAvailable(listing: PresentedListing | null | undefined) {
  return Boolean(listing?.id && listing.status === "ACTIVE" && !listing.unavailable);
}

function listingStatusLabel(status?: ListingStatus) {
  switch (status) {
    case "PENDING": return "Pending moderation";
    case "REJECTED": return "Not approved";
    case "SOLD": return "Sold";
    case "ARCHIVED": return "Archived";
    default: return "Unavailable";
  }
}

export function Inbox() {
  const { toast, confirm } = useToast();
    const navigate = useNavigate();
  const { user, reloadUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [offerAmount, setOfferAmount] = useState("");
  const [showOffer, setShowOffer] = useState(false);
  const [pendingAttachmentUrl, setPendingAttachmentUrl] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sendError, setSendError] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [promptConfig, setPromptConfig] = useState<PromptConfig | null>(null);
  
  // Settings Tabs State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"assistant" | "privacy" | "theme">("assistant");

  // Auto-Reply Settings State
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(user?.autoReplyEnabled || false);
  const [autoReplyMessage, setAutoReplyMessage] = useState(user?.autoReplyMessage || "");
  const [autoReplyDelay, setAutoReplyDelay] = useState(normalizeAutoReplyDelay(user?.autoReplyDelay));
  
  // Privacy Settings State
  const [showOnlineStatus, setShowOnlineStatus] = useState(user?.showOnlineStatus !== false);
  const [showAcademicProfile, setShowAcademicProfile] = useState(user?.showAcademicProfile || false);
  const [resumeText, setResumeText] = useState(user?.resume || "");
  const [projectsText, setProjectsText] = useState(user?.projects || "");

  // Personalization Theme State
  const [themeColor, setThemeColor] = useState(() => localStorage.getItem("theme_color") || "#e11d48");

  const [savingSettings, setSavingSettings] = useState(false);

  // Typing state
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Attachment Switcher Modal State
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [sellerListings, setSellerListings] = useState<Listing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [sellerListingsError, setSellerListingsError] = useState("");
  
  const socketRef = useRef<Socket | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Unread messages / Smart scroll state
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevMessagesLength = useRef(0);

  const [otpValue, setOtpValue] = useState("");
  const [txSubmitting, setTxSubmitting] = useState(false);

  const activeConvId = searchParams.get("conversationId");

  // Apply theme color helper
  const applyThemeColor = (color: string) => {
    localStorage.setItem("theme_color", color);
    setThemeColor(color);
    document.documentElement.style.setProperty("--primary", color);
  };

  // Fetch all conversations
  const fetchConversations = async (selectId?: string) => {
    try {
      const res = await api.get<ConversationsResponse>("/conversations");
      const list: Conversation[] = (Array.isArray(res.data.conversations) ? res.data.conversations : [])
        .map((conversation) => normalizeConversation(conversation));
      setConversations(list);
      
      const targetId = selectId || activeConvId;
      if (targetId) {
        const found = list.find((c) => c.id === targetId);
        if (found) {
          setActiveConversation(found);
          setMessages(found.messages || []);
        }
      }
    } catch (err) {
      console.error("Error fetching conversations:");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    fetchConversations();
    
    // Sync initial state from user context
    if (user) {
      setAutoReplyEnabled(user.autoReplyEnabled || false);
      setAutoReplyMessage(user.autoReplyMessage || "Hi! Thanks for reaching out. I'll get back to you as soon as possible.");
      setAutoReplyDelay(normalizeAutoReplyDelay(user.autoReplyDelay));
      setShowOnlineStatus(user.showOnlineStatus !== false);
    }

    // Apply color theme on load
    const savedTheme = localStorage.getItem("theme_color");
    if (savedTheme) {
      document.documentElement.style.setProperty("--primary", savedTheme);
    }
  }, [activeConvId, navigate, user]);

  // Connect socket.io
  useEffect(() => {
    if (!user) return;

    const socket = io(API_URL, {
      withCredentials: true,
      transports: ["websocket"]
    });
    socketRef.current = socket;

    socket.on("message:new", (msg: Message) => {
      // If message is for the active conversation, append it
      setMessages((prev) => {
        if (prev.some((p) => p.id === msg.id)) return prev;
        return [...prev, msg];
      });
      // Refresh list to show last message
      fetchConversations(activeConversation?.id);
    });

    socket.on("messages:read", (data: { conversationId: string; readAt: string }) => {
      if (activeConversation && data.conversationId === activeConversation.id) {
        setMessages((current) =>
          current.map((msg) =>
            msg.sender.id === user?.id
              ? { ...msg, readAt: data.readAt }
              : msg
          )
        );
      }
    });

    // Listen to typing events
    socket.on("typing:status", (data: { conversationId: string; userId: string; isTyping: boolean }) => {
      if (activeConversation && data.conversationId === activeConversation.id) {
        const partnerId = activeConversation.buyer.id === user?.id ? activeConversation.seller.id : activeConversation.buyer.id;
        if (data.userId === partnerId) {
          setIsPartnerTyping(data.isTyping);
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [activeConversation?.id, user?.id]);

  // Join room when conversation is selected
  useEffect(() => {
    if (activeConversation && socketRef.current) {
      socketRef.current.emit("conversation:join", activeConversation.id, () => {
        window.dispatchEvent(new Event("intitrade:messages-changed"));
      });
      setMessages(activeConversation.messages || []);
      setIsPartnerTyping(false); // Reset typing status when switching rooms
    }
  }, [activeConversation]);

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      setUnreadCount(0);
      setIsNearBottom(true);
    }
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const nearBottom = scrollHeight - scrollTop - clientHeight < 150;
    setIsNearBottom(nearBottom);
    if (nearBottom) {
      setUnreadCount(0);
    }
  };

  // Scroll to bottom when activeConversation is selected or changed
  useEffect(() => {
    if (activeConversation) {
      setIsPartnerTyping(false);
      setUnreadCount(0);
      setIsNearBottom(true);
      setTimeout(() => {
        scrollToBottom();
      }, 50);
    }
  }, [activeConversation]);

  // Handle incoming messages scroll behavior
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const isMyMessage = lastMessage?.sender.id === user?.id;

      if (isNearBottom || isMyMessage || prevMessagesLength.current === 0) {
        scrollToBottom();
      } else {
        setUnreadCount((prev) => prev + 1);
      }
    }
    prevMessagesLength.current = messages.length;
  }, [messages, isNearBottom, user?.id]);

  // Handle scrolling when partner is typing
  useEffect(() => {
    if (isPartnerTyping && isNearBottom) {
      scrollToBottom();
    }
  }, [isPartnerTyping]);

  const handleSendMessage = async (textToSend: string, attachmentUrl = pendingAttachmentUrl, offer = offerAmount) => {
    if ((!textToSend.trim() && !attachmentUrl && !offer) || !activeConversation) return false;

    const text = textToSend.trim();

    // Stop typing immediately on send
    if (socketRef.current) {
      socketRef.current.emit("typing:stop", { conversationId: activeConversation.id });
    }

    try {
      setSendError("");
      const payload = {
        conversationId: activeConversation.id,
        body: text,
        attachmentUrl: attachmentUrl || undefined,
        offerAmount: offer ? Number(offer) : undefined
      };
      if (socketRef.current?.connected) {
        await new Promise<void>((resolve, reject) => {
          socketRef.current!.timeout(10000).emit("message:send", payload, (timeoutError: Error | null, response?: { ok?: boolean; message?: unknown }) => {
            if (timeoutError) return reject(new Error("The message timed out. Please try again."));
            if (!response?.ok) {
              const reason = typeof response?.message === "string" ? response.message : "The message was rejected.";
              return reject(new Error(reason));
            }
            resolve();
          });
        });
      } else {
        await api.post(`/conversations/${activeConversation.id}/messages`, payload);
        fetchConversations(activeConversation.id);
      }
      return true;
    } catch (err) {
      console.error("Failed to send message:");
      setSendError(err instanceof Error ? err.message : "Failed to send the message. Please try again.");
      return false;
    }
  };

  const handleNewMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    if (socketRef.current && activeConversation) {
      // Emit typing start
      socketRef.current.emit("typing:start", { conversationId: activeConversation.id });
      
      // Stop typing signal after 2.5s of no keypress
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socketRef.current?.emit("typing:stop", { conversationId: activeConversation.id });
      }, 2500);
    }
  };

  const onSendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sendingMessage) return;
    setSendingMessage(true);
    const sent = await handleSendMessage(newMessage);
    setSendingMessage(false);
    if (sent) {
      setNewMessage("");
      setPendingAttachmentUrl("");
      setOfferAmount("");
      setShowOffer(false);
    }
  };

  const handleChatImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    const response = await api.post<UploadResponse>("/uploads", form, { headers: { "Content-Type": "multipart/form-data" } });
    setPendingAttachmentUrl(response.data.url);
  };

  const selectConversation = (conv: Conversation) => {
    setActiveConversation(conv);
    setMessages(conv.messages || []);
    setSearchParams({ conversationId: conv.id });
    void api.patch(`/conversations/${conv.id}/read`).then(() => {
      setMessages((current) => current.map((message) => message.sender.id !== user?.id ? { ...message, readAt: message.readAt ?? new Date().toISOString() } : message));
      window.dispatchEvent(new Event("intitrade:messages-changed"));
    });
  };

  const blockPartner = () => {
    if (!activeConversation || !user) return;
    const partnerId = activeConversation.buyer.id === user.id ? activeConversation.seller.id : activeConversation.buyer.id;
    setPromptConfig({
      isOpen: true,
      title: `Block ${getPartnerName(activeConversation)}?`,
      description: "Why do you want to block this user? They will not be able to message you or view your listings.",
      placeholder: "e.g., Harassment, spam, scam...",
      onSubmit: async (reason: string) => {
        try {
          await api.post(`/community/blocks/${partnerId}`, { reason: reason.trim() });
          toast.success("User blocked successfully.");
          fetchConversations(activeConversation.id);
        } catch (err) {
          console.error("Failed to block user:");
          toast.error("Failed to block user.");
        }
      }
    });
  };

  const unblockPartner = () => {
    if (!activeConversation || !user) return;
    const partnerId = activeConversation.buyer.id === user.id ? activeConversation.seller.id : activeConversation.buyer.id;
    confirm({
      title: `Unblock ${getPartnerName(activeConversation)}?`,
      description: "You will be able to exchange messages and see each other's listings again.",
      confirmText: "Unblock",
      onConfirm: async () => {
        try {
          await api.delete(`/community/blocks/${partnerId}`);
          toast.success("User unblocked.");
          fetchConversations(activeConversation.id);
        } catch (err) {
          toast.error("Failed to unblock user.");
        }
      }
    });
  };

  const handleResolveOffer = async (messageId: string, action: "accept" | "decline") => {
    try {
      await api.post(`/transactions/messages/${messageId}/${action}-offer`);
      setMessages((current) =>
        current.map((msg) =>
          msg.id === messageId
            ? { ...msg, offerStatus: action === "accept" ? "ACCEPTED" : "DECLINED" }
            : msg
        )
      );
      void fetchConversations(activeConversation?.id);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to resolve offer."));
    }
  };

  const handleUpdateTxStatus = async (txId: string, status: "COMPLETED" | "CANCELLED" | "DISPUTED", otp?: string) => {
    if (status === "DISPUTED") {
      setPromptConfig({
        isOpen: true,
        title: "Dispute Transaction",
        description: "Please explain the issue. Moderation team will review the meetup details.",
        placeholder: "e.g., Item was defective, seller didn't show up...",
        onSubmit: async (reason: string) => {
          setTxSubmitting(true);
          try {
            await api.patch(`/transactions/${txId}/status`, { status, reason, otpCode: otp });
            toast.success("Transaction marked as disputed.");
            setOtpValue("");
            void fetchConversations(activeConversation?.id);
          } catch (err) {
            toast.error(getApiErrorMessage(err, "Action failed."));
          } finally {
            setTxSubmitting(false);
          }
        }
      });
      return;
    }
    if (status === "CANCELLED") {
      confirm({
        title: "Cancel Reservation?",
        description: "Are you sure you want to cancel this reservation? The item will return to active listings.",
        variant: "destructive",
        confirmText: "Cancel Reservation",
        onConfirm: async () => {
          setTxSubmitting(true);
          try {
            await api.patch(`/transactions/${txId}/status`, { status, otpCode: otp });
            toast.success("Reservation cancelled.");
            setOtpValue("");
            void fetchConversations(activeConversation?.id);
          } catch (err) {
            toast.error(getApiErrorMessage(err, "Action failed."));
          } finally {
            setTxSubmitting(false);
          }
        }
      });
      return;
    }
    setTxSubmitting(true);
    try {
      await api.patch(`/transactions/${txId}/status`, { status, otpCode: otp });
      toast.success(`Transaction marked as ${status.toLowerCase()}`);
      setOtpValue("");
      void fetchConversations(activeConversation?.id);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Action failed."));
    } finally {
      setTxSubmitting(false);
    }
  };

  const handleSwitchListing = async (listingId: string) => {
    if (!activeConversation) return;
    try {
      const res = await api.patch<ConversationResponse>(`/conversations/${activeConversation.id}/listing`, { listingId });
      const updatedConversation = normalizeConversation(res.data.conversation);
      setActiveConversation(updatedConversation);
      setShowAttachmentModal(false);
      // Refresh list
      fetchConversations(updatedConversation.id);
    } catch (err) {
      console.error("Failed to update conversation listing context:");
      toast.error("Failed to change attached product.");
    }
  };

  useEffect(() => {
    if (!showAttachmentModal || !activeConversation) return;

    let cancelled = false;
    setListingsLoading(true);
    setSellerListingsError("");

    api.get<ListingsResponse>("/listings", { params: { sellerId: activeConversation.sellerId, limit: 50 } })
      .then((res) => {
        if (cancelled) return;
        const listings: Listing[] = Array.isArray(res.data.listings) ? res.data.listings : [];
        setSellerListings(listings.filter((listing) => listing.id !== activeConversation.listing?.id));
      })
      .catch(() => {
        if (cancelled) return;
        setSellerListings([]);
        setSellerListingsError("Could not load the seller's active listings. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setListingsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [showAttachmentModal, activeConversation?.id, activeConversation?.sellerId, activeConversation?.listing?.id]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const normalizedAutoReplyDelay = normalizeAutoReplyDelay(autoReplyDelay);
      setAutoReplyDelay(normalizedAutoReplyDelay);
      await api.patch("/auth/profile", {
        autoReplyEnabled,
        autoReplyMessage,
        autoReplyDelay: normalizedAutoReplyDelay,
        showOnlineStatus,
        showAcademicProfile,
        resume: resumeText,
        projects: projectsText
      });
      await reloadUser();
      setShowSettingsModal(false);
      toast.success("Settings saved successfully!");
    } catch (err) {
      console.error("Error saving settings:");
      toast.error("Failed to save settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  // Check if partner is Online or get Last Seen date
  const getPartnerOnlineStatus = (conv: Conversation) => {
    const partner = conv.buyer.id === user?.id ? conv.seller : conv.buyer;
    if (!partner.showOnlineStatus) return "Offline";
    if (!partner.lastActiveAt) return "Offline";

    const diffMs = Date.now() - new Date(partner.lastActiveAt).getTime();
    if (diffMs < 2 * 60 * 1000) {
      return "Online";
    }

    const date = new Date(partner.lastActiveAt);
    return `Last seen at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const isPartnerOnline = (conv: Conversation) => {
    const partner = conv.buyer.id === user?.id ? conv.seller : conv.buyer;
    if (!partner.showOnlineStatus || !partner.lastActiveAt) return false;
    const diffMs = Date.now() - new Date(partner.lastActiveAt).getTime();
    return diffMs < 2 * 60 * 1000;
  };

  // Filter conversations based on search input
  const filteredConversations = conversations.filter((c) => {
    const partnerName = c.buyer.id === user?.id ? c.seller.name : c.buyer.name;
    const titleMatch = listingTitle(c.listing).toLowerCase().includes(searchQuery.toLowerCase());
    const partnerMatch = partnerName.toLowerCase().includes(searchQuery.toLowerCase());
    return titleMatch || partnerMatch;
  });

  const getPartnerName = (conv: Conversation) => {
    return conv.buyer.id === user?.id ? conv.seller.name : conv.buyer.name;
  };

  const getPartnerAvatar = (conv: Conversation) => {
    return conv.buyer.id === user?.id ? conv.seller.avatarUrl : conv.buyer.avatarUrl;
  };

  if (loading && conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 h-[calc(100vh-80px)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex-grow bg-white flex overflow-hidden h-[calc(100vh-80px)]">
      {/* Sidebar - List of Chats */}
      <div className={`${activeConversation ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 flex-col border-r border-border h-full bg-gray-50/50`}>
        <div className="p-4 border-b border-border bg-white">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-foreground">Messages</h2>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => {
                setSettingsTab("assistant");
                setShowSettingsModal(true);
              }} 
              className="text-gray-500 hover:text-primary rounded-xl"
              title="Chat & Profile Settings"
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>
          <div className="relative">
            <Input 
              placeholder="Search conversations..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl pl-10 bg-gray-100 border-transparent h-10 text-sm"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground text-sm">
              No conversations found.
            </div>
          ) : (
            filteredConversations.map((chat) => {
              const isSelected = activeConversation?.id === chat.id;
              const lastMsg = chat.messages?.[chat.messages.length - 1];
              const partnerOnline = isPartnerOnline(chat);
              
              return (
                <div 
                  key={chat.id} 
                  onClick={() => selectConversation(chat)}
                  className={`p-4 border-b border-border cursor-pointer transition-colors flex gap-3 ${isSelected ? 'bg-red-50/50 border-l-4 border-l-primary' : 'hover:bg-gray-100 bg-white border-l-4 border-l-transparent'}`}
                >
                  <div className="relative">
                    <Avatar className="h-12 w-12 border border-border bg-white shadow-sm">
                      <AvatarImage src={mediaUrl(getPartnerAvatar(chat) || undefined)} />
                      <AvatarFallback className="bg-gray-200 text-gray-600 font-medium">
                        {getPartnerName(chat).substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {partnerOnline && (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></span>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-0.5">
                      <h4 className="font-semibold text-sm truncate text-gray-700">
                        {getPartnerName(chat)}
                      </h4>
                      <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                        {lastMsg ? new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-[10px] font-medium bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded truncate max-w-[150px]">
                        {listingTitle(chat.listing)}
                      </span>
                    </div>
                    <p className="text-xs truncate text-gray-500">
                      {lastMsg ? lastMsg.body : "No messages yet"}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      {activeConversation ? (
        <div className="flex-1 flex flex-col h-full bg-white relative">
          {/* Chat Header */}
          <div className="h-16 border-b border-border flex items-center justify-between px-4 sm:px-6 bg-white shrink-0">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="md:hidden -ml-2" onClick={() => setActiveConversation(null)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="relative">
                <Avatar className="h-10 w-10 border border-border bg-white">
                  <AvatarImage src={mediaUrl(getPartnerAvatar(activeConversation) || undefined)} />
                  <AvatarFallback className="bg-gray-200 font-bold">
                    {getPartnerName(activeConversation).substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {isPartnerOnline(activeConversation) && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                )}
              </div>
              <div>
                <h3 className="font-bold text-foreground leading-tight">{getPartnerName(activeConversation)}</h3>
                <span className={`text-[10px] font-semibold ${isPartnerOnline(activeConversation) ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {getPartnerOnlineStatus(activeConversation)}
                </span>
              </div>
            </div>
            {activeConversation.isBlockedByMe ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={unblockPartner}
                className="text-primary hover:bg-red-55 hover:text-primary gap-1 font-bold rounded-xl"
              >
                <ShieldAlert className="w-4 h-4 text-primary animate-pulse" /> Unblock
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={blockPartner}
                className="text-muted-foreground hover:text-primary gap-1 rounded-xl"
              >
                <Shield className="w-4 h-4" /> Block
              </Button>
            )}
          </div>

          {/* Product Banner (Context Attachment) */}
          <div className="bg-gray-50 border-b border-border p-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded bg-white border border-border overflow-hidden shrink-0">
                <img 
                  src={listingImage(activeConversation.listing)}
                  alt=""
                  className="w-full h-full object-cover" 
                  onError={(event) => { event.currentTarget.src = "/placeholder-item.svg"; }}
                />
              </div>
              <div className="min-w-0">
                {listingIsAvailable(activeConversation.listing) ? (
                  <Link to={`/product/${activeConversation.listing!.id}`} className="text-sm font-semibold text-gray-900 line-clamp-1 hover:underline">
                    {listingTitle(activeConversation.listing)}
                  </Link>
                ) : (
                  <p className="text-sm font-semibold text-gray-900 line-clamp-1">{listingTitle(activeConversation.listing)}</p>
                )}
                <div className="flex items-center gap-2">
                  {activeConversation.listing?.price !== undefined && activeConversation.listing?.price !== null && (
                    <p className="text-xs text-primary font-bold">{formatPrice(activeConversation.listing.price)}</p>
                  )}
                  {!listingIsAvailable(activeConversation.listing) && (
                    <span className="text-[10px] font-semibold text-amber-700">{listingStatusLabel(activeConversation.listing?.status)}</span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Attachment switcher trigger */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowAttachmentModal(true)}
              className="gap-1.5 h-8 text-xs font-semibold shrink-0 bg-white"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Attach Item
            </Button>
          </div>

          {/* Transaction Status & Verification Banner */}
          {activeConversation.listing?.transactions?.[0] && (() => {
            const tx = activeConversation.listing.transactions[0];
            const isBuyer = tx.buyerId === user?.id;
            const isSeller = tx.sellerId === user?.id;

            return (
              <div className="bg-green-50 border-b border-green-100 p-3 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 text-green-900 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shrink-0"></div>
                  <div>
                    <span className="font-bold">Reservation Active:</span> Quantity: {tx.quantity} · Price: {formatPrice(tx.price)}
                    {tx.meetupPoint && <p className="text-[10px] text-green-700 mt-0.5">Meetup point: <strong>{tx.meetupPoint.name}</strong></p>}
                  </div>
                </div>
                
                {isBuyer && tx.otpCode && (
                  <div className="bg-white border border-green-200 rounded-xl p-2 px-3 self-start sm:self-auto flex items-center gap-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-green-600">Your Code (OTP)</span>
                    <span className="font-extrabold text-sm tracking-widest text-gray-900">{tx.otpCode}</span>
                  </div>
                )}

                {isSeller && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Input 
                      placeholder="Enter OTP" 
                      value={otpValue} 
                      inputMode="numeric"
                      onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="w-28 h-8 bg-white border-green-300 focus-visible:ring-green-500 rounded-lg text-center text-sm font-bold tracking-widest"
                    />
                    <Button 
                      onClick={() => handleUpdateTxStatus(tx.id, "COMPLETED", otpValue)}
                      disabled={![4, 6].includes(otpValue.length) || txSubmitting}
                      className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-1 h-8 rounded-lg"
                    >
                      Verify & Complete
                    </Button>
                    <Button 
                      onClick={() => handleUpdateTxStatus(tx.id, "CANCELLED")}
                      disabled={txSubmitting}
                      variant="ghost" 
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs font-bold py-1 h-8 rounded-lg"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => handleUpdateTxStatus(tx.id, "DISPUTED")}
                      disabled={txSubmitting}
                      variant="ghost" 
                      className="text-amber-700 hover:text-amber-800 hover:bg-amber-50 text-xs font-bold py-1 h-8 rounded-lg"
                    >
                      Dispute
                    </Button>
                  </div>
                )}

                {isBuyer && (
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => handleUpdateTxStatus(tx.id, "CANCELLED")}
                      disabled={txSubmitting}
                      variant="outline" 
                      className="bg-white border-gray-300 hover:bg-gray-100 text-gray-700 text-xs font-bold py-1 h-8 rounded-lg"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => handleUpdateTxStatus(tx.id, "DISPUTED")}
                      disabled={txSubmitting}
                      variant="ghost" 
                      className="text-amber-700 hover:text-amber-800 hover:bg-amber-50 text-xs font-bold py-1 h-8 rounded-lg"
                    >
                      Dispute
                    </Button>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Messages List - Fixed Overflow Scroll */}
          <div className="flex-1 min-h-0 relative flex flex-col">
            <div 
              ref={scrollContainerRef} 
              onScroll={handleScroll}
              className="flex-grow overflow-y-auto p-4 sm:p-6 bg-gray-50/30"
            >
            <div className="space-y-4">
              {messages.map((msg) => {
                const isMe = msg.sender.id === user?.id;
                
                return (
                  <div key={msg.id} className={`flex items-start gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                    {!isMe && (
                      <Avatar className="h-8 w-8 border border-border mt-1 shrink-0 bg-white">
                        <AvatarImage src={mediaUrl(getPartnerAvatar(activeConversation) || undefined)} />
                        <AvatarFallback className="text-[10px]">
                          {getPartnerName(activeConversation).substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className={`p-3 rounded-2xl max-w-[80%] sm:max-w-[70%] shadow-sm ${
                      isMe 
                        ? 'bg-primary text-white rounded-tr-sm' 
                        : 'bg-white border border-border text-gray-800 rounded-tl-sm'
                    }`}>
                      {msg.offerAmount && (
                        <div className={`rounded-xl p-3 mb-2 ${isMe ? "bg-white/15" : "bg-green-50 text-green-900 border border-green-100"}`}>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-xs">Price offer</p>
                          <p className="text-lg font-extrabold">{formatPrice(msg.offerAmount)}</p>
                          {msg.offerStatus === "ACCEPTED" && (
                            <span className="inline-block mt-2 px-2 py-0.5 text-[10px] font-bold bg-green-600 text-white rounded-full">Offer Accepted</span>
                          )}
                          {msg.offerStatus === "DECLINED" && (
                            <span className="inline-block mt-2 px-2 py-0.5 text-[10px] font-bold bg-red-600 text-white rounded-full">Offer Declined</span>
                          )}
                          {(!msg.offerStatus || msg.offerStatus === "PENDING") && activeConversation.sellerId === user?.id && !isMe && (
                            <div className="flex gap-2 mt-3">
                              <Button 
                                type="button" 
                                onClick={() => handleResolveOffer(msg.id, "accept")} 
                                className="bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold py-1 h-7 rounded-lg"
                              >
                                Accept
                              </Button>
                              <Button 
                                type="button" 
                                onClick={() => handleResolveOffer(msg.id, "decline")} 
                                variant="outline" 
                                className="bg-white hover:bg-gray-100 text-gray-700 border-gray-300 text-[10px] font-bold py-1 h-7 rounded-lg"
                              >
                                Decline
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                      {msg.attachmentUrl && <img src={mediaUrl(msg.attachmentUrl)} alt="Chat attachment" className="rounded-xl max-h-60 object-cover mb-2" />}
                      {msg.body && <p className="text-sm break-words whitespace-pre-wrap">{msg.body}</p>}
                      <span className={`text-[9px] block mt-1 flex items-center justify-end gap-1 ${isMe ? 'text-red-200' : 'text-gray-400'}`}>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {isMe && (
                          <span className="flex text-xs">
                            {msg.readAt ? (
                              <span className="text-blue-300 font-bold" title="Read">✓✓</span>
                            ) : msg.deliveredAt ? (
                              <span className="text-gray-300 font-bold" title="Delivered">✓✓</span>
                            ) : (
                              <span className="text-red-200 font-bold" title="Sent">✓</span>
                            )}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Bouncing Dots typing status */}
              {isPartnerTyping && (
                <div className="flex items-start gap-3">
                  <Avatar className="h-8 w-8 border border-border mt-1 shrink-0 bg-white">
                    <AvatarImage src={mediaUrl(getPartnerAvatar(activeConversation) || undefined)} />
                    <AvatarFallback className="text-[10px]">
                      {getPartnerName(activeConversation).substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-white border border-border text-gray-800 p-3 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-2">
                    <span className="text-xs text-gray-500 font-semibold">{getPartnerName(activeConversation)} is typing</span>
                    <div className="flex gap-1 items-center justify-center mt-1">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            </div>

            {/* Scroll Down Floating Button */}
            {!isNearBottom && (
              <button
                type="button"
                onClick={scrollToBottom}
                className="absolute bottom-4 right-6 bg-white hover:bg-gray-100 text-gray-700 w-11 h-11 rounded-full flex items-center justify-center shadow-lg border border-border transition-all hover:scale-105 active:scale-95 z-10"
                title="Scroll to bottom"
              >
                <ChevronDown className="w-6 h-6 text-gray-500" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-green-500 text-white font-extrabold text-[10px] min-w-5 h-5 rounded-full px-1.5 flex items-center justify-center border-2 border-white shadow-sm animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Message Presets */}
          {messages.length === 0 && !activeConversation.isBlockedByMe && !activeConversation.hasBlockedMe && (
            <div className="px-4 py-2 bg-gray-50/50 border-t border-border overflow-x-auto flex gap-2 scrollbar-none shrink-0">
              {PRESETS.map((preset, index) => (
                <button
                  key={index}
                  onClick={() => handleSendMessage(preset)}
                  className="bg-white hover:bg-red-50/50 border border-border rounded-full px-3 py-1.5 text-xs text-gray-600 hover:text-primary transition-all whitespace-nowrap font-medium shadow-sm hover:border-primary/20 shrink-0"
                >
                  {preset}
                </button>
              ))}
            </div>
          )}

          {/* Block Banners or Message Input */}
          {activeConversation.isBlockedByMe ? (
            <div className="p-4 sm:p-6 bg-red-50/50 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 text-red-900 text-sm">
              <div className="flex items-center gap-2.5">
                <span className="text-lg">🚫</span>
                <div>
                  <p className="font-bold">You have blocked this user</p>
                  <p className="text-xs text-red-700">Unblock them to resume messaging.</p>
                </div>
              </div>
              <Button
                type="button"
                onClick={unblockPartner}
                className="bg-primary hover:bg-primary/95 text-white font-bold h-10 px-5 rounded-xl self-start sm:self-auto shadow-sm"
              >
                Unblock User
              </Button>
            </div>
          ) : activeConversation.hasBlockedMe ? (
            <div className="p-4 sm:p-6 bg-gray-50 border-t border-border flex items-center gap-2.5 shrink-0 text-gray-500 text-sm">
              <span className="text-lg">🚫</span>
              <div>
                <p className="font-bold">This user is currently unavailable</p>
                <p className="text-xs text-gray-400">Messaging is disabled for this conversation.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={onSendSubmit} className="p-3 sm:p-4 bg-white border-t border-border shrink-0">
              {sendError && <p role="alert" className="mb-2 text-sm text-red-600">{sendError}</p>}
              {pendingAttachmentUrl && <div className="mb-2 flex items-center gap-2 bg-gray-50 rounded-xl p-2"><img src={mediaUrl(pendingAttachmentUrl)} className="w-14 h-14 object-cover rounded-lg" alt="Ready to send" /><span className="text-xs flex-1">Image ready to send</span><Button type="button" variant="ghost" size="icon" onClick={() => setPendingAttachmentUrl("")}><X className="w-4 h-4" /></Button></div>}
              {showOffer && <div className="mb-2 flex items-center gap-2"><Input type="number" min="0.01" step="0.01" value={offerAmount} onChange={(e) => setOfferAmount(e.target.value)} placeholder="Offer amount in RM" /><Button type="button" variant="ghost" onClick={() => { setShowOffer(false); setOfferAmount(""); }}>Cancel</Button></div>}
              <div className="flex items-center gap-2">
                <label className="h-10 w-10 flex items-center justify-center cursor-pointer text-gray-400 hover:text-gray-600 shrink-0"><input type="file" accept="image/*" className="hidden" onChange={handleChatImage} /><ImageIcon className="h-5 w-5" /></label>
                <Button type="button" variant="ghost" size="icon" onClick={() => setShowOffer(!showOffer)} title="Make an offer"><Tag className="h-5 w-5" /></Button>
                <div className="flex-1 relative">
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={handleNewMessageChange}
                    className="w-full rounded-full px-4 bg-gray-100 border-transparent h-12"
                  />
                </div>
                <Button type="submit" disabled={sendingMessage} className="h-12 w-12 rounded-full shrink-0 flex items-center justify-center p-0">
                  {sendingMessage ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5 ml-1" />}
                </Button>
              </div>
            </form>
          )}
        </div>
      ) : (
        <div className="hidden md:flex flex-grow items-center justify-center flex-col bg-gray-50/50">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4 border border-border shadow-sm">
            <MessageSquare className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-700 mb-2">Your Messages</h3>
          <p className="text-muted-foreground text-sm">Select a conversation to start chatting in real time</p>
        </div>
      )}

      {/* MODAL 1: Settings Hub (Auto-Reply, Privacy, Themes) */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-border overflow-hidden relative">
            <div className="absolute top-4 right-4">
              <Button variant="ghost" size="icon" onClick={() => setShowSettingsModal(false)} className="rounded-full">
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="mb-5 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Settings className="w-4 h-4" />
              </div>
              <h3 className="font-extrabold text-lg text-foreground">Settings Panel</h3>
            </div>

            {/* Tabs Selector */}
            <div className="flex border-b border-border mb-4">
              <button
                type="button"
                onClick={() => setSettingsTab("assistant")}
                className={`flex-1 pb-2.5 text-xs font-bold text-center border-b-2 transition-all ${
                  settingsTab === "assistant" 
                    ? "border-primary text-primary" 
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                <span className="flex items-center justify-center gap-1"><Zap className="w-3.5 h-3.5" /> Auto-Reply</span>
              </button>
              <button
                type="button"
                onClick={() => setSettingsTab("privacy")}
                className={`flex-1 pb-2.5 text-xs font-bold text-center border-b-2 transition-all ${
                  settingsTab === "privacy" 
                    ? "border-primary text-primary" 
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                <span className="flex items-center justify-center gap-1"><Shield className="w-3.5 h-3.5" /> Privacy</span>
              </button>
              <button
                type="button"
                onClick={() => setSettingsTab("theme")}
                className={`flex-1 pb-2.5 text-xs font-bold text-center border-b-2 transition-all ${
                  settingsTab === "theme" 
                    ? "border-primary text-primary" 
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                <span className="flex items-center justify-center gap-1"><Palette className="w-3.5 h-3.5" /> Theme Color</span>
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              {/* TAB 1: Auto-Reply */}
              {settingsTab === "assistant" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-border">
                    <div>
                      <label htmlFor="auto-reply-toggle" className="font-bold text-sm text-gray-900 block">Enable Auto-Reply</label>
                      <span className="text-[10px] text-muted-foreground">Automatically respond when you are away.</span>
                    </div>
                    <input
                      id="auto-reply-toggle"
                      type="checkbox"
                      checked={autoReplyEnabled}
                      onChange={(e) => setAutoReplyEnabled(e.target.checked)}
                      className="w-5 h-5 text-primary focus:ring-primary border-gray-300 rounded"
                    />
                  </div>

                  {autoReplyEnabled && (
                    <>
                      <div>
                        <label htmlFor="auto-reply-msg" className="block text-sm font-semibold text-gray-700 mb-1">Custom Message</label>
                        <textarea
                          id="auto-reply-msg"
                          rows={3}
                          required
                          value={autoReplyMessage}
                          onChange={(e) => setAutoReplyMessage(e.target.value)}
                          placeholder="Hi! I am currently out of campus. I will reply to you soon!"
                          className="w-full rounded-xl border border-border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-gray-800"
                        />
                      </div>

                      <div>
                        <label htmlFor="auto-reply-delay-sec" className="block text-sm font-semibold text-gray-700 mb-1">Response Delay (seconds)</label>
                        <Input
                          id="auto-reply-delay-sec"
                          type="number"
                          min={0}
                          max={MAX_AUTO_REPLY_DELAY_SECONDS}
                          required
                          value={autoReplyDelay}
                          onChange={(e) => setAutoReplyDelay(normalizeAutoReplyDelay(e.target.value))}
                          className="h-10 text-sm"
                        />
                        <span className="text-[10px] text-muted-foreground mt-1 block">Set 0 for instant auto-replies (maximum 1440 seconds).</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* TAB 2: Privacy & Academic Portfolio */}
              {settingsTab === "privacy" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-border">
                    <div>
                      <label htmlFor="online-status-toggle" className="font-bold text-sm text-gray-900 block">Show Online Status</label>
                      <span className="text-[10px] text-muted-foreground">Allows other students to see when you are active.</span>
                    </div>
                    <input
                      id="online-status-toggle"
                      type="checkbox"
                      checked={showOnlineStatus}
                      onChange={(e) => setShowOnlineStatus(e.target.checked)}
                      className="w-5 h-5 text-primary focus:ring-primary border-gray-300 rounded"
                    />
                  </div>

                  <div className="border-t border-border pt-4">
                    <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-border">
                      <div>
                        <label htmlFor="academic-status-toggle" className="font-bold text-sm text-gray-900 block">Show Academic Profile & Portfolio</label>
                        <span className="text-[10px] text-muted-foreground">Share your self-authored academic background, projects, and resume on your shop or course listings.</span>
                      </div>
                      <input
                        id="academic-status-toggle"
                        type="checkbox"
                        checked={showAcademicProfile}
                        onChange={(e) => setShowAcademicProfile(e.target.checked)}
                        className="w-5 h-5 text-primary focus:ring-primary border-gray-300 rounded"
                      />
                    </div>
                  </div>

                  {showAcademicProfile && (
                    <div className="space-y-4 pt-2">
                      <div className="bg-amber-50 text-amber-800 text-xs p-3 rounded-xl border border-amber-100 flex items-center gap-2">
                        <span>🎓</span>
                        <span>Your academic profile is self-reported. It is not verified by INTI or Google, so only share information you are comfortable showing to other users.</span>
                      </div>
                      
                      <div>
                        <label htmlFor="resume-input" className="block text-sm font-semibold text-gray-700 mb-1">Resume / About Me</label>
                        <textarea
                          id="resume-input"
                          rows={3}
                          value={resumeText}
                          onChange={(e) => setResumeText(e.target.value)}
                          placeholder="Introduce your academic background, experience or tutor achievements..."
                          className="w-full rounded-xl border border-border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-gray-800"
                        />
                      </div>

                      <div>
                        <label htmlFor="projects-input" className="block text-sm font-semibold text-gray-700 mb-1">Projects (one per line or description)</label>
                        <textarea
                          id="projects-input"
                          rows={3}
                          value={projectsText}
                          onChange={(e) => setProjectsText(e.target.value)}
                          placeholder="e.g. - My Calculus Tutor Bot: A Telegram chatbot resolving math tasks..."
                          className="w-full rounded-xl border border-border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-gray-800"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: Theme Selector */}
              {settingsTab === "theme" && (
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Accent Highlight Color</label>
                  <div className="grid grid-cols-2 gap-2">
                    {THEME_OPTIONS.map((opt) => {
                      const isSelected = themeColor === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => applyThemeColor(opt.value)}
                          className={`p-3 rounded-xl border text-sm font-bold flex items-center justify-between transition-all ${
                            isSelected 
                              ? "border-primary bg-red-50/10 text-primary" 
                              : "border-border bg-white text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: opt.value }}></span>
                            {opt.name}
                          </span>
                          {isSelected && <Check className="w-4 h-4 text-primary" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-3 justify-end mt-6 border-t pt-4">
                <Button type="button" variant="ghost" onClick={() => setShowSettingsModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={savingSettings} className="px-5">
                  {savingSettings ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Save Configuration
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAttachmentModal && (
        <AttachmentSwitcherModal
          listings={sellerListings}
          loading={listingsLoading}
          error={sellerListingsError}
          onClose={() => setShowAttachmentModal(false)}
          onSelectListing={handleSwitchListing}
        />
      )}

      <PromptModal
        isOpen={Boolean(promptConfig?.isOpen)}
        onClose={() => setPromptConfig(null)}
        title={promptConfig?.title || ""}
        description={promptConfig?.description}
        placeholder={promptConfig?.placeholder}
        onSubmit={promptConfig?.onSubmit || (async () => {})}
      />
    </div>
  );
}
