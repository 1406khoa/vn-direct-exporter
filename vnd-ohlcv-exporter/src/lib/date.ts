import dayjs from "dayjs";

export function toUnixSeconds(d: Date): number {
  return Math.floor(d.getTime() / 1000);
}

export function todayLocal(): Date {
  return new Date();
}

export function daysAgo(n: number): Date {
  const t = new Date();
  t.setDate(t.getDate() - n);
  return t;
}

export function toIsoDate(d: Date): string {
  return dayjs(d).format("YYYY-MM-DD");
}

export function parseIsoDate(input: string): Date {
  // input from <input type="date"> is always yyyy-mm-dd
  const [y, m, d] = input.split("-").map(Number);
  return new Date(y, m - 1, d);
}