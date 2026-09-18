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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_run: {
        Row: {
          company_id: string | null
          confidence: number | null
          cost_usd: number | null
          created_at: string
          id: string
          input_tokens: number | null
          model: string
          output_tokens: number | null
          prompt_name: string
          prompt_version: string
        }
        Insert: {
          company_id?: string | null
          confidence?: number | null
          cost_usd?: number | null
          created_at?: string
          id?: string
          input_tokens?: number | null
          model: string
          output_tokens?: number | null
          prompt_name: string
          prompt_version: string
        }
        Update: {
          company_id?: string | null
          confidence?: number | null
          cost_usd?: number | null
          created_at?: string
          id?: string
          input_tokens?: number | null
          model?: string
          output_tokens?: number | null
          prompt_name?: string
          prompt_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_run_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_event: {
        Row: {
          actor_id: string | null
          actor_label: string
          created_at: string
          detail: string | null
          event: string
          id: number
          ip: unknown
          object_id: string | null
          object_type: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_label: string
          created_at?: string
          detail?: string | null
          event: string
          id?: number
          ip?: unknown
          object_id?: string | null
          object_type?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_label?: string
          created_at?: string
          detail?: string | null
          event?: string
          id?: number
          ip?: unknown
          object_id?: string | null
          object_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_event_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company: {
        Row: {
          company_type: string | null
          created_at: string
          disqualified_reason: string | null
          fit_score: number | null
          id: string
          market: string
          name: string
          next_touch_at: string | null
          owner_id: string | null
          product_id: string | null
          stage: Database["public"]["Enums"]["stage"]
          website: string | null
        }
        Insert: {
          company_type?: string | null
          created_at?: string
          disqualified_reason?: string | null
          fit_score?: number | null
          id?: string
          market: string
          name: string
          next_touch_at?: string | null
          owner_id?: string | null
          product_id?: string | null
          stage?: Database["public"]["Enums"]["stage"]
          website?: string | null
        }
        Update: {
          company_type?: string | null
          created_at?: string
          disqualified_reason?: string | null
          fit_score?: number | null
          id?: string
          market?: string
          name?: string
          next_touch_at?: string | null
          owner_id?: string | null
          product_id?: string | null
          stage?: Database["public"]["Enums"]["stage"]
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_market_fkey"
            columns: ["market"]
            isOneToOne: false
            referencedRelation: "market"
            referencedColumns: ["country"]
          },
          {
            foreignKeyName: "company_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
        ]
      }
      contact: {
        Row: {
          company_id: string
          email: string | null
          email_source: string | null
          full_name: string
          id: string
          is_primary: boolean
          lawful_basis: string | null
          provenance: Database["public"]["Enums"]["provenance"]
          role_title: string | null
        }
        Insert: {
          company_id: string
          email?: string | null
          email_source?: string | null
          full_name: string
          id?: string
          is_primary?: boolean
          lawful_basis?: string | null
          provenance?: Database["public"]["Enums"]["provenance"]
          role_title?: string | null
        }
        Update: {
          company_id?: string
          email?: string | null
          email_source?: string | null
          full_name?: string
          id?: string
          is_primary?: boolean
          lawful_basis?: string | null
          provenance?: Database["public"]["Enums"]["provenance"]
          role_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      fact: {
        Row: {
          company_id: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          id: string
          is_qualification_criterion: boolean
          key: string
          provenance: Database["public"]["Enums"]["provenance"]
          source_id: string | null
          value: string
        }
        Insert: {
          company_id: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          is_qualification_criterion?: boolean
          key: string
          provenance: Database["public"]["Enums"]["provenance"]
          source_id?: string | null
          value: string
        }
        Update: {
          company_id?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          is_qualification_criterion?: boolean
          key?: string
          provenance?: Database["public"]["Enums"]["provenance"]
          source_id?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "fact_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fact_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fact_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "source"
            referencedColumns: ["id"]
          },
        ]
      }
      gmail_token: {
        Row: {
          profile_id: string
          refresh_token: string
          scope: string
          updated_at: string
        }
        Insert: {
          profile_id: string
          refresh_token: string
          scope: string
          updated_at?: string
        }
        Update: {
          profile_id?: string
          refresh_token?: string
          scope?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gmail_token_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      market: {
        Row: {
          country: string
          id: string
          import_demand: string | null
          legal_note: string | null
          priority: string | null
          product_focus: string | null
          required_before_sending: string | null
          send_window: string | null
          status: string | null
          tariff_note: string | null
          weekly_outreach_cap: number
        }
        Insert: {
          country: string
          id?: string
          import_demand?: string | null
          legal_note?: string | null
          priority?: string | null
          product_focus?: string | null
          required_before_sending?: string | null
          send_window?: string | null
          status?: string | null
          tariff_note?: string | null
          weekly_outreach_cap?: number
        }
        Update: {
          country?: string
          id?: string
          import_demand?: string | null
          legal_note?: string | null
          priority?: string | null
          product_focus?: string | null
          required_before_sending?: string | null
          send_window?: string | null
          status?: string | null
          tariff_note?: string | null
          weekly_outreach_cap?: number
        }
        Relationships: []
      }
      market_note: {
        Row: {
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          id: string
          key: string
          market_id: string
          provenance: Database["public"]["Enums"]["provenance"]
          source_label: string | null
          value: string
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          key: string
          market_id: string
          provenance: Database["public"]["Enums"]["provenance"]
          source_label?: string | null
          value: string
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          key?: string
          market_id?: string
          provenance?: Database["public"]["Enums"]["provenance"]
          source_label?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_note_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_note_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "market"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting: {
        Row: {
          brief: string | null
          calendar_event_id: string | null
          company_id: string
          id: string
          purpose: string | null
          requires_commercial: boolean
          starts_at: string
        }
        Insert: {
          brief?: string | null
          calendar_event_id?: string | null
          company_id: string
          id?: string
          purpose?: string | null
          requires_commercial?: boolean
          starts_at: string
        }
        Update: {
          brief?: string | null
          calendar_event_id?: string | null
          company_id?: string
          id?: string
          purpose?: string | null
          requires_commercial?: boolean
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      message: {
        Row: {
          ai_body: string
          ai_run_id: string | null
          approved_at: string | null
          approved_by: string | null
          approved_hash: string | null
          company_id: string
          contact_id: string | null
          created_at: string
          gmail_draft_id: string | null
          human_body: string | null
          id: string
          kind: string
          rejected_reason: string | null
          released_by: string | null
          reserved_matter: string | null
          scheduled_for: string | null
          status: Database["public"]["Enums"]["msg_status"]
          subject: string
          touch_number: number
          why: Json | null
        }
        Insert: {
          ai_body: string
          ai_run_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          approved_hash?: string | null
          company_id: string
          contact_id?: string | null
          created_at?: string
          gmail_draft_id?: string | null
          human_body?: string | null
          id?: string
          kind: string
          rejected_reason?: string | null
          released_by?: string | null
          reserved_matter?: string | null
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["msg_status"]
          subject: string
          touch_number?: number
          why?: Json | null
        }
        Update: {
          ai_body?: string
          ai_run_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          approved_hash?: string | null
          company_id?: string
          contact_id?: string | null
          created_at?: string
          gmail_draft_id?: string | null
          human_body?: string | null
          id?: string
          kind?: string
          rejected_reason?: string | null
          released_by?: string | null
          reserved_matter?: string | null
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["msg_status"]
          subject?: string
          touch_number?: number
          why?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "message_ai_run_id_fkey"
            columns: ["ai_run_id"]
            isOneToOne: false
            referencedRelation: "ai_run"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contact"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_released_by_fkey"
            columns: ["released_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product: {
        Row: {
          capability_sheet: string | null
          certifications: string[] | null
          created_at: string
          hs_code: string | null
          id: string
          lead_time: string | null
          monthly_capacity: string | null
          name: string
        }
        Insert: {
          capability_sheet?: string | null
          certifications?: string[] | null
          created_at?: string
          hs_code?: string | null
          id?: string
          lead_time?: string | null
          monthly_capacity?: string | null
          name: string
        }
        Update: {
          capability_sheet?: string | null
          certifications?: string[] | null
          created_at?: string
          hs_code?: string | null
          id?: string
          lead_time?: string | null
          monthly_capacity?: string | null
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          assigned_markets: string[]
          created_at: string
          email: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          assigned_markets?: string[]
          created_at?: string
          email: string
          full_name: string
          id: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          assigned_markets?: string[]
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      reply: {
        Row: {
          ai_run_id: string | null
          body: string
          category: Database["public"]["Enums"]["reply_category"] | null
          company_id: string
          confidence: number | null
          contact_id: string | null
          corrected_category:
            | Database["public"]["Enums"]["reply_category"]
            | null
          id: string
          intent: string | null
          is_simulated: boolean
          message_id: string | null
          reasoning: string | null
          received_at: string
          recommended_action: string | null
          urgency: string | null
        }
        Insert: {
          ai_run_id?: string | null
          body: string
          category?: Database["public"]["Enums"]["reply_category"] | null
          company_id: string
          confidence?: number | null
          contact_id?: string | null
          corrected_category?:
            | Database["public"]["Enums"]["reply_category"]
            | null
          id?: string
          intent?: string | null
          is_simulated?: boolean
          message_id?: string | null
          reasoning?: string | null
          received_at?: string
          recommended_action?: string | null
          urgency?: string | null
        }
        Update: {
          ai_run_id?: string | null
          body?: string
          category?: Database["public"]["Enums"]["reply_category"] | null
          company_id?: string
          confidence?: number | null
          contact_id?: string | null
          corrected_category?:
            | Database["public"]["Enums"]["reply_category"]
            | null
          id?: string
          intent?: string | null
          is_simulated?: boolean
          message_id?: string | null
          reasoning?: string | null
          received_at?: string
          recommended_action?: string | null
          urgency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reply_ai_run_id_fkey"
            columns: ["ai_run_id"]
            isOneToOne: false
            referencedRelation: "ai_run"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reply_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reply_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contact"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reply_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "message"
            referencedColumns: ["id"]
          },
        ]
      }
      source: {
        Row: {
          company_id: string
          id: string
          quality: string | null
          retrieved_at: string
          source_type: string | null
          title: string
          url: string | null
        }
        Insert: {
          company_id: string
          id?: string
          quality?: string | null
          retrieved_at?: string
          source_type?: string | null
          title: string
          url?: string | null
        }
        Update: {
          company_id?: string
          id?: string
          quality?: string | null
          retrieved_at?: string
          source_type?: string | null
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "source_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      suppression: {
        Row: {
          created_at: string
          email_or_domain: string
          reason: string
        }
        Insert: {
          created_at?: string
          email_or_domain: string
          reason: string
        }
        Update: {
          created_at?: string
          email_or_domain?: string
          reason?: string
        }
        Relationships: []
      }
      task: {
        Row: {
          assignee_id: string | null
          blocks_stage: boolean
          company_id: string | null
          created_at: string
          done: boolean
          due_on: string | null
          id: string
          title: string
        }
        Insert: {
          assignee_id?: string | null
          blocks_stage?: boolean
          company_id?: string | null
          created_at?: string
          done?: boolean
          due_on?: string | null
          id?: string
          title: string
        }
        Update: {
          assignee_id?: string | null
          blocks_stage?: boolean
          company_id?: string | null
          created_at?: string
          done?: boolean
          due_on?: string | null
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_approve: { Args: never; Returns: boolean }
      can_see_market: { Args: { m: string }; Returns: boolean }
      can_write: { Args: never; Returns: boolean }
      company_visible: { Args: { cid: string }; Returns: boolean }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      is_commercial: { Args: never; Returns: boolean }
      jwt_markets: { Args: never; Returns: string[] }
      jwt_role: { Args: never; Returns: string }
      sees_all_markets: { Args: never; Returns: boolean }
    }
    Enums: {
      msg_status:
        | "draft"
        | "awaiting_approval"
        | "held_commercial"
        | "approved"
        | "rejected"
        | "sent"
      provenance: "verified" | "unverified" | "ai" | "human_approved"
      reply_category:
        | "buying_interest"
        | "information_request"
        | "pricing_request"
        | "not_now"
        | "wrong_person"
        | "not_interested"
        | "unsubscribe"
        | "auto_reply"
      stage:
        | "market_selection"
        | "company_research"
        | "qualification"
        | "contact_identification"
        | "outreach"
        | "follow_up"
        | "reply"
        | "meeting"
        | "commercial_discussion"
        | "nurture"
        | "disqualified"
        | "no_contact"
        | "closed"
      user_role: "executive" | "manager" | "commercial" | "auditor"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      msg_status: [
        "draft",
        "awaiting_approval",
        "held_commercial",
        "approved",
        "rejected",
        "sent",
      ],
      provenance: ["verified", "unverified", "ai", "human_approved"],
      reply_category: [
        "buying_interest",
        "information_request",
        "pricing_request",
        "not_now",
        "wrong_person",
        "not_interested",
        "unsubscribe",
        "auto_reply",
      ],
      stage: [
        "market_selection",
        "company_research",
        "qualification",
        "contact_identification",
        "outreach",
        "follow_up",
        "reply",
        "meeting",
        "commercial_discussion",
        "nurture",
        "disqualified",
        "no_contact",
        "closed",
      ],
      user_role: ["executive", "manager", "commercial", "auditor"],
    },
  },
} as const
