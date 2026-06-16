import { Employee, ClockInEntry } from "./types";

export const SEED_EMPLOYEES: Employee[] = [
  {
    id: "emp01",
    name: "José Soares Sobrinho",
    registrationId: "PIS 0132312081-4",
    role: "Operador de Logística I",
    contractHoursPerMonth: 220,
    baseSalary: 2450.00,
    extraHoursBalance: 12.5, // 12h 30m carry-over
    hourlyRate: 11.13, // 2450 / 220
    avatarColor: "bg-indigo-600",
    joinedDate: "2024-03-12"
  },
  {
    id: "emp02",
    name: "Maria de Souza Menezes",
    registrationId: "PIS 0124451299-1",
    role: "Analista Administrativa II",
    contractHoursPerMonth: 220,
    baseSalary: 3800.00,
    extraHoursBalance: 4.2,
    hourlyRate: 17.27,
    avatarColor: "bg-teal-600",
    joinedDate: "2023-08-01"
  }
];

// Seed June 2026 points for José Soares Sobrinho
export const SEED_CLOCK_INS: ClockInEntry[] = [
  // 01/06/2026 - Regular day
  { id: "c1", employeeId: "emp01", date: "2026-06-01", time: "07:55", type: "entrada", source: "ocr_slip", isCompliant: true },
  { id: "c2", employeeId: "emp01", date: "2026-06-01", time: "12:02", type: "saida_alm", source: "ocr_slip", isCompliant: true },
  { id: "c3", employeeId: "emp01", date: "2026-06-01", time: "13:05", type: "volta_alm", source: "ocr_slip", isCompliant: true },
  { id: "c4", employeeId: "emp01", date: "2026-06-01", time: "17:35", type: "saida", source: "ocr_slip", isCompliant: true },

  // 02/06/2026 - Regular day
  { id: "c5", employeeId: "emp01", date: "2026-06-02", time: "08:00", type: "entrada", source: "ocr_slip", isCompliant: true },
  { id: "c6", employeeId: "emp01", date: "2026-06-02", time: "12:00", type: "saida_alm", source: "ocr_slip", isCompliant: true },
  { id: "c7", employeeId: "emp01", date: "2026-06-02", time: "13:01", type: "volta_alm", source: "ocr_slip", isCompliant: true },
  { id: "c8", employeeId: "emp01", date: "2026-06-02", time: "17:30", type: "saida", source: "ocr_slip", isCompliant: true },

  // 03/06/2026 - Non-conformity: Lunch less than 1 hour (45 mins)
  { id: "c9", employeeId: "emp01", date: "2026-06-03", time: "07:50", type: "entrada", source: "ocr_slip", isCompliant: true },
  { id: "c10", employeeId: "emp01", date: "2026-06-03", time: "12:15", type: "saida_alm", source: "ocr_slip", isCompliant: true },
  { id: "c11", employeeId: "emp01", date: "2026-06-03", time: "13:00", type: "volta_alm", source: "ocr_slip", isCompliant: true }, // 45m lunch
  { id: "c12", employeeId: "emp01", date: "2026-06-03", time: "17:32", type: "saida", source: "ocr_slip", isCompliant: true },

  // 04/06/2026 - Overtime day
  { id: "c13", employeeId: "emp01", date: "2026-06-04", time: "07:44", type: "entrada", source: "ocr_slip", isCompliant: true },
  { id: "c14", employeeId: "emp01", date: "2026-06-04", time: "12:01", type: "saida_alm", source: "ocr_slip", isCompliant: true },
  { id: "c15", employeeId: "emp01", date: "2026-06-04", time: "13:00", type: "volta_alm", source: "ocr_slip", isCompliant: true },
  { id: "c16", employeeId: "emp01", date: "2026-06-04", time: "19:15", type: "saida", source: "ocr_slip", isCompliant: true }, // Extra hours

  // 05/06/2026 - Regular day
  { id: "c17", employeeId: "emp01", date: "2026-06-05", time: "07:58", type: "entrada", source: "ocr_slip", isCompliant: true },
  { id: "c18", employeeId: "emp01", date: "2026-06-05", time: "12:00", type: "saida_alm", source: "ocr_slip", isCompliant: true },
  { id: "c19", employeeId: "emp01", date: "2026-06-05", time: "13:00", type: "volta_alm", source: "ocr_slip", isCompliant: true },
  { id: "c20", employeeId: "emp01", date: "2026-06-05", time: "17:31", type: "saida", source: "ocr_slip", isCompliant: true },

  // 08/06/2026 - matching photo: "08/06/26 07:53" and NSR
  { id: "c21", employeeId: "emp01", date: "2026-06-08", time: "07:53", type: "entrada", source: "ocr_slip", isCompliant: true, nsr: "000497501" },
  { id: "c22", employeeId: "emp01", date: "2026-06-08", time: "12:00", type: "saida_alm", source: "ocr_slip", isCompliant: true },
  { id: "c23", employeeId: "emp01", date: "2026-06-08", time: "13:00", type: "volta_alm", source: "ocr_slip", isCompliant: true },
  { id: "c24", employeeId: "emp01", date: "2026-06-08", time: "17:37", type: "saida", source: "ocr_slip", isCompliant: true, nsr: "000497505" },

  // 09/06/2026 - Regular day
  { id: "c25", employeeId: "emp01", date: "2026-06-09", time: "07:55", type: "entrada", source: "ocr_slip", isCompliant: true },
  { id: "c26", employeeId: "emp01", date: "2026-06-09", time: "12:05", type: "saida_alm", source: "ocr_slip", isCompliant: true },
  { id: "c27", employeeId: "emp01", date: "2026-06-09", time: "13:05", type: "volta_alm", source: "ocr_slip", isCompliant: true },
  { id: "c28", employeeId: "emp01", date: "2026-06-09", time: "17:34", type: "saida", source: "ocr_slip", isCompliant: true },

  // 10/06/2026 - Non-conformity: Missing points
  { id: "c29", employeeId: "emp01", date: "2026-06-10", time: "07:50", type: "entrada", source: "ocr_slip", isCompliant: true },
  { id: "c30", employeeId: "emp01", date: "2026-06-10", time: "17:30", type: "saida", source: "ocr_slip", isCompliant: true }, // No lunch registered

  // 11/06/2026 - Regular
  { id: "c31", employeeId: "emp01", date: "2026-06-11", time: "07:52", type: "entrada", source: "ocr_slip", isCompliant: true },
  { id: "c32", employeeId: "emp01", date: "2026-06-11", time: "12:00", type: "saida_alm", source: "ocr_slip", isCompliant: true },
  { id: "c33", employeeId: "emp01", date: "2026-06-11", time: "13:00", type: "volta_alm", source: "ocr_slip", isCompliant: true },
  { id: "c34", employeeId: "emp01", date: "2026-06-11", time: "17:33", type: "saida", source: "ocr_slip", isCompliant: true },

  // 12/06/2026 - Regular day
  { id: "c35", employeeId: "emp01", date: "2026-06-12", time: "07:54", type: "entrada", source: "ocr_slip", isCompliant: true },
  { id: "c36", employeeId: "emp01", date: "2026-06-12", time: "12:00", type: "saida_alm", source: "ocr_slip", isCompliant: true },
  { id: "c37", employeeId: "emp01", date: "2026-06-12", time: "13:00", type: "volta_alm", source: "ocr_slip", isCompliant: true },
  { id: "c38", employeeId: "emp01", date: "2026-06-12", time: "17:35", type: "saida", source: "ocr_slip", isCompliant: true },

  // 13/06/2026 - matching photo: "13/06/26 13:13"
  { id: "c39", employeeId: "emp01", date: "2026-06-13", time: "13:13", type: "entrada", source: "ocr_slip", isCompliant: true, nsr: "000497520" },
  { id: "c40", employeeId: "emp01", date: "2026-06-13", time: "17:30", type: "saida", source: "ocr_slip", isCompliant: true },

  // 15/06/2026 - Regular day
  { id: "c41", employeeId: "emp01", date: "2026-06-15", time: "07:50", type: "entrada", source: "ocr_slip", isCompliant: true },
  { id: "c42", employeeId: "emp01", date: "2026-06-15", time: "12:00", type: "saida_alm", source: "ocr_slip", isCompliant: true },
  { id: "c43", employeeId: "emp01", date: "2026-06-15", time: "13:00", type: "volta_alm", source: "ocr_slip", isCompliant: true },
  { id: "c44", employeeId: "emp01", date: "2026-06-15", time: "17:34", type: "saida", source: "ocr_slip", isCompliant: true },

  // 16/06/2026 - Today (up to Lunch return)
  { id: "c45", employeeId: "emp01", date: "2026-06-16", time: "07:56", type: "entrada", source: "real_time_upload", isCompliant: true },
  { id: "c46", employeeId: "emp01", date: "2026-06-16", time: "12:02", type: "saida_alm", source: "real_time_upload", isCompliant: true },
  { id: "c47", employeeId: "emp01", date: "2026-06-16", time: "13:00", type: "volta_alm", source: "real_time_upload", isCompliant: true },


  // --- SEED POINTS FOR MARIA (emp02) ---
  { id: "m1", employeeId: "emp02", date: "2026-06-01", time: "08:58", type: "entrada", source: "manual", isCompliant: true },
  { id: "m2", employeeId: "emp02", date: "2026-06-01", time: "12:00", type: "saida_alm", source: "manual", isCompliant: true },
  { id: "m3", employeeId: "emp02", date: "2026-06-01", time: "13:00", type: "volta_alm", source: "manual", isCompliant: true },
  { id: "m4", employeeId: "emp02", date: "2026-06-01", time: "18:00", type: "saida", source: "manual", isCompliant: true },

  { id: "m5", employeeId: "emp02", date: "2026-06-02", time: "09:02", type: "entrada", source: "manual", isCompliant: true },
  { id: "m6", employeeId: "emp02", date: "2026-06-02", time: "12:00", type: "saida_alm", source: "manual", isCompliant: true },
  { id: "m7", employeeId: "emp02", date: "2026-06-02", time: "13:00", type: "volta_alm", source: "manual", isCompliant: true },
  { id: "m8", employeeId: "emp02", date: "2026-06-02", time: "18:03", type: "saida", source: "manual", isCompliant: true },

  { id: "m9", employeeId: "emp02", date: "2026-06-03", time: "08:55", type: "entrada", source: "manual", isCompliant: true },
  { id: "m10", employeeId: "emp02", date: "2026-06-03", time: "12:00", type: "saida_alm", source: "manual", isCompliant: true },
  { id: "m11", employeeId: "emp02", date: "2026-06-03", time: "12:45", type: "volta_alm", source: "manual", isCompliant: true }, // Under 1h lunch
  { id: "m12", employeeId: "emp02", date: "2026-06-03", time: "18:00", type: "saida", source: "manual", isCompliant: true }
];
