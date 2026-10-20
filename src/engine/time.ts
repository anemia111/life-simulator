export const nextDate = (date: string) =>
  new Date(Date.parse(date + "T00:00:00Z") + 86400000)
    .toISOString()
    .slice(0, 10);
export const weekday = (date: string) =>
  new Date(date + "T00:00:00Z").getUTCDay();
export const dayOfMonth = (date: string) => Number(date.slice(8, 10));
export function validateDays(days: number) {
  if (!Number.isInteger(days) || days < 1 || days > 365)
    throw Error("時間進行は1〜365日です");
}
