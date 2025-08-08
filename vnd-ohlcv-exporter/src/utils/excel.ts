// src/utils/excel.ts

import * as XLSX from "xlsx";
import type { MarketContextRow, OhlcvRow, RiskProfile } from "../types";
import { SMA, EMA, RSI, MACD, ATR, BollingerBands } from "technicalindicators";

// Gom nhóm dailyRows thành raw OHLCV tuần hoặc tháng
function aggregate(rows: OhlcvRow[], mode: "weekly" | "monthly"): OhlcvRow[] {
  const groups: Record<string, OhlcvRow[]> = {};
  rows.forEach((r) => {
    const d = new Date(r.Date);
    let key: string;
    if (mode === "weekly") {
      const dow = d.getUTCDay();
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((dow + 6) % 7));
      key = monday.toISOString().slice(0, 10);
    } else {
      key = d.toISOString().slice(0, 7); // "YYYY-MM"
    }
    (groups[key] ||= []).push(r);
  });
  return Object.entries(groups)
    .map(([k, rs]) => {
      const opens = rs.map((x) => x.Open);
      const highs = rs.map((x) => x.High);
      const lows = rs.map((x) => x.Low);
      const closes = rs.map((x) => x.Close);
      const vols = rs.map((x) => x.Volume);
      return {
        Date: mode === "weekly" ? k : `${k}-01`,
        Open: opens[0],
        High: Math.max(...highs),
        Low: Math.min(...lows),
        Close: closes[closes.length - 1],
        Volume: vols.reduce((a, b) => a + b, 0),
        Symbol: rs[0].Symbol,
        Timeframe: mode === "weekly" ? "W" : "M",
      } as OhlcvRow;
    })
    .sort((a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime());
}

// Enrich một mảng OHLCV với SMA/EMA/RSI/ATR/MACD/BB/OBV/VWAP
function enrich(rows: OhlcvRow[]): OhlcvRow[] {
  const closes = rows.map((r) => r.Close);
  const highs = rows.map((r) => r.High);
  const lows = rows.map((r) => r.Low);
  const vols = rows.map((r) => r.Volume);

  const sma20 = SMA.calculate({ period: 20, values: closes });
  const sma50 = SMA.calculate({ period: 50, values: closes });
  const ema20 = EMA.calculate({ period: 20, values: closes });
  const ema50 = EMA.calculate({ period: 50, values: closes });
  const rsi14 = RSI.calculate({ period: 14, values: closes });
  const atr14 = ATR.calculate({
    period: 14,
    high: highs,
    low: lows,
    close: closes,
  });
  const macdOut = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });
  const bbOut = BollingerBands.calculate({
    period: 20,
    values: closes,
    stdDev: 2,
  });

  // OBV
  const obvArr: number[] = [];
  let prevObv = 0;
  rows.forEach((_, i) => {
    if (i > 0) {
      if (closes[i] > closes[i - 1]) prevObv += vols[i];
      else if (closes[i] < closes[i - 1]) prevObv -= vols[i];
    }
    obvArr.push(prevObv);
  });
  // VWAP
  const vwapArr: number[] = [];
  let cumPV = 0,
    cumVol = 0;
  rows.forEach((_, i) => {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    cumPV += tp * vols[i];
    cumVol += vols[i];
    vwapArr.push(cumPV / cumVol);
  });

  return rows.map((r, i) => {
    const m = macdOut[i - 25],
      b = bbOut[i - 19];
    return {
      ...r,
      SMA20: i >= 19 ? sml(sma20[i - 19]) : undefined,
      SMA50: i >= 49 ? sml(sma50[i - 49]) : undefined,
      EMA20: i >= 19 ? sml(ema20[i - 19]) : undefined,
      EMA50: i >= 19 ? sml(ema50[i - 19]) : undefined,
      RSI14: i >= 13 ? sml(rsi14[i - 13]) : undefined,
      ATR14: i >= 13 ? sml(atr14[i - 13]) : undefined,
      MACD: m ? sml(m.MACD) : undefined,
      Signal: m ? sml(m.signal) : undefined,
      BB_Upper: b ? sml(b.upper) : undefined,
      BB_Lower: b ? sml(b.lower) : undefined,
      OBV: obvArr[i],
      VWAP: !isNaN(vwapArr[i]) ? Number(vwapArr[i].toFixed(2)) : undefined,
    };
  });
}

// helper convert and guard
function sml(v: number | undefined): number | undefined {
  return v != null ? Number(v.toFixed(2)) : undefined;
}

export function exportWorkbook(
  symbol: string,
  timeframe: "D" | "W",
  dailyRows: OhlcvRow[],
  risk: RiskProfile,
  context: MarketContextRow[]
) {
  const wb = XLSX.utils.book_new();

  // PriceData enriched
  const priceData = enrich(dailyRows);
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(priceData),
    "PriceData"
  );

  // WeeklyData enriched
  const weeklyRaw = aggregate(dailyRows, "weekly");
  const weeklyEnr = enrich(weeklyRaw);
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(weeklyEnr),
    "WeeklyData"
  );

  // MonthlyData enriched
  const monthlyRaw = aggregate(dailyRows, "monthly");
  const monthlyEnr = enrich(monthlyRaw);
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(monthlyEnr),
    "MonthlyData"
  );

  // Risk + Context
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([risk]),
    "Risk_Profile"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(context),
    "Market_Context"
  );

  // Write
  const fname = `${symbol}_${timeframe}_${new Date()
    .toISOString()
    .slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fname);
}
