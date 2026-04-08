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

-- Look up other user's name and create a private chat room in one call
-- Bypasses RLS so brand can read creator profiles for naming
CREATE OR REPLACE FUNCTION public.find_or_create_private_room(_campaign_id uuid, _user_id uuid, _other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _room_id uuid;
  _display_name text;
  _business_name text;
  _pIds uuid[];
  _p uuid;
BEGIN
  -- 1. Find existing room with both participants
  FOR _room_id IN
    SELECT cr.id FROM public.chat_rooms cr
    WHERE cr.campaign_id = _campaign_id AND cr.type = 'private'
  LOOP
    SELECT ARRAY_AGG(cp.user_id) INTO _pIds
    FROM public.chat_participants cp
    WHERE cp.chat_room_id = _room_id;
    IF _pIds @> ARRAY[_user_id, _other_user_id] AND _pIds <@ ARRAY[_user_id, _other_user_id] THEN
      RETURN _room_id; -- Found, return it
    END IF;
  END LOOP;

  -- 2. Look up other user's name (SECURITY DEFINER bypasses RLS)
  SELECT display_name INTO _display_name FROM public.profiles WHERE user_id = _other_user_id LIMIT 1;
  IF _display_name IS NULL THEN
    SELECT business_name INTO _business_name FROM public.brand_profiles WHERE user_id = _other_user_id LIMIT 1;
    _display_name := _business_name;
  END IF;
  IF _display_name IS NULL THEN
    _display_name := 'Chat';
  END IF;

  -- 3. Create new room with the name
  INSERT INTO public.chat_rooms (campaign_id, type, name)
  VALUES (_campaign_id, 'private', _display_name)
  RETURNING id INTO _room_id;

  -- 4. Add both participants
  INSERT INTO public.chat_participants (chat_room_id, user_id) VALUES (_room_id, _user_id);
  INSERT INTO public.chat_participants (chat_room_id, user_id) VALUES (_room_id, _other_user_id);

  RETURN _room_id;
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

-- Get all private rooms for a campaign with participant info
-- Uses SECURITY DEFINER so brand can see all participants
CREATE OR REPLACE FUNCTION public.get_private_rooms(_campaign_id uuid, _user_id uuid)
RETURNS TABLE(room_id uuid, room_name text, other_user_id uuid, other_display_name text, other_avatar_url text, other_business_name text, last_msg_content text, last_msg_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH room_participants AS (
    SELECT cp.chat_room_id, cp.user_id
    FROM public.chat_participants cp
    WHERE cp.chat_room_id IN (
      SELECT cr.id FROM public.chat_rooms cr WHERE cr.campaign_id = _campaign_id AND cr.type = 'private'
    )
  ),
  other_participants AS (
    SELECT rp.chat_room_id, rp.user_id AS other_id
    FROM room_participants rp
    WHERE rp.user_id != _user_id
  ),
  latest_messages AS (
    SELECT m.chat_room_id, m.content, m.created_at,
      ROW_NUMBER() OVER (PARTITION BY m.chat_room_id ORDER BY m.created_at DESC) AS rn
    FROM public.messages m
    WHERE m.chat_room_id IN (SELECT chat_room_id FROM room_participants)
  )
  SELECT
    op.chat_room_id::uuid,
    cr.name::text,
    op.other_id::uuid,
    COALESCE(p.display_name, bp.business_name)::text,
    p.avatar_url::text,
    bp.business_name::text,
    lm.content::text,
    lm.created_at::timestamptz
  FROM other_participants op
  JOIN public.chat_rooms cr ON cr.id = op.chat_room_id
  LEFT JOIN public.profiles p ON p.user_id = op.other_id
  LEFT JOIN public.brand_profiles bp ON bp.user_id = op.other_id
  LEFT JOIN latest_messages lm ON lm.chat_room_id = op.chat_room_id AND lm.rn = 1
  ORDER BY COALESCE(lm.created_at, cr.created_at) DESC;
END;
$$;
