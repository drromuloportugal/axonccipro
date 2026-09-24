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
      clinical_audit_events: {
        Row: {
          created_at: string
          guidelines: Json
          id: string
          patient_id: string | null
          question: string | null
          recommendations: Json
          rules: Json
          scope: string | null
          scores: Json
          session_id: string | null
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          guidelines?: Json
          id?: string
          patient_id?: string | null
          question?: string | null
          recommendations?: Json
          rules?: Json
          scope?: string | null
          scores?: Json
          session_id?: string | null
          source?: string
          user_id: string
        }
        Update: {
          created_at?: string
          guidelines?: Json
          id?: string
          patient_id?: string | null
          question?: string | null
          recommendations?: Json
          rules?: Json
          scope?: string | null
          scores?: Json
          session_id?: string | null
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinical_audit_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "realtime_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_guidelines: {
        Row: {
          created_at: string
          domain: string
          id: string
          slug: string
          society: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          slug: string
          society: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          slug?: string
          society?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      clinical_protocols: {
        Row: {
          active: boolean
          code: string
          created_at: string
          domain: string
          id: string
          name: string
          precedence: boolean
          statement: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          domain: string
          id?: string
          name: string
          precedence?: boolean
          statement: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          domain?: string
          id?: string
          name?: string
          precedence?: boolean
          statement?: string
          updated_at?: string
        }
        Relationships: []
      }
      engine_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          code: string
          created_at: string
          domain: string
          evidence: string | null
          id: string
          patient_id: string
          priority: string
          run_id: string | null
          title: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          code: string
          created_at?: string
          domain: string
          evidence?: string | null
          id?: string
          patient_id: string
          priority: string
          run_id?: string | null
          title: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          code?: string
          created_at?: string
          domain?: string
          evidence?: string | null
          id?: string
          patient_id?: string
          priority?: string
          run_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "engine_alerts_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "engine_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      engine_rules: {
        Row: {
          action_summary: string
          active: boolean
          code: string
          condition_summary: string
          created_at: string
          domain: string
          id: string
          priority: string
          recommendation_code: string | null
          title: string
          updated_at: string
        }
        Insert: {
          action_summary: string
          active?: boolean
          code: string
          condition_summary: string
          created_at?: string
          domain: string
          id?: string
          priority?: string
          recommendation_code?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          action_summary?: string
          active?: boolean
          code?: string
          condition_summary?: string
          created_at?: string
          domain?: string
          id?: string
          priority?: string
          recommendation_code?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      engine_run_actions: {
        Row: {
          action: string
          created_at: string
          id: string
          payload: Json
          run_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          payload?: Json
          run_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          payload?: Json
          run_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "engine_run_actions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "engine_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      engine_runs: {
        Row: {
          conflicts: Json
          created_at: string
          data_used: Json
          guidelines_used: Json
          id: string
          intent: string
          missing_data: Json
          patient_bed: string | null
          patient_id: string
          question: string | null
          recommendations: Json
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          rules_fired: Json
          scores: Json
          user_id: string | null
        }
        Insert: {
          conflicts?: Json
          created_at?: string
          data_used?: Json
          guidelines_used?: Json
          id?: string
          intent: string
          missing_data?: Json
          patient_bed?: string | null
          patient_id: string
          question?: string | null
          recommendations?: Json
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rules_fired?: Json
          scores?: Json
          user_id?: string | null
        }
        Update: {
          conflicts?: Json
          created_at?: string
          data_used?: Json
          guidelines_used?: Json
          id?: string
          intent?: string
          missing_data?: Json
          patient_bed?: string | null
          patient_id?: string
          question?: string | null
          recommendations?: Json
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rules_fired?: Json
          scores?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      engine_tasks: {
        Row: {
          created_at: string
          created_by: string | null
          domain: string
          due_time: string | null
          id: string
          patient_id: string
          priority: string
          run_id: string | null
          status: string
          text: string
          updated_at: string
          window_label: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          domain: string
          due_time?: string | null
          id?: string
          patient_id: string
          priority?: string
          run_id?: string | null
          status?: string
          text: string
          updated_at?: string
          window_label: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          domain?: string
          due_time?: string | null
          id?: string
          patient_id?: string
          priority?: string
          run_id?: string | null
          status?: string
          text?: string
          updated_at?: string
          window_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "engine_tasks_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "engine_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      guideline_recommendations: {
        Row: {
          certainty: string | null
          code: string
          created_at: string
          domain: string
          id: string
          source_url: string | null
          statement_summary: string
          strength: string | null
          topic: string
          updated_at: string
          version_id: string
        }
        Insert: {
          certainty?: string | null
          code: string
          created_at?: string
          domain: string
          id?: string
          source_url?: string | null
          statement_summary: string
          strength?: string | null
          topic: string
          updated_at?: string
          version_id: string
        }
        Update: {
          certainty?: string | null
          code?: string
          created_at?: string
          domain?: string
          id?: string
          source_url?: string | null
          statement_summary?: string
          strength?: string | null
          topic?: string
          updated_at?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guideline_recommendations_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "guideline_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      guideline_versions: {
        Row: {
          created_at: string
          guideline_id: string
          id: string
          notes: string | null
          retrieved_at: string | null
          source_url: string | null
          status: string
          updated_at: string
          version_label: string
          year: number | null
        }
        Insert: {
          created_at?: string
          guideline_id: string
          id?: string
          notes?: string | null
          retrieved_at?: string | null
          source_url?: string | null
          status?: string
          updated_at?: string
          version_label: string
          year?: number | null
        }
        Update: {
          created_at?: string
          guideline_id?: string
          id?: string
          notes?: string | null
          retrieved_at?: string | null
          source_url?: string | null
          status?: string
          updated_at?: string
          version_label?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "guideline_versions_guideline_id_fkey"
            columns: ["guideline_id"]
            isOneToOne: false
            referencedRelation: "clinical_guidelines"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          created_at: string
          data: Json
          id: string
          position: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          data: Json
          id: string
          position?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      passometro_patient_snapshots: {
        Row: {
          data: Json
          patient_id: string
          position: number
          updated_at: string
        }
        Insert: {
          data: Json
          patient_id: string
          position: number
          updated_at?: string
        }
        Update: {
          data?: Json
          patient_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nome: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          nome?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      realtime_sessions: {
        Row: {
          created_at: string
          end_reason: string | null
          ended_at: string | null
          id: string
          model: string
          patient_id: string | null
          started_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_reason?: string | null
          ended_at?: string | null
          id?: string
          model: string
          patient_id?: string | null
          started_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_reason?: string | null
          ended_at?: string | null
          id?: string
          model?: string
          patient_id?: string | null
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      realtime_tool_calls: {
        Row: {
          arguments: Json
          confirmed: boolean
          created_at: string
          error: string | null
          id: string
          patient_id: string | null
          requires_confirmation: boolean
          result_summary: string | null
          session_id: string | null
          tool_name: string
          user_id: string
        }
        Insert: {
          arguments?: Json
          confirmed?: boolean
          created_at?: string
          error?: string | null
          id?: string
          patient_id?: string | null
          requires_confirmation?: boolean
          result_summary?: string | null
          session_id?: string | null
          tool_name: string
          user_id: string
        }
        Update: {
          arguments?: Json
          confirmed?: boolean
          created_at?: string
          error?: string | null
          id?: string
          patient_id?: string | null
          requires_confirmation?: boolean
          result_summary?: string | null
          session_id?: string | null
          tool_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "realtime_tool_calls_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "realtime_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_interactions: {
        Row: {
          created_at: string
          id: string
          patient_id: string | null
          role: string
          session_id: string | null
          transcript: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          patient_id?: string | null
          role: string
          session_id?: string | null
          transcript: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          patient_id?: string | null
          role?: string
          session_id?: string | null
          transcript?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_interactions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "realtime_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
