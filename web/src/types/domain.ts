import type { Database, Tables } from './database'

export type AppRole = Database['public']['Enums']['app_role']
export type AppUser = Tables<'app_users'>
export type Person = Tables<'people'>
export type Stay = Tables<'stays'>
export type Outing = Tables<'outings'>
export type CurrentResident = Tables<'current_residents'>
export type AuditEntry = Tables<'audit_log'>
export type PhoneStatus = 'none' | 'with_person' | 'in_custody'
export type Presence = 'inside' | 'outside'
export type CatalogName = 'countries' | 'case_types' | 'genders'
export interface CatalogItem {
  code: string
  labels: Record<string, string>
  sort_order: number
  active: boolean
  updated_at: string
}
