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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          performed_by: string
          target_role: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          performed_by: string
          target_role?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          performed_by?: string
          target_role?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      backup_logs: {
        Row: {
          created_at: string
          drive_file_id: string | null
          drive_file_name: string | null
          duration_ms: number | null
          error_message: string | null
          id: string
          kelas_id: string | null
          kelas_nama: string | null
          mapel_id: string | null
          mapel_nama: string | null
          queued_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          drive_file_id?: string | null
          drive_file_name?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          kelas_id?: string | null
          kelas_nama?: string | null
          mapel_id?: string | null
          mapel_nama?: string | null
          queued_by?: string | null
          status: string
        }
        Update: {
          created_at?: string
          drive_file_id?: string | null
          drive_file_name?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          kelas_id?: string | null
          kelas_nama?: string | null
          mapel_id?: string | null
          mapel_nama?: string | null
          queued_by?: string | null
          status?: string
        }
        Relationships: []
      }
      backup_queue: {
        Row: {
          attempts: number
          id: string
          kelas_id: string
          last_error: string | null
          mapel_id: string
          queued_at: string
          queued_by: string | null
        }
        Insert: {
          attempts?: number
          id?: string
          kelas_id: string
          last_error?: string | null
          mapel_id: string
          queued_at?: string
          queued_by?: string | null
        }
        Update: {
          attempts?: number
          id?: string
          kelas_id?: string
          last_error?: string | null
          mapel_id?: string
          queued_at?: string
          queued_by?: string | null
        }
        Relationships: []
      }
      broadcasts: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          message: string
          target_kelas: string[] | null
          target_mapel: string[] | null
          target_role: string[] | null
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          message: string
          target_kelas?: string[] | null
          target_mapel?: string[] | null
          target_role?: string[] | null
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string
          target_kelas?: string[] | null
          target_mapel?: string[] | null
          target_role?: string[] | null
          title?: string
        }
        Relationships: []
      }
      deleted_scores_archive: {
        Row: {
          context: string
          deleted_at: string
          deleted_by: string
          id: string
          jenis: string | null
          kelas_id: string | null
          mapel_id: string | null
          nama_penilaian: string | null
          note: string | null
          payload: Json
        }
        Insert: {
          context: string
          deleted_at?: string
          deleted_by: string
          id?: string
          jenis?: string | null
          kelas_id?: string | null
          mapel_id?: string | null
          nama_penilaian?: string | null
          note?: string | null
          payload: Json
        }
        Update: {
          context?: string
          deleted_at?: string
          deleted_by?: string
          id?: string
          jenis?: string | null
          kelas_id?: string | null
          mapel_id?: string | null
          nama_penilaian?: string | null
          note?: string | null
          payload?: Json
        }
        Relationships: []
      }
      kelas: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          created_at: string
          id: string
          nama: string
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          id?: string
          nama: string
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          id?: string
          nama?: string
        }
        Relationships: []
      }
      mapel: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          created_at: string
          id: string
          nama: string
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          id?: string
          nama: string
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          id?: string
          nama?: string
        }
        Relationships: []
      }
      nilai_pengelolaan: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kelas_id: string
          kriteria: string | null
          mapel_id: string
          nilai_asli: number
          nilai_final: number
          nilai_tambahan: number
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kelas_id: string
          kriteria?: string | null
          mapel_id: string
          nilai_asli?: number
          nilai_final?: number
          nilai_tambahan?: number
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kelas_id?: string
          kriteria?: string | null
          mapel_id?: string
          nilai_asli?: number
          nilai_final?: number
          nilai_tambahan?: number
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          created_at: string
          id: string
          nama_lengkap: string
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          id?: string
          nama_lengkap: string
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          id?: string
          nama_lengkap?: string
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      ranking_settings: {
        Row: {
          enabled: boolean
          id: string
          kelas_id: string
          mapel_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          id?: string
          kelas_id: string
          mapel_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          id?: string
          kelas_id?: string
          mapel_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ranking_settings_kelas_id_fkey"
            columns: ["kelas_id"]
            isOneToOne: false
            referencedRelation: "kelas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranking_settings_mapel_id_fkey"
            columns: ["mapel_id"]
            isOneToOne: false
            referencedRelation: "mapel"
            referencedColumns: ["id"]
          },
        ]
      }
      scores: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          jenis: string
          kelas_id: string
          kkm: number
          mapel_id: string
          nama_penilaian: string
          nilai: number
          nilai_asli: number | null
          nilai_type: string
          student_id: string
          updated_at: string
          visible: boolean
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          jenis: string
          kelas_id: string
          kkm?: number
          mapel_id: string
          nama_penilaian: string
          nilai?: number
          nilai_asli?: number | null
          nilai_type?: string
          student_id: string
          updated_at?: string
          visible?: boolean
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          jenis?: string
          kelas_id?: string
          kkm?: number
          mapel_id?: string
          nama_penilaian?: string
          nilai?: number
          nilai_asli?: number | null
          nilai_type?: string
          student_id?: string
          updated_at?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "scores_kelas_id_fkey"
            columns: ["kelas_id"]
            isOneToOne: false
            referencedRelation: "kelas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_mapel_id_fkey"
            columns: ["mapel_id"]
            isOneToOne: false
            referencedRelation: "mapel"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      user_kelas: {
        Row: {
          id: string
          kelas_id: string
          user_id: string
        }
        Insert: {
          id?: string
          kelas_id: string
          user_id: string
        }
        Update: {
          id?: string
          kelas_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_kelas_kelas_id_fkey"
            columns: ["kelas_id"]
            isOneToOne: false
            referencedRelation: "kelas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_mapel: {
        Row: {
          id: string
          mapel_id: string
          user_id: string
        }
        Insert: {
          id?: string
          mapel_id: string
          user_id: string
        }
        Update: {
          id?: string
          mapel_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_mapel_mapel_id_fkey"
            columns: ["mapel_id"]
            isOneToOne: false
            referencedRelation: "mapel"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_top_ranking: {
        Args: {
          _jenis: string
          _kelas_id: string
          _mapel_id: string
          _nama_penilaian: string
        }
        Returns: {
          nama_lengkap: string
          nilai: number
          rank: number
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "ADMIN" | "GURU" | "SISWA"
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
    Enums: {
      app_role: ["ADMIN", "GURU", "SISWA"],
    },
  },
} as const
