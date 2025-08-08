// src/components/PreviewModal.tsx

import { useState } from "react";
import type { OhlcvRow } from "../types";
import {
  SMA,
  EMA,
  RSI,
  MACD,
  ATR,
  BollingerBands,
} from "technicalindicators";
import "./PreviewModal.css";

interface PreviewModalProps {
  visible: boolean;
  onClose: () => void;
  data: OhlcvRow[];
}

type RowWithIndicators = OhlcvRow & {
  sma20?: number;
  sma50?: number;
  ema20?: number;
  ema50?: number;
  rsi14?: number;
  atr14?: number;
  macd?: number;
  signal?: number;
  bbUpper?: number;
  bbLower?: number;
  obv?: number;
  vwap?: number;
};

export default function PreviewModal({
  visible,
  onClose,
  data,
}: PreviewModalProps) {
  const [filterDate, setFilterDate] = useState<string>("");

  if (!visible) return null;

  // 1) Lọc theo ngày nếu có
  const rows = filterDate
    ? data.filter((r) => r.Date === filterDate)
    : data;

  // 2) Nếu không có dữ liệu
  if (rows.length === 0) {
    return (
      <div className="preview-overlay" onClick={onClose}>
        <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
          <header className="preview-header">
            <h2>Xem Trước Dữ Liệu Giá</h2>
            <button className="close-btn" onClick={onClose}>×</button>
          </header>
          <div className="preview-body no-data">
            Không có dữ liệu cho ngày đã chọn.
          </div>
        </div>
      </div>
    );
  }

  // 3) Chuẩn bị mảng giá
  const closes = rows.map((r) => r.Close);
  const highs = rows.map((r) => r.High);
  const lows = rows.map((r) => r.Low);
  const volumes = rows.map((r) => r.Volume);

  // 4) Tính các chỉ báo cơ bản
  const sma20 = SMA.calculate({ period: 20, values: closes });
  const sma50 = SMA.calculate({ period: 50, values: closes });
  const ema20 = EMA.calculate({ period: 20, values: closes });
  const ema50 = EMA.calculate({ period: 50, values: closes });
  const rsi14 = RSI.calculate({ period: 14, values: closes });
  const atr14 = ATR.calculate({ period: 14, high: highs, low: lows, close: closes });
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

  // 5) Tính OBV & VWAP thủ công
  const obvArr: number[] = [];
  let prevObv = 0;
  for (let i = 0; i < rows.length; i++) {
    if (i === 0) {
      prevObv = 0;
    } else {
      if (closes[i] > closes[i - 1]) prevObv += volumes[i];
      else if (closes[i] < closes[i - 1]) prevObv -= volumes[i];
      // else không đổi
    }
    obvArr.push(prevObv);
  }
  const vwapArr: number[] = [];
  let cumPV = 0, cumVol = 0;
  for (let i = 0; i < rows.length; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    cumPV += tp * volumes[i];
    cumVol += volumes[i];
    vwapArr.push(cumPV / cumVol);
  }

  // 6) Ghép tất cả vào rows
  const rowsWithIndicators: RowWithIndicators[] = rows.map((r, i) => ({
    ...r,
    sma20: i >= 19 ? sma20[i - 19] : undefined,
    sma50: i >= 49 ? sma50[i - 49] : undefined,
    ema20: i >= 19 ? ema20[i - 19] : undefined,
    ema50: i >= 19 ? ema50[i - 19] : undefined,
    rsi14: i >= 13 ? rsi14[i - 13] : undefined,
    atr14: i >= 13 ? atr14[i - 13] : undefined,
    macd: i >= 25 ? macdOut[i - 25].MACD : undefined,
    signal: i >= 25 ? macdOut[i - 25].signal : undefined,
    bbUpper: i >= 19 ? bbOut[i - 19].upper : undefined,
    bbLower: i >= 19 ? bbOut[i - 19].lower : undefined,
    obv: obvArr[i],
    vwap: vwapArr[i],
  }));

  return (
    <div className="preview-overlay" onClick={onClose}>
      <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
        <header className="preview-header">
          <h2>Xem Trước Dữ Liệu Giá</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </header>
        <div className="preview-body">
          <div className="filter-row">
            <label>
              Lọc Theo Ngày:
              <input
                type="date"
                placeholder="YYYY-MM-DD"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
            </label>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Mở</th>
                  <th>Cao</th>
                  <th>Thấp</th>
                  <th>Đóng</th>
                  <th>Vol</th>
                  <th>SMA20</th>
                  <th>SMA50</th>
                  <th>EMA20</th>
                  <th>EMA50</th>
                  <th>RSI14</th>
                  <th>ATR14</th>
                  <th>MACD</th>
                  <th>Signal</th>
                  <th>BB Upper</th>
                  <th>BB Lower</th>
                  <th>OBV</th>
                  <th>VWAP</th>
                </tr>
              </thead>
              <tbody>
                {rowsWithIndicators.map((r) => (
                  <tr key={r.Date} className={r.Close >= r.Open ? "up" : "down"}>
                    <td>{r.Date}</td>
                    <td>{r.Open}</td>
                    <td>{r.High}</td>
                    <td>{r.Low}</td>
                    <td>{r.Close}</td>
                    <td>{r.Volume}</td>
                    <td>{r.sma20?.toFixed(2) ?? "-"}</td>
                    <td>{r.sma50?.toFixed(2) ?? "-"}</td>
                    <td>{r.ema20?.toFixed(2) ?? "-"}</td>
                    <td>{r.ema50?.toFixed(2) ?? "-"}</td>
                    <td>{r.rsi14?.toFixed(2) ?? "-"}</td>
                    <td>{r.atr14?.toFixed(2) ?? "-"}</td>
                    <td>{r.macd?.toFixed(2) ?? "-"}</td>
                    <td>{r.signal?.toFixed(2) ?? "-"}</td>
                    <td>{r.bbUpper?.toFixed(2) ?? "-"}</td>
                    <td>{r.bbLower?.toFixed(2) ?? "-"}</td>
                    <td>{r.obv ?? "-"}</td>
                    <td>{r.vwap?.toFixed(2) ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
