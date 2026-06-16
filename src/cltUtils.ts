import { ClockInEntry, NonConformity } from "./types";

/**
 * Utility to convert HH:MM to minutes
 */
export function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

/**
 * Utility to convert minutes to HH:MM format
 */
export function minutesToTime(minutes: number): string {
  const absMinutes = Math.abs(minutes);
  const h = Math.floor(absMinutes / 60);
  const m = Math.floor(absMinutes % 60);
  const padH = String(h).padStart(2, "0");
  const padM = String(m).padStart(2, "0");
  return `${minutes < 0 ? "-" : ""}${padH}:${padM}`;
}

export interface DailyCalculation {
  date: string;
  totalWorkedMinutes: number;
  lunchMinutes: number;
  overtimeMinutes: number;
  nonConformities: Omit<NonConformity, "id" | "employeeId" | "resolved">[];
  hasMissingEntries: boolean;
}

/**
 * Calculates CLT metrics for a single employee's single day based on clock-in entries.
 */
export function calculateDailyCLT(date: string, entries: ClockInEntry[]): DailyCalculation {
  const dailyEntries = entries
    .filter(e => e.date === date)
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

  const ncList: Omit<NonConformity, "id" | "employeeId" | "resolved">[] = [];

  // Expected CLT limit is 8 hours worked standard (480 minutes)
  const standardWorkMinutes = 480;

  if (dailyEntries.length === 0) {
    return {
      date,
      totalWorkedMinutes: 0,
      lunchMinutes: 0,
      overtimeMinutes: 0,
      nonConformities: [],
      hasMissingEntries: false
    };
  }

  // Validate geofence breaches for any entries
  const breachedEntries = dailyEntries.filter(e => !e.isCompliant);
  if (breachedEntries.length > 0) {
    ncList.push({
      date,
      type: "outside_geofence",
      description: `Ponto batido fora do perímetro da empresa: ${breachedEntries.map(e => e.time).join(", ")}`,
      severity: "high"
    });
  }

  // If there are less than 4 entries we might have missing points
  if (dailyEntries.length < 4) {
    // If only 1 entry, or odd count, it is definitely a missing point or incomplete day
    if (dailyEntries.length === 2) {
      // Direct shift without lunch?
      const inTime = timeToMinutes(dailyEntries[0].time);
      const outTime = timeToMinutes(dailyEntries[1].time);
      const diff = outTime - inTime;
      return {
        date,
        totalWorkedMinutes: diff,
        lunchMinutes: 0,
        overtimeMinutes: Math.max(0, diff - standardWorkMinutes),
        nonConformities: [
          {
            date,
            type: "missing_clock_in",
            description: "Falta marcação de intervalo de almoço (apenas entrada/saída)",
            severity: "low"
          },
          ...ncList
        ],
        hasMissingEntries: true
      };
    } else {
      return {
        date,
        totalWorkedMinutes: 0,
        lunchMinutes: 0,
        overtimeMinutes: 0,
        nonConformities: [
          {
            date,
            type: "missing_clock_in",
            description: `Batidas de ponto incongruentes (total: ${dailyEntries.length}). Esperado 4 marcações CLT.`,
            severity: "medium"
          },
          ...ncList
        ],
        hasMissingEntries: true
      };
    }
  }

  // Standard CLT has 4 entries: 
  // 1. Entrada
  // 2. Saída Almoço
  // 3. Volta Almoço
  // 4. Saída Final
  const ent = timeToMinutes(dailyEntries[0].time);
  const sAlm = timeToMinutes(dailyEntries[1].time);
  const vAlm = timeToMinutes(dailyEntries[2].time);
  const sFin = timeToMinutes(dailyEntries[3].time);

  const morningWorked = sAlm - ent;
  const afternoonWorked = sFin - vAlm;
  const totalWorkedMinutes = morningWorked + afternoonWorked;
  const lunchMinutes = vAlm - sAlm;

  // CLT non-conformities check

  // 1. Under 1 hour lunch (Art. 71 CLT minimum 1h, max 2h)
  if (lunchMinutes < 60) {
    ncList.push({
      date,
      type: "under_one_hour_lunch",
      description: `Intervalo de almoço de ${lunchMinutes} min é inferior ao mínimo legal de 1 hora (Art. 71 CLT)`,
      severity: "high"
    });
  }

  // 2. Maximum daily hours under CLT is 8 hours + max 2 hours extra = 10 hours (600 minutes) total
  if (totalWorkedMinutes > 600) {
    ncList.push({
      date,
      type: "over_ten_hours_day",
      description: `Jornada diária ultrapassou o limite legal CLT de 10 horas (${minutesToTime(totalWorkedMinutes)} trabalhadas)`,
      severity: "medium"
    });
  }

  // Calculate overtime
  // CLT Standard: Hours past 8h a day are 50% overtime.
  // Overtime minutes is totalWorkedMinutes - 8 hours
  const overtimeMinutes = Math.max(0, totalWorkedMinutes - standardWorkMinutes);

  return {
    date,
    totalWorkedMinutes,
    lunchMinutes,
    overtimeMinutes,
    nonConformities: ncList,
    hasMissingEntries: false
  };
}

/**
 * Calculates CLT summary for current month
 */
export function calculateMonthlyCLT(employeeId: string, month: string, entries: ClockInEntry[]) {
  // Filter only entries of this month (e.g. "2026-06")
  const monthlyEntries = entries.filter(e => e.employeeId === employeeId && e.date.startsWith(month));
  
  // Find unique days worked
  const uniqueDays = Array.from(new Set(monthlyEntries.map(e => e.date))).sort();

  let totalWorked = 0;
  let totalOvertime = 0;
  let allNonConformities: NonConformity[] = [];
  let missingPointDaysCount = 0;

  uniqueDays.forEach((day, index) => {
    const dayCalc = calculateDailyCLT(day, monthlyEntries);
    totalWorked += dayCalc.totalWorkedMinutes;
    totalOvertime += dayCalc.overtimeMinutes;
    
    if (dayCalc.hasMissingEntries) {
      missingPointDaysCount++;
    }

    dayCalc.nonConformities.forEach(nc => {
      allNonConformities.push({
        id: `${employeeId}-${day}-${nc.type}`,
        employeeId,
        date: day,
        type: nc.type,
        description: nc.description,
        severity: nc.severity,
        resolved: false
      });
    });
  });

  return {
    uniqueDaysCount: uniqueDays.length,
    totalWorkedMinutes: totalWorked,
    totalOvertimeMinutes: totalOvertime,
    nonConformities: allNonConformities,
    missingPointDaysCount
  };
}
