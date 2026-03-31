import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Clock, DollarSign } from "lucide-react";

interface Campaign {
  id: string;
  title: string;
  description: string | null;
  budget: number | null;
  platforms: string[] | null;
  campaign_length_days: number | null;
  status: string;
  price_per_video: number | null;
  is_free_product: boolean;
  target_regions: string[] | null;
}

const Gigs = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCampaigns = async () => {
      const { data } = await supabase
        .from("campaigns")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      setCampaigns((data as any) || []);
      setLoading(false);
    };
    fetchCampaigns();
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-foreground">Available Gigs</h1>
        <p className="text-muted-foreground mt-1">Browse and apply to brand campaigns</p>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-border/50 animate-pulse">
              <CardHeader><div className="h-6 bg-muted rounded w-3/4" /><div className="h-4 bg-muted rounded w-1/2 mt-2" /></CardHeader>
            </Card>
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <Card className="border-border/50 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-16 w-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
              <Briefcase className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-heading font-semibold text-foreground mb-1">No gigs available yet</h3>
            <p className="text-muted-foreground text-sm text-center max-w-sm">
              New campaigns from brands will appear here. Make sure your profile and socials are connected so you're ready to apply.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} className="border-border/50 hover:border-primary/30 transition-colors cursor-pointer">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{campaign.title}</CardTitle>
                </div>
                {campaign.platforms && campaign.platforms.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {campaign.platforms.map((p) => (
                      <Badge key={p} variant="secondary" className="capitalize text-xs">{p}</Badge>
                    ))}
                  </div>
                )}
                <CardDescription className="line-clamp-2">{campaign.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {campaign.is_free_product ? (
                    <Badge variant="outline" className="text-xs">Free Product</Badge>
                  ) : campaign.price_per_video ? (
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-3.5 w-3.5" />
                      <span>HK${campaign.price_per_video}/video</span>
                    </div>
                  ) : null}
                  {campaign.campaign_length_days && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{campaign.campaign_length_days}d</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Gigs;
