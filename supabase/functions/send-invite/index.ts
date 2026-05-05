import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const body = await req.json();
    const personId: string = body.personId;
    const email: string = (body.email || "").trim().toLowerCase();
    const role: string = body.role === "admin" ? "admin" : "member";
    if (!personId || !email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Dados inválidos" }), { status: 400, headers: corsHeaders });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Resolve workspace through the user's membership
    const { data: ws } = await admin.from("workspace_members").select("workspace_id").eq("user_id", user.id).maybeSingle();
    if (!ws) return new Response(JSON.stringify({ error: "Workspace não encontrado" }), { status: 400, headers: corsHeaders });
    const workspaceId = ws.workspace_id;

    // Update person record
    await admin.from("people").update({ email, role }).eq("id", personId).eq("workspace_id", workspaceId);

    // Create / refresh invite row
    await admin.from("workspace_invites")
      .update({ status: "expired" })
      .eq("workspace_id", workspaceId)
      .eq("email", email)
      .eq("status", "pending");

    const { data: invite, error: inviteErr } = await admin.from("workspace_invites").insert({
      workspace_id: workspaceId, email, role, invited_by: user.id, status: "pending",
    }).select("token").single();
    if (inviteErr || !invite) {
      return new Response(JSON.stringify({ error: "Erro ao criar convite" }), { status: 500, headers: corsHeaders });
    }

    const origin = req.headers.get("origin") || req.headers.get("referer") || "";
    const redirectTo = `${origin.replace(/\/$/, "")}/login?invite=${invite.token}`;

    // Try invite (creates user). If user already exists, send magic link instead.
    const { error: inviteAuthErr } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (inviteAuthErr) {
      const msg = (inviteAuthErr.message || "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        // User exists — send magic link so they sign in & trigger membership creation isn't enough (trigger only fires on signup).
        // For existing users we attach via RPC after they sign in (handled client-side).
        const { error: linkErr } = await admin.auth.admin.generateLink({
          type: "magiclink", email, options: { redirectTo },
        });
        if (linkErr) {
          return new Response(JSON.stringify({ error: linkErr.message }), { status: 500, headers: corsHeaders });
        }
      } else {
        return new Response(JSON.stringify({ error: inviteAuthErr.message }), { status: 500, headers: corsHeaders });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});