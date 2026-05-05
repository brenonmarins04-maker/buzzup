import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

type Action = "send" | "resend" | "cancel";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const body = await req.json();
    const action: Action = (body.action as Action) || "send";
    const personId: string = body.personId;
    if (!personId) return new Response(JSON.stringify({ error: "personId obrigatório" }), { status: 400, headers: corsHeaders });

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: ws } = await admin.from("workspace_members").select("workspace_id").eq("user_id", user.id).maybeSingle();
    if (!ws) return new Response(JSON.stringify({ error: "Workspace não encontrado" }), { status: 400, headers: corsHeaders });
    const workspaceId = ws.workspace_id;

    // Load person
    const { data: person, error: pErr } = await admin.from("people")
      .select("id, email, role, workspace_id, name").eq("id", personId).maybeSingle();
    if (pErr || !person || person.workspace_id !== workspaceId) {
      return new Response(JSON.stringify({ error: "Pessoa não encontrada" }), { status: 404, headers: corsHeaders });
    }

    // Workspace name
    const { data: wsRow } = await admin.from("workspaces").select("name").eq("id", workspaceId).maybeSingle();
    const workspaceName = wsRow?.name || "Workspace";

    // CANCEL action
    if (action === "cancel") {
      await admin.from("workspace_invites")
        .update({ status: "canceled", canceled_at: new Date().toISOString() })
        .eq("workspace_id", workspaceId)
        .ilike("email", person.email || "")
        .eq("status", "pending");
      await admin.from("people").update({ invite_status: "canceled" }).eq("id", personId);
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // SEND / RESEND action — requires email & role
    const email: string = ((body.email ?? person.email) || "").toString().trim().toLowerCase();
    const role: string = (body.role || person.role) === "admin" ? "admin" : "member";
    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "E-mail inválido" }), { status: 400, headers: corsHeaders });
    }

    // Update person record
    await admin.from("people").update({ email, role, invite_status: "pending" }).eq("id", personId);

    // Cancel previous pending invites for same workspace+email
    await admin.from("workspace_invites")
      .update({ status: "canceled", canceled_at: new Date().toISOString() })
      .eq("workspace_id", workspaceId)
      .ilike("email", email)
      .eq("status", "pending");

    // Create new invite
    const { data: invite, error: inviteErr } = await admin.from("workspace_invites").insert({
      workspace_id: workspaceId,
      person_id: personId,
      email,
      role,
      invited_by: user.id,
      status: "pending",
      last_sent_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }).select("token").single();
    if (inviteErr || !invite) {
      await admin.from("people").update({ invite_status: "error" }).eq("id", personId);
      return new Response(JSON.stringify({ error: inviteErr?.message || "Erro ao criar convite" }), { status: 500, headers: corsHeaders });
    }

    const origin = req.headers.get("origin") || req.headers.get("referer") || "https://buzzup0.lovable.app";
    const acceptUrl = `${origin.replace(/\/$/, "")}/login?invite=${invite.token}`;
    const roleLabel = role === "admin" ? "Administrador" : "Membro";

    // Send email via Resend (gateway)
    if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
      await admin.from("people").update({ invite_status: "error" }).eq("id", personId);
      await admin.from("workspace_invites").update({ status: "error" }).eq("token", invite.token);
      return new Response(JSON.stringify({ error: "Resend não configurado" }), { status: 500, headers: corsHeaders });
    }

    const html = `
<div style="font-family:Arial,sans-serif;max-width:540px;margin:0 auto;padding:24px;color:#111">
  <h2 style="margin:0 0 12px">Você foi convidado para o BuzzUp</h2>
  <p>Olá! Você foi convidado para acessar o workspace <strong>${escapeHtml(workspaceName)}</strong> como <strong>${roleLabel}</strong>.</p>
  <p style="margin:28px 0">
    <a href="${acceptUrl}" style="background:#111;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;display:inline-block;font-weight:600">Aceitar convite</a>
  </p>
  <p style="font-size:12px;color:#666">Ou copie e cole este link no navegador:<br>${acceptUrl}</p>
  <p style="font-size:12px;color:#999">Este convite expira em 7 dias.</p>
</div>`.trim();

    const resendResp = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: "PROJEC <convites@send.projecjunior.com.br>",
        to: [email],
        subject: `Convite para acessar o workspace ${workspaceName}`,
        html,
      }),
    });

    if (!resendResp.ok) {
      const errBody = await resendResp.text();
      console.error("Resend error", resendResp.status, errBody);
      await admin.from("people").update({ invite_status: "error" }).eq("id", personId);
      await admin.from("workspace_invites").update({ status: "error" }).eq("token", invite.token);
      return new Response(JSON.stringify({ error: `Falha ao enviar email: ${errBody}` }), { status: 502, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true, token: invite.token }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});

function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}