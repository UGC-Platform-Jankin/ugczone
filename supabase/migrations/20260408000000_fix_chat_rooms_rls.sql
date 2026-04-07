-- Fix chat_rooms insert policy: ensure brand can create private chat rooms for their campaigns
DROP POLICY IF EXISTS "cr_insert" ON public.chat_rooms;
CREATE POLICY "cr_insert" ON public.chat_rooms
FOR INSERT TO authenticated
WITH CHECK (true);

-- Also ensure chat_participants insert is fully permissive for authenticated users
DROP POLICY IF EXISTS "cp_insert" ON public.chat_participants;
CREATE POLICY "cp_insert" ON public.chat_participants
FOR INSERT TO authenticated
WITH CHECK (true);
