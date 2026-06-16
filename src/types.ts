/**
 * Type declarations for Ponto Inteligente
 */

export type ClockInType = 'entrada' | 'saida_alm' | 'volta_alm' | 'saida';

export interface ClockInEntry {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  type: ClockInType;
  source: 'manual' | 'ocr_slip' | 'real_time_upload' | 'restaurant_infer' | 'geofence_simulation';
  nsr?: string;
  companyName?: string;
  cnpj?: string;
  latitude?: number;
  longitude?: number;
  isCompliant: boolean;
  remarks?: string;
}

export interface Employee {
  id: string;
  name: string;
  registrationId: string; // PIS/Ponto
  role: string;
  contractHoursPerMonth: number; // e.g. 220
  baseSalary: number;
  extraHoursBalance: number; // in hours, ex: +3.5h
  hourlyRate: number; // baseSalary / 220
  avatarColor: string;
  joinedDate: string;
}

export interface NonConformity {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  type: 'missing_clock_in' | 'under_one_hour_lunch' | 'over_ten_hours_day' | 'outside_geofence' | 'unusual_schedule';
  description: string;
  severity: 'low' | 'medium' | 'high';
  resolved: boolean;
}

export interface HoleriteSummary {
  id: string;
  employeeId: string;
  period: string; // MM/YYYY
  baseSalary: number;
  grossSalary: number;
  extraHoursPaid: number;
  extraHoursValue: number;
  totalDiscounts: number;
  netSalary: number;
  extractedAt: string;
}

export interface GeofenceZone {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  address: string;
}

export type UserRole = "colaborador" | "gestor_rh";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  password?: string;
  role: UserRole;
  employeeId?: string; // link to employee details if role is colaborador
  createdAt: string;
}

export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  appliedVacancy: string;
  step: string; // "1" | "2" | "3" | "4"
  summary: string;
  techSkills: string;
  appliedDate: string;
}

export interface JiraTask {
  id: string;
  title: string;
  description: string;
  systemDomain: string; // "Folha" | "Jurídico" | "Tributário" | "ERP" | "Outro"
  priority: 'Crítica' | 'Alta' | 'Média' | 'Baixa';
  status: 'Backlog' | 'To Do' | 'In Progress' | 'Done';
  assignee: string;
}

export interface EmployeeTraining {
  id: string;
  employeeId: string;
  courseName: string;
  progress: number; // 0 to 100
  completed: boolean;
  lastActivity: string; // YYYY-MM-DD
}

