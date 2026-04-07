-- Remove FK constraint from chat_rooms.campaign_id
-- Supabase RLS prevents FK validation at insert time when the inserting
-- user's auth context can't read the referenced row. The app layer
-- handles referential integrity, so the FK is redundant.
ALTER TABLE public.chat_rooms DROP CONSTRAINT IF EXISTS chat_rooms_campaign_id_fkey;
