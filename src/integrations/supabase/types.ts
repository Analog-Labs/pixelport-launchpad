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
      agent_tasks: {
        Row: {
          agent_model: string | null
          agent_role: string
          approval_feedback: string | null
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          id: string
          platform: string | null
          requires_approval: boolean | null
          scheduled_for: string | null
          status: string
          task_description: string
          task_input: Json | null
          task_output: Json | null
          task_type: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          agent_model?: string | null
          agent_role: string
          approval_feedback?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          id?: string
          platform?: string | null
          requires_approval?: boolean | null
          scheduled_for?: string | null
          status?: string
          task_description: string
          task_input?: Json | null
          task_output?: Json | null
          task_type: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          agent_model?: string | null
          agent_role?: string
          approval_feedback?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          id?: string
          platform?: string | null
          requires_approval?: boolean | null
          scheduled_for?: string | null
          status?: string
          task_description?: string
          task_input?: Json | null
          task_output?: Json | null
          task_type?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          agent_id: string
          avatar_url: string | null
          created_at: string | null
          display_name: string
          fallback_model: string | null
          id: string
          is_visible: boolean | null
          model: string | null
          role: string
          settings: Json | null
          soul_template_version: string | null
          status: string
          tenant_id: string
          tone: string | null
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string
          fallback_model?: string | null
          id?: string
          is_visible?: boolean | null
          model?: string | null
          role?: string
          settings?: Json | null
          soul_template_version?: string | null
          status?: string
          tenant_id: string
          tone?: string | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string
          fallback_model?: string | null
          id?: string
          is_visible?: boolean | null
          model?: string | null
          role?: string
          settings?: Json | null
          soul_template_version?: string | null
          status?: string
          tenant_id?: string
          tone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string | null
          encrypted_key: string
          id: string
          is_active: boolean | null
          key_alias: string
          key_hint: string | null
          provider: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          encrypted_key: string
          id?: string
          is_active?: boolean | null
          key_alias: string
          key_hint?: string | null
          provider: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          encrypted_key?: string
          id?: string
          is_active?: boolean | null
          key_alias?: string
          key_hint?: string | null
          provider?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      approvals: {
        Row: {
          content_item_id: string
          created_at: string | null
          decided_at: string | null
          decided_by: string | null
          feedback: string | null
          id: string
          inngest_event_id: string | null
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          content_item_id: string
          created_at?: string | null
          decided_at?: string | null
          decided_by?: string | null
          feedback?: string | null
          id?: string
          inngest_event_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          content_item_id?: string
          created_at?: string | null
          decided_at?: string | null
          decided_by?: string | null
          feedback?: string | null
          id?: string
          inngest_event_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approvals_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          agent_id: string
          content: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          session_id: string
          tenant_id: string
        }
        Insert: {
          agent_id?: string
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          session_id: string
          tenant_id: string
        }
        Update: {
          agent_id?: string
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          session_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          last_message_at: string | null
          tenant_id: string
          title: string | null
        }
        Insert: {
          agent_id?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          tenant_id: string
          title?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          tenant_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      competitors: {
        Row: {
          analysis: Json | null
          company_name: string
          created_at: string | null
          id: string
          recent_activity: string | null
          summary: string | null
          tenant_id: string
          threat_level: string | null
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          analysis?: Json | null
          company_name: string
          created_at?: string | null
          id?: string
          recent_activity?: string | null
          summary?: string | null
          tenant_id: string
          threat_level?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          analysis?: Json | null
          company_name?: string
          created_at?: string | null
          id?: string
          recent_activity?: string | null
          summary?: string | null
          tenant_id?: string
          threat_level?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competitors_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          agent_id: string | null
          body: string | null
          brief_id: string | null
          content_type: string
          created_at: string | null
          feedback: string | null
          id: string
          media_urls: string[] | null
          metadata: Json | null
          platform: string | null
          published_at: string | null
          published_url: string | null
          revision_count: number | null
          scheduled_for: string | null
          status: string
          tenant_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          agent_id?: string | null
          body?: string | null
          brief_id?: string | null
          content_type?: string
          created_at?: string | null
          feedback?: string | null
          id?: string
          media_urls?: string[] | null
          metadata?: Json | null
          platform?: string | null
          published_at?: string | null
          published_url?: string | null
          revision_count?: number | null
          scheduled_for?: string | null
          status?: string
          tenant_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          agent_id?: string | null
          body?: string | null
          brief_id?: string | null
          content_type?: string
          created_at?: string | null
          feedback?: string | null
          id?: string
          media_urls?: string[] | null
          metadata?: Json | null
          platform?: string | null
          published_at?: string | null
          published_url?: string | null
          revision_count?: number | null
          scheduled_for?: string | null
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_items_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          access_token: string | null
          account_id: string | null
          account_name: string | null
          auth_type: string
          connected_at: string | null
          created_at: string
          error_message: string | null
          id: string
          is_active: boolean
          last_used_at: string | null
          metadata: Json | null
          refresh_token: string | null
          scopes: string[] | null
          service: string
          status: string
          tenant_id: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          account_id?: string | null
          account_name?: string | null
          auth_type?: string
          connected_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          metadata?: Json | null
          refresh_token?: string | null
          scopes?: string[] | null
          service: string
          status?: string
          tenant_id: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          account_id?: string | null
          account_name?: string | null
          auth_type?: string
          connected_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          metadata?: Json | null
          refresh_token?: string | null
          scopes?: string[] | null
          service?: string
          status?: string
          tenant_id?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions_log: {
        Row: {
          agent_id: string | null
          cost_usd: number | null
          created_at: string | null
          event_type: string
          id: string
          metadata: Json | null
          model_used: string | null
          summary: string | null
          tenant_id: string
          tokens_used: number | null
        }
        Insert: {
          agent_id?: string | null
          cost_usd?: number | null
          created_at?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          model_used?: string | null
          summary?: string | null
          tenant_id: string
          tokens_used?: number | null
        }
        Update: {
          agent_id?: string | null
          cost_usd?: number | null
          created_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          model_used?: string | null
          summary?: string | null
          tenant_id?: string
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_log_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      slack_connections: {
        Row: {
          bot_token: string
          bot_user_id: string | null
          connected_at: string | null
          created_at: string
          id: string
          installer_user_id: string | null
          is_active: boolean
          scopes: string[] | null
          team_id: string
          team_name: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          bot_token: string
          bot_user_id?: string | null
          connected_at?: string | null
          created_at?: string
          id?: string
          installer_user_id?: string | null
          is_active?: boolean
          scopes?: string[] | null
          team_id: string
          team_name?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          bot_token?: string
          bot_user_id?: string | null
          connected_at?: string | null
          created_at?: string
          id?: string
          installer_user_id?: string | null
          is_active?: boolean
          scopes?: string[] | null
          team_id?: string
          team_name?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "slack_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          agent_api_key: string | null
          agentmail_inbox: string | null
          created_at: string | null
          droplet_id: string | null
          droplet_ip: string | null
          gateway_token: string | null
          id: string
          litellm_team_id: string | null
          name: string
          onboarding_data: Json | null
          plan: string
          settings: Json | null
          slug: string
          status: string
          supabase_user_id: string
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          agent_api_key?: string | null
          agentmail_inbox?: string | null
          created_at?: string | null
          droplet_id?: string | null
          droplet_ip?: string | null
          gateway_token?: string | null
          id?: string
          litellm_team_id?: string | null
          name: string
          onboarding_data?: Json | null
          plan?: string
          settings?: Json | null
          slug: string
          status?: string
          supabase_user_id: string
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          agent_api_key?: string | null
          agentmail_inbox?: string | null
          created_at?: string | null
          droplet_id?: string | null
          droplet_ip?: string | null
          gateway_token?: string | null
          id?: string
          litellm_team_id?: string | null
          name?: string
          onboarding_data?: Json | null
          plan?: string
          settings?: Json | null
          slug?: string
          status?: string
          supabase_user_id?: string
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      vault_sections: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          last_updated_by: string | null
          section_key: string
          section_title: string
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          last_updated_by?: string | null
          section_key: string
          section_title: string
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          last_updated_by?: string | null
          section_key?: string
          section_title?: string
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vault_sections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
