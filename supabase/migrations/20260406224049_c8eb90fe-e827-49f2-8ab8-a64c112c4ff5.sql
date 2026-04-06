ALTER TABLE public.posted_video_links
ADD COLUMN schedule_event_id uuid REFERENCES public.posting_schedule(id) ON DELETE SET NULL;