export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          phone: string;
          avatar_path: string | null;
          department: string;
          requested_role: 'Student' | 'Employee';
          role: 'Student' | 'Employee' | 'Manager' | 'Admin';
          account_status: 'Pending' | 'Approved' | 'Rejected' | 'Suspended';
          driving_permission: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          phone?: string;
          avatar_path?: string | null;
          department?: string;
          requested_role: 'Student' | 'Employee';
          role: 'Student' | 'Employee' | 'Manager' | 'Admin';
          account_status?: 'Pending' | 'Approved' | 'Rejected' | 'Suspended';
          driving_permission?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          phone?: string;
          avatar_path?: string | null;
          department?: string;
          requested_role?: 'Student' | 'Employee';
          role?: 'Student' | 'Employee' | 'Manager' | 'Admin';
          account_status?: 'Pending' | 'Approved' | 'Rejected' | 'Suspended';
          driving_permission?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      admin_portal_snapshot: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      admin_portal_action: {
        Args: { p_action: string; p_payload: Json };
        Returns: Json;
      };
      submit_data_subject_request: {
        Args: { p_request_type: string; p_details: string };
        Returns: string;
      };
      list_my_data_subject_requests: {
        Args: Record<PropertyKey, never>;
        Returns: { id: string; request_type: string; details: string; status: string; admin_note: string; created_at: string; reviewed_at: string | null }[];
      };
      list_published_announcements: {
        Args: Record<PropertyKey, never>;
        Returns: { id: string; title: string; body: string; important: boolean; published_at: string; seen: boolean }[];
      };
      mark_announcement_seen: {
        Args: { p_announcement_id: string };
        Returns: boolean;
      };
      admin_list_pending_accounts: {
        Args: Record<PropertyKey, never>;
        Returns: {
          account_id: string;
          email: string;
          full_name: string;
          phone: string;
          department: string;
          requested_role: string;
          created_at: string;
        }[];
      };
      admin_review_pending_account: {
        Args: {
          p_account_id: string;
          p_decision: string;
          p_verified_role: string | null;
          p_affiliation_verified: boolean;
          p_reason: string | null;
        };
        Returns: {
          account_id: string;
          account_status: string;
          role: string;
          driving_permission: boolean;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
