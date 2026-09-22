import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useData, type ParkingItem, type ParkingItemStatus } from "@/contexts/DataContext";
import { normalizeToISODate } from "@/lib/demandStatus";

/**
 * A linha como vem do banco. Declarada aqui porque os tipos gerados do
 * Supabase estão desatualizados — não têm completed_at nem completed_by.
 */
type LinhaDemanda = {
  id: string;
  area: string;
  person_id: string | null;
  title: string;
  description: string | null;
  date: string | null;
  position: number | null;
  status: string | null;
  points: number | null;
  completed_at: string | null;
  completed_by: string | null;
};

/**
 * Demandas concluídas dentro de um período, buscadas sob demanda.
 *
 * O app só mantém à mão as demandas em andamento e as concluídas há pouco —
 * as antigas ficam no banco sem pesar no carregamento. Os relatórios, porém,
 * podem olhar qualquer período, inclusive anterior a isso. Então eles buscam
 * o próprio recorte, em vez de depender do que está carregado.
 *
 * Como efeito colateral bom, a busca traz só a janela pedida: é menos dado
 * que varrer a lista inteira em memória.
 */
export function useCompletedDemands(range: { start: string; end: string }) {
  const { workspaceId } = useData();
  const [itens, setItens] = useState<ParkingItem[]>([]);

  useEffect(() => {
    if (!workspaceId || !range.start || !range.end) { setItens([]); return; }

    let cancelado = false;

    (async () => {
      // Uma folga de um dia em cada ponta cobre a diferença de fuso entre o
      // carimbo no banco (UTC) e o dia local usado no filtro da tela
      const de = new Date(range.start + "T00:00:00");
      de.setDate(de.getDate() - 1);
      const ate = new Date(range.end + "T00:00:00");
      ate.setDate(ate.getDate() + 2);

      const { data, error } = await (supabase.from as any)("parking_items")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("status", "done")
        .gte("completed_at", de.toISOString())
        .lt("completed_at", ate.toISOString());

      if (cancelado || error) return;

      setItens((data ?? []).map((p: LinhaDemanda): ParkingItem => ({
        id: p.id,
        area: p.area,
        personId: p.person_id ?? null,
        title: p.title,
        description: p.description ?? "",
        date: normalizeToISODate(p.date) ?? "",
        position: p.position ?? 0,
        status: (p.status as ParkingItemStatus) ?? "done",
        points: p.points ?? 1,
        completedAt: p.completed_at ?? null,
        completedBy: p.completed_by ?? null,
      })));
    })();

    return () => { cancelado = true; };
  }, [workspaceId, range.start, range.end]);

  return itens;
}
