import { useState, useEffect } from "react";
import { useData } from "@/contexts/DataContext";
import type { Post } from "@/lib/mock-data";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  const { teams, projects, channels, categories, addPost, updatePost } = useData();
  const allMembers = teams.flatMap(t => t.members);

  const [form, setForm] = useState({
    title: "",
    copy: "",
    hashtags: "",
    cta: "",
    link: "",
    date: defaultDate || "",
    time: "10:00",
    channel: "instagram" as Post["channel"],
    category: categories[0] || "",
    status: "not-started" as Post["status"],
    assignees: [] as string[],
    projectId: projects[0]?.id || "",
  });

  useEffect(() => {
    if (post) {
      setForm({
        title: post.title,
        copy: post.copy,
        hashtags: post.hashtags.join(", "),
        cta: post.cta,
        link: post.link,
        date: post.date,
        time: post.time,
        channel: post.channel,
        category: post.category,
        status: post.status,
        assignees: post.assignees,
        projectId: post.projectId,
      });
    } else {
      setForm({
        title: "",
        copy: "",
        hashtags: "",
        cta: "",
        link: "",
        date: defaultDate || "",
        time: "10:00",
        channel: "instagram",
        category: categories[0] || "",
        status: "not-started",
        assignees: [],
        projectId: projects[0]?.id || "",
      });
    }
  }, [post, defaultDate, open, categories, projects]);

  const handleSave = () => {
    if (!form.title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }
    const data = {
      ...form,
      hashtags: form.hashtags.split(",").map(h => h.trim()).filter(Boolean),
    };
    if (post) {
      updatePost({ ...post, ...data });
      toast.success("Publicação atualizada");
    } else {
      addPost(data);
      toast.success("Publicação criada");
    }
    onOpenChange(false);
  };

  const toggleAssignee = (name: string) => {
    setForm(prev => ({
      ...prev,
      assignees: prev.assignees.includes(name)
        ? prev.assignees.filter(a => a !== name)
        : [...prev.assignees, name],
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
              <select value={form.channel} onChange={e => setForm(p => ({ ...p, channel: e.target.value as Post["channel"] }))} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
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
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Hashtags</label>
            <Input value={form.hashtags} onChange={e => setForm(p => ({ ...p, hashtags: e.target.value }))} placeholder="#marketing, #digital" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">CTA</label>
              <Input value={form.cta} onChange={e => setForm(p => ({ ...p, cta: e.target.value }))} placeholder="Saiba mais" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Link</label>
              <Input value={form.link} onChange={e => setForm(p => ({ ...p, link: e.target.value }))} placeholder="https://..." />
            </div>
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
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as Post["status"] }))} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="not-started">Não Começado</option>
                <option value="in-progress">Em Andamento</option>
                <option value="done">Pronto</option>
                <option value="published">Publicado</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Projeto</label>
            <select value={form.projectId} onChange={e => setForm(p => ({ ...p, projectId: e.target.value }))} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Responsáveis</label>
            <div className="flex flex-wrap gap-1.5">
              {allMembers.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleAssignee(m)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    form.assignees.includes(m) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input text-muted-foreground hover:bg-accent"
                  }`}
                >
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
