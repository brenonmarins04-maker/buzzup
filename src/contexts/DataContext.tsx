import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";
import { getNowBrasilia, getTodayBrasilia } from "@/lib/utils";

type Json = Database["public"]["Tables"]["tasks"]["Row"]["checklist"];

export type Person = { id: string; name: string };
export type Project = { id: string; name: string; description: string; color: string; status: string; members: Person[] };
export type Task = {
  id: string; title: string; description: string; team: string;
  responsible: Person[]; deadline: string; status: string; priority: string;
  checklist: { text: string; checked: boolean }[];
};
export type Post = {
  id: string; title: string; copy: string; channel: string; category: string;
  date: string; time: string; status: string; responsible: Person[];
  link: string; media_url: string;
};
export type CalendarEvent = { id: string; title: string; date: string; type: string; description: string };
export type Channel = { id: string; name: string; color: string };

export type Notification = {
  id: string; title: string; message: string;
  type: "warning" | "danger" | "info"; read: boolean; date: string;
};

type DataContextType = {
  people: Person[]; projects: Project[]; tasks: Task[]; posts: Post[];
  events: CalendarEvent[];
  categories: string[]; channels: Channel[]; notifications: Notification[];
  loading: boolean; workspaceId: string | null;

  addPerson: (name: string) => void;
  updatePerson: (id: string, name: string) => void;
  deletePerson: (id: string) => void;

  addTask: (task: Omit<Task, "id" | "responsible"> & { responsibleIds: string[] }) => void;
  updateTask: (task: Task) => void;
  deleteTask: (id: string) => void;

  addPost: (post: Omit<Post, "id" | "responsible"> & { responsibleIds: string[] }) => void;
  updatePost: (post: Post) => void;
  deletePost: (id: string) => void;

  addProject: (project: Omit<Project, "id" | "members"> & { memberIds: string[] }) => void;
  updateProject: (project: Project) => void;
  deleteProject: (id: string) => void;

  addEvent: (event: Omit<CalendarEvent, "id">) => void;
  updateEvent: (event: CalendarEvent) => void;
  deleteEvent: (id: string) => void;

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

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.id;

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoriesRaw, setCategoriesRaw] = useState<{ id: string; name: string }[]>([]);

  // Fetch workspace + all data
  useEffect(() => {
    if (!uid) {
      setWorkspaceId(null); setPeople([]); setProjects([]); setTasks([]); setPosts([]);
      setEvents([]); setCategories([]); setChannels([]);
      setCategoriesRaw([]); setLoading(false);
      return;
    }
    let cancelled = false;
    async function fetchAll() {
      setLoading(true);
      // Get workspace
      const { data: ws } = await supabase.from("workspaces").select("id").eq("user_id", uid!).single();
      if (cancelled || !ws) { setLoading(false); return; }
      const wsId = ws.id;
      setWorkspaceId(wsId);

      const [pplRes, projRes, tkRes, psRes, evRes, catRes, chRes, ppRes, taRes, paRes] = await Promise.all([
        supabase.from("people").select("id, name").eq("workspace_id", wsId),
        supabase.from("projects").select("*").eq("workspace_id", wsId),
        supabase.from("tasks").select("*").eq("workspace_id", wsId),
        supabase.from("posts").select("*").eq("workspace_id", wsId),
        supabase.from("calendar_items").select("*").eq("workspace_id", wsId),
        supabase.from("categories").select("id, name").eq("workspace_id", wsId),
        supabase.from("channels").select("id, name, color").eq("workspace_id", wsId),
        supabase.from("project_participants").select("project_id, person_id"),
        supabase.from("task_assignees").select("task_id, person_id"),
        supabase.from("post_assignees").select("post_id, person_id"),
      ]);
      if (cancelled) return;

      const pplList: Person[] = (pplRes.data || []).map(p => ({ id: p.id, name: p.name }));
      const pplMap = new Map(pplList.map(p => [p.id, p]));
      setPeople(pplList);

      // Build junction maps
      const projParticipants = new Map<string, Person[]>();
      (ppRes.data || []).forEach(r => {
        const person = pplMap.get(r.person_id);
        if (person) {
          const arr = projParticipants.get(r.project_id) || [];
          arr.push(person);
          projParticipants.set(r.project_id, arr);
        }
      });
      const taskAssignees = new Map<string, Person[]>();
      (taRes.data || []).forEach(r => {
        const person = pplMap.get(r.person_id);
        if (person) {
          const arr = taskAssignees.get(r.task_id) || [];
          arr.push(person);
          taskAssignees.set(r.task_id, arr);
        }
      });
      const postAssignees = new Map<string, Person[]>();
      (paRes.data || []).forEach(r => {
        const person = pplMap.get(r.person_id);
        if (person) {
          const arr = postAssignees.get(r.post_id) || [];
          arr.push(person);
          postAssignees.set(r.post_id, arr);
        }
      });

      setProjects((projRes.data || []).map(r => ({
        id: r.id, name: r.name, description: r.description, color: r.color, status: r.status,
        members: projParticipants.get(r.id) || [],
      })));
      setTasks((tkRes.data || []).map(r => {
        const checklist = Array.isArray(r.checklist) ? (r.checklist as { text: string; checked: boolean }[]) : [];
        return {
          id: r.id, title: r.title, description: r.description, team: r.team,
          responsible: taskAssignees.get(r.id) || [], deadline: r.deadline, status: r.status,
          priority: r.priority, checklist,
        };
      }));
      setPosts((psRes.data || []).map(r => ({
        id: r.id, title: r.title, copy: r.copy, channel: r.channel, category: r.category,
        date: r.date, time: r.time, status: r.status, responsible: postAssignees.get(r.id) || [],
        link: r.link, media_url: r.media_url,
      })));
      setEvents((evRes.data || []).map(r => ({
        id: r.id, title: r.title, date: r.date, type: r.type, description: r.description,
      })));
      const rawCats = catRes.data || [];
      setCategoriesRaw(rawCats);
      setCategories(rawCats.map(c => c.name));
      setChannels((chRes.data || []).map(c => ({ id: c.id, name: c.name, color: c.color })));
      setLoading(false);
    }
    fetchAll();
    return () => { cancelled = true; };
  }, [uid]);

  // Notifications
  useEffect(() => {
    const today = getTodayBrasilia();
    const todayDate = getNowBrasilia();
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

  // Helper to sync junction tables
  const syncJunction = useCallback(async (table: "project_participants" | "task_assignees" | "post_assignees", fkCol: string, fkId: string, personIds: string[]) => {
    // Delete all existing
    await (supabase.from(table) as any).delete().eq(fkCol, fkId);
    // Insert new
    if (personIds.length > 0) {
      const rows = personIds.map(pid => ({ [fkCol]: fkId, person_id: pid }));
      await (supabase.from(table) as any).insert(rows);
    }
  }, []);

  // === PEOPLE ===
  const addPerson = useCallback(async (name: string) => {
    if (!workspaceId) return;
    const { data } = await supabase.from("people").insert({ workspace_id: workspaceId, name }).select("id, name").single();
    if (data) setPeople(prev => [...prev, { id: data.id, name: data.name }]);
  }, [workspaceId]);

  const updatePerson = useCallback(async (id: string, name: string) => {
    await supabase.from("people").update({ name }).eq("id", id);
    setPeople(prev => prev.map(p => p.id === id ? { ...p, name } : p));
    // Update local state in tasks/posts/projects too
    setTasks(prev => prev.map(t => ({ ...t, responsible: t.responsible.map(r => r.id === id ? { ...r, name } : r) })));
    setPosts(prev => prev.map(p => ({ ...p, responsible: p.responsible.map(r => r.id === id ? { ...r, name } : r) })));
    setProjects(prev => prev.map(p => ({ ...p, members: p.members.map(m => m.id === id ? { ...m, name } : m) })));
  }, []);

  const deletePerson = useCallback(async (id: string) => {
    await supabase.from("people").delete().eq("id", id);
    setPeople(prev => prev.filter(p => p.id !== id));
    setTasks(prev => prev.map(t => ({ ...t, responsible: t.responsible.filter(r => r.id !== id) })));
    setPosts(prev => prev.map(p => ({ ...p, responsible: p.responsible.filter(r => r.id !== id) })));
    setProjects(prev => prev.map(p => ({ ...p, members: p.members.filter(m => m.id !== id) })));
  }, []);

  // === TASKS ===
  const addTask = useCallback(async (t: Omit<Task, "id" | "responsible"> & { responsibleIds: string[] }) => {
    if (!workspaceId) return;
    const { data } = await supabase.from("tasks").insert({
      workspace_id: workspaceId, title: t.title, description: t.description, team: t.team,
      deadline: t.deadline, status: t.status, priority: t.priority,
      checklist: t.checklist as unknown as Json,
    }).select().single();
    if (data) {
      await syncJunction("task_assignees", "task_id", data.id, t.responsibleIds);
      const resp = people.filter(p => t.responsibleIds.includes(p.id));
      const checklist = Array.isArray(data.checklist) ? (data.checklist as { text: string; checked: boolean }[]) : [];
      setTasks(prev => [...prev, {
        id: data.id, title: data.title, description: data.description, team: data.team,
        responsible: resp, deadline: data.deadline, status: data.status, priority: data.priority, checklist,
      }]);
    }
  }, [workspaceId, people, syncJunction]);

  const updateTask = useCallback(async (t: Task) => {
    await supabase.from("tasks").update({
      title: t.title, description: t.description, team: t.team,
      deadline: t.deadline, status: t.status, priority: t.priority,
      checklist: t.checklist as unknown as Json,
    }).eq("id", t.id);
    await syncJunction("task_assignees", "task_id", t.id, t.responsible.map(r => r.id));
    setTasks(prev => prev.map(x => x.id === t.id ? t : x));
  }, [syncJunction]);

  const deleteTask = useCallback(async (id: string) => {
    await supabase.from("tasks").delete().eq("id", id);
    setTasks(prev => prev.filter(x => x.id !== id));
  }, []);

  // === POSTS ===
  const addPost = useCallback(async (p: Omit<Post, "id" | "responsible"> & { responsibleIds: string[] }) => {
    if (!workspaceId) return;
    const { data } = await supabase.from("posts").insert({
      workspace_id: workspaceId, title: p.title, copy: p.copy, channel: p.channel,
      category: p.category, date: p.date, time: p.time, status: p.status,
      link: p.link, media_url: p.media_url,
    }).select().single();
    if (data) {
      await syncJunction("post_assignees", "post_id", data.id, p.responsibleIds);
      const resp = people.filter(per => p.responsibleIds.includes(per.id));
      setPosts(prev => [...prev, {
        id: data.id, title: data.title, copy: data.copy, channel: data.channel, category: data.category,
        date: data.date, time: data.time, status: data.status, responsible: resp,
        link: data.link, media_url: data.media_url,
      }]);
    }
  }, [workspaceId, people, syncJunction]);

  const updatePost = useCallback(async (p: Post) => {
    await supabase.from("posts").update({
      title: p.title, copy: p.copy, channel: p.channel, category: p.category,
      date: p.date, time: p.time, status: p.status, link: p.link, media_url: p.media_url,
    }).eq("id", p.id);
    await syncJunction("post_assignees", "post_id", p.id, p.responsible.map(r => r.id));
    setPosts(prev => prev.map(x => x.id === p.id ? p : x));
  }, [syncJunction]);

  const deletePost = useCallback(async (id: string) => {
    await supabase.from("posts").delete().eq("id", id);
    setPosts(prev => prev.filter(x => x.id !== id));
  }, []);

  // === PROJECTS ===
  const addProject = useCallback(async (p: Omit<Project, "id" | "members"> & { memberIds: string[] }) => {
    if (!workspaceId) return;
    const { data } = await supabase.from("projects").insert({
      workspace_id: workspaceId, name: p.name, description: p.description,
      color: p.color, status: p.status,
    }).select().single();
    if (data) {
      await syncJunction("project_participants", "project_id", data.id, p.memberIds);
      const members = people.filter(per => p.memberIds.includes(per.id));
      setProjects(prev => [...prev, {
        id: data.id, name: data.name, description: data.description,
        color: data.color, status: data.status, members,
      }]);
    }
  }, [workspaceId, people, syncJunction]);

  const updateProject = useCallback(async (p: Project) => {
    await supabase.from("projects").update({
      name: p.name, description: p.description, color: p.color, status: p.status,
    }).eq("id", p.id);
    await syncJunction("project_participants", "project_id", p.id, p.members.map(m => m.id));
    setProjects(prev => prev.map(x => x.id === p.id ? p : x));
  }, [syncJunction]);

  const deleteProject = useCallback(async (id: string) => {
    await supabase.from("projects").delete().eq("id", id);
    setProjects(prev => prev.filter(x => x.id !== id));
  }, []);

  // === EVENTS (calendar_items) ===
  const addEvent = useCallback(async (e: Omit<CalendarEvent, "id">) => {
    if (!workspaceId) return;
    const { data } = await supabase.from("calendar_items").insert({
      workspace_id: workspaceId, title: e.title, date: e.date,
      type: e.type, description: e.description,
    }).select().single();
    if (data) setEvents(prev => [...prev, { id: data.id, title: data.title, date: data.date, type: data.type, description: data.description }]);
  }, [workspaceId]);

  const updateEvent = useCallback(async (e: CalendarEvent) => {
    await supabase.from("calendar_items").update({
      title: e.title, date: e.date, type: e.type, description: e.description,
    }).eq("id", e.id);
    setEvents(prev => prev.map(x => x.id === e.id ? e : x));
  }, []);

  const deleteEvent = useCallback(async (id: string) => {
    await supabase.from("calendar_items").delete().eq("id", id);
    setEvents(prev => prev.filter(x => x.id !== id));
  }, []);

  // === CATEGORIES ===
  const addCategory = useCallback(async (cat: string) => {
    if (!workspaceId || categories.includes(cat)) return;
    const { data } = await supabase.from("categories").insert({ workspace_id: workspaceId, name: cat }).select("id, name").single();
    if (data) {
      setCategoriesRaw(prev => [...prev, data]);
      setCategories(prev => [...prev, cat]);
    }
  }, [workspaceId, categories]);

  const removeCategory = useCallback(async (cat: string) => {
    const row = categoriesRaw.find(c => c.name === cat);
    if (row) {
      await supabase.from("categories").delete().eq("id", row.id);
      setCategoriesRaw(prev => prev.filter(c => c.id !== row.id));
      setCategories(prev => prev.filter(c => c !== cat));
    }
  }, [categoriesRaw]);

  const updateCategory = useCallback(async (oldCat: string, newCat: string) => {
    const row = categoriesRaw.find(c => c.name === oldCat);
    if (row) {
      await supabase.from("categories").update({ name: newCat }).eq("id", row.id);
      setCategoriesRaw(prev => prev.map(c => c.id === row.id ? { ...c, name: newCat } : c));
      setCategories(prev => prev.map(c => c === oldCat ? newCat : c));
    }
  }, [categoriesRaw]);

  // === CHANNELS ===
  const addChannel = useCallback(async (ch: Omit<Channel, "id">) => {
    if (!workspaceId) return;
    const { data } = await supabase.from("channels").insert({ workspace_id: workspaceId, name: ch.name, color: ch.color }).select("id, name, color").single();
    if (data) setChannels(prev => [...prev, { id: data.id, name: data.name, color: data.color }]);
  }, [workspaceId]);

  const removeChannel = useCallback(async (id: string) => {
    await supabase.from("channels").delete().eq("id", id);
    setChannels(prev => prev.filter(c => c.id !== id));
  }, []);

  const updateChannel = useCallback(async (ch: Channel) => {
    await supabase.from("channels").update({ name: ch.name, color: ch.color }).eq("id", ch.id);
    setChannels(prev => prev.map(c => c.id === ch.id ? ch : c));
  }, []);

  // Notifications
  const markNotificationRead = useCallback((id: string) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n)), []);
  const markAllNotificationsRead = useCallback(() => setNotifications(prev => prev.map(n => ({ ...n, read: true }))), []);

  return (
    <DataContext.Provider value={{
      people, projects, tasks, posts, events, categories, channels, notifications, loading, workspaceId,
      addPerson, updatePerson, deletePerson,
      addTask, updateTask, deleteTask,
      addPost, updatePost, deletePost,
      addProject, updateProject, deleteProject,
      addEvent, updateEvent, deleteEvent,
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
