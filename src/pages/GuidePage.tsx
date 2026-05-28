import { useAuth } from "@/contexts/AuthContext";
import {
  LogIn, Sparkles, KeyRound, Home, CalendarDays, Users, FolderKanban,
  Briefcase, Crown, Shield, Eye, Plus, Megaphone, Bell, HelpCircle,
} from "lucide-react";

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card border border-border rounded-lg p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
      </div>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

function MenuRow({ icon: Icon, name, desc }: { icon: any; name: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="h-7 w-7 rounded-md bg-accent flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="h-3.5 w-3.5 text-foreground" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{name}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </div>
  );
}

function RoleCard({ icon: Icon, name, color, items }: { icon: any; name: string; color: string; items: string[] }) {
  return (
    <div className="border border-border rounded-lg p-4 bg-background/50">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-sm font-semibold text-foreground">{name}</span>
      </div>
      <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
        {items.map((i, k) => <li key={k}>{i}</li>)}
      </ul>
    </div>
  );
}

export default function GuidePage() {
  const { role } = useAuth();
  const roleLabel = role === "owner" ? "Owner" : role === "admin" ? "Admin" : role === "member" ? "Member" : "—";

  return (
    <div className="animate-fade-in max-w-3xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight flex items-center gap-2">
            <HelpCircle className="h-6 w-6 text-primary" /> Guia rápido do BuzzUp
          </h1>
          <p className="text-sm text-muted-foreground">Do login até o menu — como usar o app no dia a dia.</p>
        </div>
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
          Seu cargo: {roleLabel}
        </span>
      </div>

      <Section icon={LogIn} title="1. Login">
        <p>Cada pessoa tem seu próprio e-mail e senha (não existe mais login compartilhado).</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Entrar:</strong> digite e-mail e senha já cadastrados.</li>
          <li><strong>Criar conta:</strong> informe nome, e-mail e senha.</li>
          <li><strong>Esqueci a senha:</strong> envia link de redefinição por e-mail.</li>
        </ul>
      </Section>

      <Section icon={Sparkles} title="2. Boas-vindas — primeira entrada">
        <p>Se você ainda não pertence a nenhum workspace, o app abre a tela de boas-vindas com dois caminhos:</p>
        <div className="grid sm:grid-cols-2 gap-3 mt-2">
          <div className="border border-border rounded-md p-3">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Criar workspace</span>
            </div>
            <p className="text-xs text-muted-foreground">Você dá um nome e vira <strong>Owner</strong> automaticamente.</p>
          </div>
          <div className="border border-border rounded-md p-3">
            <div className="flex items-center gap-2 mb-1">
              <KeyRound className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Entrar com código</span>
            </div>
            <p className="text-xs text-muted-foreground">Cole um código <code className="text-[11px]">BUZZ-XXXXXX</code> recebido de um Owner ou Admin.</p>
          </div>
        </div>
      </Section>

      <Section icon={Home} title="3. O menu — centro do app">
        <p>O menu fica na <strong>lateral esquerda</strong> no desktop e na <strong>barra inferior</strong> no celular. É por ele que você acessa todas as áreas do workspace, vê seu cargo e sai do app.</p>
        <div className="mt-3 divide-y divide-border">
          <MenuRow icon={Home} name="Início" desc="Dashboard com alertas, métricas e visão do dia." />
          <MenuRow icon={CalendarDays} name="Calendário" desc="Eventos, posts e tarefas em um calendário unificado." />
          <MenuRow icon={Users} name="Pessoas" desc="Cadastro de pessoas, equipes, gamificação e histórico." />
          <MenuRow icon={FolderKanban} name="Projetos" desc="Gestão de projetos internos." />
          <MenuRow icon={Briefcase} name="Mercado" desc="Área do time de Mercado." />
          <MenuRow icon={Sparkles} name="GG" desc="Área da Gestão de Gente." />
          <MenuRow icon={Crown} name="Presidência" desc="Área da Presidência." />
          <MenuRow icon={Shield} name="Acessos" desc="Membros e convites do workspace (você está aqui em /members)." />
        </div>
      </Section>

      <Section icon={Plus} title="4. Atalhos do menu">
        <div className="grid sm:grid-cols-3 gap-3">
          <MenuRow icon={Plus} name="Botão + (FAB)" desc="Cria Tarefa, Post ou Evento rapidamente. Visível para Owner e Admin." />
          <MenuRow icon={Megaphone} name="Mensagem geral" desc="Aviso fixo no topo para todos. Owner e Admin." />
          <MenuRow icon={Bell} name="Notificações" desc="Alertas de prazos e novidades." />
        </div>
      </Section>

      <Section icon={Shield} title="5. Cargos e permissões">
        <div className="grid sm:grid-cols-3 gap-3">
          <RoleCard icon={Crown} name="Owner" color="text-amber-500" items={[
            "Controla tudo",
            "Cria convites de Admin e Member",
            "Promove, rebaixa e remove",
            "Não pode ser removido",
          ]} />
          <RoleCard icon={Shield} name="Admin" color="text-primary" items={[
            "Cria e edita conteúdo",
            "Cria convites só de Member",
            "Remove só Members",
            "Não mexe em Owner/Admin",
          ]} />
          <RoleCard icon={Eye} name="Member" color="text-muted-foreground" items={[
            "Apenas visualiza",
            "Não cria nem edita",
            "Não convida",
            "Não remove ninguém",
          ]} />
        </div>
        <p className="text-xs mt-3">As regras são validadas no <strong>banco de dados</strong>, não só na tela — não é possível burlar pelo navegador.</p>
      </Section>

      <Section icon={KeyRound} title="6. Convidar alguém (Acessos)">
        <ol className="list-decimal pl-5 space-y-1">
          <li>Abra <strong>Acessos</strong> no menu.</li>
          <li>Clique em <strong>Gerar convite</strong>.</li>
          <li>Escolha o cargo, a validade (1h, 24h ou 7 dias) e os usos.</li>
          <li>Copie o código exibido — <strong>ele aparece apenas uma vez</strong>.</li>
          <li>Envie manualmente por WhatsApp, mensagem ou presencialmente.</li>
        </ol>
        <p className="text-xs">A pessoa entra pela tela de boas-vindas usando <strong>Entrar com código</strong>.</p>
      </Section>
    </div>
  );
}
