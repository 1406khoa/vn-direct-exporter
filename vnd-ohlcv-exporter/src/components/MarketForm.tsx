import { useEffect, useState } from "react";
import { fetchHistory } from "../service/vndirect";
import type {
  MarketContextRow,
  OhlcvRow,
  RiskProfile,
  Timeframe,
} from "../types";
import { daysAgo, parseIsoDate, toIsoDate } from "../lib/date";
import { exportWorkbook } from "../utils/excel";
import "./PreviewModal.css";
import PreviewModal from "./PreviewModal";

type RangeMode = "lastNDays" | "custom";

import "./MarketForm.css";

export default function MarketForm() {
  const [symbol, setSymbol] = useState("E1VFVN30");
  const [timeframe, setTimeframe] = useState<Timeframe>("D");
  const [rangeMode, setRangeMode] = useState<RangeMode>("lastNDays");
  const [nDays, setNDays] = useState(90);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [previewRows, setPreviewRows] = useState<OhlcvRow[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Risk profile inputs
  const [capital, setCapital] = useState("");
  const [maxDD, setMaxDD] = useState("");
  const [targetProfit, setTargetProfit] = useState("");
  const [horizon, setHorizon] = useState("");
  const [riskNotes, setRiskNotes] = useState("");

  // Market context inputs
  const [mcDate, setMcDate] = useState("");
  const [mcHeadline, setMcHeadline] = useState("");
  const [mcLink, setMcLink] = useState("");
  const [mcSupport, setMcSupport] = useState("");
  const [mcResistance, setMcResistance] = useState("");
  const [mcPlannedBuy, setMcPlannedBuy] = useState("");
  const [mcActualBuy, setMcActualBuy] = useState("");
  const [mcComment, setMcComment] = useState("");

  // Khi đổi sang custom, mặc định From = hôm nay - 9, To = hôm nay
  useEffect(() => {
    if (rangeMode === "custom") {
      setFromDate(toIsoDate(daysAgo(9)));
      setToDate(toIsoDate(new Date()));
    }
  }, [rangeMode]);

  const handleExport = async () => {
    try {
      // 1) Tính from/to
      let from: Date;
      let to: Date;
      if (rangeMode === "lastNDays") {
        to = new Date();
        from = daysAgo(nDays);
      } else {
        if (!fromDate || !toDate) {
          throw new Error("Please select both From and To dates");
        }
        from = parseIsoDate(fromDate);
        to = parseIsoDate(toDate);
      }

      // 2) Chuẩn bị mảng rows
      let rows: OhlcvRow[];

      if (timeframe === "W") {
        // — Weekly: fetch daily rồi aggregate thành tuần
        const rawDaily = await fetchHistory(
          symbol.trim().toUpperCase(),
          "D",
          from,
          to
        );
        const daily = rawDaily.t.map((ts, i) => ({
          date: new Date(ts * 1000),
          open: rawDaily.o[i],
          high: rawDaily.h[i],
          low: rawDaily.l[i],
          close: rawDaily.c[i],
          volume: rawDaily.v[i],
        }));
        // Nhóm theo tuần (Monday là đầu tuần)
        const groups: Record<string, typeof daily> = {};
        daily.forEach((item) => {
          const d = item.date;
          const dow = d.getUTCDay(); // 0=Sun,1=Mon...
          const weekStart = new Date(d);
          weekStart.setUTCDate(d.getUTCDate() - ((dow + 6) % 7));
          const key = weekStart.toISOString().slice(0, 10);
          if (!groups[key]) groups[key] = [];
          groups[key].push(item);
        });
        // Tạo mảng OhlcvRow tuần
        rows = Object.entries(groups)
          .map(([wk, grp]): OhlcvRow => {
            grp.sort((a, b) => a.date.getTime() - b.date.getTime());
            return {
              Date: wk,
              Open: grp[0].open,
              High: Math.max(...grp.map((r) => r.high)),
              Low: Math.min(...grp.map((r) => r.low)),
              Close: grp[grp.length - 1].close,
              Volume: grp.reduce((sum, r) => sum + r.volume, 0),
              Symbol: symbol.trim().toUpperCase(),
              Timeframe: "W" as Timeframe,
            };
          })
          .sort(
            (a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime()
          );
      } else {
        // — Daily: gọi API 1D
        const rawDaily = await fetchHistory(
          symbol.trim().toUpperCase(),
          "D",
          from,
          to
        );
        rows = rawDaily.t.map(
          (ts, i): OhlcvRow => ({
            Date: new Date(ts * 1000).toISOString().slice(0, 10),
            Open: rawDaily.o[i],
            High: rawDaily.h[i],
            Low: rawDaily.l[i],
            Close: rawDaily.c[i],
            Volume: rawDaily.v[i],
            Symbol: symbol.trim().toUpperCase(),
            Timeframe: "D" as Timeframe,
          })
        );
      }

      if (!rows.length) {
        throw new Error("No data returned in selected range");
      }

      // 3) Build risk & context
      const risk: RiskProfile = {
        Capital_VND: capital ? Number(capital) : undefined,
        Max_Drawdown_Pct: maxDD ? Number(maxDD) : undefined,
        Target_Profit_Pct: targetProfit ? Number(targetProfit) : undefined,
        Holding_Horizon: horizon || undefined,
        Notes: riskNotes || undefined,
      };

      const context: MarketContextRow[] = [
        {
          News_or_Event_Date: mcDate || undefined,
          Ticker: symbol.trim().toUpperCase(),
          Headline_or_Note: mcHeadline || undefined,
          Source_or_Link: mcLink || undefined,
          Support_Zone: mcSupport || undefined,
          Resistance_Zone: mcResistance || undefined,
          Planned_Buy_Zone: mcPlannedBuy || undefined,
          Actual_Buy_Price: mcActualBuy || undefined,
          Comment: mcComment || undefined,
        },
      ];

      // 4) Xuất file
      exportWorkbook(
        symbol.trim().toUpperCase(),
        timeframe,
        rows,
        risk,
        context
      );
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      alert(msg);
    }
  };

  // New: preview handler
  const handlePreview = async () => {
    try {
      // reuse the same fetch logic as export
      let from: Date, to: Date;
      if (rangeMode === "lastNDays") {
        to = new Date();
        from = daysAgo(nDays);
      } else {
        if (!fromDate || !toDate) throw new Error("Please pick dates");
        from = parseIsoDate(fromDate);
        to = parseIsoDate(toDate);
      }
      // always fetch daily then aggregate if needed
      const raw = await fetchHistory(
        symbol.trim().toUpperCase(),
        "D",
        from,
        to
      );
      let rows: OhlcvRow[];
      if (timeframe === "W") {
               // — Weekly: fetch daily rồi aggregate thành tuần
        const rawDaily = await fetchHistory(
          symbol.trim().toUpperCase(),
          "D",
          from,
          to
        );
        const daily = rawDaily.t.map((ts, i) => ({
          date: new Date(ts * 1000),
          open: rawDaily.o[i],
          high: rawDaily.h[i],
          low: rawDaily.l[i],
          close: rawDaily.c[i],
          volume: rawDaily.v[i],
        }));
        // Nhóm theo tuần (Monday là đầu tuần)
        const groups: Record<string, typeof daily> = {};
        daily.forEach((item) => {
          const d = item.date;
          const dow = d.getUTCDay(); // 0=Sun,1=Mon...
          const weekStart = new Date(d);
          weekStart.setUTCDate(d.getUTCDate() - ((dow + 6) % 7));
          const key = weekStart.toISOString().slice(0, 10);
          if (!groups[key]) groups[key] = [];
          groups[key].push(item);
        });
        // Tạo mảng OhlcvRow tuần
        rows = Object.entries(groups)
          .map(([wk, grp]): OhlcvRow => {
            grp.sort((a, b) => a.date.getTime() - b.date.getTime());
            return {
              Date: wk,
              Open: grp[0].open,
              High: Math.max(...grp.map((r) => r.high)),
              Low: Math.min(...grp.map((r) => r.low)),
              Close: grp[grp.length - 1].close,
              Volume: grp.reduce((sum, r) => sum + r.volume, 0),
              Symbol: symbol.trim().toUpperCase(),
              Timeframe: "W" as Timeframe,
            };
          })
          .sort(
            (a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime()
          );
      } else {
        rows = raw.t.map(
          (ts, i): OhlcvRow => ({
            Date: new Date(ts * 1000).toISOString().slice(0, 10),
            Open: raw.o[i],
            High: raw.h[i],
            Low: raw.l[i],
            Close: raw.c[i],
            Volume: raw.v[i],
            Symbol: symbol.trim().toUpperCase(),
            Timeframe: "D",
          })
        );
      }
      if (!rows.length) throw new Error("No data to preview");
      setPreviewRows(rows);
      setPreviewOpen(true);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  const canPickDates = rangeMode === "custom";

  return (
    <div className="market-form mx-auto max-w-3xl p-4">
      <h1 className="text-2xl font-bold mb-4">VNDIRECT - Xuất Dữ Liệu OHLCV</h1>

      {/* Symbol & Timeframe */}
      <section className="mb-6 space-y-2">
        <h2 className="text-lg font-semibold">Mã Chứng Khoán & Khung Thời Gian</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="flex flex-col">
            <span>Mã CK</span>
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="E1VFVN30"
              className="border rounded p-2"
            />
            <span className="text-gray-400 text-sm mt-1">VD: VNM, HPG, VIC</span>
          </label>
          <label className="flex flex-col">
            <span>Khung Thời Gian</span>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as Timeframe)}
              className="border rounded p-2"
            >
              <option value="D">Ngày (D)</option>
              <option value="W">Tuần (W)</option>
            </select>
            <span className="text-gray-400 text-sm mt-1">Chọn chu kỳ nến</span>
          </label>
          <label className="flex flex-col">
            <span>Chế Độ Thời Gian</span>
            <select
              value={rangeMode}
              onChange={(e) => setRangeMode(e.target.value as RangeMode)}
              className="border rounded p-2"
            >
              <option value="lastNDays">N ngày gần nhất</option>
              <option value="custom">Tùy chọn Từ/Đến</option>
            </select>
            <span className="text-gray-400 text-sm mt-1">Chọn khoảng thời gian</span>
          </label>
        </div>

        {rangeMode === "lastNDays" && (
          <label className="flex flex-col mt-3">
            <span>Số ngày gần nhất</span>
            <input
              type="number"
              min={1}
              max={3650}
              value={nDays}
              onChange={(e) => setNDays(Number(e.target.value))}
              className="border rounded p-2"
            />
            <span className="text-gray-400 text-sm mt-1">VD: 90 ngày, 180 ngày, 360 ngày</span>
          </label>
        )}

        {canPickDates && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            <label className="flex flex-col">
              <span>Từ Ngày</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="border rounded p-2"
              />
              <span className="text-gray-400 text-sm mt-1">Ngày bắt đầu</span>
            </label>
            <label className="flex flex-col">
              <span>Đến Ngày</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="border rounded p-2"
              />
              <span className="text-gray-400 text-sm mt-1">Ngày kết thúc</span>
            </label>
          </div>
        )}
      </section>

      {/* Risk Profile */}
      <section className="mb-6 space-y-2">
        <h2 className="text-lg font-semibold">
          Quản Lý Rủi Ro <span className="optional-label">(không bắt buộc)</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="flex flex-col">
            <span>Vốn Đầu Tư (VNĐ)</span>
            <input
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
              className="border rounded p-2"
              placeholder="100000000"
            />
            <span className="text-gray-400 text-sm mt-1">VD: 100,000,000</span>
          </label>
          <label className="flex flex-col">
            <span>Mức Lỗ Chấp Nhận (%)</span>
            <input
              value={maxDD}
              onChange={(e) => setMaxDD(e.target.value)}
              className="border rounded p-2"
              placeholder="7"
            />
            <span className="text-gray-400 text-sm mt-1">VD: 7 (7%)</span>
          </label>
          <label className="flex flex-col">
            <span>Mục Tiêu Lợi Nhuận (%)</span>
            <input
              value={targetProfit}
              onChange={(e) => setTargetProfit(e.target.value)}
              className="border rounded p-2"
              placeholder="15"
            />
            <span className="text-gray-400 text-sm mt-1">VD: 15 (15%)</span>
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          <label className="flex flex-col">
            <span>Thời Gian Nắm Giữ</span>
            <input
              value={horizon}
              onChange={(e) => setHorizon(e.target.value)}
              className="border rounded p-2"
              placeholder="3-6 tháng"
            />
            <span className="text-gray-400 text-sm mt-1">VD: 3-6 tháng, 1 năm</span>
          </label>
          <label className="flex flex-col md:col-span-2">
            <span>Ghi Chú</span>
            <input
              value={riskNotes}
              onChange={(e) => setRiskNotes(e.target.value)}
              className="border rounded p-2"
              placeholder="Ghi chú thêm về chiến lược"
            />
            <span className="text-gray-400 text-sm mt-1">Các thông tin bổ sung về chiến lược</span>
          </label>
        </div>
      </section>

      {/* Market Context */}
      <section className="mb-6 space-y-2">
        <h2 className="text-lg font-semibold">
          Phân Tích Thị Trường <span className="optional-label">(không bắt buộc)</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="flex flex-col">
            <span>Ngày Tin/Sự Kiện</span>
            <input
              type="date"
              value={mcDate}
              onChange={(e) => setMcDate(e.target.value)}
              className="border rounded p-2"
            />
            <span className="text-gray-400 text-sm mt-1">Ngày có tin tức quan trọng</span>
          </label>
          <label className="flex flex-col md:col-span-2">
            <span>Tiêu Đề / Ghi Chú</span>
            <input
              value={mcHeadline}
              onChange={(e) => setMcHeadline(e.target.value)}
              className="border rounded p-2"
              placeholder="Tin tức hoặc sự kiện quan trọng"
            />
            <span className="text-gray-400 text-sm mt-1">VD: Công ty công bố kết quả kinh doanh Q2</span>
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          <label className="flex flex-col">
            <span>Nguồn / Link</span>
            <input
              value={mcLink}
              onChange={(e) => setMcLink(e.target.value)}
              className="border rounded p-2"
              placeholder="URL nguồn tin"
            />
            <span className="text-gray-400 text-sm mt-1">Link bài viết hoặc nguồn tin</span>
          </label>
          <label className="flex flex-col">
            <span>Vùng Hỗ Trợ</span>
            <input
              value={mcSupport}
              onChange={(e) => setMcSupport(e.target.value)}
              className="border rounded p-2"
              placeholder="20.5-21.0"
            />
            <span className="text-gray-400 text-sm mt-1">VD: 20.5-21.0</span>
          </label>
          <label className="flex flex-col">
            <span>Vùng Kháng Cự</span>
            <input
              value={mcResistance}
              onChange={(e) => setMcResistance(e.target.value)}
              className="border rounded p-2"
              placeholder="23.5-24.0"
            />
            <span className="text-gray-400 text-sm mt-1">VD: 23.5-24.0</span>
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          <label className="flex flex-col">
            <span>Vùng Giá Dự Kiến Mua</span>
            <input
              value={mcPlannedBuy}
              onChange={(e) => setMcPlannedBuy(e.target.value)}
              className="border rounded p-2"
              placeholder="21.2-21.5"
            />
            <span className="text-gray-400 text-sm mt-1">VD: 21.2-21.5</span>
          </label>
          <label className="flex flex-col">
            <span>Giá Mua Thực Tế</span>
            <input
              value={mcActualBuy}
              onChange={(e) => setMcActualBuy(e.target.value)}
              className="border rounded p-2"
              placeholder="21.3"
            />
            <span className="text-gray-400 text-sm mt-1">Giá mua đã thực hiện</span>
          </label>
          <label className="flex flex-col md:col-span-1">
            <span>Nhận Xét</span>
            <input
              value={mcComment}
              onChange={(e) => setMcComment(e.target.value)}
              className="border rounded p-2"
              placeholder="Ghi chú phân tích"
            />
            <span className="text-gray-400 text-sm mt-1">Các nhận xét bổ sung</span>
          </label>
        </div>
      </section>

      <div className="mt-6 text-center">
        <button onClick={handleExport} className="export-button">
          Xuất Excel
        </button>

        <button onClick={handlePreview} className="border rounded px-4 py-2 export-button">
          Xem Trước
        </button>
      </div>
      {/* Preview modal */}
      <PreviewModal
        visible={previewOpen}
        onClose={() => setPreviewOpen(false)}
        data={previewRows}
      />
    </div>
  );
}
