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
      announcements: {
        Row: {
          bg_color: string | null
          content: string
          content_ar: string | null
          content_fr: string | null
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          link_url: string | null
          sort_order: number
          text_color: string | null
          updated_at: string
        }
        Insert: {
          bg_color?: string | null
          content: string
          content_ar?: string | null
          content_fr?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          text_color?: string | null
          updated_at?: string
        }
        Update: {
          bg_color?: string | null
          content?: string
          content_ar?: string | null
          content_fr?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          text_color?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      carnet_payments: {
        Row: {
          amount_paid: number
          created_at: string
          customer_phone: string
          id: string
          vendor_id: string
        }
        Insert: {
          amount_paid: number
          created_at?: string
          customer_phone: string
          id?: string
          vendor_id: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          customer_phone?: string
          id?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "carnet_payments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          accent_color: string | null
          created_at: string
          icon_name: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name_ar: string | null
          name_en: string
          name_fr: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          created_at?: string
          icon_name?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name_ar?: string | null
          name_en: string
          name_fr?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          created_at?: string
          icon_name?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name_ar?: string | null
          name_en?: string
          name_fr?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      communes: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          neighborhood_id: string | null
          phone_number: string | null
          saved_instructions: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          neighborhood_id?: string | null
          phone_number?: string | null
          saved_instructions?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          neighborhood_id?: string | null
          phone_number?: string | null
          saved_instructions?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cyclist_coverage: {
        Row: {
          created_at: string
          cyclist_id: string
          id: string
          neighborhood_id: string
        }
        Insert: {
          created_at?: string
          cyclist_id: string
          id?: string
          neighborhood_id: string
        }
        Update: {
          created_at?: string
          cyclist_id?: string
          id?: string
          neighborhood_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cyclist_coverage_cyclist_id_fkey"
            columns: ["cyclist_id"]
            isOneToOne: false
            referencedRelation: "cyclists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cyclist_coverage_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
        ]
      }
      cyclists: {
        Row: {
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          phone_number: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          is_active?: boolean
          phone_number: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone_number?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cyclists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      global_settings: {
        Row: {
          created_at: string
          free_delivery_threshold: number
          global_delivery_fee: number
          id: string
          marketplace_active: boolean
          minimum_order_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          free_delivery_threshold?: number
          global_delivery_fee?: number
          id?: string
          marketplace_active?: boolean
          minimum_order_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          free_delivery_threshold?: number
          global_delivery_fee?: number
          id?: string
          marketplace_active?: boolean
          minimum_order_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      invoice_settings: {
        Row: {
          address: string | null
          created_at: string
          footer_message: string | null
          id: string
          phone: string | null
          store_name: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          footer_message?: string | null
          id?: string
          phone?: string | null
          store_name?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          footer_message?: string | null
          id?: string
          phone?: string | null
          store_name?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      master_products: {
        Row: {
          category: Database["public"]["Enums"]["product_category"]
          category_id: string | null
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          measurement_unit: Database["public"]["Enums"]["measurement_unit"]
          name_ar: string | null
          name_fr: string | null
          popularity_score: number
          product_name: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["product_category"]
          category_id?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          measurement_unit: Database["public"]["Enums"]["measurement_unit"]
          name_ar?: string | null
          name_fr?: string | null
          popularity_score?: number
          product_name: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["product_category"]
          category_id?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          measurement_unit?: Database["public"]["Enums"]["measurement_unit"]
          name_ar?: string | null
          name_fr?: string | null
          popularity_score?: number
          product_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "master_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      neighborhoods: {
        Row: {
          commune_id: string
          created_at: string
          delivery_fee: number
          id: string
          name: string
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          commune_id: string
          created_at?: string
          delivery_fee?: number
          id?: string
          name: string
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          commune_id?: string
          created_at?: string
          delivery_fee?: number
          id?: string
          name?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "neighborhoods_commune_id_fkey"
            columns: ["commune_id"]
            isOneToOne: false
            referencedRelation: "communes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neighborhoods_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_name: string
          customer_phone: string | null
          customer_user_id: string
          cyclist_id: string | null
          delivered_at: string | null
          delivery_auth_code: string
          delivery_fee: number
          delivery_notes: string
          id: string
          item_count: number
          neighborhood_id: string | null
          order_items: Json
          payment_method: Database["public"]["Enums"]["payment_method"]
          status: Database["public"]["Enums"]["order_status"]
          total_price: number
          updated_at: string
          vendor_id: string
          vendor_settlement_status: Database["public"]["Enums"]["vendor_settlement_status"]
        }
        Insert: {
          created_at?: string
          customer_name: string
          customer_phone?: string | null
          customer_user_id: string
          cyclist_id?: string | null
          delivered_at?: string | null
          delivery_auth_code?: string
          delivery_fee?: number
          delivery_notes?: string
          id?: string
          item_count?: number
          neighborhood_id?: string | null
          order_items?: Json
          payment_method?: Database["public"]["Enums"]["payment_method"]
          status?: Database["public"]["Enums"]["order_status"]
          total_price?: number
          updated_at?: string
          vendor_id: string
          vendor_settlement_status?: Database["public"]["Enums"]["vendor_settlement_status"]
        }
        Update: {
          created_at?: string
          customer_name?: string
          customer_phone?: string | null
          customer_user_id?: string
          cyclist_id?: string | null
          delivered_at?: string | null
          delivery_auth_code?: string
          delivery_fee?: number
          delivery_notes?: string
          id?: string
          item_count?: number
          neighborhood_id?: string | null
          order_items?: Json
          payment_method?: Database["public"]["Enums"]["payment_method"]
          status?: Database["public"]["Enums"]["order_status"]
          total_price?: number
          updated_at?: string
          vendor_id?: string
          vendor_settlement_status?: Database["public"]["Enums"]["vendor_settlement_status"]
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_user_id_fkey"
            columns: ["customer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_cyclist_id_fkey"
            columns: ["cyclist_id"]
            isOneToOne: false
            referencedRelation: "cyclists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_requests: {
        Row: {
          created_at: string
          id: string
          otp_code: string
          phone_number: string
        }
        Insert: {
          created_at?: string
          id?: string
          otp_code: string
          phone_number: string
        }
        Update: {
          created_at?: string
          id?: string
          otp_code?: string
          phone_number?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          created_at: string
          display_name: string | null
          full_name: string | null
          id: string
          neighborhood_id: string | null
          phone: string | null
          preferred_language: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          id: string
          neighborhood_id?: string | null
          phone?: string | null
          preferred_language?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          id?: string
          neighborhood_id?: string | null
          phone?: string | null
          preferred_language?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
        ]
      }
      site_ads: {
        Row: {
          bg_color: string | null
          content: string
          content_ar: string | null
          content_fr: string | null
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          link_url: string | null
          sort_order: number
          text_color: string | null
          updated_at: string
        }
        Insert: {
          bg_color?: string | null
          content: string
          content_ar?: string | null
          content_fr?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          text_color?: string | null
          updated_at?: string
        }
        Update: {
          bg_color?: string | null
          content?: string
          content_ar?: string | null
          content_fr?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          text_color?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendor_carnet: {
        Row: {
          created_at: string
          current_debt: number
          customer_cin: string | null
          customer_name: string | null
          customer_phone: string
          id: string
          max_limit: number
          status: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          current_debt?: number
          customer_cin?: string | null
          customer_name?: string | null
          customer_phone: string
          id?: string
          max_limit?: number
          status?: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          current_debt?: number
          customer_cin?: string | null
          customer_name?: string | null
          customer_phone?: string
          id?: string
          max_limit?: number
          status?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_carnet_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_products: {
        Row: {
          category_id: string | null
          created_at: string
          flash_sale_end_time: string | null
          flash_sale_price: number | null
          id: string
          image_url: string | null
          is_active: boolean
          is_available: boolean
          is_flash_sale: boolean
          master_product_id: string
          measurement_unit:
            | Database["public"]["Enums"]["measurement_unit"]
            | null
          name_ar: string | null
          name_fr: string | null
          popularity_score: number
          updated_at: string
          vendor_id: string
          vendor_price: number
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          flash_sale_end_time?: string | null
          flash_sale_price?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_available?: boolean
          is_flash_sale?: boolean
          master_product_id: string
          measurement_unit?:
            | Database["public"]["Enums"]["measurement_unit"]
            | null
          name_ar?: string | null
          name_fr?: string | null
          popularity_score?: number
          updated_at?: string
          vendor_id: string
          vendor_price?: number
        }
        Update: {
          category_id?: string | null
          created_at?: string
          flash_sale_end_time?: string | null
          flash_sale_price?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_available?: boolean
          is_flash_sale?: boolean
          master_product_id?: string
          measurement_unit?:
            | Database["public"]["Enums"]["measurement_unit"]
            | null
          name_ar?: string | null
          name_fr?: string | null
          popularity_score?: number
          updated_at?: string
          vendor_id?: string
          vendor_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "vendor_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_products_master_product_id_fkey"
            columns: ["master_product_id"]
            isOneToOne: false
            referencedRelation: "master_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_products_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_service_zones: {
        Row: {
          created_at: string
          id: string
          neighborhood_id: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          neighborhood_id: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          neighborhood_id?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_service_zones_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_service_zones_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          assigned_categories: string[]
          created_at: string
          id: string
          is_active: boolean
          owner_name: string | null
          phone_number: string
          store_name: string
          updated_at: string
          user_id: string | null
          vendor_type: Database["public"]["Enums"]["vendor_type"]
        }
        Insert: {
          assigned_categories?: string[]
          created_at?: string
          id?: string
          is_active?: boolean
          owner_name?: string | null
          phone_number: string
          store_name: string
          updated_at?: string
          user_id?: string | null
          vendor_type?: Database["public"]["Enums"]["vendor_type"]
        }
        Update: {
          assigned_categories?: string[]
          created_at?: string
          id?: string
          is_active?: boolean
          owner_name?: string | null
          phone_number?: string
          store_name?: string
          updated_at?: string
          user_id?: string | null
          vendor_type?: Database["public"]["Enums"]["vendor_type"]
        }
        Relationships: [
          {
            foreignKeyName: "vendors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      clear_vendor_carnet_debt: {
        Args: { p_customer_phone: string; p_vendor_id: string }
        Returns: undefined
      }
      complete_delivery_and_apply_payment: {
        Args: { p_cyclist_id: string; p_order_id: string }
        Returns: {
          new_status: string
          order_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      record_vendor_carnet_payment: {
        Args: {
          p_amount: number
          p_customer_phone: string
          p_vendor_id: string
        }
        Returns: {
          payment_id: string
          remaining_debt: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      measurement_unit:
        | "Kg"
        | "Liter"
        | "Piece"
        | "Pack"
        | "Gram"
        | "Bunch"
        | "Tray"
        | "Box"
      order_status:
        | "new"
        | "preparing"
        | "ready"
        | "delivering"
        | "delivered"
        | "cancelled"
      payment_method: "COD" | "Carnet"
      product_category:
        | "Vegetables"
        | "Fruits"
        | "Dairy"
        | "Bakery"
        | "Pantry"
        | "Groceries"
        | "Vegetables & Fruits"
        | "Meat & Poultry"
        | "Bakery & Pastry"
        | "Dairy & Eggs"
        | "Drinks & Water"
        | "Cleaning Supplies"
      vendor_settlement_status: "pending" | "settled"
      vendor_type: "general" | "specialized"
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
      app_role: ["admin", "moderator", "user"],
      measurement_unit: [
        "Kg",
        "Liter",
        "Piece",
        "Pack",
        "Gram",
        "Bunch",
        "Tray",
        "Box",
      ],
      order_status: [
        "new",
        "preparing",
        "ready",
        "delivering",
        "delivered",
        "cancelled",
      ],
      payment_method: ["COD", "Carnet"],
      product_category: [
        "Vegetables",
        "Fruits",
        "Dairy",
        "Bakery",
        "Pantry",
        "Groceries",
        "Vegetables & Fruits",
        "Meat & Poultry",
        "Bakery & Pastry",
        "Dairy & Eggs",
        "Drinks & Water",
        "Cleaning Supplies",
      ],
      vendor_settlement_status: ["pending", "settled"],
      vendor_type: ["general", "specialized"],
    },
  },
} as const
