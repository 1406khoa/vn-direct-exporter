export type Timeframe = "D" | "W";

export interface OhlcvRow {
  Date: string; // ISO yyyy-mm-dd
  Open: number;
  High: number;
  Low: number;
  Close: number;
  Volume: number;
  Symbol: string;
  Timeframe: Timeframe;
  SMA20?: number;
  SMA50?: number;
  EMA20?: number;
  EMA50?: number;
  RSI14?: number;
  ATR14?: number;
  MACD?: number;
  Signal?: number;
  BB_Upper?: number;
  BB_Lower?: number;
  OBV?: number;
  VWAP?: number;
}

export interface RiskProfile {
  Capital_VND?: number;
  Max_Drawdown_Pct?: number;
  Target_Profit_Pct?: number;
  Holding_Horizon?: string; // e.g., "days", "weeks", "months"
  Notes?: string;
}

export interface MarketContextRow {
  News_or_Event_Date?: string; // ISO date or text
  Ticker?: string;
  Headline_or_Note?: string;
  Source_or_Link?: string;
  Support_Zone?: string;
  Resistance_Zone?: string;
  Planned_Buy_Zone?: string;
  Actual_Buy_Price?: number | string;
  Comment?: string;
}
