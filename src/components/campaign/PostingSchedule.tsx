import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Plus, Trash2, Loader2, Edit2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDay } from "date-fns";

interface ScheduleEvent {
  id: string;
  campaign_id: string;
  event_date: string;
  description: string;
}

interface Props {
  campaignId: string;
  readOnly?: boolean;
}

const PostingSchedule = ({ campaignId, readOnly = false }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editEvent, setEditEvent] = useState<ScheduleEvent | null>(null);
  const [eventText, setEventText] = useState("");
  const [saving, setSaving] = useState(false);

  const loadEvents = async () => {
    const { data } = await supabase
      .from("posting_schedule")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("event_date");
    setEvents((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { loadEvents(); }, [campaignId]);

  const handleSave = async () => {
    if (!eventText.trim() || !selectedDate) return;
    setSaving(true);

    if (editEvent) {
      await supabase.from("posting_schedule").update({
        description: eventText.trim(),
        event_date: format(selectedDate, "yyyy-MM-dd"),
      } as any).eq("id", editEvent.id);
    } else {
      await supabase.from("posting_schedule").insert({
        campaign_id: campaignId,
        event_date: format(selectedDate, "yyyy-MM-dd"),
        description: eventText.trim(),
      } as any);
    }

    toast({ title: editEvent ? "Event updated" : "Event added" });
    setShowAdd(false);
    setEditEvent(null);
    setEventText("");
    await loadEvents();
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("posting_schedule").delete().eq("id", id);
    toast({ title: "Event removed" });
    loadEvents();
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);

  const getEventsForDate = (date: Date) =>
    events.filter(e => isSameDay(new Date(e.event_date + "T00:00:00"), date));

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>←</Button>
          <h3 className="font-heading font-bold text-foreground text-base">{format(currentMonth, "MMMM yyyy")}</h3>
          <Button variant="outline" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>→</Button>
        </div>
        {!readOnly && (
          <Button size="sm" className="gap-1.5" onClick={() => { setSelectedDate(new Date()); setEditEvent(null); setEventText(""); setShowAdd(true); }}>
            <Plus className="h-3.5 w-3.5" /> Add Event
          </Button>
        )}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border border-border">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
          <div key={d} className="bg-secondary/50 text-center text-[11px] font-bold text-muted-foreground py-2 uppercase tracking-wider">{d}</div>
        ))}
        {Array.from({ length: startDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="bg-background/50 min-h-[80px]" />
        ))}
        {days.map(day => {
          const dayEvents = getEventsForDate(day);
          const isToday = isSameDay(day, new Date());
          return (
            <div
              key={day.toISOString()}
              className={`bg-background min-h-[80px] p-1.5 transition-colors ${!readOnly ? "cursor-pointer hover:bg-secondary/30" : ""} ${isToday ? "ring-1 ring-inset ring-primary/30" : ""}`}
              onClick={() => {
                if (readOnly) return;
                setSelectedDate(day);
                setEditEvent(null);
                setEventText("");
                setShowAdd(true);
              }}
            >
              <p className={`text-xs font-medium mb-1 ${isToday ? "text-primary font-bold" : "text-foreground"}`}>
                {format(day, "d")}
              </p>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 2).map(ev => (
                  <div
                    key={ev.id}
                    className="text-[10px] leading-tight px-1 py-0.5 rounded bg-primary/10 text-primary truncate cursor-pointer hover:bg-primary/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (readOnly) return;
                      setSelectedDate(new Date(ev.event_date + "T00:00:00"));
                      setEditEvent(ev);
                      setEventText(ev.description);
                      setShowAdd(true);
                    }}
                    title={ev.description}
                  >
                    {ev.description}
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <p className="text-[10px] text-muted-foreground">+{dayEvents.length - 2} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Upcoming events list */}
      {events.length > 0 && (
        <div className="mt-6">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">All Events</h4>
          <div className="space-y-2">
            {events.map(ev => (
              <div key={ev.id} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50 border border-border/30">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Calendar className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{ev.description}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(ev.event_date + "T00:00:00"), "EEEE, MMMM d, yyyy")}</p>
                </div>
                {!readOnly && (
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => {
                      setSelectedDate(new Date(ev.event_date + "T00:00:00"));
                      setEditEvent(ev);
                      setEventText(ev.description);
                      setShowAdd(true);
                    }}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDelete(ev.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {events.length === 0 && (
        <div className="text-center py-8">
          <Calendar className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">
            {readOnly ? "No posting schedule set yet." : "Click on a date or 'Add Event' to create a posting schedule."}
          </p>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showAdd} onOpenChange={(o) => { if (!o) { setShowAdd(false); setEditEvent(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editEvent ? "Edit Event" : "Add Schedule Event"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Date</label>
              <Input
                type="date"
                value={selectedDate ? format(selectedDate, "yyyy-MM-dd") : ""}
                onChange={(e) => setSelectedDate(e.target.value ? new Date(e.target.value + "T00:00:00") : null)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Description</label>
              <Input
                value={eventText}
                onChange={(e) => setEventText(e.target.value)}
                placeholder="e.g. Post unboxing video on TikTok"
              />
            </div>
            <Button onClick={handleSave} disabled={saving || !eventText.trim() || !selectedDate} className="w-full gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
              {editEvent ? "Update Event" : "Add Event"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PostingSchedule;
