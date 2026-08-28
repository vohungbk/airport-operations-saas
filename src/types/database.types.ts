export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      ai_queries: {
        Row: {
          answer: string | null
          created_at: string
          id: string
          intent: string | null
          partner_id: string | null
          query_result: Json | null
          question: string
          user_id: string | null
        }
        Insert: {
          answer?: string | null
          created_at?: string
          id?: string
          intent?: string | null
          partner_id?: string | null
          query_result?: Json | null
          question: string
          user_id?: string | null
        }
        Update: {
          answer?: string | null
          created_at?: string
          id?: string
          intent?: string | null
          partner_id?: string | null
          query_result?: Json | null
          question?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_queries_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_queries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      airports: {
        Row: {
          city: string
          code: string
          country: string
          created_at: string
          id: string
          name: string
          timezone: string
          updated_at: string
        }
        Insert: {
          city: string
          code: string
          country: string
          created_at?: string
          id?: string
          name: string
          timezone: string
          updated_at?: string
        }
        Update: {
          city?: string
          code?: string
          country?: string
          created_at?: string
          id?: string
          name?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      booking_events: {
        Row: {
          booking_id: string
          created_at: string
          from_status: Database["public"]["Enums"]["booking_status"] | null
          id: string
          metadata: Json | null
          notes: string | null
          seat_id: string | null
          to_status: Database["public"]["Enums"]["booking_status"]
          user_id: string | null
        }
        Insert: {
          booking_id: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["booking_status"] | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          seat_id?: string | null
          to_status: Database["public"]["Enums"]["booking_status"]
          user_id?: string | null
        }
        Update: {
          booking_id?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["booking_status"] | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          seat_id?: string | null
          to_status?: Database["public"]["Enums"]["booking_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_events_seat_id_fkey"
            columns: ["seat_id"]
            isOneToOne: false
            referencedRelation: "seats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          actual_arrival_at: string | null
          airport_id: string
          assigned_seat_id: string | null
          assigned_technician_id: string | null
          booking_number: string
          child_age_band: string | null
          child_height: number | null
          created_at: string
          daily_rate: number
          estimated_arrival_at: string | null
          external_booking_number: string | null
          flight_id: string | null
          gross_revenue: number | null
          id: string
          incident_status: Database["public"]["Enums"]["incident_status"] | null
          notes: string | null
          paid_days: number
          partner_id: string
          partner_share: number | null
          pickup_at: string
          platform_share: number | null
          return_at: string
          scheduled_arrival_at: string | null
          seat_category_id: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
          vehicle: string | null
          vehicle_bay: string | null
        }
        Insert: {
          actual_arrival_at?: string | null
          airport_id: string
          assigned_seat_id?: string | null
          assigned_technician_id?: string | null
          booking_number: string
          child_age_band?: string | null
          child_height?: number | null
          created_at?: string
          daily_rate: number
          estimated_arrival_at?: string | null
          external_booking_number?: string | null
          flight_id?: string | null
          gross_revenue?: number | null
          id?: string
          incident_status?:
            | Database["public"]["Enums"]["incident_status"]
            | null
          notes?: string | null
          paid_days?: number
          partner_id: string
          partner_share?: number | null
          pickup_at: string
          platform_share?: number | null
          return_at: string
          scheduled_arrival_at?: string | null
          seat_category_id: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          vehicle?: string | null
          vehicle_bay?: string | null
        }
        Update: {
          actual_arrival_at?: string | null
          airport_id?: string
          assigned_seat_id?: string | null
          assigned_technician_id?: string | null
          booking_number?: string
          child_age_band?: string | null
          child_height?: number | null
          created_at?: string
          daily_rate?: number
          estimated_arrival_at?: string | null
          external_booking_number?: string | null
          flight_id?: string | null
          gross_revenue?: number | null
          id?: string
          incident_status?:
            | Database["public"]["Enums"]["incident_status"]
            | null
          notes?: string | null
          paid_days?: number
          partner_id?: string
          partner_share?: number | null
          pickup_at?: string
          platform_share?: number | null
          return_at?: string
          scheduled_arrival_at?: string | null
          seat_category_id?: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          vehicle?: string | null
          vehicle_bay?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_airport_id_fkey"
            columns: ["airport_id"]
            isOneToOne: false
            referencedRelation: "airports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_assigned_seat_id_fkey"
            columns: ["assigned_seat_id"]
            isOneToOne: false
            referencedRelation: "seats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_assigned_technician_id_fkey"
            columns: ["assigned_technician_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_flight_id_fkey"
            columns: ["flight_id"]
            isOneToOne: false
            referencedRelation: "flights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_seat_category_id_fkey"
            columns: ["seat_category_id"]
            isOneToOne: false
            referencedRelation: "seat_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaning_records: {
        Row: {
          booking_id: string | null
          checklist: Json | null
          completed_at: string | null
          created_at: string
          employee_id: string
          id: string
          notes: string | null
          passed: boolean | null
          photo_path: string | null
          seat_id: string
          started_at: string
        }
        Insert: {
          booking_id?: string | null
          checklist?: Json | null
          completed_at?: string | null
          created_at?: string
          employee_id: string
          id?: string
          notes?: string | null
          passed?: boolean | null
          photo_path?: string | null
          seat_id: string
          started_at: string
        }
        Update: {
          booking_id?: string | null
          checklist?: Json | null
          completed_at?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          notes?: string | null
          passed?: boolean | null
          photo_path?: string | null
          seat_id?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaning_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_records_seat_id_fkey"
            columns: ["seat_id"]
            isOneToOne: false
            referencedRelation: "seats"
            referencedColumns: ["id"]
          },
        ]
      }
      flights: {
        Row: {
          actual_arrival_at: string | null
          airport_id: string
          created_at: string
          delay_minutes: number | null
          estimated_arrival_at: string | null
          flight_number: string
          id: string
          last_synced_at: string | null
          provider: string | null
          scheduled_arrival_at: string
          status: Database["public"]["Enums"]["flight_status"]
          terminal: string | null
          updated_at: string
        }
        Insert: {
          actual_arrival_at?: string | null
          airport_id: string
          created_at?: string
          delay_minutes?: number | null
          estimated_arrival_at?: string | null
          flight_number: string
          id?: string
          last_synced_at?: string | null
          provider?: string | null
          scheduled_arrival_at: string
          status?: Database["public"]["Enums"]["flight_status"]
          terminal?: string | null
          updated_at?: string
        }
        Update: {
          actual_arrival_at?: string | null
          airport_id?: string
          created_at?: string
          delay_minutes?: number | null
          estimated_arrival_at?: string | null
          flight_number?: string
          id?: string
          last_synced_at?: string | null
          provider?: string | null
          scheduled_arrival_at?: string
          status?: Database["public"]["Enums"]["flight_status"]
          terminal?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flights_airport_id_fkey"
            columns: ["airport_id"]
            isOneToOne: false
            referencedRelation: "airports"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          booking_id: string | null
          created_at: string
          description: string
          id: string
          partner_id: string
          reported_by: string
          resolved_at: string | null
          resolved_by: string | null
          seat_id: string | null
          severity: Database["public"]["Enums"]["incident_severity"]
          status: Database["public"]["Enums"]["incident_status"]
          technician_job_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          description: string
          id?: string
          partner_id: string
          reported_by: string
          resolved_at?: string | null
          resolved_by?: string | null
          seat_id?: string | null
          severity: Database["public"]["Enums"]["incident_severity"]
          status?: Database["public"]["Enums"]["incident_status"]
          technician_job_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          description?: string
          id?: string
          partner_id?: string
          reported_by?: string
          resolved_at?: string | null
          resolved_by?: string | null
          seat_id?: string | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          status?: Database["public"]["Enums"]["incident_status"]
          technician_job_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_seat_id_fkey"
            columns: ["seat_id"]
            isOneToOne: false
            referencedRelation: "seats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_technician_job_id_fkey"
            columns: ["technician_job_id"]
            isOneToOne: false
            referencedRelation: "technician_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_records: {
        Row: {
          booking_id: string | null
          checklist: Json | null
          created_at: string
          id: string
          inspection_type: string
          inspector_id: string
          notes: string | null
          photo_path: string | null
          result: Database["public"]["Enums"]["inspection_result"]
          seat_id: string
        }
        Insert: {
          booking_id?: string | null
          checklist?: Json | null
          created_at?: string
          id?: string
          inspection_type: string
          inspector_id: string
          notes?: string | null
          photo_path?: string | null
          result: Database["public"]["Enums"]["inspection_result"]
          seat_id: string
        }
        Update: {
          booking_id?: string | null
          checklist?: Json | null
          created_at?: string
          id?: string
          inspection_type?: string
          inspector_id?: string
          notes?: string | null
          photo_path?: string | null
          result?: Database["public"]["Enums"]["inspection_result"]
          seat_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_records_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_records_seat_id_fkey"
            columns: ["seat_id"]
            isOneToOne: false
            referencedRelation: "seats"
            referencedColumns: ["id"]
          },
        ]
      }
      installations: {
        Row: {
          category_verified: boolean
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          installation_completed: boolean
          notes: string | null
          photo_path: string | null
          seat_verified: boolean
          technician_job_id: string
          vehicle_location: string | null
        }
        Insert: {
          category_verified?: boolean
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          installation_completed?: boolean
          notes?: string | null
          photo_path?: string | null
          seat_verified?: boolean
          technician_job_id: string
          vehicle_location?: string | null
        }
        Update: {
          category_verified?: boolean
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          installation_completed?: boolean
          notes?: string | null
          photo_path?: string | null
          seat_verified?: boolean
          technician_job_id?: string
          vehicle_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "installations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installations_technician_job_id_fkey"
            columns: ["technician_job_id"]
            isOneToOne: false
            referencedRelation: "technician_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          due_date: string
          id: string
          invoice_number: string
          issue_date: string
          partner_id: string
          pdf_path: string | null
          settlement_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          total: number
          updated_at: string
          vat: number
        }
        Insert: {
          created_at?: string
          due_date: string
          id?: string
          invoice_number: string
          issue_date: string
          partner_id: string
          pdf_path?: string | null
          settlement_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          total: number
          updated_at?: string
          vat?: number
        }
        Update: {
          created_at?: string
          due_date?: string
          id?: string
          invoice_number?: string
          issue_date?: string
          partner_id?: string
          pdf_path?: string | null
          settlement_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          vat?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_commercial_terms: {
        Row: {
          annual_fee: number | null
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          launch_credit_accumulated: number | null
          launch_credit_target: number | null
          launch_mode: boolean
          onboarding_fee: number | null
          partner_id: string
          partner_share_percent: number
          platform_share_percent: number
          updated_at: string
        }
        Insert: {
          annual_fee?: number | null
          created_at?: string
          effective_from: string
          effective_to?: string | null
          id?: string
          launch_credit_accumulated?: number | null
          launch_credit_target?: number | null
          launch_mode?: boolean
          onboarding_fee?: number | null
          partner_id: string
          partner_share_percent: number
          platform_share_percent: number
          updated_at?: string
        }
        Update: {
          annual_fee?: number | null
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          launch_credit_accumulated?: number | null
          launch_credit_target?: number | null
          launch_mode?: boolean
          onboarding_fee?: number | null
          partner_id?: string
          partner_share_percent?: number
          platform_share_percent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_commercial_terms_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          code: string
          contact_email: string
          created_at: string
          id: string
          name: string
          status: Database["public"]["Enums"]["partner_status"]
          updated_at: string
        }
        Insert: {
          code: string
          contact_email: string
          created_at?: string
          id?: string
          name: string
          status?: Database["public"]["Enums"]["partner_status"]
          updated_at?: string
        }
        Update: {
          code?: string
          contact_email?: string
          created_at?: string
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["partner_status"]
          updated_at?: string
        }
        Relationships: []
      }
      seat_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          max_child_age: number
          min_child_age: number
          name: string
          safety_standard: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_child_age: number
          min_child_age: number
          name: string
          safety_standard: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_child_age?: number
          min_child_age?: number
          name?: string
          safety_standard?: string
          updated_at?: string
        }
        Relationships: []
      }
      seat_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["seat_status"] | null
          id: string
          reason: string | null
          seat_id: string
          to_status: Database["public"]["Enums"]["seat_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["seat_status"] | null
          id?: string
          reason?: string | null
          seat_id: string
          to_status: Database["public"]["Enums"]["seat_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["seat_status"] | null
          id?: string
          reason?: string | null
          seat_id?: string
          to_status?: Database["public"]["Enums"]["seat_status"]
        }
        Relationships: [
          {
            foreignKeyName: "seat_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seat_status_history_seat_id_fkey"
            columns: ["seat_id"]
            isOneToOne: false
            referencedRelation: "seats"
            referencedColumns: ["id"]
          },
        ]
      }
      seats: {
        Row: {
          airport_id: string
          category_id: string
          created_at: string
          id: string
          last_cleaned_at: string | null
          last_inspected_at: string | null
          manufacture_date: string
          manufacturer: string
          max_rental_cycles: number
          model: string
          public_token: string
          purchase_date: string
          quarantine_reason: string | null
          rental_cycles: number
          retired_at: string | null
          serial_number: string
          status: Database["public"]["Enums"]["seat_status"]
          updated_at: string
        }
        Insert: {
          airport_id: string
          category_id: string
          created_at?: string
          id?: string
          last_cleaned_at?: string | null
          last_inspected_at?: string | null
          manufacture_date: string
          manufacturer: string
          max_rental_cycles: number
          model: string
          public_token?: string
          purchase_date: string
          quarantine_reason?: string | null
          rental_cycles?: number
          retired_at?: string | null
          serial_number: string
          status?: Database["public"]["Enums"]["seat_status"]
          updated_at?: string
        }
        Update: {
          airport_id?: string
          category_id?: string
          created_at?: string
          id?: string
          last_cleaned_at?: string | null
          last_inspected_at?: string | null
          manufacture_date?: string
          manufacturer?: string
          max_rental_cycles?: number
          model?: string
          public_token?: string
          purchase_date?: string
          quarantine_reason?: string | null
          rental_cycles?: number
          retired_at?: string | null
          serial_number?: string
          status?: Database["public"]["Enums"]["seat_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seats_airport_id_fkey"
            columns: ["airport_id"]
            isOneToOne: false
            referencedRelation: "airports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seats_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "seat_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      settlements: {
        Row: {
          adjustments: number
          created_at: string
          final_amount: number
          gross_revenue: number
          id: string
          launch_credit: number
          partner_id: string
          partner_share: number
          period_end: string
          period_start: string
          platform_share: number
          refunds: number
          status: Database["public"]["Enums"]["settlement_status"]
          updated_at: string
        }
        Insert: {
          adjustments?: number
          created_at?: string
          final_amount?: number
          gross_revenue?: number
          id?: string
          launch_credit?: number
          partner_id: string
          partner_share?: number
          period_end: string
          period_start: string
          platform_share?: number
          refunds?: number
          status?: Database["public"]["Enums"]["settlement_status"]
          updated_at?: string
        }
        Update: {
          adjustments?: number
          created_at?: string
          final_amount?: number
          gross_revenue?: number
          id?: string
          launch_credit?: number
          partner_id?: string
          partner_share?: number
          period_end?: string
          period_start?: string
          platform_share?: number
          refunds?: number
          status?: Database["public"]["Enums"]["settlement_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlements_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_jobs: {
        Row: {
          assigned_at: string
          booking_id: string
          completed_at: string | null
          created_at: string
          id: string
          installation_notes: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["technician_job_status"]
          technician_id: string
          updated_at: string
          vehicle_bay: string | null
        }
        Insert: {
          assigned_at?: string
          booking_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          installation_notes?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["technician_job_status"]
          technician_id: string
          updated_at?: string
          vehicle_bay?: string | null
        }
        Update: {
          assigned_at?: string
          booking_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          installation_notes?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["technician_job_status"]
          technician_id?: string
          updated_at?: string
          vehicle_bay?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technician_jobs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_jobs_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          partner_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          partner_id?: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          partner_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
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
      booking_status:
        | "pending"
        | "confirmed"
        | "assigned"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "no_show"
      flight_status:
        | "scheduled"
        | "delayed"
        | "landed"
        | "cancelled"
        | "diverted"
      incident_severity: "low" | "medium" | "high" | "critical"
      incident_status: "open" | "investigating" | "resolved" | "closed"
      inspection_result: "pass" | "conditional_pass" | "fail"
      invoice_status: "draft" | "issued" | "paid" | "overdue" | "void"
      partner_status: "pending" | "active" | "suspended" | "inactive"
      seat_status:
        | "available"
        | "reserved"
        | "in_use"
        | "cleaning"
        | "inspection"
        | "quarantine"
        | "retired"
      settlement_status: "draft" | "pending_approval" | "approved" | "paid"
      technician_job_status:
        | "assigned"
        | "in_progress"
        | "completed"
        | "cancelled"
      user_role: "admin" | "operations_manager" | "technician" | "partner_user"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      booking_status: [
        "pending",
        "confirmed",
        "assigned",
        "in_progress",
        "completed",
        "cancelled",
        "no_show",
      ],
      flight_status: [
        "scheduled",
        "delayed",
        "landed",
        "cancelled",
        "diverted",
      ],
      incident_severity: ["low", "medium", "high", "critical"],
      incident_status: ["open", "investigating", "resolved", "closed"],
      inspection_result: ["pass", "conditional_pass", "fail"],
      invoice_status: ["draft", "issued", "paid", "overdue", "void"],
      partner_status: ["pending", "active", "suspended", "inactive"],
      seat_status: [
        "available",
        "reserved",
        "in_use",
        "cleaning",
        "inspection",
        "quarantine",
        "retired",
      ],
      settlement_status: ["draft", "pending_approval", "approved", "paid"],
      technician_job_status: [
        "assigned",
        "in_progress",
        "completed",
        "cancelled",
      ],
      user_role: ["admin", "operations_manager", "technician", "partner_user"],
    },
  },
} as const

