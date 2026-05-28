export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json
          target_id: string | null
          target_type: string | null
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      area_notes: {
        Row: {
          area: string
          created_at: string
          id: string
          name: string
          position: number
          url: string
          workspace_id: string
        }
        Insert: {
          area: string
          created_at?: string
          id?: string
          name: string
          position?: number
          url?: string
          workspace_id: string
        }
        Update: {
          area?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          url?: string
          workspace_id?: string
        }
        Relationships: []
      }
      attendance_records: {
        Row: {
          area: string
          created_at: string
          date: string
          id: string
          justification: string
          person_id: string
          status: string
          workspace_id: string
        }
        Insert: {
          area: string
          created_at?: string
          date: string
          id?: string
          justification?: string
          person_id: string
          status?: string
          workspace_id: string
        }
        Update: {
          area?: string
          created_at?: string
          date?: string
          id?: string
          justification?: string
          person_id?: string
          status?: string
          workspace_id?: string
        }
        Relationships: []
      }
      attendance_settings: {
        Row: {
          area: string
          created_at: string
          id: string
          interval_days: number
          meeting_count: number
          start_date: string
          workspace_id: string
        }
        Insert: {
          area: string
          created_at?: string
          id?: string
          interval_days?: number
          meeting_count?: number
          start_date?: string
          workspace_id: string
        }
        Update: {
          area?: string
          created_at?: string
          id?: string
          interval_days?: number
          meeting_count?: number
          start_date?: string
          workspace_id?: string
        }
        Relationships: []
      }
      broadcasts: {
        Row: {
          created_at: string
          created_by: string | null
          duration_days: number
          expires_at: string
          id: string
          message: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          duration_days?: number
          expires_at?: string
          id?: string
          message: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          duration_days?: number
          expires_at?: string
          id?: string
          message?: string
          workspace_id?: string
        }
        Relationships: []
      }
      calendar_items: {
        Row: {
          area: string | null
          created_at: string
          date: string
          description: string
          id: string
          team_id: string | null
          title: string
          type: string
          workspace_id: string
        }
        Insert: {
          area?: string | null
          created_at?: string
          date?: string
          description?: string
          id?: string
          team_id?: string | null
          title: string
          type?: string
          workspace_id: string
        }
        Update: {
          area?: string | null
          created_at?: string
          date?: string
          description?: string
          id?: string
          team_id?: string | null
          title?: string
          type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          workspace_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          workspace_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      event_types: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          workspace_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          workspace_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          workspace_id?: string
        }
        Relationships: []
      }
      gamification_actions: {
        Row: {
          created_at: string
          id: string
          name: string
          points: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          points?: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          points?: number
          workspace_id?: string
        }
        Relationships: []
      }
      gamification_awards: {
        Row: {
          action_id: string | null
          action_name: string
          awarded_at: string
          awarded_by: string | null
          id: string
          person_id: string
          points: number
          workspace_id: string
        }
        Insert: {
          action_id?: string | null
          action_name: string
          awarded_at?: string
          awarded_by?: string | null
          id?: string
          person_id: string
          points?: number
          workspace_id: string
        }
        Update: {
          action_id?: string | null
          action_name?: string
          awarded_at?: string
          awarded_by?: string | null
          id?: string
          person_id?: string
          points?: number
          workspace_id?: string
        }
        Relationships: []
      }
      lead_thermometer: {
        Row: {
          area_size: string
          created_at: string
          id: string
          name: string
          position: number
          type: string
          value: string
          workspace_id: string
        }
        Insert: {
          area_size?: string
          created_at?: string
          id?: string
          name: string
          position?: number
          type?: string
          value?: string
          workspace_id: string
        }
        Update: {
          area_size?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          type?: string
          value?: string
          workspace_id?: string
        }
        Relationships: []
      }
      parking_items: {
        Row: {
          area: string
          created_at: string
          date: string
          description: string
          id: string
          person_id: string | null
          position: number
          title: string
          workspace_id: string
        }
        Insert: {
          area: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          person_id?: string | null
          position?: number
          title: string
          workspace_id: string
        }
        Update: {
          area?: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          person_id?: string | null
          position?: number
          title?: string
          workspace_id?: string
        }
        Relationships: []
      }
      people: {
        Row: {
          area: string | null
          created_at: string
          email: string
          id: string
          invite_status: string
          name: string
          nickname: string | null
          role: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          area?: string | null
          created_at?: string
          email?: string
          id?: string
          invite_status?: string
          name: string
          nickname?: string | null
          role?: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          area?: string | null
          created_at?: string
          email?: string
          id?: string
          invite_status?: string
          name?: string
          nickname?: string | null
          role?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      post_assignees: {
        Row: {
          id: string
          person_id: string
          post_id: string
        }
        Insert: {
          id?: string
          person_id: string
          post_id: string
        }
        Update: {
          id?: string
          person_id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_assignees_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_assignees_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          category: string
          channel: string
          copy: string
          created_at: string
          date: string
          id: string
          link: string
          media_url: string
          status: string
          team_id: string | null
          time: string
          title: string
          workspace_id: string
        }
        Insert: {
          category?: string
          channel?: string
          copy?: string
          created_at?: string
          date?: string
          id?: string
          link?: string
          media_url?: string
          status?: string
          team_id?: string | null
          time?: string
          title: string
          workspace_id: string
        }
        Update: {
          category?: string
          channel?: string
          copy?: string
          created_at?: string
          date?: string
          id?: string
          link?: string
          media_url?: string
          status?: string
          team_id?: string | null
          time?: string
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_participants: {
        Row: {
          id: string
          person_id: string
          project_id: string
        }
        Insert: {
          id?: string
          person_id: string
          project_id: string
        }
        Update: {
          id?: string
          person_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_participants_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_participants_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          color: string
          created_at: string
          description: string
          id: string
          name: string
          status: string
          workspace_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string
          id?: string
          name: string
          status?: string
          workspace_id: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string
          id?: string
          name?: string
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignees: {
        Row: {
          id: string
          person_id: string
          task_id: string
        }
        Insert: {
          id?: string
          person_id: string
          task_id: string
        }
        Update: {
          id?: string
          person_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignees_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          area: string | null
          checklist: Json
          created_at: string
          deadline: string
          description: string
          id: string
          points: number
          status: string
          team: string
          team_id: string | null
          title: string
          workspace_id: string
        }
        Insert: {
          area?: string | null
          checklist?: Json
          created_at?: string
          deadline?: string
          description?: string
          id?: string
          points?: number
          status?: string
          team?: string
          team_id?: string | null
          title: string
          workspace_id: string
        }
        Update: {
          area?: string | null
          checklist?: Json
          created_at?: string
          deadline?: string
          description?: string
          id?: string
          points?: number
          status?: string
          team?: string
          team_id?: string | null
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: string
          person_id: string
          team_id: string
        }
        Insert: {
          id?: string
          person_id: string
          team_id: string
        }
        Update: {
          id?: string
          person_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          name: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_invites: {
        Row: {
          code_hash: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          max_uses: number
          role: string
          status: string
          updated_at: string
          used_at: string | null
          used_by: string | null
          used_count: number
          workspace_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          max_uses?: number
          role: string
          status?: string
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
          used_count?: number
          workspace_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          max_uses?: number
          role?: string
          status?: string
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
          used_count?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role: string
          status: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          access_code: string
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          access_code?: string
          created_at?: string
          id?: string
          name?: string
          user_id: string
        }
        Update: {
          access_code?: string
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_workspace_invite: {
        Args: { _code: string }
        Returns: {
          role: string
          workspace_id: string
        }[]
      }
      create_workspace: { Args: { _name: string }; Returns: string }
      create_workspace_invite: {
        Args: {
          _expires_in_hours?: number
          _max_uses?: number
          _role: string
          _workspace_id: string
        }
        Returns: string
      }
      current_workspace_role: {
        Args: { _workspace_id: string }
        Returns: string
      }
      generate_access_code: { Args: never; Returns: string }
      generate_invite_code: { Args: never; Returns: string }
      get_workspace_id: { Args: { _user_id: string }; Returns: string }
      is_workspace_admin: { Args: { _user_id: string }; Returns: boolean }
      is_workspace_owner: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      remove_workspace_member: {
        Args: { _target_user: string; _workspace_id: string }
        Returns: undefined
      }
      revoke_workspace_invite: {
        Args: { _invite_id: string; _workspace_id: string }
        Returns: undefined
      }
      update_member_role: {
        Args: { _new_role: string; _target_user: string; _workspace_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
