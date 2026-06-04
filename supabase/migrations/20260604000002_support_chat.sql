-- =====================================================
-- Support Chat System
-- Conversations between companies/users and Ervo support
-- =====================================================

CREATE TABLE public.support_conversations (
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id      uuid,
  user_id         uuid NOT NULL,
  subject         text,
  status          text NOT NULL DEFAULT 'open'
                    CHECK (status = ANY (ARRAY['open','in_progress','resolved','closed'])),
  priority        text NOT NULL DEFAULT 'normal'
                    CHECK (priority = ANY (ARRAY['low','normal','high','urgent'])),
  category        text DEFAULT 'general'
                    CHECK (category = ANY (ARRAY['general','billing','training','bug','feature'])),
  last_message_at timestamp with time zone DEFAULT now(),
  created_at      timestamp with time zone DEFAULT now(),
  updated_at      timestamp with time zone DEFAULT now(),
  CONSTRAINT support_conversations_pkey PRIMARY KEY (id),
  CONSTRAINT support_conversations_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT support_conversations_user_id_fkey   FOREIGN KEY (user_id)    REFERENCES public.profiles(id)
);

CREATE TABLE public.support_messages (
  id               uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL,
  sender_id        uuid,
  sender_type      text NOT NULL DEFAULT 'user'
                     CHECK (sender_type = ANY (ARRAY['user','support','system'])),
  content          text NOT NULL,
  attachments      jsonb DEFAULT '[]'::jsonb,
  is_read          boolean NOT NULL DEFAULT false,
  created_at       timestamp with time zone DEFAULT now(),
  CONSTRAINT support_messages_pkey PRIMARY KEY (id),
  CONSTRAINT support_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  CONSTRAINT support_messages_sender_id_fkey       FOREIGN KEY (sender_id)       REFERENCES public.profiles(id)
);

-- Zoom/training session bookings linked to a conversation
CREATE TABLE public.support_session_bookings (
  id               uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id  uuid,
  company_id       uuid,
  requested_by     uuid NOT NULL,
  session_type     text NOT NULL DEFAULT 'training'
                     CHECK (session_type = ANY (ARRAY['training','onboarding','consultation'])),
  scheduled_at     timestamp with time zone,
  zoom_link        text,
  notes            text,
  status           text NOT NULL DEFAULT 'requested'
                     CHECK (status = ANY (ARRAY['requested','confirmed','done','cancelled'])),
  created_at       timestamp with time zone DEFAULT now(),
  CONSTRAINT support_session_bookings_pkey PRIMARY KEY (id),
  CONSTRAINT support_session_bookings_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.support_conversations(id),
  CONSTRAINT support_session_bookings_company_id_fkey      FOREIGN KEY (company_id)      REFERENCES public.companies(id),
  CONSTRAINT support_session_bookings_requested_by_fkey    FOREIGN KEY (requested_by)    REFERENCES public.profiles(id)
);

-- Indexes
CREATE INDEX idx_support_conversations_company_id ON public.support_conversations (company_id);
CREATE INDEX idx_support_conversations_user_id    ON public.support_conversations (user_id);
CREATE INDEX idx_support_conversations_status     ON public.support_conversations (status);
CREATE INDEX idx_support_messages_conversation_id ON public.support_messages (conversation_id);
CREATE INDEX idx_support_messages_created_at      ON public.support_messages (created_at);

-- =====================================================
-- Row Level Security
-- =====================================================

ALTER TABLE public.support_conversations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_session_bookings  ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything
CREATE POLICY "super_admin_all_conversations" ON public.support_conversations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "super_admin_all_messages" ON public.support_messages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "super_admin_all_bookings" ON public.support_session_bookings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- Company users: read conversations milik company sendiri
CREATE POLICY "company_users_read_conversations" ON public.support_conversations
  FOR SELECT USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

-- Company users: hanya bisa buat conversation untuk diri sendiri
CREATE POLICY "company_users_insert_conversations" ON public.support_conversations
  FOR INSERT WITH CHECK (
    user_id    = auth.uid()
    AND company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

-- Company users: update status conversation milik sendiri
CREATE POLICY "company_users_update_conversations" ON public.support_conversations
  FOR UPDATE USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

-- Company users: baca pesan di conversation company sendiri
CREATE POLICY "company_users_read_messages" ON public.support_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.support_conversations sc
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE sc.id = conversation_id AND sc.company_id = p.company_id
    )
  );

-- Company users: kirim pesan — sender_id harus diri sendiri, sender_type harus 'user'
CREATE POLICY "company_users_send_messages" ON public.support_messages
  FOR INSERT WITH CHECK (
    sender_id   = auth.uid()
    AND sender_type = 'user'
    AND EXISTS (
      SELECT 1 FROM public.support_conversations sc
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE sc.id = conversation_id AND sc.company_id = p.company_id
    )
  );

-- Company users: read bookings milik company sendiri
CREATE POLICY "company_users_read_bookings" ON public.support_session_bookings
  FOR SELECT USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

-- Company users: buat booking untuk diri sendiri, tidak bisa set zoom_link
CREATE POLICY "company_users_insert_bookings" ON public.support_session_bookings
  FOR INSERT WITH CHECK (
    requested_by = auth.uid()
    AND company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND zoom_link IS NULL  -- hanya super_admin yang bisa set zoom_link
  );
