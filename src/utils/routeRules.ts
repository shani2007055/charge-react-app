// קבועי האלגוריתם – מראה של RouteRules בשרת (DTO/Constants.cs).
// חשוב שיהיו זהים, כדי שהחיווי במסך יתאים לחישוב בשרת.
export const ROUTE_RULES = {
  consumptionKwhPerKm: 0.18,     // צריכת אנרגיה ממוצעת לק"מ
  reserveKm: 20,                 // רזרבה שתמיד נשארת בסוללה
  defaultBatteryCapacityKwh: 60, // אם לא נבחר רכב
} as const;

/** טווח נסיעה משוער בק"מ: (אחוז/100 × קיבולת) ÷ צריכה לק"מ */
export function estimateRangeKm(batteryPercent: number, capacityKwh?: number | null): number {
  const capacity = capacityKwh && capacityKwh > 0 ? capacityKwh : ROUTE_RULES.defaultBatteryCapacityKwh;
  const kwh = (batteryPercent / 100) * capacity;
  return kwh / ROUTE_RULES.consumptionKwhPerKm;
}