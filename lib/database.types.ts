// Types de la base — écrits à la main pour l'instant.
// Régénérables depuis le schéma Supabase : `npm run types` (nécessite la CLI + `supabase start`).

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      google_ads_connections: {
        Row: {
          id: string;
          workspace_id: string;
          customer_id: string;
          descriptive_name: string | null;
          currency_code: string | null;
          time_zone: string | null;
          refresh_token: string | null;
          is_default: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          customer_id: string;
          descriptive_name?: string | null;
          currency_code?: string | null;
          time_zone?: string | null;
          refresh_token?: string | null;
          is_default?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          customer_id?: string;
          descriptive_name?: string | null;
          currency_code?: string | null;
          time_zone?: string | null;
          refresh_token?: string | null;
          is_default?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          status: string;
          plan: string;
          trial_ends_at: string | null;
          current_period_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          status?: string;
          plan?: string;
          trial_ends_at?: string | null;
          current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          status?: string;
          plan?: string;
          trial_ends_at?: string | null;
          current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      mcp_tokens: {
        Row: {
          id: string;
          workspace_id: string;
          token: string;
          label: string | null;
          created_at: string;
          last_used_at: string | null;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          token: string;
          label?: string | null;
          created_at?: string;
          last_used_at?: string | null;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          token?: string;
          label?: string | null;
          created_at?: string;
          last_used_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
