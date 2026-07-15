import { type FormEvent, useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Clock3, LifeBuoy, Loader2, MessageSquareText, Send } from "lucide-react";
import { api } from "../../api/client";
import type { Pagination, SupportTicket, SupportTicketCategory, SupportTicketMessage, SupportTicketStatus } from "../../types";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";

const categories: Array<{ value: SupportTicketCategory; label: string }> = [
  { value: "ACCOUNT", label: "Account & login" },
  { value: "LISTING", label: "Listing or moderation" },
  { value: "TRANSACTION", label: "Transaction or trade" },
  { value: "SAFETY", label: "Safety concern" },
  { value: "TECHNICAL", label: "Technical problem" },
  { value: "OTHER", label: "Other" }
];

const statusLabels: Record<SupportTicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  WAITING_FOR_USER: "Waiting for you",
  RESOLVED: "Resolved",
  CLOSED: "Closed"
};

function statusStyle(status: SupportTicketStatus) {
  if (status === "RESOLVED" || status === "CLOSED") return "bg-green-100 text-green-800 border-green-200";
  if (status === "WAITING_FOR_USER") return "bg-amber-100 text-amber-800 border-amber-200";
  if (status === "IN_PROGRESS") return "bg-blue-100 text-blue-800 border-blue-200";
  return "bg-red-50 text-primary border-red-200";
}

type ConversationState = {
  loading: boolean;
  messages: SupportTicketMessage[];
  pagination?: Pagination;
  error?: string;
};

