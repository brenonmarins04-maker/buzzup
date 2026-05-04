import { useState, useEffect, useRef } from "react";
import { useData } from "@/contexts/DataContext";
import type { Post } from "@/contexts/DataContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useFormMemory } from "@/hooks/useFormMemory";
import TeamPersonSelector from "@/components/TeamPersonSelector";
import TeamSelector from "@/components/TeamSelector";
import { ChevronDown } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post?: Post | null;
  defaultDate?: string;
};

export default function PostModal({ open, onOpenChange, post, defaultDate }: Props) {
  const { people, channels, categories, addPost, updatePost } = useData();
  const { memory, remember } = useFormMemory();
  const titleRef = useRef<HTMLInputElement>(null);
  const [showMore, setShowMore] = useState(false);

  const makeBlank = () => ({
    title: "", copy: "", link: "", date: defaultDate || "", time: "10:00",
    channel: memory.lastChannel || channels[0]?.id || "",
    category: memory.lastCategory || categories[0] || "",
    status: "not-started", responsibleIds: [] as string[], media_url: "",
    teamId: (memory.lastTeamId as string | null) ?? null,
  });

  const [form, setForm] = useState(makeBlank);

  useEffect(() => {
    if (post) {
      setForm({
        title: post.title, copy: post.copy, link: post.link, date: post.date,
        time: post.time, channel: post.channel, category: post.category,
        status: post.status, responsibleIds: post.responsible.map(r => r.id), media_url: post.media_url,
        teamId: post.teamId,
      });
      setShowMore(!!(post.link || post.responsible.length));
    } else {
      setForm(makeBlank());
      setShowMore(false);
    }
  }, [post, defaultDate, open, categories, channels]);

  const handleSave = () => {
    if (!form.title.trim()) { toast.error("Título é obrigatório"); return; }
    remember({ lastChannel: form.channel, lastCategory: form.category, lastTeamId: form.teamId });
    if (post) {
      updatePost({
        ...post, title: form.title, copy: form.copy, link: form.link, date: form.date,
        time: form.time, channel: form.channel, category: form.category, status: form.status,
        responsible: people.filter(p => form.responsibleIds.includes(p.id)), media_url: form.media_url,
        teamId: form.teamId,
      });
      toast.success("Publicação atualizada");
      onOpenChange(false);
    } else {
      addPost(form);
      toast.success("Publicação criada");
      setForm({ ...makeBlank(), channel: form.channel, category: form.category, date: form.date, teamId: form.teamId });
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  };

  const toggleResponsible = (id: string) => {
    setForm(prev => ({
      ...prev,
      responsibleIds: prev.responsibleIds.includes(id) ? prev.responsibleIds.filter(a => a !== id) : [...prev.responsibleIds, id],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-2">
          <DialogTitle className="text-base font-medium text-muted-foreground">
            {post ? "Editar publicação" : "Nova publicação"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="flex flex-col">
          <div className="px-5 pb-3">
            <Input
              ref={titleRef}
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="Título"
              className="border-0 px-0 text-xl font-semibold shadow-none focus-visible:ring-0 h-auto py-1 placeholder:text-muted-foreground/50"
            />
            <Textarea
              value={form.copy}
              onChange={e => setForm(p => ({ ...p, copy: e.target.value }))}
              placeholder="Texto do post..."
              rows={3}
              className="border-0 px-0 shadow-none focus-visible:ring-0 resize-none placeholder:text-muted-foreground/50"
              onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSave(); } }}
            />
          </div>

          <div className="px-5 py-3 border-t border-border/60 grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                className="h-9 text-sm border-0 bg-muted/50 focus-visible:ring-1" />
              <Input type="time" value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))}
                className="h-9 text-sm border-0 bg-muted/50 focus-visible:ring-1 w-24" />
            </div>
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
              className="h-9 rounded-md border-0 bg-muted/50 px-3 text-sm">
              <option value="not-started">Não começado</option>
              <option value="in-progress">Em andamento</option>
              <option value="done">Pronto</option>
              <option value="published">Publicado</option>
            </select>
            <select value={form.channel} onChange={e => setForm(p => ({ ...p, channel: e.target.value }))}
              className="h-9 rounded-md border-0 bg-muted/50 px-3 text-sm">
              {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
              className="h-9 rounded-md border-0 bg-muted/50 px-3 text-sm">
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="px-5 py-3 border-t border-border/60">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Equipe</p>
            <TeamSelector selectedId={form.teamId} onChange={(id) => setForm(p => ({ ...p, teamId: id }))} />
          </div>

          <div className="border-t border-border/60">
            <button type="button" onClick={() => setShowMore(s => !s)}
              className="w-full flex items-center justify-between px-5 py-2.5 text-xs font-medium text-muted-foreground hover:bg-accent/40 transition-colors">
              <span>Mais opções{form.responsibleIds.length > 0 ? ` · ${form.responsibleIds.length} responsável(is)` : ""}{form.link ? " · com link" : ""}</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showMore ? "rotate-180" : ""}`} />
            </button>
            {showMore && (
              <div className="px-5 pb-4 flex flex-col gap-3">
                <Input value={form.link} onChange={e => setForm(p => ({ ...p, link: e.target.value }))} placeholder="Link (https://...)"
                  className="h-9 text-sm border-0 bg-muted/50 focus-visible:ring-1" />
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Responsáveis</p>
                  <TeamPersonSelector selectedIds={form.responsibleIds} onToggle={toggleResponsible} />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 px-5 py-3 border-t border-border/60 bg-muted/20">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" size="sm">{post ? "Salvar" : "Criar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
