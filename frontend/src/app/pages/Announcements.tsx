import React, { useEffect, useState } from "react";
import { CalendarDays, MapPin, Megaphone, PlusCircle } from "lucide-react";
import { api, mediaUrl } from "../../api/client";
import { useAuth } from "../../state/AuthContext";
import type { Announcement } from "../../types";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";

export function Announcements() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [location, setLocation] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const load = () => api.get("/announcements").then((res) => setAnnouncements(res.data.announcements));
  useEffect(() => { void load(); }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post("/announcements", { title, body, imageUrl: imageUrl || null, location: location || null, eventDate: eventDate || null });
      setTitle(""); setBody(""); setLocation(""); setEventDate(""); setImageUrl(""); setShowForm(false);
      setNotice(user?.role === "ADMIN" ? "Announcement published." : "Announcement sent to the admin team for approval.");
      await load();
    } finally { setSaving(false); }
  };

  const uploadPoster = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    const response = await api.post("/uploads", form, { headers: { "Content-Type": "multipart/form-data" } });
    setImageUrl(response.data.url);
  };

  return (
    <div className="flex-1 bg-gray-50 py-10">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div><div className="flex items-center gap-2 text-primary font-semibold mb-2"><Megaphone className="w-5 h-5" /> Campus board</div><h1 className="text-3xl font-bold">Announcements & posters</h1><p className="text-muted-foreground mt-2">Events, student clubs, lost-and-found and useful campus updates—not commercial listings.</p></div>
          {user && <Button onClick={() => setShowForm(!showForm)} className="gap-2"><PlusCircle className="w-4 h-4" /> Post announcement</Button>}
        </div>

        {notice && <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-green-800">{notice}</div>}
        {showForm && (
          <Card className="mb-8"><CardContent className="p-6"><form onSubmit={submit} className="space-y-4">
            <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} minLength={4} required placeholder="Robotics club open day" /></div>
            <div><Label>Details</Label><Textarea value={body} onChange={(e) => setBody(e.target.value)} minLength={10} required className="min-h-28" placeholder="Tell the campus community what is happening." /></div>
            <div className="grid sm:grid-cols-2 gap-4"><div><Label>Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Student Centre" /></div><div><Label>Date and time</Label><Input type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} /></div></div>
            <div><Label>Poster image (optional)</Label><Input type="file" accept="image/*" onChange={uploadPoster} />{imageUrl && <img src={mediaUrl(imageUrl)} alt="Poster preview" className="mt-3 h-36 rounded-xl object-cover" />}</div>
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button><Button disabled={saving}>{saving ? "Submitting..." : "Submit for approval"}</Button></div>
          </form></CardContent></Card>
        )}

        {announcements.length === 0 ? <div className="text-center bg-white rounded-2xl border py-20 text-muted-foreground">No active announcements yet.</div> : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">{announcements.map((announcement) => <Card key={announcement.id} className="overflow-hidden">
            {announcement.imageUrl && <img src={mediaUrl(announcement.imageUrl)} alt="" className="w-full h-44 object-cover" />}
            <CardContent className="p-6"><p className="text-xs font-semibold text-primary mb-2">APPROVED CAMPUS ANNOUNCEMENT</p><h2 className="text-xl font-bold mb-2">{announcement.title}</h2><p className="text-sm text-muted-foreground whitespace-pre-line line-clamp-4">{announcement.body}</p><div className="mt-5 pt-4 border-t space-y-2 text-sm text-gray-600">{announcement.eventDate && <p className="flex gap-2"><CalendarDays className="w-4 h-4" /> {new Date(announcement.eventDate).toLocaleString()}</p>}{announcement.location && <p className="flex gap-2"><MapPin className="w-4 h-4" /> {announcement.location}</p>}<p>Posted by {announcement.author?.name}</p></div></CardContent>
          </Card>)}</div>
        )}
      </div>
    </div>
  );
}
