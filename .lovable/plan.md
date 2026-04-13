

# Plan: Authentication + Workspace Isolation

## Summary
Add email/password login with Lovable Cloud, user profiles, and workspace-isolated data so each user sees only their own tasks, posts, projects, events, and teams.

## Phase 1 — Enable Lovable Cloud + Database Schema

**Tables to create via migrations:**

1. **profiles** — `id (uuid, FK auth.users)`, `display_name (text)`, `created_at`
   - Trigger to auto-create on signup
   - RLS: users read/update own profile only

2. **teams** — `id`, `user_id (uuid, FK auth.users)`, `name`, `color`, `members (text[])`
   - RLS: user_id = auth.uid()

3. **projects** — `id`, `user_id`, `name`, `description`, `team`, `color`, `status`, `created_at`
   - RLS: user_id = auth.uid()

4. **tasks** — `id`, `user_id`, `title`, `description`, `team`, `responsible (text[])`, `deadline`, `status`, `priority`, `checklist (jsonb)`
   - RLS: user_id = auth.uid()

5. **posts** — `id`, `user_id`, `title`, `copy`, `channel`, `category`, `date`, `time`, `status`, `responsible (text[])`, `link`, `media_url`
   - RLS: user_id = auth.uid()

6. **calendar_events** — `id`, `user_id`, `title`, `date`, `time`, `end_time`, `type`, `description`
   - RLS: user_id = auth.uid()

7. **general_items** — `id`, `user_id`, `title`, `description`, `date`, `time`, `type`
   - RLS: user_id = auth.uid()

8. **categories** — `id`, `user_id`, `name`
   - RLS: user_id = auth.uid()

9. **channels** — `id`, `user_id`, `name`, `color`
   - RLS: user_id = auth.uid()

All tables have `user_id NOT NULL` with RLS policies restricting CRUD to `auth.uid() = user_id`.

## Phase 2 — Auth Pages

- **Login page** (`/login`) — email + password form with sign-up toggle
- **Sign-up page** — creates account + profile with display name
- **Password reset** — forgot password flow + `/reset-password` page
- **Auth guard** — `ProtectedRoute` component wrapping all app routes
- **Logout** button in sidebar user section

## Phase 3 — Migrate DataContext to Supabase

- Replace localStorage with Supabase queries in `DataContext`
- All CRUD operations use Supabase client (insert/update/delete with `user_id`)
- On login, fetch user's data; on logout, clear state
- Seed default teams and channels on first login (if user has none)
- Keep notification generation logic client-side (derived from fetched data)

## Phase 4 — UI Adjustments

- Show profile display name in sidebar instead of "Admin"
- All existing features (dashboard alerts, calendar drag-drop, mobile layout, active/completed tabs) remain unchanged
- Remove mock-data initial seeding for logged-in users

## Technical Notes

- Lovable Cloud must be enabled before creating migrations
- All RLS uses simple `auth.uid() = user_id` pattern (no roles table needed since single-user workspaces)
- `checklist` stored as JSONB array: `[{text, checked}]`
- `responsible` and `members` stored as `text[]` arrays

