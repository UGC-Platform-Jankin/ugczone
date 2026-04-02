import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { type, profile, items } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    let systemPrompt = "";
    let userPrompt = "";

    if (type === "creator_to_campaigns") {
      systemPrompt = `You are a matching engine. Given a creator profile and a list of campaigns, return a JSON array of objects with "id" (campaign id) and "match" (integer 0-100 representing match percentage). Consider: creator bio/interests vs campaign description/requirements, platforms overlap, region overlap. Be realistic - not everything is 90%+. Return ONLY valid JSON array, no markdown.`;
      userPrompt = `Creator Profile:\n- Name: ${profile.display_name || "Unknown"}\n- Bio: ${profile.bio || "No bio"}\n- Platforms: ${(profile.platforms || []).join(", ") || "None"}\n- Followers: ${profile.followers || "Unknown"}\n\nCampaigns:\n${items.map((c: any) => `- ID: ${c.id}, Title: "${c.title}", Description: "${(c.description || "").slice(0, 200)}", Platforms: ${(c.platforms || []).join(", ")}, Regions: ${(c.target_regions || []).join(", ")}, Requirements: "${(c.requirements || "").slice(0, 150)}"`).join("\n")}`;
    } else if (type === "campaign_to_creators") {
      systemPrompt = `You are a matching engine. Given a brand's campaign details and a list of creators, return a JSON array of objects with "id" (creator user_id) and "match" (integer 0-100 representing match percentage). Consider: creator bio/content style vs campaign needs, platforms overlap, follower count relevance. Be realistic. Return ONLY valid JSON array, no markdown.`;
      userPrompt = `Brand Campaigns:\n${(profile.campaigns || []).map((c: any) => `- "${c.title}": ${(c.description || "").slice(0, 150)}, Platforms: ${(c.platforms || []).join(", ")}, Regions: ${(c.target_regions || []).join(", ")}`).join("\n")}\n\nCreators:\n${items.map((c: any) => `- ID: ${c.user_id}, Name: "${c.display_name || "Unknown"}", Bio: "${(c.bio || "").slice(0, 150)}", Platforms: ${(c.platforms || []).join(", ")}, Followers: ${c.followers || 0}`).join("\n")}`;
    } else {
      return new Response(JSON.stringify({ error: "Invalid type" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI error:", status, t);
      return new Response(JSON.stringify({ error: "AI error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";
    
    // Parse the JSON from the response, stripping markdown if present
    let matches;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      matches = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content);
      matches = [];
    }

    return new Response(JSON.stringify({ matches }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-match error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
