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
