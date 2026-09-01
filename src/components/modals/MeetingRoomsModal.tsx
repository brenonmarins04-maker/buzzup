import { useState } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const ROOM_COLORS = ["#00B4D8", "#F97316", "#10B981", "#8B5CF6", "#EC4899", "#EAB308"];

interface MeetingRoomsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MeetingRoomsModal({ open, onOpenChange }: MeetingRoomsModalProps) {
  const { meetings, meetingRooms, addMeetingRoom, updateMeetingRoom, deleteMeetingRoom } = useData();

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(ROOM_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(ROOM_COLORS[0]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await addMeetingRoom(newName.trim(), newColor);
    setNewName("");
    setNewColor(ROOM_COLORS[(meetingRooms.length + 1) % ROOM_COLORS.length]);
  };

  const startEdit = (id: string, name: string, color: string) => {
    setEditingId(id);
    setEditName(name);
    setEditColor(color);
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    await updateMeetingRoom(editingId, { name: editName.trim(), color: editColor });
    setEditingId(null);
  };

  const ColorPicker = ({ value, onChange }: { value: string; onChange: (c: string) => void }) => (
    <div className="flex gap-1.5">
      {ROOM_COLORS.map(c => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={`Cor ${c}`}
          className={`h-6 w-6 rounded-full transition-transform ${value === c ? "scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-background" : ""}`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Salas de reunião</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {meetingRooms.map(room => {
            const usadaPor = meetings.filter(m => m.roomId === room.id).length;
            if (editingId === room.id) {
              return (
                <div key={room.id} className="rounded-xl border border-border p-3">
                  <Input value={editName} onChange={e => setEditName(e.target.value)} className="mb-2" />
                  <div className="flex items-center justify-between">
                    <ColorPicker value={editColor} onChange={setEditColor} />
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                      <Button size="sm" onClick={saveEdit} disabled={!editName.trim()}>
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            }
            return (
              <div key={room.id} className="flex items-center gap-2 rounded-xl border border-border p-3">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: room.color }} />
                <button
                  type="button"
                  onClick={() => startEdit(room.id, room.name, room.color)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-sm font-medium">{room.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {usadaPor === 0 ? "Sem reuniões" : `${usadaPor} ${usadaPor === 1 ? "reunião" : "reuniões"}`}
                  </span>
                </button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteMeetingRoom(room.id)}
                  className="text-red-400 hover:text-red-300"
                  aria-label={`Remover ${room.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}

          {meetingRooms.length === 0 && (
            <p className="py-2 text-sm text-muted-foreground">
              Nenhuma sala ainda. Crie a primeira abaixo.
            </p>
          )}
        </div>

        {/* Nova sala */}
        <div className="rounded-xl border border-dashed border-border p-3">
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
            placeholder="Nome da sala"
          />
          <div className="mt-2 flex items-center justify-between">
            <ColorPicker value={newColor} onChange={setNewColor} />
            <Button size="sm" onClick={handleAdd} disabled={!newName.trim()}>
              <Plus className="mr-1 h-4 w-4" />
              Adicionar
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Apagar uma sala não apaga as reuniões dela — elas ficam sem sala.
        </p>
      </DialogContent>
    </Dialog>
  );
}