export function Support() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sendingReplyId, setSendingReplyId] = useState<string | null>(null);
  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [category, setCategory] = useState<SupportTicketCategory>("TECHNICAL");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Record<string, ConversationState>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  const loadTickets = useCallback(async (requestedPage: number) => {
    setLoading(true);
    setPageError("");
    try {
      const response = await api.get("/support", { params: { page: requestedPage, limit: 20 } });
      setTickets(response.data.tickets || []);
      setPagination(response.data.pagination || { page: requestedPage, limit: 20, total: 0, totalPages: 1 });
    } catch {
      setPageError("We could not load your support requests. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadTickets(page); }, [loadTickets, page]);

  useEffect(() => {
    const refresh = () => { void loadTickets(page); };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [loadTickets, page]);

  const loadConversation = async (ticketId: string, messagePage = 1, append = false) => {
    if (!append && conversations[ticketId]?.messages.length) return;
    setConversations((current) => ({ ...current, [ticketId]: { loading: true, messages: append ? current[ticketId]?.messages || [] : [] } }));
    try {
      const response = await api.get(`/support/${ticketId}/messages`, { params: { page: messagePage, limit: 100 } });
      setConversations((current) => ({
        ...current,
        [ticketId]: { loading: false, messages: append ? [...(response.data.messages || []), ...(current[ticketId]?.messages || [])] : response.data.messages || [], pagination: response.data.pagination }
      }));
    } catch {
      setConversations((current) => ({
        ...current,
        [ticketId]: { loading: false, messages: [], error: "The conversation could not be loaded." }
      }));
    }
  };

  const toggleConversation = (ticketId: string) => {
    const nextId = openTicketId === ticketId ? null : ticketId;
    setOpenTicketId(nextId);
    if (nextId) void loadConversation(nextId);
  };

  const submitTicket = async (event: FormEvent) => {
    event.preventDefault();
    setFormError("");
    setSuccess("");
    setSubmitting(true);
    try {
      const response = await api.post("/support", { category, subject, description });
      setSubject("");
      setDescription("");
      setCategory("TECHNICAL");
      setSuccess("Your request was sent. Support will reply here and notify you when it is updated.");
      if (page === 1) {
        setTickets((current) => [response.data.ticket, ...current].slice(0, 20));
        setPagination((current) => ({ ...current, total: current.total + 1, totalPages: Math.max(1, Math.ceil((current.total + 1) / current.limit)) }));
      } else {
        setPage(1);
      }
    } catch (requestError: any) {
      setFormError(requestError.response?.data?.message || "Your support request could not be sent. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const sendReply = async (ticket: SupportTicket) => {
    const body = replyDrafts[ticket.id]?.trim();
    if (!body) return;
    setSendingReplyId(ticket.id);
    try {
      const response = await api.post(`/support/${ticket.id}/messages`, { body });
      setConversations((current) => ({
        ...current,
        [ticket.id]: {
          loading: false,
          messages: [...(current[ticket.id]?.messages || []), response.data.message],
          pagination: current[ticket.id]?.pagination
        }
      }));
      setReplyDrafts((current) => ({ ...current, [ticket.id]: "" }));
      setTickets((current) => current.map((item) => item.id === ticket.id ? {
        ...item,
        status: (["WAITING_FOR_USER", "RESOLVED"] as SupportTicketStatus[]).includes(item.status) ? "OPEN" : item.status,
        lastMessageAt: response.data.message.createdAt,
        _count: { messages: (item._count?.messages || 0) + 1 }
      } : item));
    } catch (requestError: any) {
      setConversations((current) => ({
        ...current,
        [ticket.id]: {
          loading: false,
          messages: current[ticket.id]?.messages || [],
          pagination: current[ticket.id]?.pagination,
          error: requestError.response?.data?.message || "Your reply could not be sent."
        }
      }));
    } finally {
      setSendingReplyId(null);
    }
  };

  return (
    <div className="flex-1 bg-gray-50 py-8 sm:py-12">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-primary font-bold text-sm mb-2"><LifeBuoy className="w-4 h-4" /> INTITRADE SUPPORT</div>
          <h1 className="text-3xl font-extrabold text-foreground">How can we help?</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">Send a private request about your account, a listing, a transaction, or a technical issue. Only you and the support team can see it.</p>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-6 items-start">
          <Card className="bg-white border-border shadow-sm lg:sticky lg:top-28">
            <CardHeader><CardTitle className="text-xl">New support request</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={submitTicket} className="space-y-4">
                <div>
                  <label htmlFor="support-category" className="text-sm font-semibold text-gray-800 block mb-1.5">What do you need help with?</label>
                  <select id="support-category" value={category} onChange={(event) => setCategory(event.target.value as SupportTicketCategory)} className="w-full h-11 rounded-lg border border-input bg-white px-3 text-sm">
                    {categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="support-subject" className="text-sm font-semibold text-gray-800 block mb-1.5">Subject</label>
                  <Input id="support-subject" value={subject} onChange={(event) => setSubject(event.target.value)} minLength={4} maxLength={160} required placeholder="Briefly describe the problem" />
                </div>
                <div>
                  <div className="flex justify-between gap-3 mb-1.5"><label htmlFor="support-description" className="text-sm font-semibold text-gray-800">Details</label><span className="text-xs text-muted-foreground">{description.length}/5000</span></div>
                  <Textarea id="support-description" value={description} onChange={(event) => setDescription(event.target.value)} minLength={10} maxLength={5000} required rows={7} placeholder="Tell us what happened, what you expected, and any error message you saw. Do not include passwords or payment details." />
                </div>
                {formError && <div role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{formError}</div>}
                {success && <div role="status" className="flex gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800"><CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />{success}</div>}
                <Button type="submit" disabled={submitting} className="w-full gap-2 rounded-xl">{submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}{submitting ? "Sending…" : "Send request"}</Button>
              </form>
            </CardContent>
          </Card>

          <section aria-labelledby="support-history-title" className="space-y-4 min-w-0">
            <div className="flex items-center justify-between gap-3"><h2 id="support-history-title" className="text-xl font-bold">Your requests</h2>{!loading && <span className="text-sm text-muted-foreground">{pagination.total} total</span>}</div>
            {pageError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{pageError}</div>}
            {loading ? (
              <div className="bg-white border rounded-2xl py-16 flex justify-center"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
            ) : tickets.length === 0 ? (
              <div className="bg-white border border-dashed rounded-2xl py-14 px-6 text-center"><LifeBuoy className="w-10 h-10 text-gray-300 mx-auto mb-3" /><p className="font-semibold text-gray-800">No support requests yet</p><p className="text-sm text-muted-foreground mt-1">New requests and replies will appear here.</p></div>
            ) : tickets.map((ticket) => {
              const conversation = conversations[ticket.id];
              const isOpen = openTicketId === ticket.id;
              return (
                <Card key={ticket.id} className="bg-white border-border shadow-sm overflow-hidden">
                  <CardContent className="p-5 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2"><Badge variant="outline" className={statusStyle(ticket.status)}>{statusLabels[ticket.status]}</Badge><Badge variant="outline" className="bg-gray-50">{categories.find((item) => item.value === ticket.category)?.label || ticket.category}</Badge></div>
                        <h3 className="font-bold text-lg break-words">{ticket.subject}</h3>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Clock3 className="w-3.5 h-3.5" /> Opened {new Date(ticket.createdAt).toLocaleString()} · #{ticket.id.slice(0, 8).toUpperCase()}</p>
                      </div>
                    </div>
                    {!isOpen && <p className="mt-4 text-sm text-gray-700 line-clamp-3 whitespace-pre-wrap break-words">{ticket.description}</p>}
                    <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={() => toggleConversation(ticket.id)} aria-expanded={isOpen}><MessageSquareText className="w-4 h-4" />{isOpen ? "Hide conversation" : `View conversation (${ticket._count?.messages || 1})`}</Button>

                    {isOpen && <div className="mt-5 border-t pt-5">
                      {conversation?.loading ? <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div> : conversation?.error && conversation.messages.length === 0 ? <p role="alert" className="text-sm text-red-700">{conversation.error}</p> : <div className="space-y-3">
                        {(conversation?.messages || []).map((message) => <div key={message.id} className={`flex ${message.isAdmin ? "justify-start" : "justify-end"}`}><div className={`max-w-[88%] rounded-2xl px-4 py-3 ${message.isAdmin ? "bg-blue-50 border border-blue-100 text-blue-950" : "bg-primary text-white"}`}><p className="text-xs font-semibold mb-1 opacity-75">{message.isAdmin ? message.author?.name || "IntiTrade Support" : "You"}</p><p className="text-sm whitespace-pre-wrap break-words">{message.body}</p><p className="text-[10px] mt-2 opacity-70">{new Date(message.createdAt).toLocaleString()}</p></div></div>)}
                        {conversation?.pagination && conversation.pagination.page < conversation.pagination.totalPages && <div className="text-center"><Button variant="outline" size="sm" disabled={conversation.loading} onClick={() => loadConversation(ticket.id, conversation.pagination!.page + 1, true)}>{conversation.loading ? "Loading…" : "Load older messages"}</Button></div>}
                      </div>}
                      {conversation?.error && conversation.messages.length > 0 && <p role="alert" className="text-sm text-red-700 mt-3">{conversation.error}</p>}
                      {ticket.status !== "CLOSED" ? <div className="mt-4 space-y-2"><Textarea value={replyDrafts[ticket.id] || ""} onChange={(event) => setReplyDrafts((current) => ({ ...current, [ticket.id]: event.target.value }))} maxLength={5000} rows={3} placeholder="Add a reply…" aria-label={`Reply to ${ticket.subject}`} /><div className="flex justify-end"><Button size="sm" className="gap-2" disabled={sendingReplyId === ticket.id || !(replyDrafts[ticket.id]?.trim())} onClick={() => sendReply(ticket)}>{sendingReplyId === ticket.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Send reply</Button></div></div> : <p className="text-sm text-muted-foreground mt-4">This ticket is closed. Create a new request if you still need help.</p>}
                    </div>}
                  </CardContent>
                </Card>
              );
            })}

            {pagination.totalPages > 1 && <div className="flex items-center justify-center gap-3 pt-2"><Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft className="w-4 h-4" /> Previous</Button><span className="text-sm text-muted-foreground">Page {pagination.page} of {pagination.totalPages}</span><Button variant="outline" size="sm" disabled={page >= pagination.totalPages || loading} onClick={() => setPage((current) => current + 1)}>Next <ChevronRight className="w-4 h-4" /></Button></div>}
          </section>
        </div>
      </div>
    </div>
  );
}
