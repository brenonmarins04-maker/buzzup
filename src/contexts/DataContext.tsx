import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";
import { getNowBrasilia, getTodayBrasilia } from "@/lib/utils";
import { toast } from "sonner";

type Json = Database["public"]["Tables"]["tasks"]["Row"]["checklist"];

export type Person = { id: string; name: string; nickname?: string | null; area?: string | null; areas?: string[] | null; userId?: string | null; leaderArea?: string | null; leaderAreas?: string[] | null };
export type Project = {
  id: string;
  name: string;
  description: string;
  color: string;
  status: string;
  members: Person[];
  managerId: string | null;
  pipelineStatus: string;
  startDate: string;
  endContract: string;
  endDelivered: string;
};
export type Task = {
  id: string; title: string; description: string; team: string;
  teamId: string | null;
  responsible: Person[]; deadline: string; status: string;
  checklist: { text: string; checked: boolean }[];
  points: number;
  area?: string | null;
};
export type Post = {
  id: string; title: string; copy: string; channel: string; category: string;
  date: string; time: string; status: string; responsible: Person[]; teamId: string | null;
  link: string; media_url: string;
};
export type CalendarEvent = { id: string; title: string; date: string; type: string; description: string; teamId: string | null };
export type Channel = { id: string; name: string; color: string };
export type Team = { id: string; name: string; memberIds: string[] };
export type EventType = { id: string; name: string; color: string };

export type AreaNote = { id: string; area: string; name: string; url: string; position: number };
export type ParkingItemStatus = "in-progress" | "done";
export type ParkingItem = { id: string; area: string; personId: string | null; title: string; description: string; date: string; position: number; status: ParkingItemStatus; points: number; completedAt?: string | null };

export type GamificationAction = { id: string; name: string; points: number };
export type GamificationAward = { id: string; personId: string; actionId: string | null; actionName: string; points: number; awardedAt: string };

export type LeadThermometerItem = { id: string; name: string; value: string; areaSize: string; type: string; position: number };

export type AttendanceStatus = "P" | "F" | "FJ";
export type AttendanceSetting = { id: string; area: string; intervalDays: number; startDate: string; meetingCount: number };
export type AttendanceRecord = { id: string; area: string; personId: string; date: string; status: AttendanceStatus; justification: string };

export type Broadcast = { id: string; message: string; durationDays: number; createdAt: string; expiresAt: string; createdBy: string | null };

export type WorkspaceFormTarget = "all" | "area" | "team";
export type WorkspaceForm = { id: string; title: string; description: string; url: string; targetType: WorkspaceFormTarget; targetValue: string | null; createdBy: string | null; createdAt: string };
export type FormCompletion = { id: string; formId: string; userId: string; completedAt: string };

export type Notification = {
  id: string; title: string; message: string;
  type: "warning" | "danger" | "info"; read: boolean; date: string;
};

