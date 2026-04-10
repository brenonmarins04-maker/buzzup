import { useState } from "react";
import { posts, channels, projects, categories } from "@/lib/mock-data";
import { Plus, ExternalLink, Hash } from "lucide-react";

const statusLabels: Record<string, { label: string; class: string }> = {
  "not-started": { label: "Não Começado", class: "bg-muted text-muted-foreground" },
  "in-progress": { label: "Em Andamento", class: "bg-status-in-progress/10 text-status-in-progress border border-status-in-progress/30" },
  done: { label: "Pronto", class: "bg-status-done/10 text-status-done border border-status-done/30" },
  published: { label: "Publicado", class: "bg-status-published/10 text-status-published border border-status-published/30" },
};

const channelBadge: Record<string, string> = {
  instagram: "bg-channel-instagram",
  linkedin: "bg-channel-linkedin",
  tiktok: "bg-channel-tiktok",
  blog: "bg-channel-blog",
};

export default function ContentPage() {
  const [filterChannel, setFilterChannel] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterProject, setFilterProject] = useState("all");

  const filtered = posts.filter((p) => {
    if (filterChannel !== "all" && p.channel !== filterChannel) return false;
    if (filterStatus !== "all" && p.status !== filterStatus) return false;
    if (filterProject !== "all" && p.projectId !== filterProject) return false;
    return true;
  });

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Conteúdo</h1>
          <p className="text-sm text-muted-foreground mt-1">Planejamento de publicações</p>
        </div>
        <button className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" /> Nova Publicação
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={filterChannel}
          onChange={(e) => setFilterChannel(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">Todos canais</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">Todos status</option>
          <option value="not-started">Não Começado</option>
          <option value="in-progress">Em Andamento</option>
          <option value="done">Pronto</option>
          <option value="published">Publicado</option>
        </select>
        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">Todos projetos</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Content Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((post) => {
          const project = projects.find((p) => p.id === post.projectId);
          const st = statusLabels[post.status];

          return (
            <div
              key={post.id}
              className="bg-card border border-border rounded-lg p-5 hover:shadow-md transition-all cursor-pointer group flex flex-col gap-3"
            >
              {/* Top */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${channelBadge[post.channel]}`} />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {post.channel}
                  </span>
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${st.class}`}>
                  {st.label}
                </span>
              </div>

              {/* Title */}
              <h3 className="text-sm font-semibold text-foreground leading-snug">{post.title}</h3>

              {/* Copy */}
              <p className="text-xs text-muted-foreground line-clamp-2">{post.copy}</p>

              {/* Hashtags */}
              {post.hashtags.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  {post.hashtags.map((h) => (
                    <span key={h} className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {h}
                    </span>
                  ))}
                </div>
              )}

              {/* Meta */}
              <div className="flex items-center justify-between mt-auto pt-3 border-t border-border">
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">{post.date} • {post.time}</span>
                  <span className="text-[10px] text-muted-foreground">{post.category} • {project?.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {post.link && (
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  )}
                  <div className="flex -space-x-1">
                    {post.assignees.slice(0, 2).map((a, i) => (
                      <div
                        key={i}
                        className="h-5 w-5 rounded-full bg-accent border border-card flex items-center justify-center text-[9px] font-semibold text-foreground"
                        title={a}
                      >
                        {a.split(" ").map((n) => n[0]).join("")}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
