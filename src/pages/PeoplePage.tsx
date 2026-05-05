import { useState, useRef } from "react";
import { useData, type Person } from "@/contexts/DataContext";
import { Plus, Pencil, Trash2, Mail, Send, XCircle, RefreshCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

type FormState = { name: string; email: string; role: "admin" | "member" };
const empty: FormState = { name: "", email: "", role: "member" };

export default function PeoplePage() {
  const { people, addPerson, updatePerson, deletePerson, invitePerson, resendInvite, cancelInvite } = useData();
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState<{ open: boolean; id: string }>({ open: false, id: "" });
  const [form, setForm] = useState<FormState>(empty);
  const [submitting, setSubmitting] = useState(false);
  const addRef = useRef<HTMLInputElement>(null);

  const handleAdd = async (sendEmail: boolean) => {
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    if (sendEmail && !form.email.trim()) { toast.error("E-mail é obrigatório para enviar convite"); return; }
    setSubmitting(true);
    const email = form.email.trim().toLowerCase();
    await addPerson(form.name.trim(), email, form.role);
    if (sendEmail && email) {
      // find newly created person id
      const justCreated = people.find(p => p.email === email);
      // small delay to ensure state updated; fallback fetch
      setTimeout(async () => {
        const target = justCreated || (window as any).__lastPerson;
        // Find via current people state read after re-render is awkward — do a fresh query via context (people may not include yet).
        const { supabase } = await import("@/integrations/supabase/client");
        const { data } = await supabase.from("people").select("id").eq("email", email).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (data?.id) await invitePerson(data.id, email, form.role);
      }, 200);
    } else {
      toast.success("Pessoa adicionada");
    }
    setForm(empty);
    setSubmitting(false);
    setAddModal(false);
    setTimeout(() => addRef.current?.focus(), 50);
  };

  const handleEdit = async (sendEmail: boolean) => {
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    setSubmitting(true);
    await updatePerson(editModal.id, form.name.trim(), form.email.trim().toLowerCase(), form.role);
    if (sendEmail && form.email.trim()) await invitePerson(editModal.id, form.email.trim().toLowerCase(), form.role);
    else toast.success("Pessoa atualizada");
    setEditModal({ open: false, id: "" });
    setForm(empty);
    setSubmitting(false);
  };

  const openEdit = (p: Person) => {
    setForm({ name: p.name, email: p.email || "", role: (p.role as any) === "admin" ? "admin" : "member" });
    setEditModal({ open: true, id: p.id });
  };

  const roleLabel = (r?: string) => r === "admin" ? "Administrador" : "Membro";

  const inviteBadge = (p: Person) => {
    const s = p.invite_status || "not_sent";
    const map: Record<string, { label: string; cls: string }> = {
      not_sent:  { label: "Não enviado",       cls: "bg-muted text-muted-foreground" },
      pending:   { label: "Convite enviado",   cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
      accepted:  { label: "Aceito",            cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
      expired:   { label: "Expirado",          cls: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300" },
      canceled:  { label: "Cancelado",         cls: "bg-muted text-muted-foreground" },
      error:     { label: "Erro no envio",     cls: "bg-destructive/15 text-destructive" },
    };
    const m = map[s] || map.not_sent;
    return <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${m.cls}`}>{m.label}</span>;
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Pessoas</h1>
          <p className="text-sm text-muted-foreground mt-1">{people.length} pessoas no workspace</p>
        </div>
        <button onClick={() => { setAddModal(true); setForm(empty); }}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" /> Nova Pessoa
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {people.map((person) => (
          <div key={person.id} className="flex items-start justify-between bg-card border border-border rounded-lg px-4 py-3 group">
            <div className="flex items-start gap-3 min-w-0">
              <div className="h-9 w-9 rounded-full bg-accent flex items-center justify-center text-xs font-semibold text-foreground shrink-0">
                {person.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{person.name}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${person.role === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {roleLabel(person.role)}
                  </span>
                </div>
                {person.email && <div className="text-xs text-muted-foreground truncate mt-0.5">{person.email}</div>}
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button onClick={() => openEdit(person)} className="p-1 hover:bg-accent rounded text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>
              <button onClick={() => { deletePerson(person.id); toast.success("Pessoa removida"); }}
                className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
      </div>

      {people.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhuma pessoa cadastrada. Adicione pessoas para atribuí-las a tarefas, publicações e projetos.</p>
      )}

      <Dialog open={addModal} onOpenChange={(o) => { setAddModal(o); if (!o) setForm(empty); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Adicionar Pessoa</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); handleAdd(false); }} className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome</label>
              <Input ref={addRef} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Nome da pessoa" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">E-mail (opcional)</label>
              <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="email@empresa.com" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Cargo</label>
              <Select value={form.role} onValueChange={(v) => setForm(p => ({ ...p, role: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Membro</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button type="submit" variant="outline" disabled={submitting}>Salvar</Button>
              <Button type="button" disabled={submitting || !form.email.trim()} onClick={() => handleAdd(true)} className="gap-1.5">
                <Mail className="h-3.5 w-3.5" /> Salvar e enviar convite
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editModal.open} onOpenChange={o => { if (!o) { setEditModal({ open: false, id: "" }); setForm(empty); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Editar Pessoa</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); handleEdit(false); }} className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome</label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">E-mail</label>
              <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="email@empresa.com" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Cargo</label>
              <Select value={form.role} onValueChange={(v) => setForm(p => ({ ...p, role: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Membro</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button type="submit" variant="outline" disabled={submitting}>Salvar</Button>
              <Button type="button" disabled={submitting || !form.email.trim()} onClick={() => handleEdit(true)} className="gap-1.5">
                <Mail className="h-3.5 w-3.5" /> Salvar e enviar convite
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
