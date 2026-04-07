import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen, Calendar, MessageSquare, Phone, Video, CheckCircle,
  Clock, XCircle, ExternalLink, Send, Loader2, ChevronRight, Flame, FileText, Instagram
} from "lucide-react";
import CampaignResources from "@/components/brand/CampaignResources";

interface ActiveGig {
  application: any;
  campaign: any;
  resources: any[];
  contactShares: any[];
}

const ActiveGigHub = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [gigs, setGigs] = useState<ActiveGig[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGig, setSelectedGig] = useState<ActiveGig | null>(null);
  const [sharingContact, setSharingContact] = useState<{ type: string; campaignId: string } | null>(null);
  const [contactValue, setContactValue] = useState("");
  const [savingContact, setSavingContact] = useState(false);

  const loadGigs = async () => {
    if (!user) return;
    const { data: apps } = await supabase
      .from("campaign_applications")
      .select("*")
      .eq("creator_user_id", user.id)
      .eq("status", "accepted");

    if (!apps?.length) { setGigs([]); setLoading(false); return; }

    const campIds = apps.map((a: any) => a.campaign_id);
    const [campsRes, resourcesRes, sharesRes] = await Promise.all([
      supabase.from("campaigns").select("*").in("id", campIds),
      supabase.from("campaign_resources" as any).select("*").in("campaign_id", campIds).order("display_order"),
      supabase.from("contact_shares" as any).select("*").eq("creator_user_id", user.id),
    ]);

    const campMap: Record<string, any> = {};
    (campsRes.data || []).forEach((c: any) => { campMap[c.id] = c; });
    const resMap: Record<string, any[]> = {};
    ((resourcesRes.data as any) || []).forEach((r: any) => {
      if (!resMap[r.campaign_id]) resMap[r.campaign_id] = [];
      resMap[r.campaign_id].push(r);
    });
    const shareMap: Record<string, any[]> = {};
    ((sharesRes.data as any) || []).forEach((s: any) => {
      if (!shareMap[s.campaign_id]) shareMap[s.campaign_id] = [];
      shareMap[s.campaign_id].push(s);
    });

    const result = apps.map((a: any) => ({
      application: a,
      campaign: campMap[a.campaign_id] || {},
      resources: resMap[a.campaign_id] || [],
      contactShares: shareMap[a.campaign_id] || [],
    }));

    setGigs(result);
    setLoading(false);
  };

  useEffect(() => { loadGigs(); }, [user]);

  const handleShareContact = async () => {
    if (!user || !sharingContact || !contactValue.trim()) return;
    setSavingContact(true);
    const { error } = await supabase.from("contact_shares" as any).upsert({
      campaign_id: sharingContact.campaignId,
      creator_user_id: user.id,
      contact_type: sharingContact.type,
      contact_value: contactValue.trim(),
    } as any, { onConflict: "campaign_id,creator_user_id,contact_type" });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Contact shared with the brand!" });
      setSharingContact(null);
      setContactValue("");
      loadGigs();
    }
    setSavingContact(false);
  };

  const contactTypeLabels: Record<string, { label: string; icon: any; placeholder: string }> = {
    imessage: { label: "iMessage", icon: Phone, placeholder: "Your phone number" },
    whatsapp: { label: "WhatsApp", icon: MessageSquare, placeholder: "Your WhatsApp number" },
    instagram_dm: { label: "Instagram DM", icon: Instagram, placeholder: "@your_handle" },
  };

  if (loading) return <Card className="animate-pulse"><CardContent className="p-6"><div className="h-24 bg-muted rounded" /></CardContent></Card>;
  if (gigs.length === 0) return null;

  const getSteps = (gig: ActiveGig) => {
    const steps = [];
    const c = gig.campaign;

    // Step 1: Review resources
    if (gig.resources.length > 0) {
      steps.push({ label: "Review campaign resources", icon: BookOpen, done: true, detail: `${gig.resources.length} resource(s) available` });
    }

    // Step 2: Share contact if requested
    if (c.communication_type === "request_contact" && c.request_contact_types?.length > 0) {
      const shared = gig.contactShares.map((s: any) => s.contact_type);
      const allShared = c.request_contact_types.every((t: string) => shared.includes(t));
      steps.push({
        label: "Share your contact info",
        icon: MessageSquare,
        done: allShared,
        detail: allShared ? "Contact shared" : `Brand needs: ${c.request_contact_types.map((t: string) => contactTypeLabels[t]?.label || t).join(", ")}`,
      });
    }

    // Step 3: Join external chat if applicable
    if (c.communication_type === "external" && c.external_comm_link) {
      steps.push({ label: "Join the group chat", icon: ExternalLink, done: false, detail: "External chat link provided" });
    }

    // Step 4: Book a call if calendly enabled
    if (c.calendly_enabled && c.calendly_link) {
      steps.push({ label: "Schedule a call (optional)", icon: Calendar, done: false, detail: "Book via Calendly" });
    }

    // Step 5: Submit videos
    steps.push({
      label: "Submit your videos",
      icon: Video,
      done: (gig.application.videos_delivered || 0) >= (c.expected_video_count || 1),
      detail: `${gig.application.videos_delivered || 0}/${c.expected_video_count || 1} delivered`,
    });

    return steps;
  };

  return (
    <div className="space-y-3">
      {gigs.map((gig) => {
        const steps = getSteps(gig);
        const completedSteps = steps.filter(s => s.done).length;
        return (
          <Card
            key={gig.application.id}
            className="border-border/50 hover:border-primary/20 transition-all cursor-pointer"
            onClick={() => setSelectedGig(gig)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-heading font-bold text-foreground">{gig.campaign.title}</h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-primary" /> {completedSteps}/{steps.length} steps
                    </span>
                    <span className="flex items-center gap-1">
                      <Video className="h-3 w-3" /> {gig.application.videos_delivered || 0}/{gig.campaign.expected_video_count || 1} videos
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Gig Detail Dialog */}
      <Dialog open={!!selectedGig} onOpenChange={(o) => !o && setSelectedGig(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedGig && (
            <>
              <DialogHeader>
                <DialogTitle className="font-heading text-lg">{selectedGig.campaign.title}</DialogTitle>
              </DialogHeader>

              {/* Steps Checklist */}
              <div className="space-y-3 mt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Your Action Steps</h4>
                {getSteps(selectedGig).map((step, i) => {
                  const Icon = step.icon;
                  return (
                    <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${step.done ? "bg-primary/5 border-primary/20" : "bg-secondary/50 border-border/30"}`}>
                      <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${step.done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        {step.done ? <CheckCircle className="h-3.5 w-3.5" /> : <span className="text-xs font-bold">{i + 1}</span>}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${step.done ? "text-foreground" : "text-foreground"}`}>{step.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{step.detail}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Contact Sharing Section */}
              {selectedGig.campaign.communication_type === "request_contact" && selectedGig.campaign.request_contact_types?.length > 0 && (
                <div className="space-y-2 mt-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Share Your Contact</h4>
                  <div className="space-y-2">
                    {selectedGig.campaign.request_contact_types.map((type: string) => {
                      const config = contactTypeLabels[type];
                      if (!config) return null;
                      const existing = selectedGig.contactShares.find((s: any) => s.contact_type === type);
                      const Icon = config.icon;
                      return (
                        <div key={type} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border/30">
                          <Icon className="h-4 w-4 text-primary shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">{config.label}</p>
                            {existing ? (
                              <p className="text-xs text-muted-foreground">Shared: {existing.contact_value}</p>
                            ) : (
                              <p className="text-xs text-destructive">Not shared yet</p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant={existing ? "outline" : "default"}
                            className="shrink-0 gap-1 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSharingContact({ type, campaignId: selectedGig.campaign.id });
                              setContactValue(existing?.contact_value || "");
                            }}
                          >
                            <Send className="h-3 w-3" /> {existing ? "Update" : "Share"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* External Chat Link */}
              {selectedGig.campaign.communication_type === "external" && selectedGig.campaign.external_comm_link && (
                <div className="mt-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Group Chat</h4>
                  <a href={selectedGig.campaign.external_comm_link} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="w-full gap-2">
                      <ExternalLink className="h-4 w-4" /> Join External Chat
                    </Button>
                  </a>
                </div>
              )}

              {/* Message Brand Button */}
              <div className="mt-4">
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => {
                    const brandUserId = selectedGig.campaign.brand_user_id;
                    if (!brandUserId) return;
                    navigate(`/dashboard/gig/${selectedGig.campaign.id}/private?brand=${brandUserId}`);
                  }}
                >
                  <MessageSquare className="h-4 w-4" /> Message Brand
                </Button>
              </div>

              {/* Calendly */}
              {selectedGig.campaign.calendly_enabled && selectedGig.campaign.calendly_link && (
                <div className="mt-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Schedule a Call</h4>
                  <a href={selectedGig.campaign.calendly_link} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="w-full gap-2">
                      <Calendar className="h-4 w-4" /> Book via Calendly
                    </Button>
                  </a>
                </div>
              )}

              {/* Resources */}
              {selectedGig.resources.length > 0 && (
                <div className="mt-4">
                  <CampaignResources
                    campaignId={selectedGig.campaign.id}
                    resources={selectedGig.resources}
                    onUpdate={loadGigs}
                    readOnly
                  />
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Contact Share Dialog */}
      <Dialog open={!!sharingContact} onOpenChange={(o) => !o && setSharingContact(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Share {sharingContact ? contactTypeLabels[sharingContact.type]?.label : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={contactValue}
              onChange={(e) => setContactValue(e.target.value)}
              placeholder={sharingContact ? contactTypeLabels[sharingContact.type]?.placeholder : ""}
            />
            <Button onClick={handleShareContact} disabled={savingContact || !contactValue.trim()} className="w-full gap-2">
              {savingContact ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <><Send className="h-4 w-4" /> Share with Brand</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ActiveGigHub;
