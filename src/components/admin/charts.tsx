"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

export function AdminCharts({ bookingsPerDay }: { bookingsPerDay: Array<{ day: string; count: number }> }) {
  if (bookingsPerDay.length === 0) return <div className="h-48 rounded-md bg-muted" />;
  return (
    <div className="h-52" role="img" aria-label="Bookings per day, last 14 days">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={bookingsPerDay} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="dpGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(243 63% 55%)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="hsl(243 63% 55%)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="hsl(220 14% 90%)" vertical={false} />
          <XAxis dataKey="day" tickFormatter={(v: string) => v.slice(5)} tick={{ fontSize: 11 }} stroke="hsl(222 12% 60%)" />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(222 12% 60%)" />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: "1px solid hsl(220 14% 90%)", fontSize: 12 }}
            labelFormatter={(v: string) => v}
          />
          <Area type="monotone" dataKey="count" stroke="hsl(243 63% 55%)" strokeWidth={2} fill="url(#dpGrad)" name="Lessons" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
