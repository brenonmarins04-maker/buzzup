export type Team = {
  id: string;
  name: string;
  color: string;
  members: string[];
  leader: string;
};

export type Project = {
  id: string;
  name: string;
  teamId: string;
  status: 'active' | 'completed' | 'paused';
};

export type Task = {
  id: string;
  title: string;
  description: string;
  assignees: string[];
  teamId: string;
  projectId: string;
  deadline: string;
  status: 'not-started' | 'in-progress' | 'done';
  priority: 'high' | 'medium' | 'low';
};

export type Post = {
  id: string;
  title: string;
  copy: string;
  hashtags: string[];
  cta: string;
  link: string;
  date: string;
  time: string;
  channel: 'instagram' | 'linkedin' | 'tiktok' | 'blog';
  category: string;
  status: 'not-started' | 'in-progress' | 'done' | 'published';
  assignees: string[];
  projectId: string;
};

export type CalendarEvent = {
  id: string;
  name: string;
  date: string;
  time: string;
  type: 'meeting' | 'event' | 'delivery';
  participants: string[];
  description: string;
  projectId?: string;
};

export const teams: Team[] = [
  { id: 't1', name: 'Gente e Gestão', color: 'team-gente', members: ['Ana Silva', 'Carlos Melo'], leader: 'Ana Silva' },
  { id: 't2', name: 'Mercado', color: 'team-mercado', members: ['Bruno Costa', 'Daniela Rocha', 'Eduardo Lima'], leader: 'Bruno Costa' },
  { id: 't3', name: 'Presidência', color: 'team-presidencia', members: ['Fernanda Alves', 'Gustavo Santos'], leader: 'Fernanda Alves' },
  { id: 't4', name: 'Projetos', color: 'team-projetos', members: ['Helena Martins', 'Igor Pereira', 'Juliana Neves'], leader: 'Helena Martins' },
];

export const projects: Project[] = [
  { id: 'p1', name: 'Campanha de Verão', teamId: 't2', status: 'active' },
  { id: 'p2', name: 'Rebranding Institucional', teamId: 't4', status: 'active' },
  { id: 'p3', name: 'Evento Anual 2026', teamId: 't3', status: 'active' },
];

export const tasks: Task[] = [
  { id: 'tk1', title: 'Definir paleta de cores', description: 'Escolher cores para a nova identidade visual', assignees: ['Helena Martins', 'Igor Pereira'], teamId: 't4', projectId: 'p2', deadline: '2026-04-12', status: 'in-progress', priority: 'high' },
  { id: 'tk2', title: 'Briefing fotográfico', description: 'Preparar briefing para ensaio de fotos', assignees: ['Bruno Costa'], teamId: 't2', projectId: 'p1', deadline: '2026-04-14', status: 'not-started', priority: 'medium' },
  { id: 'tk3', title: 'Revisão do contrato', description: 'Revisar contrato com fornecedor do evento', assignees: ['Fernanda Alves'], teamId: 't3', projectId: 'p3', deadline: '2026-04-11', status: 'done', priority: 'high' },
  { id: 'tk4', title: 'Montar cronograma de posts', description: 'Planejar conteúdo do mês de maio', assignees: ['Daniela Rocha', 'Eduardo Lima'], teamId: 't2', projectId: 'p1', deadline: '2026-04-15', status: 'not-started', priority: 'low' },
  { id: 'tk5', title: 'Atualizar manual da marca', description: 'Incluir novas diretrizes visuais', assignees: ['Helena Martins'], teamId: 't4', projectId: 'p2', deadline: '2026-04-18', status: 'in-progress', priority: 'medium' },
  { id: 'tk6', title: 'Confirmar palestrantes', description: 'Entrar em contato e confirmar presença', assignees: ['Gustavo Santos'], teamId: 't3', projectId: 'p3', deadline: '2026-04-13', status: 'not-started', priority: 'high' },
];

