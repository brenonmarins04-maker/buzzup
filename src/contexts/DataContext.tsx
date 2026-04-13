import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import {
  teams as initialTeams,
  projects as initialProjects,
  tasks as initialTasks,
  posts as initialPosts,
  calendarEvents as initialEvents,
  categories as initialCategories,
  channels as initialChannels,
  type Team,
  type Project,
  type Task,
  type Post,
  type CalendarEvent,
  type Channel,
} from "@/lib/mock-data";

export type GeneralItem = {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  type: "reminder" | "event" | "note";
};

export type Notification = {
  id: string;
  title: string;
  message: string;
  type: "warning" | "danger" | "info";
  read: boolean;
  date: string;
};

type DataContextType = {
  teams: Team[];
  projects: Project[];
  tasks: Task[];
  posts: Post[];
  events: CalendarEvent[];
  generalItems: GeneralItem[];
  categories: string[];
  channels: Channel[];
  notifications: Notification[];

  addTeamMember: (teamId: string, name: string) => void;
  updateTeamMember: (teamId: string, oldName: string, newName: string) => void;
  removeTeamMember: (teamId: string, name: string) => void;

  addTask: (task: Omit<Task, "id">) => void;
  updateTask: (task: Task) => void;
  deleteTask: (id: string) => void;

  addPost: (post: Omit<Post, "id">) => void;
  updatePost: (post: Post) => void;
  deletePost: (id: string) => void;

  addProject: (project: Omit<Project, "id">) => void;
  updateProject: (project: Project) => void;

  addEvent: (event: Omit<CalendarEvent, "id">) => void;
  updateEvent: (event: CalendarEvent) => void;
  deleteEvent: (id: string) => void;

  addGeneralItem: (item: Omit<GeneralItem, "id">) => void;
  updateGeneralItem: (item: GeneralItem) => void;
  deleteGeneralItem: (id: string) => void;

  addCategory: (cat: string) => void;
  removeCategory: (cat: string) => void;
  updateCategory: (oldCat: string, newCat: string) => void;

  addChannel: (channel: Omit<Channel, "id">) => void;
  removeChannel: (id: string) => void;
  updateChannel: (channel: Channel) => void;

  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;

  allMembers: string[];
};

