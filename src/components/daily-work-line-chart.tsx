import type { DailyWorkMinutes } from "@/lib/analytics";
import { formatDuration } from "@/lib/utils";

const WIDTH = 480;
const HEIGHT = 200;
const PAD = { top: 16, right: 16, bottom: 32, left: 44 };

type Props = {
  data: DailyWorkMinutes[];
};

function yTickValues(maxMinutes: number): number[] {
  if (maxMinutes <= 0) return [0];
  const step =
    maxMinutes <= 120
      ? 30
      : maxMinutes <= 240
        ? 60
        : maxMinutes <= 480
          ? 120
          : 240;
  const ticks: number[] = [0];
  for (let m = step; m < maxMinutes; m += step) {
    ticks.push(m);
  }
  ticks.push(maxMinutes);
  return [...new Set(ticks)].sort((a, b) => a - b);
}

export function DailyWorkLineChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Complete schedule blocks to see time worked.
      </p>
    );
  }

  const maxMinutes = Math.max(1, ...data.map((d) => d.minutes));
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const points = data.map((d, i) => {
    const x =
      PAD.left + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
    const y = PAD.top + plotH - (d.minutes / maxMinutes) * plotH;
    return { ...d, x, y };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  const yTicks = yTickValues(maxMinutes);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-[200px] w-full max-w-full text-muted-foreground"
        role="img"
        aria-label="Hours and minutes worked per day this week"
      >
        {yTicks.map((tick) => {
          const y = PAD.top + plotH - (tick / maxMinutes) * plotH;
          return (
            <g key={tick}>
              <line
                x1={PAD.left}
                y1={y}
                x2={WIDTH - PAD.right}
                y2={y}
                className="stroke-border"
                strokeWidth={1}
                strokeDasharray={tick === 0 ? undefined : "4 4"}
              />
              <text
                x={PAD.left - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-muted-foreground text-[10px]"
              >
                {formatDuration(tick)}
              </text>
            </g>
          );
        })}

        <path
          d={linePath}
          fill="none"
          className="stroke-primary"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {points.map((p) => (
          <g key={p.date}>
            <circle
              cx={p.x}
              cy={p.y}
              r={4}
              className="fill-primary stroke-background"
              strokeWidth={2}
            />
            <text
              x={p.x}
              y={HEIGHT - 8}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {p.label}
            </text>
            {p.minutes > 0 && (
              <text
                x={p.x}
                y={p.y - 10}
                textAnchor="middle"
                className="fill-foreground text-[10px] font-medium"
              >
                {formatDuration(p.minutes)}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
