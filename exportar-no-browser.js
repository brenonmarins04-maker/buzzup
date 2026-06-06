// ══════════════════════════════════════════════════════════════════
// EXPORTADOR BuzzUp — cole no Console do browser (F12) enquanto
// estiver logado no BuzzUp. Vai baixar um arquivo buzzup-backup.json
// ══════════════════════════════════════════════════════════════════

(async () => {
  const TABLES = [
    "workspaces", "profiles", "workspace_members", "workspace_join_requests",
    "people", "teams", "team_members", "projects", "project_participants",
    "tasks", "task_assignees", "posts", "post_assignees", "calendar_items",
    "categories", "channels", "event_types", "area_notes", "parking_items",
    "gamification_actions", "gamification_awards", "lead_thermometer",
    "attendance_settings", "attendance_records", "broadcasts",
  ];

  // Pega o cliente supabase que já está rodando na página
  // (importado pelo BuzzUp)
  const supabaseUrl = "https://ehuqbfbwgckusheiawsz.supabase.co";
  const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVodXFiZmJ3Z2NrdXNoZWlhd3N6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwOTU5NzcsImV4cCI6MjA5MTY3MTk3N30.MUr3EPeKyJf1BT6_E2PpXcxWXZC8CalhK9FpCTeQXUs";

  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm");
  const db = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  // Pega sessão atual do BuzzUp
  const { data: { session } } = await db.auth.getSession();
  if (!session) { alert("Você precisa estar logado no BuzzUp!"); return; }
  console.log("✅ Logado como:", session.user.email);

  // Seta o token da sessão no cliente exportador
  await db.auth.setSession(session);

  const backup = {};
  let totalRows = 0;

  for (const table of TABLES) {
    console.log(`Exportando ${table}...`);
    let rows = [];
    let from = 0;
    const PAGE = 500;
    while (true) {
      const { data, error } = await db.from(table).select("*").range(from, from + PAGE - 1);
      if (error) { console.warn(`⚠️ ${table}: ${error.message}`); break; }
      if (!data || data.length === 0) break;
      rows = rows.concat(data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    backup[table] = rows;
    totalRows += rows.length;
    console.log(`  ✅ ${table}: ${rows.length} registros`);
  }

  console.log(`\n✅ Total: ${totalRows} registros exportados. Baixando arquivo...`);

  // Baixa o JSON
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "buzzup-backup.json";
  a.click();
  URL.revokeObjectURL(url);

  console.log("📁 Arquivo buzzup-backup.json baixado! Agora rode o import no Node.js.");
})();
