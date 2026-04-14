import { useState } from "react";
import { useData } from "@/contexts/DataContext";
import type { Post } from "@/contexts/DataContext";
import { Plus, ExternalLink, Settings, X } from "lucide-react";
import PostModal from "@/components/modals/PostModal";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import FilterChips from "@/components/FilterChips";

const statusLabels: Record<string, { label: string; class: string }> = {
  "not-started": { label: "Não Começado", class: "bg-muted text-muted-foreground" },
  "in-progress": { label: "Em Andamento", class: "bg-status-in-progress/10 text-status-in-progress border border-status-in-progress/30" },
  done: { label: "Pronto", class: "bg-status-done/10 text-status-done border border-status-done/30" },
  published: { label: "Publicado", class: "bg-status-published/10 text-status-published border border-status-published/30" },
};

export default function ContentPage() {
  const { posts, channels, categories, addCategory, removeCategory, addChannel, removeChannel, deletePost } = useData();
  const [filterChannels, setFilterChannels] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [modal, setModal] = useState<{ open: boolean; post?: Post | null }>({ open: false });
  const [tab, setTab] = useState<"active" | "done">("active");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [newChannel, setNewChannel] = useState("");
  const [deleting, setDeleting] = useState<{ open: boolean; id: string; title: string }>({ open: false, id: "", title: "" });

  const filtered = posts.filter((p) => {
    if (filterChannels.length > 0 && !filterChannels.includes(p.channel)) return false;
    if (filterStatuses.length > 0 && !filterStatuses.includes(p.status)) return false;
    if (tab === "active") return p.status !== "done" && p.status !== "published";
    return p.status === "done" || p.status === "published";
  });

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Conteúdo</h1>
          <p className="text-sm text-muted-foreground mt-1">Planejamento de publicações</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setSettingsOpen(true)} className="flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-accent text-muted-foreground transition-colors">
            <Settings className="h-4 w-4" />
            <span className="text-[10px] hidden sm:inline">Editar canal/categoria</span>
          </button>
          <button onClick={() => setModal({ open: true })} className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4" /> Nova Publicação
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-muted rounded-md p-0.5">
          <button onClick={() => setTab("active")} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${tab === "active" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>Ativas</button>
          <button onClick={() => setTab("done")} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${tab === "done" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>Concluídas</button>
        </div>
        <FilterChips label="Canal" options={channels.map(c => ({ value: c.id, label: c.name }))} selected={filterChannels} onChange={setFilterChannels} />
        <FilterChips label="Status" options={[
          { value: "not-started", label: "Não Começado" },
          { value: "in-progress", label: "Em Andamento" },
          { value: "done", label: "Pronto" },
          { value: "published", label: "Publicado" },
        ]} selected={filterStatuses} onChange={setFilterStatuses} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((post) => {
          const ch = channels.find(c => c.id === post.channel);
          const st = statusLabels[post.status];
          return (
            <div key={post.id} onClick={() => setModal({ open: true, post })} className="bg-card border border-border rounded-lg p-5 hover:shadow-md transition-all cursor-pointer group flex flex-col gap-3 relative">
              <button onClick={e => { e.stopPropagation(); setDeleting({ open: true, id: post.id, title: post.title }); }}
                className="absolute top-2 right-2 h-6 w-6 rounded-full bg-destructive/10 text-destructive flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20">
                <X className="h-3.5 w-3.5" />
              </button>
              <div className="flex items-start justify-between pr-6">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{ch?.name || post.channel}</span>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${st?.class}`}>{st?.label}</span>
              </div>
              <h3 className="text-sm font-semibold text-foreground leading-snug">{post.title}</h3>
              <p className="text-xs text-muted-foreground line-clamp-2">{post.copy}</p>
              <div className="flex items-center justify-between mt-auto pt-3 border-t border-border">
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">{post.date} • {post.time}</span>
                  <span className="text-[10px] text-muted-foreground">{post.category}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {post.link && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
                  <div className="flex -space-x-1">
                    {post.responsible.slice(0, 2).map((a, i) => (
                      <div key={i} className="h-5 w-5 rounded-full bg-accent border border-card flex items-center justify-center text-[9px] font-semibold text-foreground" title={a}>
                        {a.split(" ").map(n => n[0]).join("")}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground col-span-full text-center py-8">Nenhuma publicação</p>}
      </div>

      <PostModal open={modal.open} onOpenChange={o => setModal({ open: o })} post={modal.post} />
      <DeleteConfirmDialog open={deleting.open} onOpenChange={o => setDeleting(p => ({ ...p, open: o }))}
        title={deleting.title} onConfirm={() => { deletePost(deleting.id); toast.success("Publicação excluída"); }} />

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Gerenciar Canais e Categorias</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Canais</h3>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {channels.map(c => (
                  <div key={c.id} className="flex items-center gap-1 bg-muted px-2 py-1 rounded-full text-xs">
                    <span>{c.name}</span>
                    <button onClick={() => { removeChannel(c.id); toast.success("Canal removido"); }} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={newChannel} onChange={e => setNewChannel(e.target.value)} placeholder="Novo canal..." className="h-8 text-sm" />
                <Button size="sm" variant="outline" onClick={() => { if (newChannel.trim()) { addChannel({ name: newChannel.trim(), color: "channel-blog" }); setNewChannel(""); toast.success("Canal adicionado"); } }}>Adicionar</Button>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Categorias</h3>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {categories.map(c => (
                  <div key={c} className="flex items-center gap-1 bg-muted px-2 py-1 rounded-full text-xs">
                    <span>{c}</span>
                    <button onClick={() => { removeCategory(c); toast.success("Categoria removida"); }} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="Nova categoria..." className="h-8 text-sm" />
                <Button size="sm" variant="outline" onClick={() => { if (newCategory.trim()) { addCategory(newCategory.trim()); setNewCategory(""); toast.success("Categoria adicionada"); } }}>Adicionar</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
