
-- Create teams table
CREATE TABLE public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create team_members junction table
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  UNIQUE (team_id, person_id)
);

-- Index for workspace filtering
CREATE INDEX idx_teams_workspace_id ON public.teams(workspace_id);

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- RLS for teams
CREATE POLICY "Users manage own teams"
ON public.teams
FOR ALL
TO authenticated
USING (workspace_id = get_workspace_id(auth.uid()))
WITH CHECK (workspace_id = get_workspace_id(auth.uid()));

-- RLS for team_members (via parent team)
CREATE POLICY "Users manage team members"
ON public.team_members
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.teams
  WHERE teams.id = team_members.team_id
  AND teams.workspace_id = get_workspace_id(auth.uid())
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.teams
  WHERE teams.id = team_members.team_id
  AND teams.workspace_id = get_workspace_id(auth.uid())
));