const DataContext = createContext<DataContextType | null>(null);

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored);
  } catch {}
  return fallback;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [teams, setTeams] = useState<Team[]>(() => loadFromStorage("mktflow_teams", initialTeams));
  const [projects, setProjects] = useState<Project[]>(() => loadFromStorage("mktflow_projects", initialProjects));
  const [tasks, setTasks] = useState<Task[]>(() => loadFromStorage("mktflow_tasks", initialTasks));
  const [posts, setPosts] = useState<Post[]>(() => loadFromStorage("mktflow_posts", initialPosts));
  const [events, setEvents] = useState<CalendarEvent[]>(() => loadFromStorage("mktflow_events", initialEvents));
  const [generalItems, setGeneralItems] = useState<GeneralItem[]>(() => loadFromStorage("mktflow_general", []));
  const [categories, setCategories] = useState<string[]>(() => loadFromStorage("mktflow_categories", initialCategories));
  const [channels, setChannels] = useState<Channel[]>(() => loadFromStorage("mktflow_channels", initialChannels));
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Persist
  useEffect(() => { localStorage.setItem("mktflow_teams", JSON.stringify(teams)); }, [teams]);
  useEffect(() => { localStorage.setItem("mktflow_projects", JSON.stringify(projects)); }, [projects]);
  useEffect(() => { localStorage.setItem("mktflow_tasks", JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { localStorage.setItem("mktflow_posts", JSON.stringify(posts)); }, [posts]);
  useEffect(() => { localStorage.setItem("mktflow_events", JSON.stringify(events)); }, [events]);
  useEffect(() => { localStorage.setItem("mktflow_general", JSON.stringify(generalItems)); }, [generalItems]);
  useEffect(() => { localStorage.setItem("mktflow_categories", JSON.stringify(categories)); }, [categories]);
  useEffect(() => { localStorage.setItem("mktflow_channels", JSON.stringify(channels)); }, [channels]);

  // Generate notifications based on tasks and posts
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const todayDate = new Date();
    const notifs: Notification[] = [];

    tasks.forEach(t => {
      if (t.status === "done") return;
      const deadline = new Date(t.deadline);
      const diffDays = Math.ceil((deadline.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        notifs.push({ id: `n_${t.id}_overdue`, title: "Tarefa atrasada", message: t.title, type: "danger", read: false, date: t.deadline });
      } else if (diffDays === 0) {
        notifs.push({ id: `n_${t.id}_today`, title: "Vence hoje", message: t.title, type: "danger", read: false, date: t.deadline });
      } else if (diffDays <= 3) {
        notifs.push({ id: `n_${t.id}_soon`, title: "Prazo próximo", message: `${t.title} — ${diffDays} dia(s)`, type: "warning", read: false, date: t.deadline });
      }
    });

    posts.forEach(p => {
      if (p.status === "published" || p.status === "done") return;
      if (p.date === today) {
        notifs.push({ id: `n_${p.id}_today`, title: "Publicação do dia", message: p.title, type: "info", read: false, date: p.date });
      } else if (p.date < today) {
        notifs.push({ id: `n_${p.id}_overdue`, title: "Publicação atrasada", message: p.title, type: "danger", read: false, date: p.date });
      }
    });

    setNotifications(notifs);
  }, [tasks, posts]);

  const allMembers = teams.flatMap(t => t.members);

  // Team member CRUD
  const addTeamMember = useCallback((teamId: string, name: string) => {
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, members: [...t.members, name] } : t));
  }, []);
  const updateTeamMember = useCallback((teamId: string, oldName: string, newName: string) => {
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, members: t.members.map(m => m === oldName ? newName : m) } : t));
  }, []);
  const removeTeamMember = useCallback((teamId: string, name: string) => {
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, members: t.members.filter(m => m !== name) } : t));
  }, []);

  // Tasks
  const addTask = useCallback((t: Omit<Task, "id">) => setTasks(prev => [...prev, { ...t, id: `tk_${uid()}` }]), []);
  const updateTask = useCallback((t: Task) => setTasks(prev => prev.map(x => x.id === t.id ? t : x)), []);
  const deleteTask = useCallback((id: string) => setTasks(prev => prev.filter(x => x.id !== id)), []);

  // Posts
  const addPost = useCallback((p: Omit<Post, "id">) => setPosts(prev => [...prev, { ...p, id: `ps_${uid()}` }]), []);
  const updatePost = useCallback((p: Post) => setPosts(prev => prev.map(x => x.id === p.id ? p : x)), []);
  const deletePost = useCallback((id: string) => setPosts(prev => prev.filter(x => x.id !== id)), []);

  // Projects
  const addProject = useCallback((p: Omit<Project, "id">) => setProjects(prev => [...prev, { ...p, id: `p_${uid()}` }]), []);
  const updateProject = useCallback((p: Project) => setProjects(prev => prev.map(x => x.id === p.id ? p : x)), []);

  // Events
  const addEvent = useCallback((e: Omit<CalendarEvent, "id">) => setEvents(prev => [...prev, { ...e, id: `ev_${uid()}` }]), []);
  const updateEvent = useCallback((e: CalendarEvent) => setEvents(prev => prev.map(x => x.id === e.id ? e : x)), []);
  const deleteEvent = useCallback((id: string) => setEvents(prev => prev.filter(x => x.id !== id)), []);

  // General items
  const addGeneralItem = useCallback((item: Omit<GeneralItem, "id">) => setGeneralItems(prev => [...prev, { ...item, id: `gi_${uid()}` }]), []);
  const updateGeneralItem = useCallback((item: GeneralItem) => setGeneralItems(prev => prev.map(x => x.id === item.id ? item : x)), []);
  const deleteGeneralItem = useCallback((id: string) => setGeneralItems(prev => prev.filter(x => x.id !== id)), []);

  // Categories
  const addCategory = useCallback((cat: string) => setCategories(prev => prev.includes(cat) ? prev : [...prev, cat]), []);
  const removeCategory = useCallback((cat: string) => setCategories(prev => prev.filter(c => c !== cat)), []);
  const updateCategory = useCallback((oldCat: string, newCat: string) => setCategories(prev => prev.map(c => c === oldCat ? newCat : c)), []);

  // Channels
  const addChannel = useCallback((ch: Omit<Channel, "id">) => setChannels(prev => [...prev, { ...ch, id: `ch_${uid()}` }]), []);
  const removeChannel = useCallback((id: string) => setChannels(prev => prev.filter(c => c.id !== id)), []);
  const updateChannel = useCallback((ch: Channel) => setChannels(prev => prev.map(c => c.id === ch.id ? ch : c)), []);

  // Notifications
  const markNotificationRead = useCallback((id: string) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n)), []);
  const markAllNotificationsRead = useCallback(() => setNotifications(prev => prev.map(n => ({ ...n, read: true }))), []);

  return (
    <DataContext.Provider value={{
      teams, projects, tasks, posts, events, generalItems, categories, channels, notifications, allMembers,
      addTeamMember, updateTeamMember, removeTeamMember,
      addTask, updateTask, deleteTask,
      addPost, updatePost, deletePost,
      addProject, updateProject,
      addEvent, updateEvent, deleteEvent,
      addGeneralItem, updateGeneralItem, deleteGeneralItem,
      addCategory, removeCategory, updateCategory,
      addChannel, removeChannel, updateChannel,
      markNotificationRead, markAllNotificationsRead,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
