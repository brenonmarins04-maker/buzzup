import { useState, useEffect } from "react";
import { useData } from "@/contexts/DataContext";
import type { Post } from "@/contexts/DataContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post?: Post | null;
  defaultDate?: string;
};

export default function PostModal({ open, onOpenChange, post, defaultDate }: Props) {
  const { allMembers, channels, categories, addPost, updatePost } = useData();

  const [form, setForm] = useState({
    title: "", copy: "", link: "", date: defaultDate || "", time: "10:00",
    channel: channels[0]?.id || "", category: categories[0] || "",
    status: "not-started", responsible: [] as string[], media_url: "",
  });

  useEffect(() => {
    if (post) {
      setForm({
        title: post.title, copy: post.copy, link: post.link, date: post.date,
        time: post.time, channel: post.channel, category: post.category,
        status: post.status, responsible: post.responsible, media_url: post.media_url,
      });
    } else {
      setForm({
        title: "", copy: "", link: "", date: defaultDate || "", time: "10:00",
        channel: channels[0]?.id || "", category: categories[0] || "",
        status: "not-started", responsible: [], media_url: "",
      });
    }
  }, [post, defaultDate, open, categories, channels]);

  const handleSave = () => {
    if (!form.title.trim()) { toast.error("Título é obrigatório"); return; }
    if (post) {
      updatePost({ ...post, ...form });
      toast.success("Publicação atualizada");
    } else {
      addPost(form);
      toast.success("Publicação criada");
    }
    onOpenChange(false);
  };

  const toggleResponsible = (name: string) => {
    setForm(prev => ({
      ...prev,
      responsible: prev.responsible.includes(name) ? prev.responsible.filter(a => a !== name) : [...prev.responsible, name],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{post ? "Editar Publicação" : "Nova Publicação"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Título *</label>
            <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Título da publicação" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Copy</label>
            <Textarea value={form.copy} onChange={e => setForm(p => ({ ...p, copy: e.target.value }))} placeholder="Texto do post..." rows={3} />
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
            <div className="flex flex-wrap gap-1.5">
              {allMembers.map(m => (
                <button key={m} type="button" onClick={() => toggleResponsible(m)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${form.responsible.includes(m) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input text-muted-foreground hover:bg-accent"}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{post ? "Salvar" : "Criar Publicação"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
