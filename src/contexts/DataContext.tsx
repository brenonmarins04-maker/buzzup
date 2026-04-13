import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

type DbTeam = Database["public"]["Tables"]["teams"]["Row"];
type DbProject = Database["public"]["Tables"]["projects"]["Row"];
type DbTask = Database["public"]["Tables"]["tasks"]["Row"];
type DbPost = Database["public"]["Tables"]["posts"]["Row"];
type DbEvent = Database["public"]["Tables"]["calendar_events"]["Row"];
type DbGeneralItem = Database["public"]["Tables"]["general_items"]["Row"];
type DbCategory = Database["public"]["Tables"]["categories"]["Row"];
type DbChannel = Database["public"]["Tables"]["channels"]["Row"];

// App-level types (without user_id, with proper typing)
export type Team = { id: string; name: string; color: string; members: string[] };
export type Project = { id: string; name: string; description: string; team: string; color: string; status: string };
export type Task = {
  id: string; title: string; description: string; team: string;
  responsible: string[]; deadline: string; status: string; priority: string;
  checklist: { text: string; checked: boolean }[];
};
export type Post = {
  id: string; title: string; copy: string; channel: string; category: string;
  date: string; time: string; status: string; responsible: string[];
  link: string; media_url: string;
};
export type CalendarEvent = { id: string; title: string; date: string; time: string; end_time: string; type: string; description: string };
export type GeneralItem = { id: string; title: string; description: string; date: string; time: string; type: string };
export type Channel = { id: string; name: string; color: string };

export type Notification = {
  id: string; title: string; message: string;
  type: "warning" | "danger" | "info"; read: boolean; date: string;
};

type DataContextType = {
  teams: Team[]; projects: Project[]; tasks: Task[]; posts: Post[];
  events: CalendarEvent[]; generalItems: GeneralItem[];
  categories: string[]; channels: Channel[]; notifications: Notification[];
  allMembers: string[]; loading: boolean;

  addTeamMember: (teamId: string, name: string) => void;
  updateTeamMember: (teamId: string, oldName: string, newName: string) => void;
  removeTeamMember: (teamId: string, name: string) => void;
  addTeam: (team: Omit<Team, "id">) => void;
  updateTeam: (team: Team) => void;
  deleteTeam: (id: string) => void;

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
};

const DataContext = createContext<DataContextType | null>(null);

