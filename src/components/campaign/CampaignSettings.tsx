import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Settings, MessageCircle, Calendar, Loader2 } from "lucide-react";

interface Props {
  campaignId: string;
}

const CampaignSettings = ({ campaignId }: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [groupChatEnabled, setGroupChatEnabled] = useState(true);
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("campaigns").select("group_chat_enabled, posting_schedule_enabled").eq("id", campaignId).single().then(({ data }) => {
      if (data) {
        setGroupChatEnabled((data as any).group_chat_enabled ?? true);
        setScheduleEnabled((data as any).posting_schedule_enabled ?? true);
      }
      setLoading(false);
    });
  }, [campaignId]);

  const handleToggle = async (field: string, value: boolean) => {
    setSaving(true);
    const update: any = {};
    update[field] = value;
    await supabase.from("campaigns").update(update).eq("id", campaignId);
    toast({ title: "Setting updated" });
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <Card className="border-border/50">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <Label className="text-sm font-semibold text-foreground">Group Chat</Label>
                <p className="text-xs text-muted-foreground">When off, only private messages between you and each creator are available</p>
              </div>
            </div>
            <Switch
              checked={groupChatEnabled}
              onCheckedChange={(v) => {
                setGroupChatEnabled(v);
                handleToggle("group_chat_enabled", v);
              }}
              disabled={saving}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <Label className="text-sm font-semibold text-foreground">Posting Schedule</Label>
                <p className="text-xs text-muted-foreground">Show a posting schedule calendar to accepted creators</p>
              </div>
            </div>
            <Switch
              checked={scheduleEnabled}
              onCheckedChange={(v) => {
                setScheduleEnabled(v);
                handleToggle("posting_schedule_enabled", v);
              }}
              disabled={saving}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CampaignSettings;
