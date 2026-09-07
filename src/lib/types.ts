export interface Province {
  id: string;
  name: string;
  slug: string;
  official_code: string;
  latitude: number;
  longitude: number;
  active: boolean;
}

export interface County {
  id: string;
  province_id: string;
  name: string;
  slug: string;
  official_code: string;
  active: boolean;
}

export interface District {
  id: string;
  county_id: string;
  name: string;
  slug: string;
  official_code: string;
  active: boolean;
}

export interface City {
  id: string;
  province_id: string;
  county_id: string;
  district_id: string | null;
  name: string;
  slug: string;
  official_code: string;
  latitude: number;
  longitude: number;
  active: boolean;
}

export interface Neighborhood {
  id: string;
  city_id: string;
  name: string;
  slug: string;
  municipality_zone: string;
  latitude: number;
  longitude: number;
  active: boolean;
}

export interface Agency {
  id: string;
  name: string;
  slug: string;
  phone: string;
  address: string;
  city: string;
  active: boolean;
}

export interface Branch {
  id: string;
  agency_id: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  active: boolean;
}

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string;
  mobile: string;
  email: string;
  role: 'manager' | 'office_manager' | 'consultant' | 'system_admin';
  agency_id: string;
  branch_id: string;
  city: string;
  areas_of_activity: string;
  years_of_experience: number;
  specialization: string;
  personal_notes: string;
  account_status: 'active' | 'suspended' | 'inactive';
  last_activity: string;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Owner {
  id: string;
  name: string;
  phone: string;
  secondary_phone: string;
  notes: string;
  tags: string[];
  status: 'active' | 'inactive' | 'blacklisted';
  assigned_consultant_id: string;
  last_contact: string;
  next_followup: string;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  mobile: string;
  secondary_phone: string;
  address: string;
  customer_type: string;
  transaction_intention: 'buy' | 'rent' | 'partnership' | 'sell' | null;
  transaction_role: string;
  budget_min: number;
  budget_max: number;
  preferred_category: string;
  preferred_property_types: string[];
  preferred_province_ids: string[];
  preferred_county_ids: string[];
  preferred_city_ids: string[];
  min_area: number;
  max_area: number;
  bedrooms: number;
  required_features: string[];
  preferred_floor: number;
  parking_required: boolean;
  elevator_required: boolean;
  property_preferences: Record<string, string | number | boolean | string[] | null>;
  urgency: 'low' | 'normal' | 'high' | 'critical';
  temperature: 'hot' | 'warm' | 'cold';
  lead_source: string;
  assigned_consultant_id: string;
  notes: string;
  tags: string[];
  last_contact: string;
  next_followup: string;
  status: 'active' | 'inactive' | 'converted' | 'lost';
  created_at: string;
  updated_at: string;
}

export interface Property {
  id: string;
  title: string;
  description: string;
  transaction_type: 'buy' | 'rent' | 'partnership' | 'sell';
  transaction_role: string;
  category: 'residential' | 'industrial' | 'commercial' | 'agricultural' | 'office';
  property_type: string;
  status: 'active' | 'sold' | 'rented' | 'inactive' | 'pending';
  is_hot: boolean;
  is_featured: boolean;
  is_active: boolean;
  owner_id: string;
  assigned_consultant_id: string;
  province_id: string;
  county_id: string;
  district_id: string;
  city_id: string;
  neighborhood_id: string;
  street: string;
  address: string;
  postal_code: string;
  latitude: number;
  longitude: number;
  land_area: number;
  building_area: number;
  rooms: number;
  bedrooms: number;
  floor: number;
  total_floors: number;
  unit_number: string;
  building_age: number;
  parking: boolean;
  storage: boolean;
  elevator: boolean;
  balcony: boolean;
  yard: boolean;
  garden: boolean;
  pool: boolean;
  security: boolean;
  heating: string;
  cooling: string;
  sale_price: number;
  deposit_price: number;
  monthly_rent: number;
  price_per_meter: number;
  owner_requested_price: number;
  participation_price: number;
  negotiable: boolean;
  payment_conditions: string;
  commission: number;
  owner_notes: string;
  owner_relationship: string;
  owner_followup_status: string;
  images: string[];
  created_at: string;
  updated_at: string;
}

export interface PropertyRequest {
  id: string;
  customer_id: string;
  transaction_type: 'buy' | 'rent' | 'partnership' | 'sell';
  transaction_role: string;
  category: string;
  property_type: string;
  province_id: string;
  county_id: string;
  city_id: string;
  neighborhood_id: string;
  budget_min: number;
  budget_max: number;
  min_area: number;
  max_area: number;
  bedrooms: number;
  required_features: string[];
  preferred_floor: number;
  parking_required: boolean;
  elevator_required: boolean;
  notes: string;
  status: 'active' | 'fulfilled' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface Call {
  id: string;
  customer_id: string;
  owner_id: string;
  property_id: string;
  consultant_id: string;
  call_date: string;
  duration_minutes: number;
  direction: 'inbound' | 'outbound';
  result: string;
  notes: string;
  next_action: string;
  next_followup: string;
  created_at: string;
}

export interface FollowUp {
  id: string;
  entity_type: 'customer' | 'owner' | 'property' | 'deal';
  entity_id: string;
  customer_id: string;
  owner_id: string;
  property_id: string;
  reason: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  due_date: string;
  due_time: string;
  assigned_consultant_id: string;
  status: 'pending' | 'completed' | 'missed' | 'cancelled';
  notes: string;
  completed_at: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  due_date: string;
  due_time: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assigned_user_id: string;
  customer_id: string;
  owner_id: string;
  property_id: string;
  deal_id: string;
  follow_up_id: string;
  created_at: string;
  updated_at: string;
}

export interface Deal {
  id: string;
  customer_id: string;
  owner_id: string;
  property_id: string;
  consultant_id: string;
  transaction_type: 'buy' | 'rent' | 'partnership' | 'sell';
  deal_value: number;
  commission: number;
  status: 'negotiating' | 'agreement' | 'contracted' | 'completed' | 'cancelled';
  negotiation_status: string;
  contract_date: string;
  completion_date: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface PropertyMatch {
  id: string;
  property_id: string;
  customer_id: string;
  score: number;
  factors: MatchFactor[];
  differences: MatchDifference[];
  created_at: string;
}

export interface MatchFactor {
  label: string;
  matched: boolean;
}

export interface MatchDifference {
  label: string;
  detail: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  entity_type: string;
  entity_id: string;
  is_read: boolean;
  created_at: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  created_at: string;
}
