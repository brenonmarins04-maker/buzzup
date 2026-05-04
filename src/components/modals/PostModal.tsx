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
    } else {
      setForm(makeBlank());
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{post ? "Editar Publicação" : "Nova Publicação"}</DialogTitle></DialogHeader>
        <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Título *</label>
            <Input ref={titleRef} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Título da publicação" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Copy</label>
            <Textarea value={form.copy} onChange={e => setForm(p => ({ ...p, copy: e.target.value }))} placeholder="Texto do post..." rows={3}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSave(); } }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Canal</label>
              <select value={form.channel} onChange={e => setForm(p => ({ ...p, channel: e.target.value }))} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Categoria</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Link</label>
            <Input value={form.link} onChange={e => setForm(p => ({ ...p, link: e.target.value }))} placeholder="https://..." />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Data</label>
              <Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Horário</label>
              <Input type="time" value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="not-started">Não Começado</option>
                <option value="in-progress">Em Andamento</option>
                <option value="done">Pronto</option>
                <option value="published">Publicado</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Responsáveis</label>
            <TeamPersonSelector selectedIds={form.responsibleIds} onToggle={toggleResponsible} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Equipe</label>
            <TeamSelector selectedId={form.teamId} onChange={(id) => setForm(p => ({ ...p, teamId: id }))} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit">{post ? "Salvar" : "Criar Publicação"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
