import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Crown, Shield, Zap, Users } from "lucide-react";

type Props = { open: boolean; onOpenChange: (o: boolean) => void };

const ROLES = [
  {
    role: "Owner",
    icon: Crown,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50 border-yellow-200",
    permissions: [
      "Acesso total a tudo",
      "Gerenciar membros e cargos",
      "Excluir o workspace",
      "Editar configurações",
      "Criar e deletar demandas",
      "Mover demandas entre pessoas",
      "Gerenciar gamificação",
    ],
  },
  {
    role: "Admin",
    icon: Shield,
    color: "text-blue-600",
    bgColor: "bg-blue-50 border-blue-200",
    permissions: [
      "Criar e gerenciar demandas em todas as áreas",
      "Mover demandas entre pessoas",
      "Editar informações de pessoas",
      "Definir áreas de trabalho",
      "Designar líderes de área",
      "Gerenciar gamificação",
      "Ver relatórios completos",
    ],
  },
  {
    role: "Líder",
    icon: Zap,
    color: "text-purple-600",
    bgColor: "bg-purple-50 border-purple-200",
    permissions: [
      "Criar e gerenciar demandas APENAS da sua área",
      "Mover demandas APENAS da sua área",
      "Ver informações de sua equipe",
      "Gerenciar presença de sua equipe",
      "Não pode criar usuários ou alterar cargos",
    ],
    note: "Cada líder gerencia apenas uma área específica",
  },
  {
    role: "Membro",
    icon: Users,
    color: "text-green-600",
    bgColor: "bg-green-50 border-green-200",
    permissions: [
      "Ver demandas atribuídas",
      "Marcar presenças",
      "Ver atividades recentes",
      "Ver dados de gamificação",
      "Não pode criar ou mover demandas",
    ],
  },
];

export default function RolesInfoModal({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Estrutura de Cargos e Permissões</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ROLES.map((r) => {
            const Icon = r.icon;
            return (
              <div key={r.role} className={`border rounded-lg p-4 ${r.bgColor}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon className={`h-6 w-6 ${r.color}`} />
                  <h3 className="font-bold text-lg">{r.role}</h3>
                </div>

                <ul className="space-y-2">
                  {r.permissions.map((perm, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <span className="text-xs mt-1.5">✓</span>
                      <span className="text-foreground">{perm}</span>
                    </li>
                  ))}
                </ul>

                {r.note && (
                  <p className="text-[11px] text-muted-foreground mt-3 p-2 bg-black/5 rounded italic">
                    💡 {r.note}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 p-4 bg-accent rounded-lg">
          <h4 className="font-semibold mb-2 text-sm">Como designar um Líder?</h4>
          <ol className="text-sm space-y-1 text-muted-foreground">
            <li>1. Vá em <strong>Pessoas → Membros</strong></li>
            <li>2. Clique para editar um membro</li>
            <li>3. Na seção "Configurações de Administrador", selecione a área</li>
            <li>4. Salve as alterações</li>
          </ol>
        </div>
      </DialogContent>
    </Dialog>
  );
}
