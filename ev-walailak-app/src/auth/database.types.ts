export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          phone: string;
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
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
