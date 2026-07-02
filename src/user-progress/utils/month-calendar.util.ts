export function parseMonthKey(monthKey: string): { year: number; month: number } {
  const [yearStr, monthStr] = monthKey.split('-');
  return {
    year: Number(yearStr),
    month: Number(monthStr),
  };
}

export function getMonthBoundsUtc(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  return { start, end };
}

export function listDaysInMonth(year: number, month: number): string[] {
  const totalDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthLabel = String(month).padStart(2, '0');
  const days: string[] = [];

  for (let day = 1; day <= totalDays; day += 1) {
    days.push(`${year}-${monthLabel}-${String(day).padStart(2, '0')}`);
  }

  return days;
}

export function currentMonthKeyUtc(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}
