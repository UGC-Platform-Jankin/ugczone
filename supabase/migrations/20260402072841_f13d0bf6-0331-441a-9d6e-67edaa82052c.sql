-- Add communication and scheduling columns to campaigns
ALTER TABLE public.campaigns
  ADD COLUMN communication_type text NOT NULL DEFAULT 'in_app_chat',
  ADD COLUMN external_comm_link text,
  ADD COLUMN request_contact_types text[] DEFAULT '{}',
  ADD COLUMN calendly_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN calendly_link text;

-- Campaign resources table
CREATE TABLE public.campaign_resources (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'other',
  title text NOT NULL,
  content text,
  file_url text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brand can manage own campaign resources"
  ON public.campaign_resources FOR ALL
  USING (EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_resources.campaign_id AND c.brand_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_resources.campaign_id AND c.brand_user_id = auth.uid()));

CREATE POLICY "Accepted creators can view campaign resources"
  ON public.campaign_resources FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM campaign_applications ca
    WHERE ca.campaign_id = campaign_resources.campaign_id
      AND ca.creator_user_id = auth.uid()
      AND ca.status = 'accepted'
  ));

-- Contact shares table
CREATE TABLE public.contact_shares (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  creator_user_id uuid NOT NULL,
  contact_type text NOT NULL,
  contact_value text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, creator_user_id, contact_type)
);

ALTER TABLE public.contact_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators can manage own contact shares"
  ON public.contact_shares FOR ALL
  USING (auth.uid() = creator_user_id)
  WITH CHECK (auth.uid() = creator_user_id);

CREATE POLICY "Brand can view contact shares for own campaigns"
  ON public.contact_shares FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM campaigns c WHERE c.id = contact_shares.campaign_id AND c.brand_user_id = auth.uid()
  ));