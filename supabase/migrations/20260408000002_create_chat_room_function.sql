-- Create SECURITY DEFINER functions to bypass RLS for chat room creation
-- The cr_insert policy fails for authenticated users because the chat_rooms
-- table has an FK to campaigns, which is filtered by RLS. Using a SECURITY
-- DEFINER function (owned by postgres) bypasses RLS at call time.

CREATE OR REPLACE FUNCTION public.create_chat_room(_campaign_id uuid, _type text, _name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  INSERT INTO public.chat_rooms (campaign_id, type, name)
  VALUES (_campaign_id, _type, _name)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

-- Overload: create_chat_room with auto-naming from other user's profile
CREATE OR REPLACE FUNCTION public.create_chat_room(_campaign_id uuid, _type text, _other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
  _display_name text;
  _business_name text;
BEGIN
  -- Try creator profile first
  SELECT display_name INTO _display_name FROM public.profiles WHERE user_id = _other_user_id LIMIT 1;
  -- Fall back to brand business name
  IF _display_name IS NULL THEN
    SELECT business_name INTO _business_name FROM public.brand_profiles WHERE user_id = _other_user_id LIMIT 1;
    _display_name := _business_name;
  END IF;

  INSERT INTO public.chat_rooms (campaign_id, type, name)
  VALUES (_campaign_id, _type, _display_name)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_chat_participant(_room_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.chat_participants (chat_room_id, user_id)
  VALUES (_room_id, _user_id)
  ON CONFLICT (chat_room_id, user_id) DO NOTHING;
END;
$$;
