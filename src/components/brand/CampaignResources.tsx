import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Upload, Trash2, Plus, Loader2, Video, BookOpen, Flame } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const resourceTypeConfig: Record<string, { label: string; icon: any; color: string }> = {
  example_video: { label: "Example Video", icon: Video, color: "text-pink-400" },
  script: { label: "Script / Brief", icon: FileText, color: "text-blue-400" },
  warmup_instructions: { label: "Account Warmup", icon: Flame, color: "text-orange-400" },
  other: { label: "Other Resource", icon: BookOpen, color: "text-emerald-400" },
};

interface Resource {
  id: string;
  type: string;
  title: string;
  content: string | null;
  file_url: string | null;
  display_order: number;
}

interface Props {
  campaignId: string;
  resources: Resource[];
  onUpdate: () => void;
  readOnly?: boolean;
}

const CampaignResources = ({ campaignId, resources, onUpdate, readOnly = false }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState("script");
  const [addTitle, setAddTitle] = useState("");
  const [addContent, setAddContent] = useState("");
  const [addFile, setAddFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!user || !addTitle.trim()) return;
    setSaving(true);

    let fileUrl: string | null = null;
    if (addFile) {
      const ext = addFile.name.split(".").pop();
      const path = `${campaignId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("video-submissions").upload(path, addFile);
      if (error) {
        toast({ title: "Upload failed", description: error.message, variant: "destructive" });
        setSaving(false);
        return;
      }
      const { data } = supabase.storage.from("video-submissions").getPublicUrl(path);
      fileUrl = data.publicUrl;
    }

    const { error } = await supabase.from("campaign_resources" as any).insert({
      campaign_id: campaignId,
      type: addType,
      title: addTitle.trim(),
      content: addContent.trim() || null,
      file_url: fileUrl,
      display_order: resources.length,
    } as any);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Resource added!" });
      setShowAdd(false);
      setAddTitle("");
      setAddContent("");
      setAddFile(null);
      onUpdate();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    await supabase.from("campaign_resources" as any).delete().eq("id", id);
    toast({ title: "Resource removed" });
    onUpdate();
    setDeleting(null);
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> Campaign Resources
          </CardTitle>
          {!readOnly && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowAdd(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Resource
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {resources.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {readOnly ? "No resources uploaded yet." : "Add example videos, scripts, and warmup instructions for creators."}
          </p>
        ) : (
          <div className="space-y-2">
            {resources.map((r) => {
              const config = resourceTypeConfig[r.type] || resourceTypeConfig.other;
              const Icon = config.icon;
              return (
                <div key={r.id} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50 border border-border/30">
                  <div className={`h-8 w-8 rounded-lg bg-background flex items-center justify-center shrink-0 ${config.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm text-foreground truncate">{r.title}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground uppercase font-bold tracking-wider">
                        {config.label}
                      </span>
                    </div>
                    {r.content && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">{r.content}</p>
                    )}
                    {r.file_url && (
                      <a
                        href={r.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline mt-1 inline-block"
                      >
                        {r.type === "example_video" ? "▶ Watch Video" : "📎 Download File"}
                      </a>
                    )}
                  </div>
                  {!readOnly && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive shrink-0 h-8 w-8 p-0"
                      disabled={deleting === r.id}
                      onClick={() => handleDelete(r.id)}
                    >
                      {deleting === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Add Resource Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Campaign Resource</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Resource Type</Label>
              <Select value={addType} onValueChange={setAddType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="example_video">Example Video</SelectItem>
                  <SelectItem value="script">Script / Brief</SelectItem>
                  <SelectItem value="warmup_instructions">Account Warmup Instructions</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={addTitle} onChange={(e) => setAddTitle(e.target.value)} placeholder="e.g. Product Unboxing Example" />
            </div>
            <div className="space-y-2">
              <Label>Content / Instructions</Label>
              <Textarea
                value={addContent}
                onChange={(e) => setAddContent(e.target.value)}
                placeholder="Write the script, instructions, or notes here..."
                className="min-h-[120px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Attach File (optional)</Label>
              <Input
                ref={fileRef}
                type="file"
                accept="video/*,image/*,.pdf,.doc,.docx,.txt"
                onChange={(e) => setAddFile(e.target.files?.[0] || null)}
              />
              <p className="text-xs text-muted-foreground">Videos, images, PDFs, or documents</p>
            </div>
            <Button onClick={handleAdd} disabled={saving || !addTitle.trim()} className="w-full gap-2">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</> : <><Upload className="h-4 w-4" /> Add Resource</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default CampaignResources;