export const posts: Post[] = [
  { id: 'ps1', title: 'Lançamento Verão 2026', copy: 'O verão chegou e trouxe novidades!', hashtags: ['#verão2026', '#novidades'], cta: 'Saiba mais', link: 'https://example.com', date: '2026-04-12', time: '10:00', channel: 'instagram', category: 'Lançamento', status: 'done', assignees: ['Bruno Costa'], projectId: 'p1' },
  { id: 'ps2', title: 'Bastidores do Rebranding', copy: 'Acompanhe a transformação da nossa marca', hashtags: ['#rebranding', '#bastidores'], cta: 'Confira', link: '', date: '2026-04-14', time: '14:00', channel: 'linkedin', category: 'Institucional', status: 'in-progress', assignees: ['Helena Martins', 'Juliana Neves'], projectId: 'p2' },
  { id: 'ps3', title: 'Dica rápida de marketing', copy: '3 dicas para melhorar seu engajamento', hashtags: ['#marketing', '#dicas'], cta: 'Salve esse post', link: '', date: '2026-04-15', time: '18:00', channel: 'tiktok', category: 'Educativo', status: 'not-started', assignees: ['Daniela Rocha'], projectId: 'p1' },
  { id: 'ps4', title: 'Artigo: Tendências 2026', copy: 'As principais tendências do mercado...', hashtags: ['#tendências', '#artigo'], cta: 'Leia o artigo completo', link: 'https://blog.example.com', date: '2026-04-17', time: '09:00', channel: 'blog', category: 'Conteúdo', status: 'not-started', assignees: ['Eduardo Lima'], projectId: 'p1' },
  { id: 'ps5', title: 'Convite Evento Anual', copy: 'Participe do nosso evento!', hashtags: ['#evento', '#2026'], cta: 'Inscreva-se', link: 'https://evento.example.com', date: '2026-04-20', time: '11:00', channel: 'instagram', category: 'Evento', status: 'not-started', assignees: ['Fernanda Alves'], projectId: 'p3' },
];

export const calendarEvents: CalendarEvent[] = [
  { id: 'ev1', name: 'Reunião de Alinhamento', date: '2026-04-11', time: '10:00', type: 'meeting', participants: ['Ana Silva', 'Bruno Costa', 'Helena Martins'], description: 'Alinhamento semanal das equipes' },
  { id: 'ev2', name: 'Entrega do Projeto Visual', date: '2026-04-14', time: '17:00', type: 'delivery', participants: ['Helena Martins', 'Igor Pereira'], description: 'Entrega final dos materiais visuais', projectId: 'p2' },
  { id: 'ev3', name: 'Workshop de Conteúdo', date: '2026-04-16', time: '14:00', type: 'event', participants: ['Bruno Costa', 'Daniela Rocha', 'Eduardo Lima'], description: 'Workshop sobre criação de conteúdo para redes sociais' },
  { id: 'ev4', name: 'Reunião com Fornecedores', date: '2026-04-18', time: '09:00', type: 'meeting', participants: ['Fernanda Alves', 'Gustavo Santos'], description: 'Negociação com fornecedores do evento', projectId: 'p3' },
];

export const categories = ['Lançamento', 'Institucional', 'Educativo', 'Conteúdo', 'Evento', 'Promoção'];

export const channels = [
  { id: 'instagram', name: 'Instagram', color: 'channel-instagram' },
  { id: 'linkedin', name: 'LinkedIn', color: 'channel-linkedin' },
  { id: 'tiktok', name: 'TikTok', color: 'channel-tiktok' },
  { id: 'blog', name: 'Blog', color: 'channel-blog' },
];

// Dashboard stats
export const dashboardStats = {
  totalTasks: tasks.length,
  completedTasks: tasks.filter(t => t.status === 'done').length,
  totalPosts: posts.length,
  publishedPosts: posts.filter(p => p.status === 'published').length,
  onTimePosts: 3,
  upcomingDeadlines: [
    { title: 'Revisão do contrato', date: '2026-04-11', priority: 'high' as const },
    { title: 'Definir paleta de cores', date: '2026-04-12', priority: 'high' as const },
    { title: 'Confirmar palestrantes', date: '2026-04-13', priority: 'high' as const },
  ],
  postsByChannel: [
    { channel: 'Instagram', count: 2 },
    { channel: 'LinkedIn', count: 1 },
    { channel: 'TikTok', count: 1 },
    { channel: 'Blog', count: 1 },
  ],
  productivityByTeam: [
    { team: 'Gente e Gestão', completed: 0, total: 0 },
    { team: 'Mercado', completed: 0, total: 2 },
    { team: 'Presidência', completed: 1, total: 2 },
    { team: 'Projetos', completed: 0, total: 2 },
  ],
};