function toTeam(r: DbTeam): Team {
  return { id: r.id, name: r.name, color: r.color, members: r.members || [] };
}
function toProject(r: DbProject): Project {
  return { id: r.id, name: r.name, description: r.description, team: r.team, color: r.color, status: r.status };
}
function toTask(r: DbTask): Task {
  const checklist = Array.isArray(r.checklist)
    ? (r.checklist as { text: string; checked: boolean }[])
    : [];
  return { id: r.id, title: r.title, description: r.description, team: r.team, responsible: r.responsible || [], deadline: r.deadline, status: r.status, priority: r.priority, checklist };
}
function toPost(r: DbPost): Post {
  return { id: r.id, title: r.title, copy: r.copy, channel: r.channel, category: r.category, date: r.date, time: r.time, status: r.status, responsible: r.responsible || [], link: r.link, media_url: r.media_url };
}
function toEvent(r: DbEvent): CalendarEvent {
  return { id: r.id, title: r.title, date: r.date, time: r.time, end_time: r.end_time, type: r.type, description: r.description };
}
function toGeneralItem(r: DbGeneralItem): GeneralItem {
  return { id: r.id, title: r.title, description: r.description, date: r.date, time: r.time, type: r.type };
}
function toChannel(r: DbChannel): Channel {
  return { id: r.id, name: r.name, color: r.color };
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.id;

  const [teams, setTeams] = useState<Team[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [generalItems, setGeneralItems] = useState<GeneralItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoriesRaw, setCategoriesRaw] = useState<DbCategory[]>([]);

  // Fetch all data when user changes
  useEffect(() => {
    if (!uid) {
      setTeams([]); setProjects([]); setTasks([]); setPosts([]);
      setEvents([]); setGeneralItems([]); setCategories([]); setChannels([]);
      setCategoriesRaw([]); setLoading(false);
      return;
    }
    let cancelled = false;
    async function fetchAll() {
      setLoading(true);
      const [tRes, pRes, tkRes, psRes, evRes, giRes, catRes, chRes] = await Promise.all([
        supabase.from("teams").select("*").eq("user_id", uid!),
        supabase.from("projects").select("*").eq("user_id", uid!),
        supabase.from("tasks").select("*").eq("user_id", uid!),
        supabase.from("posts").select("*").eq("user_id", uid!),
        supabase.from("calendar_events").select("*").eq("user_id", uid!),
        supabase.from("general_items").select("*").eq("user_id", uid!),
        supabase.from("categories").select("*").eq("user_id", uid!),
        supabase.from("channels").select("*").eq("user_id", uid!),
      ]);
      if (cancelled) return;
      setTeams((tRes.data || []).map(toTeam));
      setProjects((pRes.data || []).map(toProject));
      setTasks((tkRes.data || []).map(toTask));
      setPosts((psRes.data || []).map(toPost));
      setEvents((evRes.data || []).map(toEvent));
      setGeneralItems((giRes.data || []).map(toGeneralItem));
      const rawCats = catRes.data || [];
      setCategoriesRaw(rawCats);
      setCategories(rawCats.map(c => c.name));
      setChannels((chRes.data || []).map(toChannel));
      setLoading(false);
    }
    fetchAll();
    return () => { cancelled = true; };
  }, [uid]);

  // Generate notifications
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const todayDate = new Date();
    const notifs: Notification[] = [];
    tasks.forEach(t => {
      if (t.status === "done") return;
      const deadline = new Date(t.deadline);
      const diffDays = Math.ceil((deadline.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) notifs.push({ id: `n_${t.id}_overdue`, title: "Tarefa atrasada", message: t.title, type: "danger", read: false, date: t.deadline });
      else if (diffDays === 0) notifs.push({ id: `n_${t.id}_today`, title: "Vence hoje", message: t.title, type: "danger", read: false, date: t.deadline });
      else if (diffDays <= 3) notifs.push({ id: `n_${t.id}_soon`, title: "Prazo próximo", message: `${t.title} — ${diffDays} dia(s)`, type: "warning", read: false, date: t.deadline });
    });
    posts.forEach(p => {
      if (p.status === "published" || p.status === "done") return;
      if (p.date === today) notifs.push({ id: `n_${p.id}_today`, title: "Publicação do dia", message: p.title, type: "info", read: false, date: p.date });
      else if (p.date < today) notifs.push({ id: `n_${p.id}_overdue`, title: "Publicação atrasada", message: p.title, type: "danger", read: false, date: p.date });
    });
    setNotifications(notifs);
  }, [tasks, posts]);

  const allMembers = teams.flatMap(t => t.members);

  // === TEAMS ===
  const addTeam = useCallback(async (team: Omit<Team, "id">) => {
    if (!uid) return;
    const { data } = await supabase.from("teams").insert({ user_id: uid, name: team.name, color: team.color, members: team.members }).select().single();
    if (data) setTeams(prev => [...prev, toTeam(data)]);
  }, [uid]);

  const updateTeam = useCallback(async (team: Team) => {
    if (!uid) return;
    await supabase.from("teams").update({ name: team.name, color: team.color, members: team.members }).eq("id", team.id);
    setTeams(prev => prev.map(t => t.id === team.id ? team : t));
  }, [uid]);

  const deleteTeam = useCallback(async (id: string) => {
    if (!uid) return;
    await supabase.from("teams").delete().eq("id", id);
    setTeams(prev => prev.filter(t => t.id !== id));
  }, [uid]);

  const addTeamMember = useCallback(async (teamId: string, name: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team || !uid) return;
    const updated = { ...team, members: [...team.members, name] };
    await supabase.from("teams").update({ members: updated.members }).eq("id", teamId);
    setTeams(prev => prev.map(t => t.id === teamId ? updated : t));
  }, [teams, uid]);

  const updateTeamMember = useCallback(async (teamId: string, oldName: string, newName: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team || !uid) return;
    const updated = { ...team, members: team.members.map(m => m === oldName ? newName : m) };
    await supabase.from("teams").update({ members: updated.members }).eq("id", teamId);
    setTeams(prev => prev.map(t => t.id === teamId ? updated : t));
  }, [teams, uid]);

  const removeTeamMember = useCallback(async (teamId: string, name: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team || !uid) return;
    const updated = { ...team, members: team.members.filter(m => m !== name) };
    await supabase.from("teams").update({ members: updated.members }).eq("id", teamId);
    setTeams(prev => prev.map(t => t.id === teamId ? updated : t));
  }, [teams, uid]);

  // === TASKS ===
  const addTask = useCallback(async (t: Omit<Task, "id">) => {
    if (!uid) return;
    const { data } = await supabase.from("tasks").insert({
      user_id: uid, title: t.title, description: t.description, team: t.team,
      responsible: t.responsible, deadline: t.deadline, status: t.status,
      priority: t.priority, checklist: t.checklist as unknown as Database["public"]["Tables"]["tasks"]["Insert"]["checklist"],
    }).select().single();
    if (data) setTasks(prev => [...prev, toTask(data)]);
  }, [uid]);

  const updateTask = useCallback(async (t: Task) => {
    if (!uid) return;
    await supabase.from("tasks").update({
      title: t.title, description: t.description, team: t.team,
      responsible: t.responsible, deadline: t.deadline, status: t.status,
      priority: t.priority, checklist: t.checklist as unknown as Database["public"]["Tables"]["tasks"]["Update"]["checklist"],
    }).eq("id", t.id);
    setTasks(prev => prev.map(x => x.id === t.id ? t : x));
  }, [uid]);

  const deleteTask = useCallback(async (id: string) => {
    if (!uid) return;
    await supabase.from("tasks").delete().eq("id", id);
    setTasks(prev => prev.filter(x => x.id !== id));
  }, [uid]);

  // === POSTS ===
  const addPost = useCallback(async (p: Omit<Post, "id">) => {
    if (!uid) return;
    const { data } = await supabase.from("posts").insert({
      user_id: uid, title: p.title, copy: p.copy, channel: p.channel,
      category: p.category, date: p.date, time: p.time, status: p.status,
      responsible: p.responsible, link: p.link, media_url: p.media_url,
    }).select().single();
    if (data) setPosts(prev => [...prev, toPost(data)]);
  }, [uid]);

  const updatePost = useCallback(async (p: Post) => {
    if (!uid) return;
    await supabase.from("posts").update({
      title: p.title, copy: p.copy, channel: p.channel, category: p.category,
      date: p.date, time: p.time, status: p.status, responsible: p.responsible,
      link: p.link, media_url: p.media_url,
    }).eq("id", p.id);
    setPosts(prev => prev.map(x => x.id === p.id ? p : x));
  }, [uid]);

  const deletePost = useCallback(async (id: string) => {
    if (!uid) return;
    await supabase.from("posts").delete().eq("id", id);
    setPosts(prev => prev.filter(x => x.id !== id));
  }, [uid]);

  // === PROJECTS ===
  const addProject = useCallback(async (p: Omit<Project, "id">) => {
    if (!uid) return;
    const { data } = await supabase.from("projects").insert({
      user_id: uid, name: p.name, description: p.description, team: p.team,
      color: p.color, status: p.status,
    }).select().single();
    if (data) setProjects(prev => [...prev, toProject(data)]);
  }, [uid]);

  const updateProject = useCallback(async (p: Project) => {
    if (!uid) return;
    await supabase.from("projects").update({
      name: p.name, description: p.description, team: p.team,
      color: p.color, status: p.status,
    }).eq("id", p.id);
    setProjects(prev => prev.map(x => x.id === p.id ? p : x));
  }, [uid]);

  // === EVENTS ===
  const addEvent = useCallback(async (e: Omit<CalendarEvent, "id">) => {
    if (!uid) return;
    const { data } = await supabase.from("calendar_events").insert({
      user_id: uid, title: e.title, date: e.date, time: e.time,
      end_time: e.end_time, type: e.type, description: e.description,
    }).select().single();
    if (data) setEvents(prev => [...prev, toEvent(data)]);
  }, [uid]);

  const updateEvent = useCallback(async (e: CalendarEvent) => {
    if (!uid) return;
    await supabase.from("calendar_events").update({
      title: e.title, date: e.date, time: e.time, end_time: e.end_time,
      type: e.type, description: e.description,
    }).eq("id", e.id);
    setEvents(prev => prev.map(x => x.id === e.id ? e : x));
  }, [uid]);

  const deleteEvent = useCallback(async (id: string) => {
    if (!uid) return;
    await supabase.from("calendar_events").delete().eq("id", id);
    setEvents(prev => prev.filter(x => x.id !== id));
  }, [uid]);

  // === GENERAL ITEMS ===
  const addGeneralItem = useCallback(async (item: Omit<GeneralItem, "id">) => {
    if (!uid) return;
    const { data } = await supabase.from("general_items").insert({
      user_id: uid, title: item.title, description: item.description,
      date: item.date, time: item.time, type: item.type,
    }).select().single();
    if (data) setGeneralItems(prev => [...prev, toGeneralItem(data)]);
  }, [uid]);

  const updateGeneralItem = useCallback(async (item: GeneralItem) => {
    if (!uid) return;
    await supabase.from("general_items").update({
      title: item.title, description: item.description,
      date: item.date, time: item.time, type: item.type,
    }).eq("id", item.id);
    setGeneralItems(prev => prev.map(x => x.id === item.id ? item : x));
  }, [uid]);

  const deleteGeneralItem = useCallback(async (id: string) => {
    if (!uid) return;
    await supabase.from("general_items").delete().eq("id", id);
    setGeneralItems(prev => prev.filter(x => x.id !== id));
  }, [uid]);

  // === CATEGORIES ===
  const addCategory = useCallback(async (cat: string) => {
    if (!uid || categories.includes(cat)) return;
    const { data } = await supabase.from("categories").insert({ user_id: uid, name: cat }).select().single();
    if (data) {
      setCategoriesRaw(prev => [...prev, data]);
      setCategories(prev => [...prev, cat]);
    }
  }, [uid, categories]);

  const removeCategory = useCallback(async (cat: string) => {
    if (!uid) return;
    const row = categoriesRaw.find(c => c.name === cat);
    if (row) {
      await supabase.from("categories").delete().eq("id", row.id);
      setCategoriesRaw(prev => prev.filter(c => c.id !== row.id));
      setCategories(prev => prev.filter(c => c !== cat));
    }
  }, [uid, categoriesRaw]);

  const updateCategory = useCallback(async (oldCat: string, newCat: string) => {
    if (!uid) return;
    const row = categoriesRaw.find(c => c.name === oldCat);
    if (row) {
      await supabase.from("categories").update({ name: newCat }).eq("id", row.id);
      setCategoriesRaw(prev => prev.map(c => c.id === row.id ? { ...c, name: newCat } : c));
      setCategories(prev => prev.map(c => c === oldCat ? newCat : c));
    }
  }, [uid, categoriesRaw]);

  // === CHANNELS ===
  const addChannel = useCallback(async (ch: Omit<Channel, "id">) => {
    if (!uid) return;
    const { data } = await supabase.from("channels").insert({ user_id: uid, name: ch.name, color: ch.color }).select().single();
    if (data) setChannels(prev => [...prev, toChannel(data)]);
  }, [uid]);

  const removeChannel = useCallback(async (id: string) => {
    if (!uid) return;
    await supabase.from("channels").delete().eq("id", id);
    setChannels(prev => prev.filter(c => c.id !== id));
  }, [uid]);

  const updateChannel = useCallback(async (ch: Channel) => {
    if (!uid) return;
    await supabase.from("channels").update({ name: ch.name, color: ch.color }).eq("id", ch.id);
    setChannels(prev => prev.map(c => c.id === ch.id ? ch : c));
  }, [uid]);

  // Notifications
  const markNotificationRead = useCallback((id: string) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n)), []);
  const markAllNotificationsRead = useCallback(() => setNotifications(prev => prev.map(n => ({ ...n, read: true }))), []);

  return (
    <DataContext.Provider value={{
      teams, projects, tasks, posts, events, generalItems, categories, channels, notifications, allMembers, loading,
      addTeam, updateTeam, deleteTeam,
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
