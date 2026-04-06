import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Link2, Plus, Trash2, Loader2, ExternalLink, Play } from "lucide-react";
import VideoPlayerDialog from "@/components/VideoPlayerDialog";

interface Props {
  campaignId: string;
  campaignTitle: string;
}

const CreatorPostedVideos = ({ campaignId, campaignTitle }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [acceptedSubs, setAcceptedSubs] = useState<any[]>([]);
  const [postedLinks, setPostedLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSub, setSelectedSub] = useState("");
  const [selectedEvent, setSelectedEvent] = useState("");
  const [links, setLinks] = useState<{ platform: string; url: string }[]>([{ platform: "", url: "" }]);
  const [submitting, setSubmitting] = useState(false);
  const [playingVideo, setPlayingVideo] = useState<{ url: string; title: string } | null>(null);
  const [expectedCount, setExpectedCount] = useState(0);
  const [campaignPlatforms, setCampaignPlatforms] = useState<string[]>([]);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleEvents, setScheduleEvents] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ data: subs }, { data: campData }, { data: events }] = await Promise.all([
        supabase.from("video_submissions").select("*").eq("creator_user_id", user.id).eq("campaign_id", campaignId).eq("status", "accepted"),
        supabase.from("campaigns").select("expected_video_count, platforms, posting_schedule_enabled").eq("id", campaignId).single(),
        supabase.from("posting_schedule").select("*").eq("campaign_id", campaignId).order("event_date"),
      ]);

      const accepted = subs || [];
      setAcceptedSubs(accepted);
      setExpectedCount((campData as any)?.expected_video_count || 0);
      setCampaignPlatforms((campData as any)?.platforms || []);
      setScheduleEnabled((campData as any)?.posting_schedule_enabled || false);
      setScheduleEvents(events || []);

      if (accepted.length > 0) {
        const subIds = accepted.map((s: any) => s.id);
        const { data: pl } = await supabase.from("posted_video_links").select("*").in("submission_id", subIds);
        setPostedLinks(pl || []);
      }
      setLoading(false);
    };
    load();
  }, [user, campaignId]);

  const availablePlatforms = campaignPlatforms.length > 0 ? campaignPlatforms : ["TikTok", "Instagram", "YouTube", "Facebook", "X (Twitter)", "Other"];

  const addLink = () => setLinks([...links, { platform: "", url: "" }]);
  const removeLink = (i: number) => setLinks(links.filter((_, idx) => idx !== i));
  const updateLink = (i: number, field: string, val: string) => {
    const updated = [...links];
    (updated[i] as any)[field] = val;
    setLinks(updated);
  };

  const handleSubmitLinks = async () => {
    if (!selectedSub) { toast({ title: "Select a submission", variant: "destructive" }); return; }
    const validLinks = links.filter(l => l.platform && l.url.trim());
    if (validLinks.length === 0) { toast({ title: "Add at least one link", variant: "destructive" }); return; }
    setSubmitting(true);
    const rows = validLinks.map(l => ({
      submission_id: selectedSub,
      platform: l.platform,
      url: l.url.trim(),
      ...(selectedEvent ? { schedule_event_id: selectedEvent } : {}),
    }));
    const { error } = await supabase.from("posted_video_links").insert(rows as any);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); setSubmitting(false); return; }

    const subIds = acceptedSubs.map((s: any) => s.id);
    const { data: pl } = await supabase.from("posted_video_links").select("*").in("submission_id", subIds);
    setPostedLinks(pl || []);
    setLinks([{ platform: "", url: "" }]); setSelectedSub(""); setSelectedEvent("");
    toast({ title: "Posted video links saved!" });
    setSubmitting(false);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  const linkMap: Record<string, any[]> = {};
  postedLinks.forEach((l: any) => { if (!linkMap[l.submission_id]) linkMap[l.submission_id] = []; linkMap[l.submission_id].push(l); });

  const postedCount = postedLinks.length;
  const videosRemaining = Math.max(0, expectedCount - acceptedSubs.length);

  // Group posted links by platform for display
  const allPostedByPlatform: Record<string, any[]> = {};
  postedLinks.forEach((l: any) => {
    if (!allPostedByPlatform[l.platform]) allPostedByPlatform[l.platform] = [];
    allPostedByPlatform[l.platform].push(l);
  });

  const getEventLabel = (eventId: string | null) => {
    if (!eventId) return null;
    const ev = scheduleEvents.find((e: any) => e.id === eventId);
    return ev ? `${new Date(ev.event_date).toLocaleDateString()} — ${ev.description}` : null;
  };

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 p-3 text-center">
          <p className="text-lg font-bold text-foreground">{acceptedSubs.length}</p>
          <p className="text-[11px] text-muted-foreground">Accepted Videos</p>
        </div>
        <div className="rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 p-3 text-center">
          <p className="text-lg font-bold text-foreground">{postedCount}</p>
          <p className="text-[11px] text-muted-foreground">Links Posted</p>
        </div>
        <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-3 text-center">
          <p className="text-lg font-bold text-foreground">{videosRemaining}</p>
          <p className="text-[11px] text-muted-foreground">Remaining</p>
        </div>
      </div>

      {acceptedSubs.length > 0 ? (
        <Card className="border-border/50">
          <CardHeader><CardTitle className="text-lg">Submit Posted Video Links</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedSub} onValueChange={setSelectedSub}>
              <SelectTrigger><SelectValue placeholder="Select accepted submission" /></SelectTrigger>
              <SelectContent>
                {acceptedSubs.map(s => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
              </SelectContent>
            </Select>

            {scheduleEnabled && scheduleEvents.length > 0 && (
              <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                <SelectTrigger><SelectValue placeholder="Link to schedule event (optional)" /></SelectTrigger>
                <SelectContent>
                  {scheduleEvents.map((ev: any) => (
                    <SelectItem key={ev.id} value={ev.id}>
                      {new Date(ev.event_date).toLocaleDateString()} — {ev.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {links.map((link, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Select value={link.platform} onValueChange={v => updateLink(i, "platform", v)}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Platform" /></SelectTrigger>
                  <SelectContent>{availablePlatforms.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
                <Input className="flex-1" placeholder="https://..." value={link.url} onChange={e => updateLink(i, "url", e.target.value)} />
                {links.length > 1 && <Button size="icon" variant="ghost" onClick={() => removeLink(i)}><Trash2 className="h-4 w-4" /></Button>}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addLink} className="gap-1"><Plus className="h-3.5 w-3.5" /> Add Platform</Button>
            <Button onClick={handleSubmitLinks} disabled={submitting} className="w-full gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Submit Links
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50 border-dashed">
          <CardContent className="py-12 text-center">
            <Link2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No accepted videos yet for this campaign.</p>
          </CardContent>
        </Card>
      )}

      {/* Posted links grouped by platform */}
      {Object.keys(allPostedByPlatform).length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Your Posted Links</h3>
          {Object.entries(allPostedByPlatform).map(([platform, pLinks]) => (
            <div key={platform} className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary">{platform}</Badge>
                <span className="text-xs text-muted-foreground">({pLinks.length})</span>
              </div>
              <div className="space-y-2">
                {pLinks.map((l: any) => {
                  const sub = acceptedSubs.find(s => s.id === l.submission_id);
                  const eventLabel = getEventLabel(l.schedule_event_id);
                  return (
                    <Card key={l.id} className="border-border/50">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">{sub?.title || "Video"}</p>
                            {eventLabel && <p className="text-[11px] text-muted-foreground">📅 {eventLabel}</p>}
                            <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate flex items-center gap-1 mt-0.5">
                              {l.url} <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          </div>
                          {sub?.video_url && (
                            <button onClick={() => setPlayingVideo({ url: sub.video_url, title: sub.title })} className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0">
                              <Play className="h-3 w-3" /> Watch
                            </button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <VideoPlayerDialog videoUrl={playingVideo?.url || null} title={playingVideo?.title} onClose={() => setPlayingVideo(null)} />
    </div>
  );
};

export default CreatorPostedVideos;
