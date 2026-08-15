"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageSquare, Send, User, Search } from "lucide-react";
import { apiFetch } from "@/lib/api-config";
import { useRequiredSession } from "@/lib/session";
import { useLanguage } from "@/lib/LanguageContext";
import { cn } from "@/lib/utils";

export default function FarmerMessagesPage() {
  const { session } = useRequiredSession("fermier");
  const { lang, text } = useLanguage();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChat, setActiveChat] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState("");

  useEffect(() => {
    if (session) {
      apiFetch("/messages")
        .then(setMessages)
        .finally(() => setLoading(false));
    }
  }, [session]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage || !activeChat) return;

    try {
      const res = await apiFetch("/messages", {
        method: "POST",
        body: JSON.stringify({
          receiver_id: activeChat,
          content: newMessage
        })
      });
      setMessages([res, ...messages]);
      setNewMessage("");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <DashboardLayout 
      title={lang === "fr" ? "Messagerie" : "Ubutumwa"} 
      subtitle={lang === "fr" ? "Discutez avec vos acheteurs" : "Kuyaga n'abakiriya"}
    >
      <Card className="h-[calc(100vh-220px)] overflow-hidden flex flex-col md:flex-row rounded-3xl border-sidebar-border">
        {/* Sidebar chats */}
        <div className="w-full md:w-80 border-r border-sidebar-border flex flex-col bg-accent/5">
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Rechercher..." className="pl-9 rounded-xl h-10 bg-background" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-center py-10 text-sm text-muted-foreground">Aucune conversation.</p>
            ) : (
              // Group messages by user (simulated logic)
              <div className="divide-y divide-sidebar-border">
                {Array.from(new Set(messages.map(m => m.sender_id === session?.userId ? m.receiver_id : m.sender_id))).map((uid: any) => (
                  <button
                    key={uid}
                    onClick={() => setActiveChat(uid)}
                    className={cn(
                      "w-full p-4 flex items-center gap-3 hover:bg-accent/50 transition-colors text-left",
                      activeChat === uid && "bg-accent"
                    )}
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <User className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">Acheteur #{uid}</p>
                      <p className="text-xs text-muted-foreground truncate">Dernier message...</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col bg-background">
          {activeChat ? (
            <>
              <div className="p-4 border-b flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <User className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm">Acheteur #{activeChat}</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages
                  .filter(m => m.sender_id === activeChat || m.receiver_id === activeChat)
                  .map(m => (
                    <div
                      key={m.id}
                      className={cn(
                        "max-w-[80%] p-3 rounded-2xl text-sm",
                        m.sender_id === session?.userId
                          ? "ml-auto bg-primary text-primary-foreground rounded-tr-none"
                          : "mr-auto bg-accent text-accent-foreground rounded-tl-none"
                      )}
                    >
                      {m.content}
                      <p className="text-[10px] mt-1 opacity-70">
                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  ))}
              </div>
              <div className="p-4 border-t">
                <form onSubmit={handleSend} className="flex gap-2">
                  <Input 
                    placeholder="Votre message..." 
                    className="rounded-xl h-11"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                  />
                  <Button type="submit" size="icon" className="h-11 w-11 shrink-0 rounded-xl">
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
              <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
              <p>Sélectionnez une conversation pour commencer à discuter.</p>
            </div>
          )}
        </div>
      </Card>
    </DashboardLayout>
  );
}
