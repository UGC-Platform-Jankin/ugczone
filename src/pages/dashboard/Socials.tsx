import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Instagram, Facebook, Video, Users, Eye, Save, Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SocialForm {
  profile_url: string;
  followers_count: string;
  average_views: string;
}

const platforms = [
  { key: "instagram", name: "Instagram", icon: Instagram, placeholder: "https://instagram.com/yourhandle", color: "text-pink-400", bg: "bg-pink-500/10" },
  { key: "facebook", name: "Facebook", icon: Facebook, placeholder: "https://facebook.com/yourpage", color: "text-blue-400", bg: "bg-blue-500/10" },
  { key: "tiktok", name: "TikTok", icon: Video, placeholder: "https://tiktok.com/@yourhandle", color: "text-cyan-400", bg: "bg-cyan-500/10" },
] as const;

const emptyForm: SocialForm = { profile_url: "", followers_count: "", average_views: "" };

const Socials = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [forms, setForms] = useState<Record<string, SocialForm>>({
    instagram: { ...emptyForm },
    facebook: { ...emptyForm },
    tiktok: { ...emptyForm },
  });
  const [existingIds, setExistingIds] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchConnections = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("social_connections")
      .select("id, platform, profile_url, followers_count, average_views")
      .eq("user_id", user.id);

    if (data) {
      const newForms = { ...forms };
      const newIds: Record<string, string> = {};
      data.forEach((c) => {
        newForms[c.platform] = {
          profile_url: (c as any).profile_url || "",
          followers_count: c.followers_count?.toString() || "",
          average_views: c.average_views?.toString() || "",
        };
        newIds[c.platform] = c.id;
      });
      setForms(newForms);
      setExistingIds(newIds);
    }
    setLoading(false);
  };

  useEffect(() => { fetchConnections(); }, [user]);

  const updateField = (platform: string, field: keyof SocialForm, value: string) => {
    setForms((prev) => ({ ...prev, [platform]: { ...prev[platform], [field]: value } }));
  };

  const handleSave = async (platform: string) => {
    if (!user) return;
    setSaving(platform);
    const form = forms[platform];
    const followers = parseInt(form.followers_count) || 0;
    const views = parseInt(form.average_views) || 0;

    const row = {
      user_id: user.id,
      platform,
      profile_url: form.profile_url.trim(),
      followers_count: followers,
      average_views: views,
    };

    let error;
    if (existingIds[platform]) {
      ({ error } = await supabase.from("social_connections").update(row).eq("id", existingIds[platform]));
    } else {
      const { data, error: e } = await supabase.from("social_connections").insert(row).select("id").single();
      error = e;
      if (data) setExistingIds((prev) => ({ ...prev, [platform]: data.id }));
    }

    if (error) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${platform.charAt(0).toUpperCase() + platform.slice(1)} saved!` });
    }
    setSaving(null);
  };

  const handleRemove = async (platform: string) => {
    if (!existingIds[platform]) return;
    const { error } = await supabase.from("social_connections").delete().eq("id", existingIds[platform]);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setForms((prev) => ({ ...prev, [platform]: { ...emptyForm } }));
      setExistingIds((prev) => { const n = { ...prev }; delete n[platform]; return n; });
      toast({ title: "Removed" });
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
    if (num >= 1_000) return (num / 1_000).toFixed(1) + "K";
    return num.toString();
  };

  const totalFollowers = Object.values(forms).reduce((s, f) => s + (parseInt(f.followers_count) || 0), 0);
  const filledPlatforms = Object.values(forms).filter((f) => parseInt(f.average_views) > 0);
  const avgViews = filledPlatforms.length ? Math.round(filledPlatforms.reduce((s, f) => s + (parseInt(f.average_views) || 0), 0) / filledPlatforms.length) : 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-foreground">Your Socials</h1>
        <p className="text-muted-foreground mt-1">Add your social media profiles and stats to showcase your reach</p>
      </div>

      {totalFollowers > 0 && (
        <div className="grid grid-cols-2 gap-4 mb-8">
          <Card className="border-border/50">
            <CardContent className="p-4 flex flex-col items-center text-center gap-1">
              <Users className="h-5 w-5 text-primary mb-1" />
              <span className="text-2xl font-heading font-bold text-foreground">{formatNumber(totalFollowers)}</span>
              <span className="text-xs text-muted-foreground">Total Followers</span>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4 flex flex-col items-center text-center gap-1">
              <Eye className="h-5 w-5 text-primary mb-1" />
              <span className="text-2xl font-heading font-bold text-foreground">{formatNumber(avgViews)}</span>
              <span className="text-xs text-muted-foreground">Avg Views</span>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6">
        {platforms.map(({ key, name, icon: Icon, placeholder, color, bg }) => {
          const form = forms[key];
          const hasExisting = !!existingIds[key];
          const isSaving = saving === key;

          return (
            <Card key={key} className="border-border/50">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`h-10 w-10 rounded-full ${bg} flex items-center justify-center`}>
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                  <h3 className="font-heading font-semibold text-foreground">{name}</h3>
                </div>

                <div className="grid gap-4">
                  <div>
                    <Label htmlFor={`${key}-url`} className="text-muted-foreground text-sm">Profile Link</Label>
                    <Input
                      id={`${key}-url`}
                      placeholder={placeholder}
                      value={form.profile_url}
                      onChange={(e) => updateField(key, "profile_url", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`${key}-followers`} className="text-muted-foreground text-sm">Followers</Label>
                      <Input
                        id={`${key}-followers`}
                        type="number"
                        placeholder="e.g. 10000"
                        value={form.followers_count}
                        onChange={(e) => updateField(key, "followers_count", e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`${key}-views`} className="text-muted-foreground text-sm">Avg Views</Label>
                      <Input
                        id={`${key}-views`}
                        type="number"
                        placeholder="e.g. 5000"
                        value={form.average_views}
                        onChange={(e) => updateField(key, "average_views", e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => handleSave(key)} disabled={isSaving} size="sm">
                      {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                      {hasExisting ? "Update" : "Save"}
                    </Button>
                    {hasExisting && (
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleRemove(key)}>
                        <Trash2 className="h-4 w-4 mr-1" /> Remove
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default Socials;
