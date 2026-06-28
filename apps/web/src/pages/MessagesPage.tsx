import { Check, CheckCheck, ExternalLink, Send, ShoppingBag } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { API_URL, api, mediaUrl } from "../api/client";
import { useAuth } from "../state/AuthContext";
import type { Conversation, Message } from "../types";

export function MessagesPage() {
  const { token, user } = useAuth();
  const [params] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState(params.get("conversation") ?? "");
  const [body, setBody] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const active = conversations.find((conversation) => conversation.id === activeId) ?? conversations[0];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const socket = useMemo<Socket | null>(() => {
    if (!token) return null;
    return io(API_URL || window.location.origin, { auth: { token } });
  }, [token]);

  useEffect(() => {
    api.get("/conversations").then((response) => {
      setConversations(response.data.conversations);
      if (!activeId && response.data.conversations.length > 0) {
        setActiveId(response.data.conversations[0].id);
      }
    });
  }, [activeId]);

  useEffect(() => {
    scrollToBottom();
  }, [active?.messages]);

  useEffect(() => {
    if (!socket || !active?.id) return;
    socket.emit("conversation:join", active.id);
    socket.on("message:new", (message: Message) => {
      setConversations((current) => current.map((conversation) => (
        conversation.id === active.id
          ? { ...conversation, messages: [...conversation.messages, message] }
          : conversation
      )));
    });
    return () => {
      socket.off("message:new");
    };
  }, [active?.id, socket]);

  function send(event: FormEvent) {
    event.preventDefault();
    if (!socket || !active || !body.trim()) return;
    socket.emit("message:send", { conversationId: active.id, body });
    setBody("");
  }

  const activeListingImage = active?.listing.images[0]?.url;
  const isBuyer = active?.buyer.id === user?.id;
  const partnerName = isBuyer ? active?.seller.name : active?.buyer.name;

  return (
    <div className="grid h-[calc(100vh-160px)] min-h-[500px] gap-6 lg:grid-cols-[340px_1fr] animate-fadeIn">
      {/* Sidebar: Conversations List */}
      <aside className="panel overflow-hidden flex flex-col shadow-sm bg-white border border-line/80">
        <div className="border-b border-line/60 p-4 bg-paper/60">
          <h1 className="text-xl font-extrabold text-ink">Campus Inbox</h1>
        </div>
        <div className="divide-y divide-line/40 overflow-y-auto flex-1">
          {conversations.map((conversation) => {
            const lastMsg = conversation.messages[conversation.messages.length - 1];
            const thumb = conversation.listing.images[0]?.url;
            const isSelected = conversation.id === active?.id;

            return (
              <button
                key={conversation.id}
                onClick={() => setActiveId(conversation.id)}
                className={`w-full p-4 text-left transition flex items-center gap-3 ${
                  isSelected ? "bg-campus/10 border-l-4 border-l-campus" : "hover:bg-paper/40"
                }`}
              >
                <div className="h-12 w-12 flex-shrink-0 rounded-lg overflow-hidden border border-line bg-white">
                  {thumb ? (
                    <img src={mediaUrl(thumb)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center bg-paper text-xs">📦</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-sm text-ink truncate block">{conversation.listing.title}</span>
                    <span className="text-[10px] font-semibold text-campus flex-shrink-0 ml-1">RM {Number(conversation.listing.price).toFixed(0)}</span>
                  </div>
                  <div className="text-xs font-semibold text-ink/70 truncate mt-0.5">
                    👤 {conversation.buyer.id === user?.id ? conversation.seller.name : conversation.buyer.name}
                  </div>
                  {lastMsg && (
                    <p className="text-xs text-ink/50 truncate mt-1">
                      {lastMsg.senderId === user?.id || lastMsg.sender.id === user?.id ? "You: " : ""}
                      {lastMsg.body}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
          {!conversations.length && (
            <div className="p-12 text-center text-sm text-ink/60">
              <ShoppingBag size={32} className="mx-auto mb-2 opacity-30" />
              <p className="font-semibold">No chats started yet</p>
              <p className="text-xs mt-1">Message a seller from the marketplace to start negotiating deals.</p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Chat Area */}
      <section className="panel flex flex-col overflow-hidden shadow-md bg-white border border-line/80">
        {active ? (
          <>
            {/* Pinned Listing Header */}
            <div className="border-b border-line/60 bg-gradient-to-r from-paper via-white to-paper p-3 sm:p-4 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-14 w-14 flex-shrink-0 rounded-lg overflow-hidden border border-line bg-white shadow-xs">
                  {activeListingImage ? (
                    <img src={mediaUrl(activeListingImage)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center bg-paper text-xs">📷</div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-campus/10 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-campus">
                      {active.listing.type}
                    </span>
                    <span className="text-xs font-bold text-ink/60 truncate">Chatting with {partnerName}</span>
                  </div>
                  <h2 className="text-base font-extrabold text-ink truncate mt-0.5">{active.listing.title}</h2>
                  <div className="text-xs font-bold text-campus mt-0.5">RM {Number(active.listing.price).toFixed(2)}</div>
                </div>
              </div>
              <Link
                to={`/listings/${active.listing.id}`}
                className="button-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 flex-shrink-0"
              >
                <span>View Item</span>
                <ExternalLink size={13} />
              </Link>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
              <div className="text-center my-2">
                <span className="rounded-full bg-line/40 px-3 py-1 text-[11px] font-semibold text-ink/60">
                  🔒 Safe Campus Chat · Meet in well-lit campus areas
                </span>
              </div>

              {active.messages.map((message) => {
                const isMe = message.sender.id === user?.id || message.senderId === user?.id;
                return (
                  <div key={message.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                    <div className="text-[10px] font-bold text-ink/50 mb-1 px-1">
                      {isMe ? "You" : message.sender.name}
                    </div>
                    <div
                      className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-xs ${
                        isMe
                          ? "bg-gradient-to-r from-campus to-lake text-white rounded-br-none font-medium"
                          : "bg-white text-ink border border-line/60 rounded-bl-none font-normal"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words leading-relaxed">{message.body}</p>
                      <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${isMe ? "text-white/80" : "text-ink/40"}`}>
                        <span>{new Date(message.createdAt || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        {isMe && (
                          <span title="Delivered">
                            <CheckCheck size={13} className="inline text-white" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form className="flex items-center gap-2 border-t border-line/60 p-3 sm:p-4 bg-white" onSubmit={send}>
              <input
                className="flex-1 rounded-full border-line/80 bg-paper px-4 py-2.5 text-sm focus:bg-white"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Negotiate price or arrange campus meetup..."
              />
              <button
                type="submit"
                disabled={!body.trim()}
                className="button-primary rounded-full h-10 w-10 p-0 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-campus to-lake shadow-sm"
                aria-label="Send message"
                title="Send message"
              >
                <Send size={17} />
              </button>
            </form>
          </>
        ) : (
          <div className="grid flex-1 place-items-center text-ink/50 bg-paper/20">
            <div className="text-center">
              <span className="text-4xl block mb-2">💬</span>
              <p className="font-bold text-base">Select a conversation</p>
              <p className="text-xs text-ink/40 mt-1">Choose a chat from the left sidebar to view message history.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
