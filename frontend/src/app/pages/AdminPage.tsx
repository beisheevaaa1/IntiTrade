import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { 
  Shield, 
  Package, 
  Users, 
  ShoppingBag, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Search, 
  ArrowLeft, 
  Loader2, 
  Lock, 
  Unlock,
  GraduationCap,
  Star,
  Megaphone,
  LifeBuoy,
  Activity,
  ScrollText,
  RefreshCw
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { useAuth } from "../../state/AuthContext";
import { useToast } from "../../state/ToastContext";
import { api, mediaUrl } from "../../api/client";
import type { User, Listing, Report, Transaction, Announcement, Pagination, SupportTicket, SupportTicketMessage, SupportTicketPriority, SupportTicketStatus } from "../../types";

const isVideoUrl = (url: string) => /\.(mp4|mov|webm|ogg)$/i.test(url);

export function AdminPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast, confirm } = useToast();
  
  type AdminTab = "moderation" | "students" | "transactions" | "reports" | "reviews" | "announcements" | "disputes" | "support" | "audit" | "system";
  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    return requested === "support" || requested === "audit" || requested === "system" ? requested : "moderation";
  });
  
  // Data States
  const [pendingListings, setPendingListings] = useState<Listing[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [disputes, setDisputes] = useState<Transaction[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [supportDrafts, setSupportDrafts] = useState<Record<string, { status: SupportTicketStatus; priority: SupportTicketPriority; reply: string }>>({});
  const [supportConversations, setSupportConversations] = useState<Record<string, { loading: boolean; messages: SupportTicketMessage[]; pagination?: Pagination; error?: string }>>({});
  const [openSupportTicketId, setOpenSupportTicketId] = useState<string | null>(null);
  const [supportPagination, setSupportPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [supportPage, setSupportPage] = useState(1);
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportOpenCount, setSupportOpenCount] = useState(0);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPagination, setAuditPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [auditSearch, setAuditSearch] = useState("");
  const [auditFilter, setAuditFilter] = useState("");
  const [systemSnapshot, setSystemSnapshot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Rejection Dialog State
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [promptConfig, setPromptConfig] = useState<any>(null);
  
  // Filter & Sort States
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedFaculty, setSelectedFaculty] = useState("ALL");
  const [selectedGroup, setSelectedGroup] = useState("ALL"); // e.g. "inti_i000001" to "inti_i000005"
  
  const [listingSearch, setListingSearch] = useState("");
  const [supportSearch, setSupportSearch] = useState("");
  const [supportStatusFilter, setSupportStatusFilter] = useState<SupportTicketStatus | "ALL">("ALL");
  const [supportPriorityFilter, setSupportPriorityFilter] = useState<SupportTicketPriority | "ALL">("ALL");

  const fetchData = async (tab: AdminTab) => {
    setLoading(true);
    try {
      if (tab === "moderation") {
        const response = await api.get("/admin/listings");
        setPendingListings((response.data.listings || []).filter((listing: Listing) => listing.status === "PENDING"));
      } else if (tab === "students") {
        const response = await api.get("/admin/users");
        setStudents((response.data.users || []).filter((student: User) => student.role === "STUDENT"));
      } else if (tab === "transactions") {
        const response = await api.get("/admin/transactions");
        setTransactions(response.data.transactions || []);
      } else if (tab === "disputes") {
        const response = await api.get("/admin/disputes");
        setDisputes(response.data.disputes || []);
      } else if (tab === "reports") {
        const response = await api.get("/admin/reports");
        setReports(response.data.reports || []);
      } else if (tab === "reviews") {
        const response = await api.get("/admin/reviews");
        setReviews(response.data.reviews || []);
      } else if (tab === "announcements") {
        const response = await api.get("/admin/announcements");
        setAnnouncements(response.data.announcements || []);
      } else if (tab === "audit") {
        const response = await api.get("/admin/logs", { params: { page: auditPage, limit: 25, action: auditFilter || undefined } });
        setAuditLogs(response.data.logs || []);
        setAuditPagination(response.data.pagination || { page: auditPage, limit: 25, total: 0, totalPages: 1 });
      } else if (tab === "system") {
        const response = await api.get("/admin/system");
        setSystemSnapshot(response.data);
      }
    } catch (err) {
      console.error("Error fetching admin data:");
    } finally {
      setLoading(false);
    }
  };

  const fetchSupportData = async () => {
    setSupportLoading(true);
    try {
      const response = await api.get("/support/admin", {
        params: {
          page: supportPage,
          limit: 20,
          q: supportSearch.trim() || undefined,
          status: supportStatusFilter === "ALL" ? undefined : supportStatusFilter,
          priority: supportPriorityFilter === "ALL" ? undefined : supportPriorityFilter
        }
      });
      const tickets: SupportTicket[] = response.data.tickets || [];
      setSupportTickets(tickets);
      setSupportOpenCount(response.data.openCount || 0);
      setSupportPagination(response.data.pagination || { page: supportPage, limit: 20, total: 0, totalPages: 1 });
      setSupportDrafts((current) => Object.fromEntries(tickets.map((ticket) => [ticket.id, {
        status: ticket.status,
        priority: ticket.priority,
        reply: current[ticket.id]?.reply || ""
      }])));
    } catch (err) {
      console.error("Error fetching support tickets:");
    } finally {
      setSupportLoading(false);
    }
  };

  useEffect(() => {
    // Only admins can see this page
    if (!user) {
      navigate("/login");
      return;
    }
    if (user && user.role !== "ADMIN") {
      navigate("/");
      return;
    }
    void fetchData(activeTab);
  }, [user, navigate, activeTab, auditPage, auditFilter]);

  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    api.get("/admin/overview").then((response) => setSupportOpenCount(response.data.openSupportTickets || 0)).catch(() => undefined);
  }, [user?.id]);

  useEffect(() => {
    if (user?.role !== "ADMIN" || activeTab !== "support") return;
    const timer = window.setTimeout(() => { void fetchSupportData(); }, 250);
    return () => window.clearTimeout(timer);
  }, [user?.id, activeTab, supportPage, supportSearch, supportStatusFilter, supportPriorityFilter]);

  const handleApprove = async (id: string) => {
    setActionLoading(true);
    try {
      await api.patch(`/admin/listings/${id}/status`, { status: "ACTIVE" });
      setPendingListings(pendingListings.filter(l => l.id !== id));
      toast.success("Listing approved successfully!");
    } catch (err) {
      console.error("Request failed");
      toast.error("Action failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingId || !rejectionReason.trim()) return;

    setActionLoading(true);
    try {
      await api.patch(`/admin/listings/${rejectingId}/status`, {
        status: "REJECTED",
        rejectionReason: rejectionReason.trim()
      });
      setPendingListings(pendingListings.filter(l => l.id !== rejectingId));
      setRejectingId(null);
      setRejectionReason("");
      toast.success("Listing rejected.");
    } catch (err) {
      console.error("Request failed");
      toast.error("Action failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleBlock = (studentId: string, currentlyBlocked: boolean) => {
    confirm({
      title: `${currentlyBlocked ? 'Unblock' : 'Block'} Student?`,
      description: `Are you sure you want to ${currentlyBlocked ? 'unblock' : 'block'} this student?`,
      variant: currentlyBlocked ? "success" : "destructive",
      confirmText: currentlyBlocked ? "Unblock Student" : "Proceed to Reason",
      onConfirm: async () => {
        if (currentlyBlocked) {
          try {
            await api.patch(`/admin/users/${studentId}/block`, { isBlocked: false });
            setStudents(students.map(s => s.id === studentId ? { ...s, isBlocked: false } : s));
            toast.success("User unblocked.");
          } catch (err) {
            console.error("Request failed");
            toast.error("Failed to update user block status.");
          }
          return;
        }
        setPromptConfig({
          isOpen: true,
          title: "Block User (Admin Action)",
          description: "Please provide a reason for blocking this student.",
          placeholder: "e.g., Repeated spam, scam behavior, prohibited listings...",
          onSubmit: async (reason: string) => {
            try {
              await api.patch(`/admin/users/${studentId}/block`, { isBlocked: true, reason });
              setStudents(students.map(s => s.id === studentId ? { ...s, isBlocked: true } : s));
              toast.success("User blocked.");
            } catch (err) {
              console.error("Request failed");
              toast.error("Failed to update user block status.");
            }
          }
        });
      }
    });
  };

  const handleDismissReport = async (reportId: string) => {
    try {
      await api.patch(`/admin/reports/${reportId}`, { status: "DISMISSED" });
      setReports(reports.map(r => r.id === reportId ? { ...r, status: "DISMISSED" as any } : r));
      toast.success("Report dismissed.");
    } catch (err) {
      console.error("Request failed");
      toast.error("Action failed.");
    }
  };

  const moderateAnnouncement = async (id: string, status: "ACTIVE" | "REJECTED") => {
    if (status === "REJECTED") {
      setPromptConfig({
        isOpen: true,
        title: "Reject Announcement",
        description: "Why is this announcement being rejected?",
        placeholder: "Provide feedback for the student...",
        onSubmit: async (rejectionReason: string) => {
          await api.patch(`/admin/announcements/${id}/status`, { status: "REJECTED", rejectionReason });
          setAnnouncements((current) => current.map((announcement) => announcement.id === id ? { ...announcement, status: "REJECTED", rejectionReason } : announcement));
        }
      });
      return;
    }
    await api.patch(`/admin/announcements/${id}/status`, { status });
    setAnnouncements((current) => current.map((announcement) => announcement.id === id ? { ...announcement, status } : announcement));
  };

  const handleResolveDispute = async (id: string, verdict: "COMPLETED" | "CANCELLED") => {
    setPromptConfig({
      isOpen: true,
      title: `Resolve Dispute as ${verdict}`,
      description: "Please provide the official admin resolution note:",
      placeholder: "Explain the final decision for buyer and seller...",
      onSubmit: async (reason: string) => {
        setActionLoading(true);
        try {
          await api.patch(`/admin/disputes/${id}/resolve`, { verdict, reason });
          setDisputes(disputes.filter(d => d.id !== id));
          toast.success(`Dispute resolved as ${verdict}`);
        } catch (err: any) {
          console.error("Request failed");
          toast.error(err.response?.data?.message || "Action failed.");
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  const loadSupportConversation = async (ticketId: string, page = 1, append = false) => {
    setSupportConversations((current) => ({
      ...current,
      [ticketId]: {
        loading: true,
        messages: append ? current[ticketId]?.messages || [] : [],
        pagination: current[ticketId]?.pagination
      }
    }));
    try {
      const response = await api.get(`/support/admin/${ticketId}/messages`, { params: { page, limit: 100 } });
      setSupportConversations((current) => ({
        ...current,
        [ticketId]: {
          loading: false,
          messages: append ? [...(response.data.messages || []), ...(current[ticketId]?.messages || [])] : response.data.messages || [],
          pagination: response.data.pagination
        }
      }));
    } catch {
      setSupportConversations((current) => ({
        ...current,
        [ticketId]: {
          loading: false,
          messages: current[ticketId]?.messages || [],
          pagination: current[ticketId]?.pagination,
          error: "The ticket conversation could not be loaded."
        }
      }));
    }
  };

  const toggleSupportConversation = (ticketId: string) => {
    const next = openSupportTicketId === ticketId ? null : ticketId;
    setOpenSupportTicketId(next);
    if (next && !supportConversations[next]?.messages.length) void loadSupportConversation(next);
  };

  const updateSupportTicket = async (ticketId: string) => {
    const draft = supportDrafts[ticketId];
    if (!draft) return;
    setActionLoading(true);
    try {
      const reply = draft.reply.trim();
      const response = await api.patch(`/support/admin/${ticketId}`, {
        status: draft.status,
        priority: draft.priority,
        ...(reply ? { reply } : {})
      });
      const updated: SupportTicket = response.data.ticket;
      setSupportTickets((current) => current.map((ticket) => ticket.id === ticketId ? updated : ticket));
      setSupportDrafts((current) => ({
        ...current,
        [ticketId]: { status: updated.status, priority: updated.priority, reply: "" }
      }));
      if (reply && openSupportTicketId === ticketId) await loadSupportConversation(ticketId);
      toast.success("Support ticket updated.");
    } catch (err: any) {
      console.error("Request failed");
      toast.error(err.response?.data?.message || "Support ticket update failed.");
    } finally {
      setActionLoading(false);
    }
  };

  // Group students by ID range for easier demo/admin filtering.
  const getStudentGroup = (email: string) => {
    const match = email.match(/inti_i(\d+)/);
    if (!match) return "Other";
    const num = parseInt(match[1]);
    if (num <= 3) return "Group Alpha (i000001 - i000003)";
    if (num <= 6) return "Group Beta (i000004 - i000006)";
    return "Group Gamma (i000007 - i000010)";
  };

  // Filter students
  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(studentSearch.toLowerCase()) || 
                          s.email.toLowerCase().includes(studentSearch.toLowerCase());
    const matchesFaculty = selectedFaculty === "ALL" || s.faculty === selectedFaculty;
    
    let matchesGroup = true;
    if (selectedGroup !== "ALL") {
      const group = getStudentGroup(s.email);
      matchesGroup = group.includes(selectedGroup);
    }

    return matchesSearch && matchesFaculty && matchesGroup;
  });

  const facultiesList = Array.from(new Set(students.map(s => s.faculty).filter(Boolean)));

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-24 bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="bg-gray-50 flex-grow pb-16">
      <div className="container mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-primary font-bold text-sm mb-1">
              <Shield className="w-4 h-4" /> INTI Campus Moderation
            </div>
            <h1 className="text-3xl font-extrabold text-foreground">Admin Control Panel</h1>
          </div>
          <Button variant="outline" onClick={() => navigate("/")} className="gap-2 bg-white">
            <ArrowLeft className="w-4 h-4" /> Back to Store
          </Button>
        </div>

        {/* Tab Navigation */}
        <div className="flex overflow-x-auto border-b border-border bg-white rounded-xl p-2 gap-2 shadow-sm mb-8">
          <button 
            onClick={() => setActiveTab("moderation")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all whitespace-nowrap ${
              activeTab === "moderation" ? "bg-primary text-white" : "hover:bg-gray-100 text-gray-600"
            }`}
          >
            <Package className="w-4 h-4" /> Moderation Queue
            {pendingListings.length > 0 && (
              <Badge className="bg-red-200 text-red-800 ml-1 font-bold">{pendingListings.length}</Badge>
            )}
          </button>
          
          <button 
            onClick={() => setActiveTab("students")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all whitespace-nowrap ${
              activeTab === "students" ? "bg-primary text-white" : "hover:bg-gray-100 text-gray-600"
            }`}
          >
            <Users className="w-4 h-4" /> Student Management
          </button>
          
          <button 
            onClick={() => setActiveTab("transactions")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all whitespace-nowrap ${
              activeTab === "transactions" ? "bg-primary text-white" : "hover:bg-gray-100 text-gray-600"
            }`}
          >
            <ShoppingBag className="w-4 h-4" /> Transaction Logs
          </button>

          <button 
            onClick={() => setActiveTab("reports")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all whitespace-nowrap ${
              activeTab === "reports" ? "bg-primary text-white" : "hover:bg-gray-100 text-gray-600"
            }`}
          >
            <AlertTriangle className="w-4 h-4" /> User Reports
            {reports.filter(r => r.status === "OPEN").length > 0 && (
              <Badge className="bg-red-200 text-red-800 ml-1 font-bold">
                {reports.filter(r => r.status === "OPEN").length}
              </Badge>
            )}
          </button>
          <button onClick={() => setActiveTab("reviews")} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all whitespace-nowrap ${activeTab === "reviews" ? "bg-primary text-white" : "hover:bg-gray-100 text-gray-600"}`}>
            <Star className="w-4 h-4" /> Ratings & trust
          </button>
          <button onClick={() => setActiveTab("announcements")} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all whitespace-nowrap ${activeTab === "announcements" ? "bg-primary text-white" : "hover:bg-gray-100 text-gray-600"}`}>
            <Megaphone className="w-4 h-4" /> Announcements
            {announcements.filter((announcement) => announcement.status === "PENDING").length > 0 && <Badge className="bg-red-200 text-red-800">{announcements.filter((announcement) => announcement.status === "PENDING").length}</Badge>}
          </button>
          <button onClick={() => setActiveTab("support")} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all whitespace-nowrap ${activeTab === "support" ? "bg-primary text-white" : "hover:bg-gray-100 text-gray-600"}`}>
            <LifeBuoy className="w-4 h-4" /> Customer Support
            {supportOpenCount > 0 && <Badge className="bg-red-200 text-red-800">{supportOpenCount}</Badge>}
          </button>
          <button 
            onClick={() => setActiveTab("disputes")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all whitespace-nowrap ${
              activeTab === "disputes" ? "bg-primary text-white" : "hover:bg-gray-100 text-gray-600"
            }`}
          >
            <AlertTriangle className="w-4 h-4" /> Trade Disputes
            {disputes.length > 0 && (
              <Badge className="bg-red-200 text-red-800 ml-1 font-bold">{disputes.length}</Badge>
            )}
          </button>
          <button onClick={() => setActiveTab("audit")} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all whitespace-nowrap ${activeTab === "audit" ? "bg-primary text-white" : "hover:bg-gray-100 text-gray-600"}`}>
            <ScrollText className="w-4 h-4" /> Audit Log
          </button>
          <button onClick={() => setActiveTab("system")} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all whitespace-nowrap ${activeTab === "system" ? "bg-primary text-white" : "hover:bg-gray-100 text-gray-600"}`}>
            <Activity className="w-4 h-4" /> System Health
          </button>
        </div>

        {/* Tab Contents */}
        
        {/* 1. Moderation Queue */}
        {activeTab === "moderation" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Pending Review ({pendingListings.length})</h2>
            
            {pendingListings.length === 0 ? (
              <div className="bg-white text-center py-12 rounded-2xl border border-border shadow-sm text-muted-foreground">
                No listings require moderation. All caught up!
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {pendingListings.map(item => (
                  <Card key={item.id} className="bg-white border-border shadow-sm overflow-hidden flex flex-col h-full">
                    <CardHeader className="bg-gray-50/50 border-b border-border py-4 flex flex-row items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar className="w-8 h-8 border">
                          <AvatarFallback className="text-xs font-bold">US</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-xs font-semibold text-gray-900">{item.seller?.name}</p>
                          <p className="text-[10px] text-muted-foreground">{item.seller?.email}</p>
                        </div>
                      </div>
                      <Badge variant="outline">{item.type}</Badge>
                    </CardHeader>
                    
                    <CardContent className="p-6 flex-1 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start gap-4">
                          <h3 className="font-bold text-lg text-foreground">{item.title}</h3>
                          <span className="text-primary font-bold text-lg whitespace-nowrap">RM {parseFloat(item.price).toFixed(2)}</span>
                        </div>
                        <div className="rounded-2xl border border-border bg-gray-50 p-3">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <p className="text-xs font-bold uppercase tracking-wide text-gray-600">Listing media</p>
                            <span className="text-[11px] text-muted-foreground">{item.images?.length || 0} file{item.images?.length === 1 ? "" : "s"}</span>
                          </div>
                          {item.images?.length ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {item.images.map((image, index) => {
                                const src = mediaUrl(image.url);
                                return (
                                  <a
                                    key={image.id || image.url}
                                    href={src}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-white"
                                    title={`Open media ${index + 1}`}
                                  >
                                    {isVideoUrl(image.url) ? (
                                      <video src={src} className="w-full h-full object-cover" muted playsInline />
                                    ) : (
                                      <img src={src} alt={`${item.title} media ${index + 1}`} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                    )}
                                    <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                                      {index === 0 ? "Cover" : `#${index + 1}`}
                                    </span>
                                  </a>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-8 text-xs text-muted-foreground">
                              No media uploaded for this listing.
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-3">{item.description}</p>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p><strong>Campus Location:</strong> {item.location}</p>
                          <p><strong>Meetup Preference:</strong> {item.meetupPreference || "Not specified"}</p>
                        </div>
                      </div>

                      <div className="flex gap-3 mt-6 border-t pt-4">
                        <Button 
                          onClick={() => handleApprove(item.id)}
                          disabled={actionLoading}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl h-10 gap-1.5"
                        >
                          <CheckCircle className="w-4 h-4" /> Approve
                        </Button>
                        <Button 
                          onClick={() => setRejectingId(item.id)}
                          disabled={actionLoading}
                          variant="destructive"
                          className="flex-1 font-semibold rounded-xl h-10 gap-1.5"
                        >
                          <XCircle className="w-4 h-4" /> Reject
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Rejection Modal/Form */}
        {rejectingId && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border">
              <h3 className="font-bold text-lg text-foreground mb-2 flex items-center gap-2">
                <AlertTriangle className="text-primary w-5 h-5" /> Reject Listing
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Please provide a clear reason for rejecting this listing. The seller will see this in their dashboard.
              </p>
              
              <form onSubmit={handleRejectSubmit} className="space-y-4">
                <Input 
                  placeholder="e.g. Inappropriate item description, duplication..." 
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full h-11"
                />
                
                <div className="flex gap-3 justify-end">
                  <Button type="button" variant="ghost" onClick={() => { setRejectingId(null); setRejectionReason(""); }}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="destructive" disabled={actionLoading}>
                    Confirm Reject
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 2. Student Management */}
        {activeTab === "students" && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white p-4 rounded-xl border shadow-sm">
              <div className="relative flex-1 max-w-md w-full">
                <Input 
                  placeholder="Search students by name or email..." 
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full pl-10"
                />
                <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              </div>
              
              <div className="flex flex-wrap gap-3">
                <select
                  value={selectedFaculty}
                  onChange={(e) => setSelectedFaculty(e.target.value)}
                  className="h-10 px-3 bg-white border border-border rounded-lg text-sm text-gray-700"
                >
                  <option value="ALL">All Faculties</option>
                  {facultiesList.map(fac => (
                    <option key={fac} value={fac || ""}>{fac}</option>
                  ))}
                </select>

                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  className="h-10 px-3 bg-white border border-border rounded-lg text-sm text-gray-700"
                >
                  <option value="ALL">All Groups</option>
                  <option value="Alpha">Group Alpha (i000001 - i000003)</option>
                  <option value="Beta">Group Beta (i000004 - i000006)</option>
                  <option value="Gamma">Group Gamma (i000007 - i000010)</option>
                </select>
              </div>
            </div>

            <Card className="bg-white border-border shadow-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-border text-gray-700 font-semibold">
                        <th className="p-4">Student Name</th>
                        <th className="p-4">INTI Email</th>
                        <th className="p-4">Faculty</th>
                        <th className="p-4">Group</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-muted-foreground">
                            No students match the criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map(student => (
                          <tr key={student.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="p-4 font-semibold text-gray-900">{student.name}</td>
                            <td className="p-4 font-mono text-xs">{student.email}</td>
                            <td className="p-4 text-gray-600">{student.faculty || "Not set"}</td>
                            <td className="p-4">
                              <Badge variant="outline" className="bg-gray-50 border-gray-200">
                                {getStudentGroup(student.email)}
                              </Badge>
                            </td>
                            <td className="p-4">
                              {student.isBlocked ? (
                                <Badge variant="destructive" className="bg-red-100 text-red-800 border-none font-bold">BLOCKED</Badge>
                              ) : (
                                <Badge className="bg-green-100 text-green-800 border-none font-bold">ACTIVE</Badge>
                              )}
                            </td>
                            <td className="p-4 text-right">
                              <Button 
                                onClick={() => handleToggleBlock(student.id, student.isBlocked)}
                                variant={student.isBlocked ? "default" : "outline"}
                                size="sm"
                                className="rounded-lg gap-1"
                              >
                                {student.isBlocked ? (
                                  <>
                                    <Unlock className="w-3.5 h-3.5" /> Unblock
                                  </>
                                ) : (
                                  <>
                                    <Lock className="w-3.5 h-3.5" /> Block
                                  </>
                                )}
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 3. Transaction Logs */}
        {activeTab === "transactions" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Fake Purchase History (Deals Done)</h2>
            <Card className="bg-white border-border shadow-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-border text-gray-700 font-semibold">
                        <th className="p-4">Listing Item</th>
                        <th className="p-4">Seller</th>
                        <th className="p-4">Buyer</th>
                        <th className="p-4">Transaction Price</th>
                        <th className="p-4">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {transactions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-muted-foreground">
                            No deals made yet.
                          </td>
                        </tr>
                      ) : (
                        transactions.map(tx => (
                          <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="p-4 font-semibold text-gray-900">{tx.listing?.title}</td>
                            <td className="p-4">
                              <p className="font-medium text-gray-900">{tx.seller?.name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">{tx.seller?.email}</p>
                            </td>
                            <td className="p-4">
                              <p className="font-medium text-gray-900">{tx.buyer?.name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">{tx.buyer?.email}</p>
                            </td>
                            <td className="p-4 font-bold text-primary">RM {parseFloat(tx.price).toFixed(2)}</td>
                            <td className="p-4 text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "reviews" && (
          <div className="space-y-6">
            <div><h2 className="text-xl font-bold text-gray-900">Ratings & marketplace trust</h2><p className="text-sm text-muted-foreground">Reviews are linked to completed transactions. Block accounts from here when a pattern needs intervention.</p></div>
            <div className="space-y-3">{reviews.length === 0 ? <div className="bg-white rounded-2xl border p-10 text-center text-muted-foreground">No reviews yet.</div> : reviews.map((review) => <Card key={review.id}><CardContent className="p-5 flex flex-col md:flex-row gap-4 md:items-center"><div className="flex-1"><div className="flex gap-1 mb-2">{Array.from({ length: 5 }).map((_, index) => <Star key={index} className={`w-4 h-4 ${index < review.rating ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />)}</div><p className="font-semibold">{review.transaction?.listing?.title}</p><p className="text-sm text-muted-foreground">{review.reviewer?.name} reviewed {review.reviewee?.name}</p>{review.comment && <p className="text-sm mt-2">“{review.comment}”</p>}</div><Button variant={review.reviewee?.isBlocked ? "default" : "outline"} onClick={() => handleToggleBlock(review.reviewee.id, review.reviewee.isBlocked)}>{review.reviewee?.isBlocked ? "Unblock user" : "Block user"}</Button></CardContent></Card>)}</div>
          </div>
        )}

        {activeTab === "announcements" && (
          <div className="space-y-6">
            <div><h2 className="text-xl font-bold text-gray-900">Announcement approval</h2><p className="text-sm text-muted-foreground">Keep the campus board useful and non-commercial.</p></div>
            <div className="grid md:grid-cols-2 gap-5">{announcements.map((announcement: any) => <Card key={announcement.id}><CardContent className="p-6"><div className="flex justify-between gap-3"><div><Badge variant="outline">{announcement.status}</Badge><h3 className="font-bold text-lg mt-2">{announcement.title}</h3></div><span className="text-xs text-muted-foreground">{announcement.author?.name}</span></div><p className="text-sm text-gray-600 mt-3 whitespace-pre-line">{announcement.body}</p>{announcement.status === "PENDING" && <div className="flex gap-2 mt-5 pt-4 border-t"><Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => moderateAnnouncement(announcement.id, "ACTIVE")}>Approve</Button><Button className="flex-1" variant="destructive" onClick={() => moderateAnnouncement(announcement.id, "REJECTED")}>Reject</Button></div>}</CardContent></Card>)}</div>
          </div>
        )}

        {activeTab === "support" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Customer support tickets</h2>
              <p className="text-sm text-muted-foreground">Private conversations between users and the support team. Replies and administrative changes are recorded in the ticket history.</p>
            </div>

            <div className="bg-white border rounded-xl p-4 grid sm:grid-cols-3 gap-3 shadow-sm">
              <div className="relative sm:col-span-1">
                <Input value={supportSearch} onChange={(event) => { setSupportSearch(event.target.value); setSupportPage(1); }} placeholder="Search subject, user, or email…" className="pl-9" />
                <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              </div>
              <select value={supportStatusFilter} onChange={(event) => { setSupportStatusFilter(event.target.value as SupportTicketStatus | "ALL"); setSupportPage(1); }} className="h-10 px-3 bg-white border border-border rounded-lg text-sm">
                <option value="ALL">All statuses</option>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="WAITING_FOR_USER">Waiting for user</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>
              <select value={supportPriorityFilter} onChange={(event) => { setSupportPriorityFilter(event.target.value as SupportTicketPriority | "ALL"); setSupportPage(1); }} className="h-10 px-3 bg-white border border-border rounded-lg text-sm">
                <option value="ALL">All priorities</option>
                <option value="LOW">Low priority</option>
                <option value="NORMAL">Normal priority</option>
                <option value="HIGH">High priority</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            {supportLoading ? <div className="bg-white border rounded-2xl py-14 flex justify-center"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div> : supportTickets.length === 0 ? <div className="bg-white border rounded-2xl py-12 text-center text-muted-foreground">No support tickets match these filters.</div> : <div className="space-y-4">
              {supportTickets.map((ticket) => {
                const draft = supportDrafts[ticket.id] || { status: ticket.status, priority: ticket.priority, reply: "" };
                const conversation = supportConversations[ticket.id];
                const isOpen = openSupportTicketId === ticket.id;
                return <Card key={ticket.id} className="bg-white border-border shadow-sm">
                  <CardContent className="p-5 sm:p-6 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-2 mb-2"><Badge variant="outline">{ticket.status.replaceAll("_", " ")}</Badge><Badge variant="outline" className={ticket.priority === "URGENT" ? "bg-red-100 text-red-800" : ticket.priority === "HIGH" ? "bg-amber-100 text-amber-800" : "bg-gray-50"}>{ticket.priority}</Badge><Badge variant="outline" className="bg-gray-50">{ticket.category}</Badge></div>
                        <h3 className="font-bold text-lg break-words">{ticket.subject}</h3>
                        <p className="text-xs text-muted-foreground mt-1">#{ticket.id.slice(0, 8).toUpperCase()} · Opened {new Date(ticket.createdAt).toLocaleString()}</p>
                        <p className="text-sm mt-2"><span className="font-semibold">{ticket.user?.name}</span> <span className="text-muted-foreground">({ticket.user?.email})</span></p>
                      </div>
                      {ticket.assignedAdmin && <p className="text-xs text-muted-foreground whitespace-nowrap">Assigned to {ticket.assignedAdmin.name}</p>}
                    </div>

                    <div className="bg-gray-50 rounded-xl border p-4"><p className="text-xs font-semibold text-muted-foreground mb-1">ORIGINAL REQUEST</p><p className="text-sm whitespace-pre-wrap break-words">{ticket.description}</p></div>

                    <Button variant="outline" size="sm" onClick={() => toggleSupportConversation(ticket.id)} className="gap-2"><LifeBuoy className="w-4 h-4" />{isOpen ? "Hide conversation" : `View conversation (${ticket._count?.messages || 1})`}</Button>
                    {isOpen && <div className="border rounded-xl p-4 bg-gray-50/50 space-y-3">
                      {conversation?.loading && conversation.messages.length === 0 ? <div className="py-6 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div> : (conversation?.messages || []).map((message) => <div key={message.id} className={`flex ${message.isAdmin ? "justify-end" : "justify-start"}`}><div className={`max-w-[90%] rounded-2xl px-4 py-3 ${message.isAdmin ? "bg-primary text-white" : "bg-white border"}`}><p className="text-xs font-semibold opacity-70 mb-1">{message.isAdmin ? `${message.author?.name || "Former administrator"} · Support` : message.author?.name || "Former user"}</p><p className="text-sm whitespace-pre-wrap break-words">{message.body}</p><p className="text-[10px] opacity-60 mt-2">{new Date(message.createdAt).toLocaleString()}</p></div></div>)}
                      {conversation?.error && <p className="text-sm text-red-700">{conversation.error}</p>}
                      {conversation?.pagination && conversation.pagination.page < conversation.pagination.totalPages && <div className="text-center"><Button variant="outline" size="sm" disabled={conversation.loading} onClick={() => loadSupportConversation(ticket.id, conversation.pagination!.page + 1, true)}>{conversation.loading ? "Loading…" : "Load older messages"}</Button></div>}
                    </div>}

                    <div className="grid sm:grid-cols-2 gap-3">
                      <div><label className="text-xs font-semibold text-gray-700 block mb-1">Status</label><select value={draft.status} onChange={(event) => setSupportDrafts((current) => ({ ...current, [ticket.id]: { ...draft, status: event.target.value as SupportTicketStatus } }))} className="w-full h-10 px-3 bg-white border rounded-lg text-sm"><option value="OPEN">Open</option><option value="IN_PROGRESS">In progress</option><option value="WAITING_FOR_USER">Waiting for user</option><option value="RESOLVED">Resolved</option><option value="CLOSED">Closed</option></select></div>
                      <div><label className="text-xs font-semibold text-gray-700 block mb-1">Priority</label><select value={draft.priority} onChange={(event) => setSupportDrafts((current) => ({ ...current, [ticket.id]: { ...draft, priority: event.target.value as SupportTicketPriority } }))} className="w-full h-10 px-3 bg-white border rounded-lg text-sm"><option value="LOW">Low</option><option value="NORMAL">Normal</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></select></div>
                    </div>
                    <div><label className="text-xs font-semibold text-gray-700 block mb-1">Reply to user</label><Textarea rows={4} maxLength={5000} value={draft.reply} onChange={(event) => setSupportDrafts((current) => ({ ...current, [ticket.id]: { ...draft, reply: event.target.value } }))} placeholder="Write a clear response. Do not request passwords or payment details." /></div>
                    <div className="flex justify-end"><Button disabled={actionLoading} onClick={() => updateSupportTicket(ticket.id)}>{actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Save update</Button></div>
                  </CardContent>
                </Card>;
              })}
            </div>}

            {supportPagination.totalPages > 1 && <div className="flex justify-center items-center gap-3"><Button variant="outline" size="sm" disabled={supportPage <= 1 || supportLoading} onClick={() => setSupportPage((current) => Math.max(1, current - 1))}>Previous</Button><span className="text-sm text-muted-foreground">Page {supportPagination.page} of {supportPagination.totalPages} · {supportPagination.total} tickets</span><Button variant="outline" size="sm" disabled={supportPage >= supportPagination.totalPages || supportLoading} onClick={() => setSupportPage((current) => current + 1)}>Next</Button></div>}
          </div>
        )}

        {activeTab === "audit" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Administrator Audit Log</h2>
              <p className="mt-1 text-sm text-muted-foreground">Immutable moderation history with actor, request ID, reason, and safe before/after values.</p>
            </div>
            <form className="flex flex-col gap-3 rounded-xl border bg-white p-4 sm:flex-row" onSubmit={(event) => { event.preventDefault(); setAuditPage(1); setAuditFilter(auditSearch.trim()); }}>
              <Input value={auditSearch} onChange={(event) => setAuditSearch(event.target.value)} placeholder="Filter by action, e.g. USER_BLOCK" className="max-w-md" />
              <Button type="submit" variant="outline">Apply filter</Button>
              {auditFilter && <Button type="button" variant="ghost" onClick={() => { setAuditSearch(""); setAuditFilter(""); setAuditPage(1); }}>Clear</Button>}
            </form>
            {auditLogs.length === 0 ? (
              <div className="rounded-2xl border bg-white py-12 text-center text-muted-foreground">No audit events match this filter.</div>
            ) : (
              <div className="space-y-3">
                {auditLogs.map((log) => (
                  <Card key={log.id} className="bg-white">
                    <CardContent className="p-5">
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                        <div>
                          <div className="flex flex-wrap items-center gap-2"><Badge>{log.action}</Badge><Badge variant="outline">{log.entityType}</Badge></div>
                          <p className="mt-2 text-sm font-semibold">{log.admin?.name || log.actorEmail || "Deleted administrator"}</p>
                          <p className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()} · Entity {log.entityId}</p>
                        </div>
                        {log.requestId && <code className="break-all rounded bg-gray-100 px-2 py-1 text-[10px]">{log.requestId}</code>}
                      </div>
                      {log.reason && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><strong>Reason:</strong> {log.reason}</p>}
                      {(log.before || log.after) && <details className="mt-3 text-xs"><summary className="cursor-pointer font-semibold text-muted-foreground">View safe change snapshot</summary><pre className="mt-2 overflow-x-auto rounded-lg bg-gray-950 p-3 text-gray-100">{JSON.stringify({ before: log.before, after: log.after }, null, 2)}</pre></details>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            {auditPagination.totalPages > 1 && <div className="flex items-center justify-center gap-3"><Button variant="outline" size="sm" disabled={auditPage <= 1} onClick={() => setAuditPage((page) => Math.max(1, page - 1))}>Previous</Button><span className="text-sm text-muted-foreground">Page {auditPagination.page} of {auditPagination.totalPages} · {auditPagination.total} events</span><Button variant="outline" size="sm" disabled={auditPage >= auditPagination.totalPages} onClick={() => setAuditPage((page) => page + 1)}>Next</Button></div>}
          </div>
        )}

        {activeTab === "system" && (
          <div className="space-y-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div><h2 className="text-xl font-bold text-gray-900">System Health</h2><p className="mt-1 text-sm text-muted-foreground">Live process, database, request, memory, socket, and recent safe error signals.</p></div>
              <Button variant="outline" className="gap-2" onClick={() => void fetchData("system")}><RefreshCw className="h-4 w-4" />Refresh</Button>
            </div>
            {!systemSnapshot ? <div className="rounded-2xl border bg-white py-12 text-center text-muted-foreground">System information is unavailable.</div> : <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card><CardContent className="p-5"><p className="text-xs font-semibold text-muted-foreground">READINESS</p><p className={`mt-2 text-2xl font-bold ${systemSnapshot.readiness?.ready ? "text-green-700" : "text-red-700"}`}>{systemSnapshot.readiness?.ready ? "Ready" : "Unavailable"}</p><p className="text-xs text-muted-foreground">Database: {systemSnapshot.readiness?.database}</p></CardContent></Card>
                <Card><CardContent className="p-5"><p className="text-xs font-semibold text-muted-foreground">REQUESTS</p><p className="mt-2 text-2xl font-bold">{systemSnapshot.monitoring?.requests?.total || 0}</p><p className="text-xs text-muted-foreground">Average {systemSnapshot.monitoring?.requests?.averageDurationMs || 0} ms</p></CardContent></Card>
                <Card><CardContent className="p-5"><p className="text-xs font-semibold text-muted-foreground">MEMORY</p><p className="mt-2 text-2xl font-bold">{systemSnapshot.monitoring?.memory?.rssMb || 0} MB</p><p className="text-xs text-muted-foreground">Heap {systemSnapshot.monitoring?.memory?.heapUsedMb || 0} MB</p></CardContent></Card>
                <Card><CardContent className="p-5"><p className="text-xs font-semibold text-muted-foreground">LIVE CHAT</p><p className="mt-2 text-2xl font-bold">{systemSnapshot.monitoring?.sockets?.activeConnections || 0}</p><p className="text-xs text-muted-foreground">{systemSnapshot.monitoring?.sockets?.messagesSent || 0} messages this process</p></CardContent></Card>
              </div>
              <Card><CardHeader><CardTitle className="text-lg">Recent safe errors</CardTitle></CardHeader><CardContent>{(systemSnapshot.monitoring?.recentErrors || []).length === 0 ? <p className="text-sm text-muted-foreground">No recent errors recorded by this process.</p> : <div className="space-y-2">{systemSnapshot.monitoring.recentErrors.map((error: any) => <div key={`${error.requestId}-${error.occurredAt}`} className="rounded-lg border p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><span className="font-semibold">{error.method} {error.path}</span><span className="text-xs text-muted-foreground">{new Date(error.occurredAt).toLocaleString()}</span></div><p className="mt-1 text-red-700">{error.message}</p><code className="mt-1 block break-all text-[10px] text-muted-foreground">{error.requestId}</code></div>)}</div>}</CardContent></Card>
            </>}
          </div>
        )}

        {/* User Reports */}
        {activeTab === "reports" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Safety Reports ({reports.length})</h2>
            
            {reports.length === 0 ? (
              <div className="bg-white text-center py-12 rounded-2xl border border-border shadow-sm text-muted-foreground">
                No safety reports submitted. Campus is safe!
              </div>
            ) : (
              <div className="space-y-4">
                {reports.map(report => (
                  <Card key={report.id} className="bg-white border-border shadow-sm overflow-hidden">
                    <CardContent className="p-6 space-y-4">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                          <Badge variant="destructive" className="mb-2 bg-red-100 text-red-800 border-none font-bold">
                            {report.status}
                          </Badge>
                          <h3 className="font-bold text-lg text-foreground">
                            Reported approved version: {report.listing?.title || "Listing unavailable"}
                          </h3>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                            {report.listing?.isSnapshot && <Badge variant="outline">Immutable snapshot</Badge>}
                            {report.listing?.id && <Link to={`/product/${report.listing.id}`} className="text-primary hover:underline">Open current listing for comparison</Link>}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Submitted by: <span className="font-semibold text-gray-700">{report.reporter?.name}</span> ({report.reporter?.email})
                          </p>
                        </div>
                        {report.status === "OPEN" && (
                          <Button 
                            onClick={() => handleDismissReport(report.id)}
                            variant="outline" 
                            size="sm"
                            className="rounded-lg h-9 border-gray-300"
                          >
                            Dismiss Report
                          </Button>
                        )}
                      </div>

                      <div className="bg-gray-50 border p-4 rounded-xl space-y-2">
                        <p className="text-sm"><strong>Reason:</strong> {report.reason}</p>
                        {report.details && (
                          <p className="text-xs text-gray-600"><strong>Additional details:</strong> {report.details}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 7. Trade Disputes */}
        {activeTab === "disputes" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Active Trade Disputes ({disputes.length})</h2>
            
            {disputes.length === 0 ? (
              <div className="bg-white text-center py-12 rounded-2xl border border-border shadow-sm text-muted-foreground">
                No active disputes. All transactions running smoothly!
              </div>
            ) : (
              <div className="space-y-4">
                {disputes.map(dispute => (
                  <Card key={dispute.id} className="bg-white border-border shadow-sm overflow-hidden">
                    <CardContent className="p-6 space-y-4">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                          <Badge className="mb-2 bg-amber-100 text-amber-800 border-none font-bold">
                            DISPUTED
                          </Badge>
                          <h3 className="font-bold text-lg text-foreground">
                            Listing: {dispute.listing?.title}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            Seller: <span className="font-semibold text-gray-700">{dispute.seller?.name}</span> ({dispute.seller?.email}) · 
                            Buyer: <span className="font-semibold text-gray-700">{dispute.buyer?.name}</span> ({dispute.buyer?.email})
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Price: <strong>RM {parseFloat(dispute.price).toFixed(2)}</strong> · Date: {new Date(dispute.createdAt).toLocaleString()}
                          </p>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button 
                            onClick={() => handleResolveDispute(dispute.id, "COMPLETED")}
                            disabled={actionLoading}
                            className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg"
                          >
                            Release Funds (Complete)
                          </Button>
                          <Button 
                            onClick={() => handleResolveDispute(dispute.id, "CANCELLED")}
                            disabled={actionLoading}
                            variant="destructive"
                            className="text-xs font-bold rounded-lg"
                          >
                            Cancel Transaction
                          </Button>
                        </div>
                      </div>

                      <div className="bg-amber-50/50 border border-amber-100 p-4 rounded-xl">
                        <p className="text-sm text-amber-900"><strong>Dispute Reason:</strong> {dispute.disputeReason || "No reason provided."}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
