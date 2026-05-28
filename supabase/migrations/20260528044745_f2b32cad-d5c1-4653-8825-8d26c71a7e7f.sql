ALTER TABLE public.broadcasts REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcasts;