import { toUnixSeconds } from "../lib/date";

export interface DchartResponse {
  t: number[];
  o: number[];
  h: number[];
  l: number[];
  c: number[];
  v: number[];
  s: string; // "ok" if success
}

const DCHART_URL = "https://dchart-api.vndirect.com.vn/dchart/history";

export async function fetchHistory(
  symbol: string,
  resolution: "D" | "W",
  from: Date,
  to: Date
): Promise<DchartResponse> {
  const params = new URLSearchParams({
    symbol,
    resolution,
    from: String(toUnixSeconds(from)),
    to: String(toUnixSeconds(to)),
  });
  const url = `${DCHART_URL}?${params.toString()}`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    throw new Error(`HTTP error ${res.status} when calling API`);
  }

  // Đọc text trước, sau đó parse JSON nếu đúng
  const text = await res.text();
  let json: DchartResponse;
  try {
    json = JSON.parse(text) as DchartResponse;
  } catch {
    throw new Error(`API trả về không phải JSON:\n${text}`);
  }

  if (json.s !== "ok") {
    throw new Error(`API status not ok: ${json.s}`);
  }

  const n = json.t.length;
  if (![json.o, json.h, json.l, json.c, json.v].every(arr => arr.length === n)) {
    throw new Error("Mismatched array lengths in API response");
  }

  return json;
}
