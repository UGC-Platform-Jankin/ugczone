import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Video, Play } from "lucide-react";
import VideoPlayerDialog from "@/components/VideoPlayerDialog";

interface Props {
  campaignId: string;
}

const BrandVideos = ({ campaignId }: Props) => {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [creators, setCreators] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [playingVideo, setPlayingVideo] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      // Load all submissions (all statuses — prize pool auto-accepts)
      const { data: subs } = await supabase
        .from("video_submissions")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false });

      setSubmissions(subs || []);

      // Load creator profiles
      const creatorIds = [...new Set((subs || []).map((s: any) => s.creator_user_id))];
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("*").in("user_id", creatorIds);
        const map: Record<string, any> = {};
        (profiles || []).forEach((p: any) => { map[p.user_id] = p; });
        setCreators(map);
      }

      setLoading(false);
    };
    load();
  }, [campaignId]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">All Submitted Videos</h2>
        <Badge>{submissions.length} video{submissions.length !== 1 ? "s" : ""}</Badge>
      </div>

      {submissions.length === 0 ? (
        <Card className="border-border/50 border-dashed">
          <CardContent className="py-12 text-center">
            <Video className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No videos submitted yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {submissions.map((sub: any) => {
            const creator = creators[sub.creator_user_id];
            return (
              <Card key={sub.id} className="border-border/50">
                <CardContent className="p-4 flex items-center gap-4">
                  <button
                    onClick={() => setPlayingVideo({ url: sub.video_url, title: sub.title })}
                    className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/80 shrink-0"
                  >
                    <Play className="h-5 w-5 text-foreground" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{sub.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={creator?.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px]">{(creator?.display_name || "?")[0]}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground">{creator?.display_name || "Unknown"}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">{new Date(sub.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Auto-Accepted</Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <VideoPlayerDialog videoUrl={playingVideo?.url || null} title={playingVideo?.title} onClose={() => setPlayingVideo(null)} />
    </div>
  );
};

export default BrandVideos;
