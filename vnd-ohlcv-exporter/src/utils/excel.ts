import * as XLSX from "xlsx";
import type { MarketContextRow, OhlcvRow, RiskProfile } from "../types";

export function exportWorkbook(
  symbol: string,
  timeframe: "D" | "W",
  priceRows: OhlcvRow[],
  risk: RiskProfile,
  context: MarketContextRow[],
) {
  // PriceData sheet
  const priceSheet = XLSX.utils.json_to_sheet(priceRows);

  // Risk_Profile sheet (single-row starter; user can edit later)
  const riskRows = [risk];
  const riskSheet = XLSX.utils.json_to_sheet(riskRows);

  // Market_Context sheet
  const contextSheet = XLSX.utils.json_to_sheet(context);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, priceSheet, "PriceData");
  XLSX.utils.book_append_sheet(wb, riskSheet, "Risk_Profile");
  XLSX.utils.book_append_sheet(wb, contextSheet, "Market_Context");

  const fname = `${symbol}_${timeframe}_${new Date()
    .toISOString()
    .slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fname);
}