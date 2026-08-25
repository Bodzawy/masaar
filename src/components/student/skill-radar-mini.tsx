"use client";

import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";

export function SkillRadarMini({ data }: { data: Array<{ skill: string; score: number }> }) {
  const chartData = data.map((d) => ({ skill: d.skill.charAt(0) + d.skill.slice(1).toLowerCase(), score: d.score }));
  if (chartData.length === 0) return <div className="h-40 rounded-md bg-muted" />;
  return (
    <div className="h-44" aria-label="Skill radar chart" role="img">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={chartData} outerRadius="72%">
          <PolarGrid stroke="hsl(220 14% 90%)" />
          <PolarAngleAxis dataKey="skill" tick={{ fontSize: 10, fill: "hsl(222 12% 42%)" }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar dataKey="score" stroke="hsl(243 63% 55%)" fill="hsl(243 63% 55%)" fillOpacity={0.25} strokeWidth={2} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
