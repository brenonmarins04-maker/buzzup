import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Search, Trash2, Users } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { AREAS, getAreaLabel } from "@/lib/areas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  buildTimeOptions,
  describeConflict,
  durationLabel,
  findConflicts,
  formatNameList,
  minutesToLabel,
  personName,
  resolveParticipants,
  SLOT_MIN,
  WEEKDAYS,
  type Meeting,
  type MeetingTargetType,
} from "@/lib/agenda";

interface MeetingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Reunião existente (edição) ou null (nova) */
  meeting?: Meeting | null;
  /** Horário pré-preenchido ao clicar num espaço vazio da grade */
  initial?: { weekday: number; startMin: number } | null;
}

const TIME_OPTIONS = buildTimeOptions();

export default function MeetingModal({ open, onOpenChange, meeting, initial }: MeetingModalProps) {
  const { people, teams, meetings, meetingRooms, addMeeting, updateMeeting, deleteMeeting } = useData();
  const isEdit = !!meeting;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [weekday, setWeekday] = useState(1);
  const [startMin, setStartMin] = useState(14 * 60);
  const [endMin, setEndMin] = useState(15 * 60);
  const [targetType, setTargetType] = useState<MeetingTargetType>("team");
  const [targetValue, setTargetValue] = useState<string | null>(null);
  const [personIds, setPersonIds] = useState<string[]>([]);
  const [personSearch, setPersonSearch] = useState("");
  // Segunda confirmação: o conflito avisa, mas não trava
  const [forceSave, setForceSave] = useState(false);

  // Preenche ao abrir
  useEffect(() => {
    if (!open) return;
    setForceSave(false);
    setPersonSearch("");
    if (meeting) {
      setTitle(meeting.title);
      setDescription(meeting.description);
      setRoomId(meeting.roomId);
      setWeekday(meeting.weekday);
      setStartMin(meeting.startMin);
      setEndMin(meeting.endMin);
      setTargetType(meeting.targetType);
      setTargetValue(meeting.targetValue);
      setPersonIds(meeting.personIds);
      return;
    }
    setTitle("");
    setDescription("");
    setRoomId(meetingRooms[0]?.id ?? null);
    setWeekday(initial?.weekday ?? 1);
    setStartMin(initial?.startMin ?? 14 * 60);
    setEndMin((initial?.startMin ?? 14 * 60) + 60);
    setTargetType(teams.length ? "team" : "area");
    setTargetValue(teams[0]?.id ?? AREAS[0]?.key ?? null);
    setPersonIds([]);
  }, [open, meeting, initial, meetingRooms, teams]);

  // O fim sempre anda junto com o início, mantendo a duração
  const onChangeStart = (value: number) => {
    const dur = Math.max(SLOT_MIN, endMin - startMin);
    setStartMin(value);
    setEndMin(value + dur);
    setForceSave(false);
  };

  const draft = useMemo(
    () => ({ id: meeting?.id, weekday, startMin, endMin, targetType, targetValue, personIds, roomId }),
    [meeting?.id, weekday, startMin, endMin, targetType, targetValue, personIds, roomId],
  );

  const participants = useMemo(
    () => resolveParticipants(draft, { people, teams }),
    [draft, people, teams],
  );

  const conflicts = useMemo(
    () => findConflicts(draft, meetings, { people, teams }),
    [draft, meetings, people, teams],
  );

  const filteredPeople = useMemo(() => {
    const q = personSearch.trim().toLowerCase();
    if (!q) return people;
    return people.filter(p => p.name.toLowerCase().includes(q) || (p.nickname ?? "").toLowerCase().includes(q));
  }, [people, personSearch]);

  const timeInvalid = endMin <= startMin;
  const noParticipants = participants.length === 0;
  const canSave = !!title.trim() && !timeInvalid && !noParticipants && (conflicts.length === 0 || forceSave);

  const handleSave = async () => {
    if (!canSave) return;
    const payload = {
      title: title.trim(),
      description: description.trim(),
      roomId,
      weekday,
      startMin,
      endMin,
      targetType,
      targetValue: targetType === "people" ? null : targetValue,
      personIds: targetType === "people" ? personIds : [],
    };
    if (meeting) await updateMeeting(meeting.id, payload);
    else await addMeeting(payload);
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!meeting) return;
    await deleteMeeting(meeting.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar reunião" : "Nova reunião"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Título</label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex.: Reunião de Marketing"
              className="mt-1"
              autoFocus
            />
          </div>

          {/* Dia da semana */}
          <div>
            <label className="text-sm font-medium">Dia da semana</label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {WEEKDAYS.map(d => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => { setWeekday(d.key); setForceSave(false); }}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    weekday === d.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {d.short}
                </button>
              ))}
            </div>
          </div>

          {/* Horário — sempre de 30 em 30 minutos */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Começa</label>
              <Select value={String(startMin)} onValueChange={v => onChangeStart(Number(v))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {TIME_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Termina</label>
              <Select value={String(endMin)} onValueChange={v => { setEndMin(Number(v)); setForceSave(false); }}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {TIME_OPTIONS.filter(o => o.value > startMin).map(o => (
                    <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {!timeInvalid && (
            <p className="-mt-2 text-xs text-muted-foreground">
              {minutesToLabel(startMin)} às {minutesToLabel(endMin)} · {durationLabel(startMin, endMin)}
            </p>
          )}

          {/* Sala */}
          <div>
            <label className="text-sm font-medium">Sala</label>
            <Select
              value={roomId ?? "none"}
              onValueChange={v => { setRoomId(v === "none" ? null : v); setForceSave(false); }}
            >
              <SelectTrigger className="mt-1"><SelectValue placeholder="Sem sala" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem sala</SelectItem>
                {meetingRooms.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quem participa */}
          <div>
            <label className="text-sm font-medium">Quem participa</label>
            <div className="mt-1 flex gap-1.5">
              {([
                { key: "team", label: "Time" },
                { key: "area", label: "Área" },
                { key: "people", label: "Pessoas" },
              ] as const).map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    setTargetType(opt.key);
                    setForceSave(false);
                    if (opt.key === "team") setTargetValue(teams[0]?.id ?? null);
                    else if (opt.key === "area") setTargetValue(AREAS[0]?.key ?? null);
                    else setTargetValue(null);
                  }}
                  className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    targetType === opt.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {targetType === "team" && (
              <Select value={targetValue ?? ""} onValueChange={v => { setTargetValue(v); setForceSave(false); }}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder={teams.length ? "Escolha o time" : "Nenhum time criado"} />
                </SelectTrigger>
                <SelectContent>
                  {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            {targetType === "area" && (
              <Select value={targetValue ?? ""} onValueChange={v => { setTargetValue(v); setForceSave(false); }}>
                <SelectTrigger className="mt-2"><SelectValue placeholder="Escolha a área" /></SelectTrigger>
                <SelectContent>
                  {AREAS.map(a => <SelectItem key={a.key} value={a.key}>{getAreaLabel(a.key)}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            {targetType === "people" && (
              <div className="mt-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={personSearch}
                    onChange={e => setPersonSearch(e.target.value)}
                    placeholder="Buscar pessoa..."
                    className="pl-8"
                  />
                </div>
                <div className="mt-2 max-h-44 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                  {filteredPeople.map(p => (
                    <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-accent">
                      <Checkbox
                        checked={personIds.includes(p.id)}
                        onCheckedChange={() => {
                          setPersonIds(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id]);
                          setForceSave(false);
                        }}
                      />
                      <span className="text-sm">{p.nickname?.trim() || p.name}</span>
                    </label>
                  ))}
                  {filteredPeople.length === 0 && (
                    <p className="px-1.5 py-2 text-sm text-muted-foreground">Ninguém encontrado.</p>
                  )}
                </div>
              </div>
            )}

            {/* Escolher time ou área já inclui todo mundo dele */}
            <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
              <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {noParticipants
                ? "Ninguém está nesta seleção ainda."
                : `${participants.length} ${participants.length === 1 ? "pessoa" : "pessoas"}: ${formatNameList(participants.map(id => personName(people, id)), 4)}`}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">Observações (opcional)</label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Pauta, link da chamada..."
              className="mt-1"
              rows={2}
            />
          </div>

          {/* Conflitos de horário */}
          {conflicts.length > 0 && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3">
              <div className="flex items-center gap-2 text-sm font-bold text-red-400">
                <AlertTriangle className="h-4 w-4" />
                Esse horário já está ocupado
              </div>
              <ul className="mt-2 space-y-1.5">
                {conflicts.map(c => (
                  <li key={`${c.kind}-${c.meeting.id}`} className="text-sm text-foreground/90">
                    • {describeConflict(c, { people, rooms: meetingRooms })}
                  </li>
                ))}
              </ul>
              <label className="mt-3 flex cursor-pointer items-center gap-2">
                <Checkbox checked={forceSave} onCheckedChange={v => setForceSave(v === true)} />
                <span className="text-xs text-muted-foreground">
                  Marcar mesmo assim
                </span>
              </label>
            </div>
          )}
        </div>

        <div className="mt-2 flex items-center gap-2">
          {isEdit && (
            <Button variant="ghost" onClick={handleDelete} className="text-red-400 hover:text-red-300">
              <Trash2 className="mr-1.5 h-4 w-4" />
              Excluir
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} className="ml-auto">
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!canSave} className="font-bold">
            {isEdit ? "Salvar" : "Marcar reunião"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
