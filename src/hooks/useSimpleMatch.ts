/**
 * Simple formula-based matching between a creator profile and campaigns.
 * Used for both creator→campaign (Gigs page) and brand→creator (Find Creators).
 * Always returns 50–100.
 */
export function computeCreatorCampaignMatches(
  profile: {
    platforms?: string[];
    country?: string | null;
    content_types?: string[] | null;
    followers?: number;
    past_collabs?: { brand_name: string }[];
  } | null,
  campaigns: {
    id: string;
    platforms?: string[] | null;
    target_regions?: string[] | null;
    is_free_product?: boolean;
    price_per_video?: number | null;
    requirements?: string | null;
    description?: string | null;
  }[]
): Record<string, number> {
  if (!profile || campaigns.length === 0) return {};

  const creatorPlatforms = new Set((profile.platforms || []).map(p => p.toLowerCase()));
  const creatorCountry = (profile.country || "").toLowerCase();
  const creatorContentTypes = new Set((profile.content_types || []).map(t => t.toLowerCase()));

  const result: Record<string, number> = {};

  for (const camp of campaigns) {
    let score = 0;

    // ── Platform overlap (35%) ──────────────────────────────────
    // Weighed by what the campaign requires, not what creator has.
    const campPlatforms = (camp.platforms || []).map(p => p.toLowerCase());
    if (campPlatforms.length > 0) {
      const overlap = campPlatforms.filter(p => creatorPlatforms.has(p)).length;
      score += (overlap / campPlatforms.length) * 35;
    } else {
      score += 20; // no platform requirement = partial credit
    }

    // ── Region match (30%) ──────────────────────────────────────
    const regions = (camp.target_regions || []).map(r => r.toLowerCase());
    if (regions.length === 0 || regions.includes("worldwide") || regions.includes("world-wide")) {
      score += 30; // worldwide = full match
    } else if (creatorCountry && regions.some(r => r.toLowerCase().includes(creatorCountry) || creatorCountry.includes(r.toLowerCase()))) {
      score += 30;
    } else {
      score += 0; // no match, no partial credit — minimum will catch this
    }

    // ── Content type relevance (25%) ────────────────────────────
    const campText = `${camp.description || ""} ${camp.requirements || ""}`.toLowerCase();
    if (creatorContentTypes.size > 0 && campText.length > 0) {
      let contentMatch = 0;
      creatorContentTypes.forEach(ct => {
        if (campText.includes(ct)) contentMatch++;
      });
      score += Math.min((contentMatch / creatorContentTypes.size) * 25, 25);
    } else {
      score += 12; // neutral partial credit
    }

    // ── Paid campaign bonus (10%) ───────────────────────────────
    if (!camp.is_free_product && camp.price_per_video && camp.price_per_video > 0) {
      score += 10;
    } else {
      score += 0;
    }

    // Enforce minimum 50 — score starts high enough that this rarely floors,
    // but catches edge cases where nothing matches at all.
    const pct = Math.round(Math.max(50, Math.min((score / 95) * 100, 100)));
    result[camp.id] = pct;
  }

  return result;
}

/**
 * Same formula for brand→creator matching (used in Find Creators).
 * Takes creator profiles and brand campaigns; returns 50–100.
 */
export function computeBrandCreatorMatches(
  brandCampaigns: {
    id: string;
    platforms?: string[] | null;
    target_regions?: string[] | null;
    is_free_product?: boolean;
    price_per_video?: number | null;
    requirements?: string | null;
    description?: string | null;
  }[],
  creators: {
    id: string;
    platforms?: string[];
    country?: string | null;
    content_types?: string[] | null;
    followers?: number;
  }[]
): Record<string, number> {
  if (!brandCampaigns.length || creators.length === 0) return {};

  // Build aggregated platform/region/content_type sets across all brand campaigns
  const allCampPlatforms = new Set(
    brandCampaigns.flatMap(c => (c.platforms || []).map(p => p.toLowerCase()))
  );
  const allCampRegions = brandCampaigns.flatMap(c => (c.target_regions || []).map(r => r.toLowerCase()));
  const allCampText = brandCampaigns
    .map(c => `${c.description || ""} ${c.requirements || ""}`)
    .join(" ")
    .toLowerCase();
  const hasPaidCampaigns = brandCampaigns.some(c => !c.is_free_product && c.price_per_video && c.price_per_video > 0);

  const result: Record<string, number> = {};

  for (const creator of creators) {
    const creatorPlatforms = new Set((creator.platforms || []).map(p => p.toLowerCase()));
    const creatorCountry = (creator.country || "").toLowerCase();
    const creatorContentTypes = new Set((creator.content_types || []).map(t => t.toLowerCase()));

    let score = 0;

    // Platform overlap (35%) — does creator have what campaigns need?
    if (allCampPlatforms.size > 0) {
      const overlap = [...allCampPlatforms].filter(p => creatorPlatforms.has(p)).length;
      score += (overlap / allCampPlatforms.size) * 35;
    } else {
      score += 20;
    }

    // Region match (30%)
    const isWorldwide = allCampRegions.some(r => r.includes("worldwide") || r.includes("world-wide"));
    if (allCampRegions.length === 0 || isWorldwide) {
      score += 30;
    } else if (creatorCountry && allCampRegions.some(r => r.includes(creatorCountry) || creatorCountry.includes(r))) {
      score += 30;
    } else {
      score += 0;
    }

    // Content type relevance (25%)
    if (creatorContentTypes.size > 0 && allCampText.length > 0) {
      let contentMatch = 0;
      creatorContentTypes.forEach(ct => {
        if (allCampText.includes(ct)) contentMatch++;
      });
      score += Math.min((contentMatch / creatorContentTypes.size) * 25, 25);
    } else {
      score += 12;
    }

    // Paid campaigns bonus (10%)
    if (hasPaidCampaigns) {
      score += 10;
    } else {
      score += 0;
    }

    const pct = Math.round(Math.max(50, Math.min((score / 95) * 100, 100)));
    result[creator.id] = pct;
  }

  return result;
}