type DataContextType = {
  people: Person[]; projects: Project[]; tasks: Task[]; posts: Post[];
  events: CalendarEvent[]; teams: Team[];
  categories: string[]; channels: Channel[]; eventTypes: EventType[]; notifications: Notification[];
  areaNotes: AreaNote[]; parkingItems: ParkingItem[];
  gamificationActions: GamificationAction[]; gamificationAwards: GamificationAward[];
  leadThermometer: LeadThermometerItem[];
  attendanceSettings: AttendanceSetting[];
  attendanceRecords: AttendanceRecord[];
  broadcasts: Broadcast[];
  forms: WorkspaceForm[]; formCompletions: FormCompletion[];
  loading: boolean; workspaceId: string | null;

  addPerson: (name: string) => void;
  updatePerson: (id: string, name: string) => void;
  updatePersonNickname: (id: string, nickname: string | null) => void;
  updatePersonArea: (id: string, area: string | null) => void;
  updatePersonAreas: (id: string, areas: string[]) => void;
  updatePersonLeaderArea: (id: string, leaderArea: string | null) => void;
  updatePersonLeaderAreas: (id: string, leaderAreas: string[]) => void;
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

  addTeam: (name: string, memberIds: string[]) => void;
  updateTeam: (team: Team) => void;
  deleteTeam: (id: string) => void;

  addEventType: (et: Omit<EventType, "id">) => void;
  updateEventType: (et: EventType) => void;
  deleteEventType: (id: string) => void;

  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;

  addAreaNote: (area: string, name: string, url: string) => Promise<void>;
  updateAreaNote: (n: AreaNote) => Promise<void>;
  deleteAreaNote: (id: string) => Promise<void>;

  addParkingItem: (area: string, title: string, date: string, description?: string, points?: number, personId?: string | null) => Promise<void>;
  updateParkingItem: (p: ParkingItem) => Promise<void>;
  moveParkingItem: (id: string, personId: string | null) => Promise<void>;
  deleteParkingItem: (id: string) => Promise<void>;

  addGamificationAction: (name: string, points: number) => Promise<void>;
  updateGamificationAction: (a: GamificationAction) => Promise<void>;
  deleteGamificationAction: (id: string) => Promise<void>;

  awardGamificationPoints: (personId: string, action: GamificationAction) => Promise<void>;
  awardPointsForDemandCompletion: (personId: string, points: number, demandTitle: string) => Promise<void>;
  deleteGamificationAward: (id: string) => Promise<void>;

  addLeadThermometer: (item: Omit<LeadThermometerItem, "id" | "position">) => Promise<void>;
  updateLeadThermometer: (item: LeadThermometerItem) => Promise<void>;
  deleteLeadThermometer: (id: string) => Promise<void>;

  upsertAttendanceSetting: (area: string, data: { intervalDays: number; startDate: string; meetingCount: number }) => Promise<void>;
  setAttendance: (area: string, personId: string, date: string, status: AttendanceStatus, justification?: string) => Promise<void>;
  clearAttendance: (area: string, personId: string, date: string) => Promise<void>;

  addBroadcast: (message: string, durationDays: number) => Promise<void>;
  deleteBroadcast: (id: string) => Promise<void>;

  addForm: (title: string, url: string, targetType: WorkspaceFormTarget, targetValue: string | null, description?: string) => Promise<void>;
  deleteForm: (id: string) => Promise<void>;
  markFormCompleted: (formId: string) => Promise<void>;
  unmarkFormCompleted: (formId: string) => Promise<void>;
};

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, workspaceId: authWorkspaceId } = useAuth();
  const uid = user?.id;
  const workspaceId = authWorkspaceId;
  const [people, setPeople] = useState<Person[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [areaNotes, setAreaNotes] = useState<AreaNote[]>([]);
  const [parkingItems, setParkingItems] = useState<ParkingItem[]>([]);
  const [gamificationActions, setGamificationActions] = useState<GamificationAction[]>([]);
  const [gamificationAwards, setGamificationAwards] = useState<GamificationAward[]>([]);
  const [leadThermometer, setLeadThermometer] = useState<LeadThermometerItem[]>([]);
  const [attendanceSettings, setAttendanceSettings] = useState<AttendanceSetting[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [forms, setForms] = useState<WorkspaceForm[]>([]);
  const [formCompletions, setFormCompletions] = useState<FormCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoriesRaw, setCategoriesRaw] = useState<{ id: string; name: string }[]>([]);
  const pplMapRef = useRef<Map<string, Person>>(new Map());

  // Fetch workspace + all data
  useEffect(() => {
    if (!uid || !workspaceId) {
      setPeople([]); setProjects([]); setTasks([]); setPosts([]);
      setEvents([]); setCategories([]); setChannels([]); setTeams([]);
      setCategoriesRaw([]); setEventTypes([]); setAreaNotes([]); setParkingItems([]); setGamificationActions([]); setGamificationAwards([]); setLeadThermometer([]); setAttendanceSettings([]); setAttendanceRecords([]); setBroadcasts([]); setForms([]); setFormCompletions([]); setLoading(false);
      return;
    }
    let cancelled = false;
    async function fetchAll() {
      setLoading(true);
      const wsId = workspaceId!;
      try {

      const [pplRes, projRes, tkRes, psRes, evRes, catRes, chRes, ppRes, taRes, paRes, teamsRes, tmRes, etRes, anRes, piRes, gaRes, gwRes, ltRes, asRes, arRes, bcRes, fmRes, fcRes] = await Promise.all([
        (supabase.from("people") as any).select("*").eq("workspace_id", wsId),
        supabase.from("projects").select("*").eq("workspace_id", wsId),
        supabase.from("tasks").select("*").eq("workspace_id", wsId),
        supabase.from("posts").select("*").eq("workspace_id", wsId),
        supabase.from("calendar_items").select("*").eq("workspace_id", wsId),
        supabase.from("categories").select("id, name").eq("workspace_id", wsId),
        supabase.from("channels").select("id, name, color").eq("workspace_id", wsId),
        supabase.from("project_participants").select("project_id, person_id"),
        supabase.from("task_assignees").select("task_id, person_id"),
        supabase.from("post_assignees").select("post_id, person_id"),
        supabase.from("teams").select("id, name").eq("workspace_id", wsId),
        supabase.from("team_members").select("team_id, person_id"),
        (supabase.from as any)("event_types").select("id, name, color").eq("workspace_id", wsId),
        (supabase.from as any)("area_notes").select("*").eq("workspace_id", wsId),
        (supabase.from as any)("parking_items").select("*").eq("workspace_id", wsId),
        (supabase.from as any)("gamification_actions").select("*").eq("workspace_id", wsId),
        (supabase.from as any)("gamification_awards").select("*").eq("workspace_id", wsId).order("awarded_at", { ascending: false }),
        (supabase.from as any)("lead_thermometer").select("*").eq("workspace_id", wsId).order("position", { ascending: true }),
        (supabase.from as any)("attendance_settings").select("*").eq("workspace_id", wsId),
        (supabase.from as any)("attendance_records").select("*").eq("workspace_id", wsId),
        (supabase.from as any)("broadcasts").select("*").eq("workspace_id", wsId).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }),
        (supabase.from as any)("workspace_forms").select("*").eq("workspace_id", wsId).order("created_at", { ascending: false }),
        (supabase.from as any)("form_completions").select("*").eq("workspace_id", wsId),
      ]);
      if (cancelled) return;

      const pplList: Person[] = (pplRes.data || []).map((p: any) => {
        const rawArea: string | null = p.area ?? null;
        const areas = rawArea ? rawArea.split(",").filter(Boolean) : [];
        const leaderAreas: string[] = typeof p.leader_areas === "string" && p.leader_areas.trim()
          ? p.leader_areas.split(",").filter(Boolean)
          : [];
        const leaderArea = leaderAreas[0] || null;
        return { id: p.id, name: p.name, nickname: p.nickname ?? null, area: rawArea, areas, userId: p.user_id ?? null, leaderArea, leaderAreas };
      });

      const pplMap = new Map(pplList.map(p => [p.id, p]));
      pplMapRef.current = pplMap;
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

      // Build teams
      const teamMembersMap = new Map<string, string[]>();
      (tmRes.data || []).forEach(r => {
        const arr = teamMembersMap.get(r.team_id) || [];
        arr.push(r.person_id);
        teamMembersMap.set(r.team_id, arr);
      });
      setTeams((teamsRes.data || []).map(t => ({
        id: t.id, name: t.name, memberIds: teamMembersMap.get(t.id) || [],
      })));

      setProjects((projRes.data || []).map(r => ({
        id: r.id, name: r.name, description: r.description, color: r.color, status: r.status,
        members: projParticipants.get(r.id) || [],
        managerId: (r as any).manager_id ?? null,
        pipelineStatus: (r as any).pipeline_status ?? "",
        startDate: (r as any).start_date ?? "",
        endContract: (r as any).end_contract ?? "",
        endDelivered: (r as any).end_delivered ?? "",
      })));
      setTasks((tkRes.data || []).map(r => {
        const checklist = Array.isArray(r.checklist) ? (r.checklist as { text: string; checked: boolean }[]) : [];
        return {
          id: r.id, title: r.title, description: r.description, team: r.team,
          teamId: (r as any).team_id ?? null,
          responsible: taskAssignees.get(r.id) || [], deadline: r.deadline, status: r.status,
          checklist, points: (r as any).points ?? 0,
          area: (r as any).area ?? null,
        };
      }));
      setPosts((psRes.data || []).map(r => ({
        id: r.id, title: r.title, copy: r.copy, channel: r.channel, category: r.category,
        date: r.date, time: r.time, status: r.status, responsible: postAssignees.get(r.id) || [],
        link: r.link, media_url: r.media_url, teamId: (r as any).team_id ?? null,
      })));
      setEvents((evRes.data || []).map(r => ({
        id: r.id, title: r.title, date: r.date, type: r.type, description: r.description, teamId: (r as any).team_id ?? null,
      })));
      const rawCats = catRes.data || [];
      setCategoriesRaw(rawCats);
      setCategories(rawCats.map(c => c.name));
      setChannels((chRes.data || []).map(c => ({ id: c.id, name: c.name, color: c.color })));
      setEventTypes(((etRes as any)?.data || []).map((e: any) => ({ id: e.id, name: e.name, color: e.color })));
      setAreaNotes(((anRes as any)?.data || []).map((n: any) => ({ id: n.id, area: n.area, name: n.name, url: n.url, position: n.position ?? 0 })));
      setParkingItems(((piRes as any)?.data || []).map((p: any) => ({ id: p.id, area: p.area, personId: p.person_id ?? null, title: p.title, description: p.description ?? "", date: p.date ?? "", position: p.position ?? 0, status: (p.status as ParkingItemStatus) ?? "in-progress", points: p.points ?? 1, completedAt: p.completed_at ?? null })));
      setGamificationActions(((gaRes as any)?.data || []).map((a: any) => ({ id: a.id, name: a.name, points: a.points ?? 0 })));
      setGamificationAwards(((gwRes as any)?.data || []).map((w: any) => ({ id: w.id, personId: w.person_id, actionId: w.action_id ?? null, actionName: w.action_name, points: w.points ?? 0, awardedAt: w.awarded_at })));
      setLeadThermometer(((ltRes as any)?.data || []).map((l: any) => ({ id: l.id, name: l.name, value: l.value ?? "", areaSize: l.area_size ?? "", type: l.type ?? "", position: l.position ?? 0 })));
      setAttendanceSettings(((asRes as any)?.data || []).map((s: any) => ({ id: s.id, area: s.area, intervalDays: s.interval_days ?? 7, startDate: s.start_date ?? "", meetingCount: s.meeting_count ?? 8 })));
      setAttendanceRecords(((arRes as any)?.data || []).map((r: any) => ({ id: r.id, area: r.area, personId: r.person_id, date: r.date, status: (r.status ?? "P") as AttendanceStatus, justification: r.justification ?? "" })));
      setBroadcasts(((bcRes as any)?.data || []).map((b: any) => ({ id: b.id, message: b.message, durationDays: b.duration_days ?? 7, createdAt: b.created_at, expiresAt: b.expires_at, createdBy: b.created_by ?? null })));
      // Forms — se as tabelas ainda não existirem no banco, os resultados vêm com erro e ficam vazios (não quebra o app)
      setForms(((fmRes as any)?.data || []).map((f: any) => ({ id: f.id, title: f.title, description: f.description ?? "", url: f.url, targetType: (f.target_type ?? "all") as WorkspaceFormTarget, targetValue: f.target_value ?? null, createdBy: f.created_by ?? null, createdAt: f.created_at })));
      setFormCompletions(((fcRes as any)?.data || []).map((c: any) => ({ id: c.id, formId: c.form_id, userId: c.user_id, completedAt: c.completed_at })));

      // Sync: migrate tasks with deadlines into parkingItems so they appear in Quadro CB
      try {
        const existingParkingIds = new Set(((piRes as any)?.data || []).map((p: any) => p.id));
        const taskList: any[] = tkRes.data || [];
        const parkingList: any[] = (piRes as any)?.data || [];
        // Track which tasks already have a matching parking item (by title+date)
        const parkingKeys = new Set(parkingList.map((p: any) => `${p.title}|||${p.date}`));
        const toMigrate = taskList.filter(t => {
          if (!t.deadline) return false;
          if (t.status === "done") return false;
          // Skip if a parking item with same title+date already exists
          return !parkingKeys.has(`${t.title}|||${t.deadline}`);
        });
        if (toMigrate.length > 0 && !cancelled) {
          const inserts = toMigrate.map(t => ({
            workspace_id: wsId,
            area: t.area || "projetos",
            title: t.title,
            description: t.description || "",
            date: t.deadline,
            person_id: (taskAssignees.get(t.id) || [])[0]?.id || null,
            status: t.status === "in-progress" ? "in-progress" : "in-progress",
            points: t.points || 1,
            position: 0,
          }));
          const { data: created } = await (supabase.from("parking_items") as any).insert(inserts).select("*");
          if (created && !cancelled) {
            const newItems: ParkingItem[] = created.map((p: any) => ({
              id: p.id, area: p.area, personId: p.person_id ?? null, title: p.title,
              description: p.description ?? "", date: p.date ?? "", position: p.position ?? 0,
              status: (p.status as ParkingItemStatus) ?? "in-progress", points: p.points ?? 1,
            }));
            setParkingItems(prev => [...prev, ...newItems]);
          }
        }
      } catch (_) { /* migration failure is non-fatal */ }

      if (!cancelled) setLoading(false);
      } catch (err) {
        // Catch-all: network errors, unexpected exceptions — always clear loading state
        // so the app doesn't get stuck on a spinner (especially on mobile)
        if (!cancelled) setLoading(false);
      }
    }
    fetchAll();
    return () => { cancelled = true; };
  }, [uid, workspaceId]);

  // Realtime: re-fetch only the affected data group when a specific table changes
  useEffect(() => {
    if (!workspaceId) return;
    const wsId = workspaceId;

    const refetchPeople = async () => {
      const { data } = await (supabase.from("people") as any).select("*").eq("workspace_id", wsId);
      const pplList: Person[] = (data || []).map((p: any) => {
        const rawArea: string | null = p.area ?? null;
        const areas = rawArea ? rawArea.split(",").filter(Boolean) : [];
        const leaderAreas: string[] = typeof p.leader_areas === "string" && p.leader_areas.trim()
          ? p.leader_areas.split(",").filter(Boolean) : [];
        return { id: p.id, name: p.name, nickname: p.nickname ?? null, area: rawArea, areas, userId: p.user_id ?? null, leaderArea: leaderAreas[0] || null, leaderAreas };
      });
      pplMapRef.current = new Map(pplList.map(p => [p.id, p]));
      setPeople(pplList);
    };

    const refetchTasks = async () => {
      const [tkRes, taRes] = await Promise.all([
        supabase.from("tasks").select("*").eq("workspace_id", wsId),
        supabase.from("task_assignees").select("task_id, person_id"),
      ]);
      const pplMap = pplMapRef.current;
      const taskAssignees = new Map<string, Person[]>();
      (taRes.data || []).forEach((r: any) => {
        const person = pplMap.get(r.person_id);
        if (person) { const arr = taskAssignees.get(r.task_id) || []; arr.push(person); taskAssignees.set(r.task_id, arr); }
      });
      setTasks((tkRes.data || []).map((r: any) => ({
        id: r.id, title: r.title, description: r.description, team: r.team,
        teamId: r.team_id ?? null,
        responsible: taskAssignees.get(r.id) || [], deadline: r.deadline, status: r.status,
        checklist: Array.isArray(r.checklist) ? r.checklist as { text: string; checked: boolean }[] : [],
        points: r.points ?? 0, area: r.area ?? null,
      })));
    };

    const refetchPosts = async () => {
      const [psRes, paRes] = await Promise.all([
        supabase.from("posts").select("*").eq("workspace_id", wsId),
        supabase.from("post_assignees").select("post_id, person_id"),
      ]);
      const pplMap = pplMapRef.current;
      const postAssignees = new Map<string, Person[]>();
      (paRes.data || []).forEach((r: any) => {
        const person = pplMap.get(r.person_id);
        if (person) { const arr = postAssignees.get(r.post_id) || []; arr.push(person); postAssignees.set(r.post_id, arr); }
      });
      setPosts((psRes.data || []).map((r: any) => ({
        id: r.id, title: r.title, copy: r.copy, channel: r.channel, category: r.category,
        date: r.date, time: r.time, status: r.status, responsible: postAssignees.get(r.id) || [],
        link: r.link, media_url: r.media_url, teamId: r.team_id ?? null,
      })));
    };

    const refetchProjects = async () => {
      const [projRes, ppRes] = await Promise.all([
        supabase.from("projects").select("*").eq("workspace_id", wsId),
        supabase.from("project_participants").select("project_id, person_id"),
      ]);
      const pplMap = pplMapRef.current;
      const projParticipants = new Map<string, Person[]>();
      (ppRes.data || []).forEach((r: any) => {
        const person = pplMap.get(r.person_id);
        if (person) { const arr = projParticipants.get(r.project_id) || []; arr.push(person); projParticipants.set(r.project_id, arr); }
      });
      setProjects((projRes.data || []).map((r: any) => ({
        id: r.id, name: r.name, description: r.description, color: r.color, status: r.status,
        members: projParticipants.get(r.id) || [],
        managerId: r.manager_id ?? null, pipelineStatus: r.pipeline_status ?? "",
        startDate: r.start_date ?? "", endContract: r.end_contract ?? "", endDelivered: r.end_delivered ?? "",
      })));
    };

    const refetchTeams = async () => {
      const [teamsRes, tmRes] = await Promise.all([
        supabase.from("teams").select("id, name").eq("workspace_id", wsId),
        supabase.from("team_members").select("team_id, person_id"),
      ]);
      const teamMembersMap = new Map<string, string[]>();
      (tmRes.data || []).forEach((r: any) => { const arr = teamMembersMap.get(r.team_id) || []; arr.push(r.person_id); teamMembersMap.set(r.team_id, arr); });
      setTeams((teamsRes.data || []).map((t: any) => ({ id: t.id, name: t.name, memberIds: teamMembersMap.get(t.id) || [] })));
    };

    const refetchEvents = async () => {
      const { data } = await supabase.from("calendar_items").select("*").eq("workspace_id", wsId);
      setEvents((data || []).map((r: any) => ({ id: r.id, title: r.title, date: r.date, type: r.type, description: r.description, teamId: r.team_id ?? null })));
    };

    const refetchCategories = async () => {
      const { data } = await supabase.from("categories").select("id, name").eq("workspace_id", wsId);
      const rawCats = data || [];
      setCategoriesRaw(rawCats);
      setCategories(rawCats.map((c: any) => c.name));
    };

    const refetchChannels = async () => {
      const { data } = await supabase.from("channels").select("id, name, color").eq("workspace_id", wsId);
      setChannels((data || []).map((c: any) => ({ id: c.id, name: c.name, color: c.color })));
    };

    const refetchEventTypes = async () => {
      const { data } = await (supabase.from as any)("event_types").select("id, name, color").eq("workspace_id", wsId);
      setEventTypes((data || []).map((e: any) => ({ id: e.id, name: e.name, color: e.color })));
    };

    const refetchAreaNotes = async () => {
      const { data } = await (supabase.from as any)("area_notes").select("*").eq("workspace_id", wsId);
      setAreaNotes((data || []).map((n: any) => ({ id: n.id, area: n.area, name: n.name, url: n.url, position: n.position ?? 0 })));
    };

    const refetchParkingItems = async () => {
      const { data } = await (supabase.from as any)("parking_items").select("*").eq("workspace_id", wsId);
      setParkingItems((data || []).map((p: any) => ({ id: p.id, area: p.area, personId: p.person_id ?? null, title: p.title, description: p.description ?? "", date: p.date ?? "", position: p.position ?? 0, status: (p.status as ParkingItemStatus) ?? "in-progress", points: p.points ?? 1, completedAt: p.completed_at ?? null })));
    };

    const refetchGamificationActions = async () => {
      const { data } = await (supabase.from as any)("gamification_actions").select("*").eq("workspace_id", wsId);
      setGamificationActions((data || []).map((a: any) => ({ id: a.id, name: a.name, points: a.points ?? 0 })));
    };

    const refetchGamificationAwards = async () => {
      const { data } = await (supabase.from as any)("gamification_awards").select("*").eq("workspace_id", wsId).order("awarded_at", { ascending: false });
      setGamificationAwards((data || []).map((w: any) => ({ id: w.id, personId: w.person_id, actionId: w.action_id ?? null, actionName: w.action_name, points: w.points ?? 0, awardedAt: w.awarded_at })));
    };

    const refetchLeadThermometer = async () => {
      const { data } = await (supabase.from as any)("lead_thermometer").select("*").eq("workspace_id", wsId).order("position", { ascending: true });
      setLeadThermometer((data || []).map((l: any) => ({ id: l.id, name: l.name, value: l.value ?? "", areaSize: l.area_size ?? "", type: l.type ?? "", position: l.position ?? 0 })));
    };

    const refetchAttendanceSettings = async () => {
      const { data } = await (supabase.from as any)("attendance_settings").select("*").eq("workspace_id", wsId);
      setAttendanceSettings((data || []).map((s: any) => ({ id: s.id, area: s.area, intervalDays: s.interval_days ?? 7, startDate: s.start_date ?? "", meetingCount: s.meeting_count ?? 8 })));
    };

    const refetchAttendanceRecords = async () => {
      const { data } = await (supabase.from as any)("attendance_records").select("*").eq("workspace_id", wsId);
      setAttendanceRecords((data || []).map((r: any) => ({ id: r.id, area: r.area, personId: r.person_id, date: r.date, status: (r.status ?? "P") as AttendanceStatus, justification: r.justification ?? "" })));
    };

    const refetchBroadcasts = async () => {
      const { data } = await (supabase.from as any)("broadcasts").select("*").eq("workspace_id", wsId).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false });
      setBroadcasts((data || []).map((b: any) => ({ id: b.id, message: b.message, durationDays: b.duration_days ?? 7, createdAt: b.created_at, expiresAt: b.expires_at, createdBy: b.created_by ?? null })));
    };

    const refetchForms = async () => {
      const { data } = await (supabase.from as any)("workspace_forms").select("*").eq("workspace_id", wsId).order("created_at", { ascending: false });
      setForms((data || []).map((f: any) => ({ id: f.id, title: f.title, description: f.description ?? "", url: f.url, targetType: (f.target_type ?? "all") as WorkspaceFormTarget, targetValue: f.target_value ?? null, createdBy: f.created_by ?? null, createdAt: f.created_at })));
    };

    const refetchFormCompletions = async () => {
      const { data } = await (supabase.from as any)("form_completions").select("*").eq("workspace_id", wsId);
      setFormCompletions((data || []).map((c: any) => ({ id: c.id, formId: c.form_id, userId: c.user_id, completedAt: c.completed_at })));
    };

    // Per-group debounce: bursts on the same group collapse into one fetch (300ms window)
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const debounced = (key: string, fn: () => Promise<void>) => {
      const existing = timers.get(key);
      if (existing) clearTimeout(existing);
      timers.set(key, setTimeout(() => { timers.delete(key); fn(); }, 300));
    };

    const TABLE_HANDLERS: Record<string, () => void> = {
      people:               () => debounced("people", refetchPeople),
      tasks:                () => debounced("tasks", refetchTasks),
      task_assignees:       () => debounced("tasks", refetchTasks),
      posts:                () => debounced("posts", refetchPosts),
      post_assignees:       () => debounced("posts", refetchPosts),
      projects:             () => debounced("projects", refetchProjects),
      project_participants: () => debounced("projects", refetchProjects),
      teams:                () => debounced("teams", refetchTeams),
      team_members:         () => debounced("teams", refetchTeams),
      calendar_items:       () => debounced("events", refetchEvents),
      categories:           () => debounced("categories", refetchCategories),
      channels:             () => debounced("channels", refetchChannels),
      event_types:          () => debounced("eventTypes", refetchEventTypes),
      area_notes:           () => debounced("areaNotes", refetchAreaNotes),
      parking_items:        () => debounced("parkingItems", refetchParkingItems),
      gamification_actions: () => debounced("gamificationActions", refetchGamificationActions),
      gamification_awards:  () => debounced("gamificationAwards", refetchGamificationAwards),
      lead_thermometer:     () => debounced("leadThermometer", refetchLeadThermometer),
      attendance_settings:  () => debounced("attendanceSettings", refetchAttendanceSettings),
      attendance_records:   () => debounced("attendanceRecords", refetchAttendanceRecords),
      broadcasts:           () => debounced("broadcasts", refetchBroadcasts),
      workspace_forms:      () => debounced("forms", refetchForms),
      form_completions:     () => debounced("formCompletions", refetchFormCompletions),
    };

    // Unique suffix prevents collision when removeChannel (async) hasn't finished
    // before this effect re-runs (e.g. AppLayout remount after an error redirect).
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase.channel(`ws-${workspaceId}-${Math.random().toString(36).slice(2)}`);
      Object.entries(TABLE_HANDLERS).forEach(([table, handler]) => {
        channel!.on("postgres_changes", { event: "*", schema: "public", table }, handler);
      });
      channel.subscribe();
    } catch { channel = null; }
    return () => {
      timers.forEach(t => clearTimeout(t));
      if (channel) supabase.removeChannel(channel);
    };
  }, [workspaceId]);

  // Sync: keep people list in sync with workspace_members.
  // Isolated effect — runs only on workspace change, not on every Realtime tick,
  // to prevent write race conditions when multiple Realtime events arrive simultaneously.
  useEffect(() => {
    if (!uid || !workspaceId) return;
    const wsId = workspaceId;
    let cancelled = false;
    (async () => {
      try {
        const { data: wsMembers } = await (supabase.rpc as any)("list_workspace_members", { _ws_id: wsId });
        if (!wsMembers || cancelled) return;

        const memberUserIds = new Set((wsMembers as any[]).map((m: any) => m.user_id));

        const { data: currentPeople } = await (supabase.from("people") as any)
          .select("id, name, user_id")
          .eq("workspace_id", wsId);
        if (cancelled || !currentPeople) return;

        const existingUserIds = new Set((currentPeople as any[]).filter((p: any) => p.user_id).map((p: any) => p.user_id));
        const toCreate = (wsMembers as any[]).filter((m: any) => m.user_id && !existingUserIds.has(m.user_id));
        const orphaned = (currentPeople as any[]).filter((p: any) => p.user_id && !memberUserIds.has(p.user_id));

        if (toCreate.length > 0) {
          await (supabase.from("people") as any).insert(
            toCreate.map((m: any) => ({ workspace_id: wsId, name: m.display_name || "Usuário", user_id: m.user_id }))
          );
        }
        for (const orphan of orphaned) {
          await (supabase.from("people") as any).delete().eq("id", (orphan as any).id);
        }

        // Realtime subscription on `people` table handles the reload automatically
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, [uid, workspaceId]);

  // Click tracking — registra uma "entrada" no BuzzUp por usuário/workspace.
  // Só conta uma nova entrada se passaram pelo menos 15 minutos desde a última,
  // evitando inflar o contador com reloads/navegações rápidas.
  useEffect(() => {
    if (!uid || !workspaceId) return;
    let cancelled = false;
    (async () => {
      const { data: last } = await (supabase.from("user_daily_logins") as any)
        .select("created_at")
        .eq("workspace_id", workspaceId)
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;

      const FIFTEEN_MIN_MS = 15 * 60 * 1000;
      const lastClickMs = last?.created_at ? new Date(last.created_at).getTime() : 0;
      if (Date.now() - lastClickMs < FIFTEEN_MIN_MS) return;

      await (supabase.from("user_daily_logins") as any).insert({
        workspace_id: workspaceId,
        user_id: uid,
        login_date: getTodayBrasilia(),
      });
    })();
    return () => { cancelled = true; };
  }, [uid, workspaceId]);

  // Notifications
  useEffect(() => {
    const today = getTodayBrasilia();
    const todayDate = getNowBrasilia();
    const notifs: Notification[] = [];
    tasks.forEach(t => {
      if (t.status === "done") return;
      const deadline = new Date(t.deadline);
      const diffDays = Math.ceil((deadline.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) notifs.push({ id: `n_${t.id}_overdue`, title: "Demanda atrasada", message: t.title, type: "danger", read: false, date: t.deadline });
      else if (diffDays === 0) notifs.push({ id: `n_${t.id}_today`, title: "Vence hoje", message: t.title, type: "danger", read: false, date: t.deadline });
      else if (diffDays <= 3) notifs.push({ id: `n_${t.id}_soon`, title: "Prazo próximo", message: `${t.title} — ${diffDays} dia(s)`, type: "warning", read: false, date: t.deadline });
    });
    posts.forEach(p => {
      if (p.status === "published" || p.status === "done") return;
      if (!p.date) return; // estacionamento — sem data, não pode estar atrasado
      if (p.date === today) notifs.push({ id: `n_${p.id}_today`, title: "Publicação do dia", message: p.title, type: "info", read: false, date: p.date });
      else if (p.date < today) notifs.push({ id: `n_${p.id}_overdue`, title: "Publicação atrasada", message: p.title, type: "danger", read: false, date: p.date });
    });
    setNotifications(notifs);
  }, [tasks, posts]);

  // Helper to sync junction tables
  const syncJunction = useCallback(async (table: "project_participants" | "task_assignees" | "post_assignees" | "team_members", fkCol: string, fkId: string, personIds: string[]) => {
    await (supabase.from(table) as any).delete().eq(fkCol, fkId);
    if (personIds.length > 0) {
      const rows = personIds.map(pid => ({ [fkCol]: fkId, person_id: pid }));
      await (supabase.from(table) as any).insert(rows);
    }
  }, []);

  // === PEOPLE ===
  const addPerson = useCallback(async (name: string) => {
    if (!workspaceId) return;
    const { data, error } = await (supabase.from("people") as any).insert({ workspace_id: workspaceId, name }).select("id, name, nickname, area, user_id").single();
    if (error) { toast.error("Erro ao adicionar pessoa"); return; }
    if (data) {
      const rawArea: string | null = data.area ?? null;
      setPeople(prev => [...prev, { id: data.id, name: data.name, nickname: data.nickname ?? null, area: rawArea, areas: rawArea ? rawArea.split(",").filter(Boolean) : [], userId: data.user_id ?? null, leaderArea: null }]);
    }
  }, [workspaceId]);

  const updatePerson = useCallback(async (id: string, name: string) => {
    const { error } = await supabase.from("people").update({ name }).eq("id", id);
    if (error) { toast.error("Erro ao atualizar pessoa"); return; }
    setPeople(prev => prev.map(p => p.id === id ? { ...p, name } : p));
    setTasks(prev => prev.map(t => ({ ...t, responsible: t.responsible.map(r => r.id === id ? { ...r, name } : r) })));
    setPosts(prev => prev.map(p => ({ ...p, responsible: p.responsible.map(r => r.id === id ? { ...r, name } : r) })));
    setProjects(prev => prev.map(p => ({ ...p, members: p.members.map(m => m.id === id ? { ...m, name } : m) })));
  }, []);

  const updatePersonNickname = useCallback(async (id: string, nickname: string | null) => {
    const value = nickname && nickname.trim() ? nickname.trim() : null;
    const { error } = await (supabase.from("people") as any).update({ nickname: value }).eq("id", id);
    if (error) { toast.error("Erro ao atualizar apelido"); return; }
    setPeople(prev => prev.map(p => p.id === id ? { ...p, nickname: value } : p));
  }, []);

  const updatePersonArea = useCallback(async (id: string, area: string | null) => {
    const { error } = await (supabase.from("people") as any).update({ area }).eq("id", id);
    if (error) { toast.error("Erro ao atualizar área"); return; }
    setPeople(prev => prev.map(p => p.id === id ? { ...p, area } : p));
  }, []);

  const updatePersonAreas = useCallback(async (id: string, areas: string[]) => {
    // Store multiple areas in the existing "area" column as comma-separated
    const areaStr = areas.length > 0 ? areas.join(",") : null;
    const { error } = await (supabase.from("people") as any).update({ area: areaStr }).eq("id", id);
    if (error) { toast.error("Erro ao atualizar áreas"); return; }
    setPeople(prev => prev.map(p => p.id === id ? { ...p, area: areaStr, areas } : p));
  }, []);

  const updatePersonLeaderAreas = useCallback(async (id: string, leaderAreas: string[]) => {
    const areaStr = leaderAreas.length > 0 ? leaderAreas.join(",") : null;
    const { error } = await (supabase.from("people") as any).update({ leader_areas: areaStr }).eq("id", id);
    if (error) { toast.error("Erro ao salvar liderança"); return; }
    setPeople(prev => prev.map(p => p.id === id ? { ...p, leaderAreas, leaderArea: leaderAreas[0] || null } : p));
  }, []);

  const updatePersonLeaderArea = useCallback(async (id: string, leaderArea: string | null) => {
    const areaStr = leaderArea || null;
    const { error } = await (supabase.from("people") as any).update({ leader_areas: areaStr }).eq("id", id);
    if (error) { toast.error("Erro ao salvar liderança"); return; }
    setPeople(prev => prev.map(p => p.id === id ? { ...p, leaderArea, leaderAreas: leaderArea ? [leaderArea] : [] } : p));
  }, []);

  const deletePerson = useCallback(async (id: string) => {
    const { error } = await supabase.from("people").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir pessoa"); return; }
    setPeople(prev => prev.filter(p => p.id !== id));
    setTasks(prev => prev.map(t => ({ ...t, responsible: t.responsible.filter(r => r.id !== id) })));
    setPosts(prev => prev.map(p => ({ ...p, responsible: p.responsible.filter(r => r.id !== id) })));
    setProjects(prev => prev.map(p => ({ ...p, members: p.members.filter(m => m.id !== id) })));
    setTeams(prev => prev.map(t => ({ ...t, memberIds: t.memberIds.filter(mid => mid !== id) })));
  }, []);

  // === TASKS ===
  const addTask = useCallback(async (t: Omit<Task, "id" | "responsible"> & { responsibleIds: string[] }) => {
    if (!workspaceId) return;
    const { data, error } = await supabase.from("tasks").insert({
      workspace_id: workspaceId, title: t.title, description: t.description, team: t.team,
      deadline: t.deadline, status: t.status,
      checklist: t.checklist as unknown as Json,
      team_id: t.teamId,
      points: t.points ?? 0,
    } as any).select().single();
    if (error) { toast.error("Erro ao criar demanda"); return; }
    if (data) {
      await syncJunction("task_assignees", "task_id", data.id, t.responsibleIds);
      const resp = people.filter(p => t.responsibleIds.includes(p.id));
      const checklist = Array.isArray(data.checklist) ? (data.checklist as { text: string; checked: boolean }[]) : [];
      setTasks(prev => [...prev, {
        id: data.id, title: data.title, description: data.description, team: data.team,
        teamId: (data as any).team_id ?? null,
        responsible: resp, deadline: data.deadline, status: data.status, checklist,
        points: (data as any).points ?? 0,
      }]);
    }
  }, [workspaceId, people, syncJunction]);

  const updateTask = useCallback(async (t: Task) => {
    const prevTask = tasks.find(x => x.id === t.id);
    const { error } = await supabase.from("tasks").update({
      title: t.title, description: t.description, team: t.team,
      deadline: t.deadline, status: t.status,
      checklist: t.checklist as unknown as Json,
      team_id: t.teamId,
      points: t.points ?? 0,
    } as any).eq("id", t.id);
    if (error) { toast.error("Erro ao atualizar demanda"); return; }
    await syncJunction("task_assignees", "task_id", t.id, t.responsible.map(r => r.id));
    setTasks(prev => prev.map(x => x.id === t.id ? t : x));
    // Award gamification points when task transitions to "done"
    if (workspaceId && prevTask && prevTask.status !== "done" && t.status === "done" && (t.points ?? 0) > 0 && t.responsible.length > 0) {
      const pts = t.points;
      const inserts = t.responsible.map(r => ({
        workspace_id: workspaceId, person_id: r.id, action_id: null,
        action_name: `Demanda: ${t.title}`, points: pts, awarded_by: uid,
      }));
      const { data: aws } = await (supabase.from("gamification_awards") as any).insert(inserts).select();
      if (aws && aws.length) {
        setGamificationAwards(curr => [
          ...aws.map((aw: any) => ({ id: aw.id, personId: aw.person_id, actionId: aw.action_id ?? null, actionName: aw.action_name, points: aw.points ?? 0, awardedAt: aw.awarded_at })),
          ...curr,
        ]);
        toast.success(`+${pts} ponto${pts > 1 ? "s" : ""} para ${t.responsible.length > 1 ? `${t.responsible.length} responsáveis` : t.responsible[0].name}`);
      }
    }
  }, [syncJunction, tasks, workspaceId, uid]);

  const deleteTask = useCallback(async (id: string) => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir demanda"); return; }
    setTasks(prev => prev.filter(x => x.id !== id));
  }, []);

  // === POSTS ===
  const addPost = useCallback(async (p: Omit<Post, "id" | "responsible"> & { responsibleIds: string[] }) => {
    if (!workspaceId) return;
      const { data, error } = await supabase.from("posts").insert({
      workspace_id: workspaceId, title: p.title, copy: p.copy, channel: p.channel,
      category: p.category,
        date: p.date || "",
        time: p.time || "",
      status: p.status,
      link: p.link, media_url: p.media_url, team_id: p.teamId,
    } as any).select().single();
    if (error) { toast.error("Erro ao criar publicação"); return; }
    if (data) {
      await syncJunction("post_assignees", "post_id", data.id, p.responsibleIds);
      const resp = people.filter(per => p.responsibleIds.includes(per.id));
      setPosts(prev => [...prev, {
        id: data.id, title: data.title, copy: data.copy, channel: data.channel, category: data.category,
        date: data.date || "", time: data.time || "", status: data.status, responsible: resp,
        link: data.link, media_url: data.media_url, teamId: (data as any).team_id ?? null,
      }]);
    }
  }, [workspaceId, people, syncJunction]);

  const updatePost = useCallback(async (p: Post) => {
    const { error } = await supabase.from("posts").update({
      title: p.title, copy: p.copy, channel: p.channel, category: p.category,
      date: p.date || "",
      time: p.time || "",
      status: p.status, link: p.link, media_url: p.media_url, team_id: p.teamId,
    } as any).eq("id", p.id);
    if (error) { toast.error("Erro ao atualizar publicação"); return; }
    await syncJunction("post_assignees", "post_id", p.id, p.responsible.map(r => r.id));
    setPosts(prev => prev.map(x => x.id === p.id ? p : x));
  }, [syncJunction]);

  const deletePost = useCallback(async (id: string) => {
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir publicação"); return; }
    setPosts(prev => prev.filter(x => x.id !== id));
  }, []);

  // === PROJECTS ===
  const addProject = useCallback(async (p: Omit<Project, "id" | "members"> & { memberIds: string[] }) => {
    if (!workspaceId) return;
    const { data, error } = await (supabase.from("projects") as any).insert({
      workspace_id: workspaceId, name: p.name, description: p.description,
      color: p.color, status: p.status,
      manager_id: p.managerId, pipeline_status: p.pipelineStatus,
      start_date: p.startDate, end_contract: p.endContract, end_delivered: p.endDelivered,
    }).select().single();
    if (error) { toast.error("Erro ao criar projeto"); return; }
    if (data) {
      await syncJunction("project_participants", "project_id", data.id, p.memberIds);
      const members = people.filter(per => p.memberIds.includes(per.id));
      setProjects(prev => [...prev, {
        id: data.id, name: data.name, description: data.description,
        color: data.color, status: data.status, members,
        managerId: (data as any).manager_id ?? null,
        pipelineStatus: (data as any).pipeline_status ?? "",
        startDate: (data as any).start_date ?? "",
        endContract: (data as any).end_contract ?? "",
        endDelivered: (data as any).end_delivered ?? "",
      }]);
    }
  }, [workspaceId, people, syncJunction]);

  const updateProject = useCallback(async (p: Project) => {
    const { error } = await (supabase.from("projects") as any).update({
      name: p.name, description: p.description, color: p.color, status: p.status,
      manager_id: p.managerId, pipeline_status: p.pipelineStatus,
      start_date: p.startDate, end_contract: p.endContract, end_delivered: p.endDelivered,
    }).eq("id", p.id);
    if (error) { toast.error("Erro ao atualizar projeto"); return; }
    await syncJunction("project_participants", "project_id", p.id, p.members.map(m => m.id));
    setProjects(prev => prev.map(x => x.id === p.id ? p : x));
  }, [syncJunction]);

  const deleteProject = useCallback(async (id: string) => {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir projeto"); return; }
    setProjects(prev => prev.filter(x => x.id !== id));
  }, []);

  // === EVENTS (calendar_items) ===
  const addEvent = useCallback(async (e: Omit<CalendarEvent, "id">) => {
    if (!workspaceId) return;
    const { data, error } = await supabase.from("calendar_items").insert({
      workspace_id: workspaceId, title: e.title, date: e.date,
      type: e.type, description: e.description, team_id: e.teamId,
    } as any).select().single();
    if (error) { toast.error("Erro ao criar evento"); return; }
    if (data) setEvents(prev => [...prev, { id: data.id, title: data.title, date: data.date, type: data.type, description: data.description, teamId: (data as any).team_id ?? null }]);
  }, [workspaceId]);

  const updateEvent = useCallback(async (e: CalendarEvent) => {
    const { error } = await supabase.from("calendar_items").update({
      title: e.title, date: e.date, type: e.type, description: e.description, team_id: e.teamId,
    } as any).eq("id", e.id);
    if (error) { toast.error("Erro ao atualizar evento"); return; }
    setEvents(prev => prev.map(x => x.id === e.id ? e : x));
  }, []);

  const deleteEvent = useCallback(async (id: string) => {
    const { error } = await supabase.from("calendar_items").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir evento"); return; }
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

  // === TEAMS ===
  const addTeam = useCallback(async (name: string, memberIds: string[]) => {
    if (!workspaceId) return;
    const { data, error } = await supabase.from("teams").insert({ workspace_id: workspaceId, name }).select("id, name").single();
    if (error) { toast.error("Erro ao criar time"); return; }
    if (data) {
      if (memberIds.length > 0) {
        await syncJunction("team_members", "team_id", data.id, memberIds);
      }
      setTeams(prev => [...prev, { id: data.id, name: data.name, memberIds }]);
    }
  }, [workspaceId, syncJunction]);

  const updateTeam = useCallback(async (team: Team) => {
    const { error } = await supabase.from("teams").update({ name: team.name }).eq("id", team.id);
    if (error) { toast.error("Erro ao atualizar time"); return; }
    await syncJunction("team_members", "team_id", team.id, team.memberIds);
    setTeams(prev => prev.map(t => t.id === team.id ? team : t));
  }, [syncJunction]);

  const deleteTeam = useCallback(async (id: string) => {
    const { error } = await supabase.from("teams").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir time"); return; }
    setTeams(prev => prev.filter(t => t.id !== id));
  }, []);

  // === EVENT TYPES ===
  const addEventType = useCallback(async (et: Omit<EventType, "id">) => {
    if (!workspaceId) return;
    const { data, error } = await (supabase.from as any)("event_types").insert({ workspace_id: workspaceId, name: et.name, color: et.color }).select("id, name, color").single();
    if (error) { toast.error("Erro ao adicionar tipo"); return; }
    if (data) setEventTypes(prev => [...prev, { id: data.id, name: data.name, color: data.color }]);
  }, [workspaceId]);

  const updateEventType = useCallback(async (et: EventType) => {
    const { error } = await (supabase.from as any)("event_types").update({ name: et.name, color: et.color }).eq("id", et.id);
    if (error) { toast.error("Erro ao atualizar tipo"); return; }
    setEventTypes(prev => prev.map(x => x.id === et.id ? et : x));
  }, []);

  const deleteEventType = useCallback(async (id: string) => {
    const { error } = await (supabase.from as any)("event_types").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover tipo"); return; }
    setEventTypes(prev => prev.filter(x => x.id !== id));
  }, []);

  // Notifications
  const markNotificationRead = useCallback((id: string) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n)), []);
  const markAllNotificationsRead = useCallback(() => setNotifications(prev => prev.map(n => ({ ...n, read: true }))), []);

  // === AREA NOTES (link shortcuts) ===
  const addAreaNote = useCallback(async (area: string, name: string, url: string) => {
    if (!workspaceId) return;
    const { data, error } = await (supabase.from("area_notes") as any)
      .insert({ workspace_id: workspaceId, area, name, url, position: areaNotes.filter(n => n.area === area).length })
      .select().single();
    if (error) { toast.error("Erro ao criar atalho"); return; }
    if (data) setAreaNotes(prev => [...prev, { id: data.id, area: data.area, name: data.name, url: data.url, position: data.position ?? 0 }]);
  }, [workspaceId, areaNotes]);

  const updateAreaNote = useCallback(async (n: AreaNote) => {
    const { error } = await (supabase.from("area_notes") as any).update({ name: n.name, url: n.url, position: n.position }).eq("id", n.id);
    if (error) { toast.error("Erro ao atualizar"); return; }
    setAreaNotes(prev => prev.map(x => x.id === n.id ? n : x));
  }, []);

  const deleteAreaNote = useCallback(async (id: string) => {
    const { error } = await (supabase.from("area_notes") as any).delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    setAreaNotes(prev => prev.filter(x => x.id !== id));
  }, []);

  // === PARKING ITEMS (Quadro CB) ===
  const addParkingItem = useCallback(async (area: string, title: string, date: string, description = "", points: number = 1, personId: string | null = null) => {
    if (!workspaceId) return;
    const pts = Math.max(1, Math.min(3, Math.round(points || 1)));
    const pid = personId || null;
    const { data, error } = await (supabase.from("parking_items") as any)
      .insert({ workspace_id: workspaceId, area, title, description, date, points: pts, person_id: pid, position: parkingItems.filter(p => p.area === area && p.personId === pid).length })
      .select().single();
    if (error) { toast.error("Erro ao criar card"); return; }
    if (data) setParkingItems(prev => [...prev, { id: data.id, area: data.area, personId: data.person_id ?? null, title: data.title, description: data.description ?? "", date: data.date ?? "", position: data.position ?? 0, status: (data.status as ParkingItemStatus) ?? "in-progress", points: data.points ?? pts }]);
  }, [workspaceId, parkingItems]);

  const updateParkingItem = useCallback(async (p: ParkingItem) => {
    const prev = parkingItems.find(x => x.id === p.id);
    const becomingDone = prev && prev.status !== "done" && p.status === "done";
    const { error } = await (supabase.from("parking_items") as any)
      .update({ area: p.area, title: p.title, description: p.description, date: p.date, person_id: p.personId, position: p.position, status: p.status, points: p.points, ...(becomingDone ? { completed_at: new Date().toISOString() } : {}) })
      .eq("id", p.id);
    if (error) { toast.error("Erro ao atualizar"); return; }
    const completedAt = becomingDone ? new Date().toISOString() : p.completedAt ?? prev?.completedAt ?? null;
    setParkingItems(curr => curr.map(x => x.id === p.id ? { ...p, completedAt } : x));
    // Award gamification points when transitioning to "done"
    if (workspaceId && becomingDone && p.personId) {
      const pts = Math.max(1, Math.min(3, p.points || 1));
      const { data: aw } = await (supabase.from("gamification_awards") as any)
        .insert({ workspace_id: workspaceId, person_id: p.personId, action_id: null, action_name: `Demanda: ${p.title}`, points: pts, awarded_by: uid })
        .select().single();
      if (aw) {
        setGamificationAwards(curr => [{ id: aw.id, personId: aw.person_id, actionId: aw.action_id ?? null, actionName: aw.action_name, points: aw.points ?? 0, awardedAt: aw.awarded_at }, ...curr]);
        toast.success(`+${pts} ponto${pts > 1 ? "s" : ""} para a gamificação`);
      }
    }
  }, [parkingItems, workspaceId, uid]);

  const moveParkingItem = useCallback(async (id: string, personId: string | null) => {
    const { error } = await (supabase.from("parking_items") as any).update({ person_id: personId }).eq("id", id);
    if (error) { toast.error("Erro ao mover"); return; }
    setParkingItems(prev => prev.map(x => x.id === id ? { ...x, personId } : x));
  }, []);

  const deleteParkingItem = useCallback(async (id: string) => {
    const { error } = await (supabase.from("parking_items") as any).delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    setParkingItems(prev => prev.filter(x => x.id !== id));
  }, []);

  // === GAMIFICATION ===
  const addGamificationAction = useCallback(async (name: string, points: number) => {
    if (!workspaceId) return;
    const { data, error } = await (supabase.from("gamification_actions") as any)
      .insert({ workspace_id: workspaceId, name, points }).select().single();
    if (error) { toast.error("Erro ao criar ação"); return; }
    if (data) setGamificationActions(prev => [...prev, { id: data.id, name: data.name, points: data.points ?? 0 }]);
  }, [workspaceId]);

  const updateGamificationAction = useCallback(async (a: GamificationAction) => {
    const { error } = await (supabase.from("gamification_actions") as any)
      .update({ name: a.name, points: a.points }).eq("id", a.id);
    if (error) { toast.error("Erro ao atualizar ação"); return; }
    setGamificationActions(prev => prev.map(x => x.id === a.id ? a : x));
  }, []);

  const deleteGamificationAction = useCallback(async (id: string) => {
    const { error } = await (supabase.from("gamification_actions") as any).delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir ação"); return; }
    setGamificationActions(prev => prev.filter(x => x.id !== id));
  }, []);

  const awardGamificationPoints = useCallback(async (personId: string, action: GamificationAction) => {
    if (!workspaceId) return;
    const { data, error } = await (supabase.from("gamification_awards") as any)
      .insert({ workspace_id: workspaceId, person_id: personId, action_id: action.id, action_name: action.name, points: action.points, awarded_by: uid }).select().single();
    if (error) { toast.error("Erro ao pontuar"); return; }
    if (data) setGamificationAwards(prev => [{ id: data.id, personId: data.person_id, actionId: data.action_id ?? null, actionName: data.action_name, points: data.points ?? 0, awardedAt: data.awarded_at }, ...prev]);
  }, [workspaceId, uid]);

  const awardPointsForDemandCompletion = useCallback(async (personId: string, points: number, demandTitle: string) => {
    if (!workspaceId || points <= 0) return;
    const { data, error } = await (supabase.from("gamification_awards") as any)
      .insert({
        workspace_id: workspaceId,
        person_id: personId,
        action_id: null,
        action_name: `Demanda concluída: "${demandTitle}"`,
        points: points,
        awarded_by: uid
      }).select().single();
    if (error) { return; }
    if (data) setGamificationAwards(prev => [{ id: data.id, personId: data.person_id, actionId: null, actionName: data.action_name, points: data.points ?? 0, awardedAt: data.awarded_at }, ...prev]);
  }, [workspaceId, uid]);

  const deleteGamificationAward = useCallback(async (id: string) => {
    const { error } = await (supabase.from("gamification_awards") as any).delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir registro"); return; }
    setGamificationAwards(prev => prev.filter(x => x.id !== id));
  }, []);

  // === LEAD THERMOMETER (Mercado) ===
  const addLeadThermometer = useCallback(async (item: Omit<LeadThermometerItem, "id" | "position">) => {
    if (!workspaceId) return;
    const { data, error } = await (supabase.from("lead_thermometer") as any)
      .insert({ workspace_id: workspaceId, name: item.name, value: item.value, area_size: item.areaSize, type: item.type, position: leadThermometer.length })
      .select().single();
    if (error) { toast.error("Erro ao adicionar lead"); return; }
    if (data) setLeadThermometer(prev => [...prev, { id: data.id, name: data.name, value: data.value ?? "", areaSize: data.area_size ?? "", type: data.type ?? "", position: data.position ?? 0 }]);
  }, [workspaceId, leadThermometer]);

  const updateLeadThermometer = useCallback(async (item: LeadThermometerItem) => {
    const { error } = await (supabase.from("lead_thermometer") as any)
      .update({ name: item.name, value: item.value, area_size: item.areaSize, type: item.type, position: item.position }).eq("id", item.id);
    if (error) { toast.error("Erro ao atualizar lead"); return; }
    setLeadThermometer(prev => prev.map(x => x.id === item.id ? item : x));
  }, []);

  const deleteLeadThermometer = useCallback(async (id: string) => {
    const { error } = await (supabase.from("lead_thermometer") as any).delete().eq("id", id);
    if (error) { toast.error("Erro ao remover lead"); return; }
    setLeadThermometer(prev => prev.filter(x => x.id !== id));
  }, []);

  // === ATTENDANCE (Controle de Presenças) ===
  const upsertAttendanceSetting = useCallback(async (area: string, data: { intervalDays: number; startDate: string; meetingCount: number }) => {
    if (!workspaceId) return;
    const { data: row, error } = await (supabase.from("attendance_settings") as any)
      .upsert({ workspace_id: workspaceId, area, interval_days: data.intervalDays, start_date: data.startDate, meeting_count: data.meetingCount }, { onConflict: "workspace_id,area" })
      .select().single();
    if (error) { toast.error("Erro ao salvar configuração"); return; }
    if (row) {
      const mapped: AttendanceSetting = { id: row.id, area: row.area, intervalDays: row.interval_days ?? 7, startDate: row.start_date ?? "", meetingCount: row.meeting_count ?? 8 };
      setAttendanceSettings(prev => {
        const others = prev.filter(s => s.area !== area);
        return [...others, mapped];
      });
    }
  }, [workspaceId]);

  const setAttendance = useCallback(async (area: string, personId: string, date: string, status: AttendanceStatus, justification = "") => {
    if (!workspaceId) return;
    // Optimistic update — UI reflects change immediately
    const tempId = `tmp-${area}-${personId}-${date}`;
    const optimistic: AttendanceRecord = { id: tempId, area, personId, date, status, justification };
    setAttendanceRecords(prev => {
      const others = prev.filter(r => !(r.area === area && r.personId === personId && r.date === date));
      return [...others, optimistic];
    });
    const { data, error } = await (supabase.from("attendance_records") as any)
      .upsert({ workspace_id: workspaceId, area, person_id: personId, date, status, justification }, { onConflict: "workspace_id,area,person_id,date" })
      .select().single();
    if (error) {
      toast.error("Erro ao salvar presença");
      setAttendanceRecords(prev => prev.filter(r => r.id !== tempId));
      return;
    }
    if (data) {
      const mapped: AttendanceRecord = { id: data.id, area: data.area, personId: data.person_id, date: data.date, status: data.status, justification: data.justification ?? "" };
      setAttendanceRecords(prev => {
        const others = prev.filter(r => !(r.area === area && r.personId === personId && r.date === date));
        return [...others, mapped];
      });
    }
  }, [workspaceId]);

  const clearAttendance = useCallback(async (area: string, personId: string, date: string) => {
    if (!workspaceId) return;
    let prevRecords: AttendanceRecord[] = [];
    setAttendanceRecords(prev => {
      prevRecords = prev.filter(r => r.area === area && r.personId === personId && r.date === date);
      return prev.filter(r => !(r.area === area && r.personId === personId && r.date === date));
    });
    const { error } = await (supabase.from("attendance_records") as any).delete()
      .eq("workspace_id", workspaceId).eq("area", area).eq("person_id", personId).eq("date", date);
    if (error) {
      toast.error("Erro ao limpar");
      setAttendanceRecords(prev => [...prev, ...prevRecords]);
    }
  }, [workspaceId]);

  // === BROADCASTS (Mensagens gerais) ===
  const addBroadcast = useCallback(async (message: string, durationDays: number) => {
    if (!workspaceId) return;
    // Accept fractional days (e.g. 0.5 = 12 hours, 1/60 = 1 minute)
    const exactDays = Math.max(1 / (24 * 60), Math.min(36500, durationDays || 1));
    const daysInt = Math.max(1, Math.round(exactDays)); // for the integer column
    const expiresAt = new Date(Date.now() + exactDays * 24 * 60 * 60 * 1000).toISOString();
    const isInternal = message.startsWith("__") || message.startsWith("Bem-vindos, o Workspace");
    const { data, error } = await (supabase.from("broadcasts") as any)
      .insert({ workspace_id: workspaceId, message, duration_days: daysInt, expires_at: expiresAt, created_by: uid })
      .select().single();
    if (error) {
      if (!isInternal) toast.error("Erro ao publicar mensagem");
      return;
    }
    if (data) setBroadcasts(prev => [{ id: data.id, message: data.message, durationDays: data.duration_days, createdAt: data.created_at, expiresAt: data.expires_at, createdBy: data.created_by ?? null }, ...prev]);
  }, [workspaceId, uid]);

  const deleteBroadcast = useCallback(async (id: string) => {
    const { error } = await (supabase.from("broadcasts") as any).delete().eq("id", id);
    if (error) { toast.error("Erro ao remover mensagem"); return; }
    setBroadcasts(prev => prev.filter(b => b.id !== id));
  }, []);

  // === FORMS (Formulários do workspace) ===
  const addForm = useCallback(async (title: string, url: string, targetType: WorkspaceFormTarget, targetValue: string | null, description = "") => {
    if (!workspaceId) return;
    const { data, error } = await (supabase.from("workspace_forms") as any)
      .insert({ workspace_id: workspaceId, title, description, url, target_type: targetType, target_value: targetValue, created_by: uid })
      .select().single();
    if (error) { toast.error("Erro ao criar formulário"); return; }
    if (data) setForms(prev => [{ id: data.id, title: data.title, description: data.description ?? "", url: data.url, targetType: (data.target_type ?? "all") as WorkspaceFormTarget, targetValue: data.target_value ?? null, createdBy: data.created_by ?? null, createdAt: data.created_at }, ...prev]);
  }, [workspaceId, uid]);

  const deleteForm = useCallback(async (id: string) => {
    const { error } = await (supabase.from("workspace_forms") as any).delete().eq("id", id);
    if (error) { toast.error("Erro ao remover formulário"); return; }
    setForms(prev => prev.filter(f => f.id !== id));
    setFormCompletions(prev => prev.filter(c => c.formId !== id));
  }, []);

  const markFormCompleted = useCallback(async (formId: string) => {
    if (!workspaceId || !uid) return;
    // Optimistic — o card some na hora
    const tempId = `tmp-${formId}-${uid}`;
    const completedAt = new Date().toISOString();
    setFormCompletions(prev => [...prev, { id: tempId, formId, userId: uid, completedAt }]);
    const { data, error } = await (supabase.from("form_completions") as any)
      .insert({ form_id: formId, workspace_id: workspaceId, user_id: uid, completed_at: completedAt })
      .select().single();
    if (error) {
      // 23505 = já marcado (unique) — mantém otimista; outros erros revertem
      if (!String(error.code) .includes("23505")) {
        toast.error("Erro ao marcar como preenchido");
        setFormCompletions(prev => prev.filter(c => c.id !== tempId));
      }
      return;
    }
    if (data) setFormCompletions(prev => prev.map(c => c.id === tempId ? { id: data.id, formId: data.form_id, userId: data.user_id, completedAt: data.completed_at } : c));
  }, [workspaceId, uid]);

  const unmarkFormCompleted = useCallback(async (formId: string) => {
    if (!workspaceId || !uid) return;
    // Optimistic — o card volta para pendente na hora
    let removed: FormCompletion[] = [];
    setFormCompletions(prev => {
      removed = prev.filter(c => c.formId === formId && c.userId === uid);
      return prev.filter(c => !(c.formId === formId && c.userId === uid));
    });
    const { error } = await (supabase.from("form_completions") as any)
      .delete().eq("form_id", formId).eq("user_id", uid);
    if (error) {
      toast.error("Erro ao desfazer preenchimento");
      setFormCompletions(prev => [...prev, ...removed]);
    }
  }, [workspaceId, uid]);

  return (
    <DataContext.Provider value={{
      people, projects, tasks, posts, events, categories, channels, teams, eventTypes, notifications, areaNotes, parkingItems, gamificationActions, gamificationAwards, leadThermometer, attendanceSettings, attendanceRecords, broadcasts, forms, formCompletions, loading, workspaceId,
      addPerson, updatePerson, updatePersonNickname, updatePersonArea, updatePersonAreas, updatePersonLeaderArea, updatePersonLeaderAreas, deletePerson,
      addTask, updateTask, deleteTask,
      addPost, updatePost, deletePost,
      addProject, updateProject, deleteProject,
      addEvent, updateEvent, deleteEvent,
      addCategory, removeCategory, updateCategory,
      addChannel, removeChannel, updateChannel,
      addTeam, updateTeam, deleteTeam,
      addEventType, updateEventType, deleteEventType,
      markNotificationRead, markAllNotificationsRead,
      addAreaNote, updateAreaNote, deleteAreaNote,
      addParkingItem, updateParkingItem, moveParkingItem, deleteParkingItem,
      addGamificationAction, updateGamificationAction, deleteGamificationAction,
      awardGamificationPoints, awardPointsForDemandCompletion, deleteGamificationAward,
      addLeadThermometer, updateLeadThermometer, deleteLeadThermometer,
      upsertAttendanceSetting, setAttendance, clearAttendance,
      addBroadcast, deleteBroadcast,
      addForm, deleteForm, markFormCompleted, unmarkFormCompleted,
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
