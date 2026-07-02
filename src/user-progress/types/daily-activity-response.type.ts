export type DailyActivityDay = {
  date: string;
  attempted: boolean;
};

export type DailyActivityResponse = {
  year: number;
  month: number;
  monthKey: string;
  startDate: string;
  endDate: string;
  timezone: 'UTC';
  days: DailyActivityDay[];
  summary: {
    activeDays: number;
    totalDays: number;
  };
};
