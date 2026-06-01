// Migration: Add is_public column and auto_join_public_workspace function
// Run with: node scripts/migrate-public-workspace.mjs

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ehuqbfbwgckusheiawsz.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVodXFiZmJ3Z2NrdXNoZWlhd3N6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwOTU5NzcsImV4cCI6MjA5MTY3MTk3N30.MUr3EPeKyJf1BT6_E2PpXcxWXZC8CalhK9FpCTeQXUs";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log("Testing connection...");

  // Test: try to read from workspaces
  const { data, error } = await supabase.from("workspaces").select("id, name, code").limit(1);
  if (error) {
    console.error("Connection error:", error.message);
    console.log("\n⚠️  The migration SQL must be run directly in the Supabase SQL Editor.");
    console.log("Go to: https://supabase.com/dashboard/project/ehuqbfbwgckusheiawsz/sql");
    console.log("\nCopy and paste the SQL below:\n");
  } else {
    console.log("Connected! Found workspace:", data?.[0]?.name || "(none)");
    console.log("\n⚠️  Column/function creation requires admin access.");
    console.log("Go to: https://supabase.com/dashboard/project/ehuqbfbwgckusheiawsz/sql");
    console.log("\nCopy and paste the SQL below:\n");
  }

  console.log(`
-- =============================================
-- MIGRATION: Public/Private Workspace Toggle
-- =============================================

-- 1. Add is_public column to workspaces table
ALTER TABLE public.workspaces
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- 2. Add areas column to people table (for multi-area support)
ALTER TABLE public.people
ADD COLUMN IF NOT EXISTS areas TEXT DEFAULT NULL;

-- 3. Add leader_area column to people table
ALTER TABLE public.people
ADD COLUMN IF NOT EXISTS leader_area TEXT DEFAULT NULL;

-- 4. Create the auto_join_public_workspace function
CREATE OR REPLACE FUNCTION public.auto_join_public_workspace(_code TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _ws_id UUID;
  _uid UUID := auth.uid();
BEGIN
  -- Must be authenticated
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Find workspace by code
  SELECT id INTO _ws_id
  FROM public.workspaces
  WHERE code = _code AND is_public = true;

  IF _ws_id IS NULL THEN
    RAISE EXCEPTION 'invalid_code_or_not_public';
  END IF;

  -- Check if already a member
  IF EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _ws_id AND user_id = _uid
  ) THEN
    RAISE EXCEPTION 'already_member';
  END IF;

  -- Auto-insert as member (no approval needed)
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (_ws_id, _uid, 'member');

  -- Cancel any pending join requests for this workspace
  UPDATE public.workspace_join_requests
  SET status = 'approved', decided_at = NOW(), decided_role = 'member'
  WHERE workspace_id = _ws_id AND user_id = _uid AND status = 'pending';
END;
$$;

-- 5. Grant execute permission
GRANT EXECUTE ON FUNCTION public.auto_join_public_workspace(TEXT) TO anon, authenticated;

-- 6. Update RLS policies to allow reading is_public
-- (workspaces table should already have SELECT for authenticated users)

SELECT 'Migration complete!' AS status;
  `);
}

main().catch(console.error);
