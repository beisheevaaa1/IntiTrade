import { Send } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { API_URL, api } from "../api/client";
import { useAuth } from "../state/AuthContext";
import type { Conversation, Message } from "../types";

export function MessagesPage() {
  const { token, user } = useAuth();
  const [params] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState(params.get("conversation") ?? "");
  const [body, setBody] = useState("");

  const active = conversations.find((conversation) => conversation.id === activeId) ?? conversations[0];

  const socket = useMemo<Socket | null>(() => {
    if (!token) return null;
    return io(API_URL || window.location.origin, { auth: { token } });
  }, [token]);

  useEffect(() => {
    api.get("/conversations").then((response) => {
      setConversations(response.data.conversations);
      if (!activeId) setActiveId(response.data.conversations[0]?.id ?? "");
    });
  }, [activeId]);

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
      socket.disconnect();
    };
  }, [active?.id, socket]);

  function send(event: FormEvent) {
    event.preventDefault();
    if (!socket || !active || !body.trim()) return;
    socket.emit("message:send", { conversationId: active.id, body });
    setBody("");
  }

  return (
    <div className="grid min-h-[70vh] gap-4 lg:grid-cols-[340px_1fr]">
      <aside className="panel overflow-hidden">
        <div className="border-b border-line p-4">
          <h1 className="text-xl font-semibold">Messages</h1>
        </div>
        <div className="divide-y divide-line">
          {conversations.map((conversation) => (
            <button key={conversation.id} onClick={() => setActiveId(conversation.id)} className={`w-full p-4 text-left hover:bg-white ${conversation.id === active?.id ? "bg-white" : ""}`}>
              <div className="font-semibold">{conversation.listing.title}</div>
              <div className="text-sm text-ink/60">{conversation.buyer.id === user?.id ? conversation.seller.name : conversation.buyer.name}</div>
            </button>
          ))}
          {!conversations.length && <div className="p-4 text-sm text-ink/60">No conversations yet.</div>}
        </div>
      </aside>
      <section className="panel flex min-h-[70vh] flex-col">
        {active ? (
          <>
            <div className="border-b border-line p-4">
              <p className="text-sm text-campus">{active.listing.type.toLowerCase()}</p>
              <h2 className="text-xl font-semibold">{active.listing.title}</h2>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {active.messages.map((message) => (
                <div key={message.id} className={`max-w-[80%] rounded-lg p-3 ${message.sender.id === user?.id || message.senderId === user?.id ? "ml-auto bg-campus text-white" : "bg-white"}`}>
                  <div className="text-xs opacity-70">{message.sender.name}</div>
                  <div>{message.body}</div>
                </div>
              ))}
            </div>
            <form className="flex gap-2 border-t border-line p-4" onSubmit={send}>
              <input className="flex-1" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write a message..." />
              <button className="button-primary" aria-label="Send message" title="Send message"><Send size={18} /></button>
            </form>
          </>
        ) : (
          <div className="grid flex-1 place-items-center text-ink/60">Select a conversation.</div>
        )}
      </section>
    </div>
  );
}
