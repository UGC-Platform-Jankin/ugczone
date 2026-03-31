ALTER TABLE public.campaigns
  ADD COLUMN price_per_video numeric DEFAULT NULL,
  ADD COLUMN is_free_product boolean NOT NULL DEFAULT false,
  ADD COLUMN expected_video_count integer NOT NULL DEFAULT 1;