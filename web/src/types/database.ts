
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "app_users": {
                  Row: {
                    "active": boolean,"created_at": string,"created_by": string | null,"display_name": string,"email": string,"role": Database["public"]['Enums']["app_role"],"updated_at": string,"updated_by": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"created_by"?: string | null,"display_name": string,"email": string,"role": Database["public"]['Enums']["app_role"],"updated_at"?: string,"updated_by"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"created_by"?: string | null,"display_name"?: string,"email"?: string,"role"?: Database["public"]['Enums']["app_role"],"updated_at"?: string,"updated_by"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_role": Database["public"]['Enums']["app_role"] | null,"actor_user_id": string | null,"at": string,"id": number,"new_data": Json | null,"old_data": Json | null,"operator_name": string | null,"record_id": string,"table_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_role"?: Database["public"]['Enums']["app_role"] | null,"actor_user_id"?: string | null,"at"?: string,"id"?: never,"new_data"?: Json | null,"old_data"?: Json | null,"operator_name"?: string | null,"record_id": string,"table_name": string
                  }
                  Update: {
                    "action"?: string,"actor_role"?: Database["public"]['Enums']["app_role"] | null,"actor_user_id"?: string | null,"at"?: string,"id"?: never,"new_data"?: Json | null,"old_data"?: Json | null,"operator_name"?: string | null,"record_id"?: string,"table_name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"case_types": {
                  Row: {
                    "active": boolean,"code": string,"created_at": string,"created_by": string | null,"labels": NonNullable<Json>,"sort_order": number,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"code": string,"created_at"?: string,"created_by"?: string | null,"labels": NonNullable<Json>,"sort_order"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "active"?: boolean,"code"?: string,"created_at"?: string,"created_by"?: string | null,"labels"?: NonNullable<Json>,"sort_order"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"countries": {
                  Row: {
                    "active": boolean,"code": string,"created_at": string,"created_by": string | null,"labels": NonNullable<Json>,"sort_order": number,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"code": string,"created_at"?: string,"created_by"?: string | null,"labels": NonNullable<Json>,"sort_order"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "active"?: boolean,"code"?: string,"created_at"?: string,"created_by"?: string | null,"labels"?: NonNullable<Json>,"sort_order"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"genders": {
                  Row: {
                    "active": boolean,"code": string,"created_at": string,"created_by": string | null,"labels": NonNullable<Json>,"sort_order": number,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"code": string,"created_at"?: string,"created_by"?: string | null,"labels": NonNullable<Json>,"sort_order"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "active"?: boolean,"code"?: string,"created_at"?: string,"created_by"?: string | null,"labels"?: NonNullable<Json>,"sort_order"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"outings": {
                  Row: {
                    "comment": string | null,"created_at": string,"created_by": string | null,"id": string,"is_exception": boolean,"left_at": string,"returned_at": string | null,"stay_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "comment"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_exception"?: boolean,"left_at"?: string,"returned_at"?: string | null,"stay_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "comment"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_exception"?: boolean,"left_at"?: string,"returned_at"?: string | null,"stay_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "outings_stay_id_fkey"
      columns: ["stay_id"]
isOneToOne: false
      referencedRelation: "current_residents"
      referencedColumns: ["stay_id"]
    },{
      foreignKeyName: "outings_stay_id_fkey"
      columns: ["stay_id"]
isOneToOne: false
      referencedRelation: "stays"
      referencedColumns: ["id"]
    }
                  ]
                },"people": {
                  Row: {
                    "birth_date": string | null,"carer_id": string | null,"country_code": string | null,"created_at": string,"created_by": string | null,"first_name": string,"gender_code": string | null,"id": string,"last_name": string | null,"merged_into_id": string | null,"photo_path": string | null,"region": string | null,"search_name": string | null,"source": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "birth_date"?: string | null,"carer_id"?: string | null,"country_code"?: string | null,"created_at"?: string,"created_by"?: string | null,"first_name": string,"gender_code"?: string | null,"id"?: string,"last_name"?: string | null,"merged_into_id"?: string | null,"photo_path"?: string | null,"region"?: string | null,"search_name"?: never,"source"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "birth_date"?: string | null,"carer_id"?: string | null,"country_code"?: string | null,"created_at"?: string,"created_by"?: string | null,"first_name"?: string,"gender_code"?: string | null,"id"?: string,"last_name"?: string | null,"merged_into_id"?: string | null,"photo_path"?: string | null,"region"?: string | null,"search_name"?: never,"source"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "people_carer_id_fkey"
      columns: ["carer_id"]
isOneToOne: false
      referencedRelation: "current_residents"
      referencedColumns: ["person_id"]
    },{
      foreignKeyName: "people_carer_id_fkey"
      columns: ["carer_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "people_country_code_fkey"
      columns: ["country_code"]
isOneToOne: false
      referencedRelation: "countries"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "people_gender_code_fkey"
      columns: ["gender_code"]
isOneToOne: false
      referencedRelation: "genders"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "people_merged_into_id_fkey"
      columns: ["merged_into_id"]
isOneToOne: false
      referencedRelation: "current_residents"
      referencedColumns: ["person_id"]
    },{
      foreignKeyName: "people_merged_into_id_fkey"
      columns: ["merged_into_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    }
                  ]
                },"settings": {
                  Row: {
                    "created_at": string,"created_by": string | null,"key": string,"updated_at": string,"updated_by": string | null,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"key": string,"updated_at"?: string,"updated_by"?: string | null,"value": NonNullable<Json>
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"key"?: string,"updated_at"?: string,"updated_by"?: string | null,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"stays": {
                  Row: {
                    "bed": string | null,"case_type_code": string | null,"created_at": string,"created_by": string | null,"entry_date": string,"exit_date": string | null,"id": string,"notes": string | null,"person_id": string,"phone_status": string,"source": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bed"?: string | null,"case_type_code"?: string | null,"created_at"?: string,"created_by"?: string | null,"entry_date"?: string,"exit_date"?: string | null,"id"?: string,"notes"?: string | null,"person_id": string,"phone_status"?: string,"source"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "bed"?: string | null,"case_type_code"?: string | null,"created_at"?: string,"created_by"?: string | null,"entry_date"?: string,"exit_date"?: string | null,"id"?: string,"notes"?: string | null,"person_id"?: string,"phone_status"?: string,"source"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "stays_case_type_code_fkey"
      columns: ["case_type_code"]
isOneToOne: false
      referencedRelation: "case_types"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "stays_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "current_residents"
      referencedColumns: ["person_id"]
    },{
      foreignKeyName: "stays_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "current_residents": {
                  Row: {
                    "age": number | null,"bed": string | null,"birth_date": string | null,"carer_id": string | null,"case_type_code": string | null,"country_code": string | null,"days_in_shelter": number | null,"entry_date": string | null,"first_name": string | null,"gender_code": string | null,"is_minor": boolean | null,"is_unaccompanied_minor": boolean | null,"last_name": string | null,"notes": string | null,"open_outing_id": string | null,"out_since": string | null,"outings_today": number | null,"person_id": string | null,"phone_status": string | null,"photo_path": string | null,"presence": string | null,"region": string | null,"stay_id": string | null,"stay_updated_at": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "people_carer_id_fkey"
      columns: ["carer_id"]
isOneToOne: false
      referencedRelation: "current_residents"
      referencedColumns: ["person_id"]
    },{
      foreignKeyName: "people_carer_id_fkey"
      columns: ["carer_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "people_country_code_fkey"
      columns: ["country_code"]
isOneToOne: false
      referencedRelation: "countries"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "people_gender_code_fkey"
      columns: ["gender_code"]
isOneToOne: false
      referencedRelation: "genders"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "stays_case_type_code_fkey"
      columns: ["case_type_code"]
isOneToOne: false
      referencedRelation: "case_types"
      referencedColumns: ["code"]
    }
                  ]
                }
          }
          Functions: {
            "check_in":
{ Args: { "p_person_id": string,"p_stay"?: Json }; Returns: string
                           },
"check_out":
{ Args: { "p_exit_date"?: string,"p_stay_id": string }; Returns: undefined
                           },
"end_outing":
{ Args: { "p_stay_id": string }; Returns: string
                           },
"find_possible_duplicates":
{ Args: { "p_birth_date"?: string,"p_country_code"?: string,"p_first_name": string,"p_last_name"?: string }; Returns: {
              "birth_date": string,"country_code": string,"first_name": string,"last_entry_date": string,"last_exit_date": string,"last_name": string,"person_id": string,"photo_path": string,"score": number
            }[]
                           },
"hook_before_user_created":
{ Args: { "event": Json }; Returns: Json
                           },
"merge_people":
{ Args: { "p_duplicate_id": string,"p_survivor_id": string }; Returns: undefined
                           },
"register_person_and_check_in":
{ Args: { "p_person": Json,"p_stay"?: Json }; Returns: Json
                           },
"search_people":
{ Args: { "p_limit"?: number,"p_query": string }; Returns: {
              "birth_date": string,"country_code": string,"first_name": string,"has_open_stay": boolean,"last_entry_date": string,"last_exit_date": string,"last_name": string,"person_id": string,"photo_path": string,"score": number
            }[]
                           },
"start_outing":
{ Args: { "p_comment"?: string,"p_confirm_exception"?: boolean,"p_stay_id": string }; Returns: string
                           }
          }
          Enums: {
            "app_role": "admin"|"legal"|"psychology"|"volunteer"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "app_role": ["admin", "legal", "psychology", "volunteer"]
          }
        }
} as const
