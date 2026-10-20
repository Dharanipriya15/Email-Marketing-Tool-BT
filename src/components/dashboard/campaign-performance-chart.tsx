"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import type { CampaignPerformancePoint } from "@/services/dashboard-service";

const OPEN_RATE_COLOR = "#2a78d6";
const CLICK_RATE_COLOR = "#eb6834";

const CHART_HEIGHT = 220;
const CHART_WIDTH = 640;
const MARGIN = { top: 12, right: 12, bottom: 28, left: 36 };
const BAR_RADIUS = 4;
const MAX_BAR_THICKNESS = 24;

function roundedTopBarPath(x: number, y: number, width: number, height: number) {
  const r = Math.min(BAR_RADIUS, height, width / 2);
  if (height <= 0) return "";
  return `M${x},${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} H${x} Z`;
}

function niceMax(value: number): number {
  if (value <= 0) return 10;
  const step = value <= 20 ? 5 : value <= 50 ? 10 : 25;
  return Math.ceil(value / step) * step;
}

export function CampaignPerformanceChart({
  data,
}: {
  data: CampaignPerformancePoint[];
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Campaign Performance</CardTitle>
        {data.length > 0 && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span
                className="h-0.5 w-3 rounded-full"
                style={{ backgroundColor: OPEN_RATE_COLOR }}
              />
              Open Rate
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="h-0.5 w-3 rounded-full"
                style={{ backgroundColor: CLICK_RATE_COLOR }}
              />
              Click Rate
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No performance data yet"
            description="Once campaigns are delivered, open and click rates will appear here."
            className="border-0 py-10"
          />
        ) : (
          <ChartBody data={data} hoveredIndex={hoveredIndex} onHover={setHoveredIndex} />
        )}
      </CardContent>
    </Card>
  );
}

function ChartBody({
  data,
  hoveredIndex,
  onHover,
}: {
  data: CampaignPerformancePoint[];
  hoveredIndex: number | null;
  onHover: (index: number | null) => void;
}) {
  const plotWidth = CHART_WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;

  const maxValue = niceMax(Math.max(...data.flatMap((d) => [d.openRate, d.clickRate])));
  const yScale = (value: number) => plotHeight - (value / maxValue) * plotHeight;

  const groupWidth = plotWidth / data.length;
  const barGap = 2;
  const barWidth = Math.min(MAX_BAR_THICKNESS, (groupWidth - barGap - 16) / 2);

  const ticks = [0, maxValue / 2, maxValue];
  const hovered = hoveredIndex !== null ? data[hoveredIndex] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="w-full"
        role="img"
        aria-label="Campaign open and click rates"
      >
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={0}
                x2={plotWidth}
                y1={yScale(tick)}
                y2={yScale(tick)}
                stroke="#e1e0d9"
                strokeWidth={1}
              />
              <text
                x={-8}
                y={yScale(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={10}
                fill="#898781"
              >
                {Math.round(tick)}%
              </text>
            </g>
          ))}

          {data.map((point, index) => {
            const groupX = index * groupWidth;
            const centerX = groupX + groupWidth / 2;
            const openX = centerX - barWidth - barGap / 2;
            const clickX = centerX + barGap / 2;
            const isHovered = hoveredIndex === index;

            return (
              <g
                key={point.id}
                onPointerEnter={() => onHover(index)}
                onPointerLeave={() => onHover(null)}
                onFocus={() => onHover(index)}
                onBlur={() => onHover(null)}
                tabIndex={0}
                style={{ outline: "none", cursor: "pointer" }}
                opacity={hoveredIndex === null || isHovered ? 1 : 0.5}
              >
                <rect
                  x={groupX}
                  y={0}
                  width={groupWidth}
                  height={plotHeight}
                  fill="transparent"
                />
                <path
                  d={roundedTopBarPath(
                    openX,
                    yScale(point.openRate),
                    barWidth,
                    plotHeight - yScale(point.openRate)
                  )}
                  fill={OPEN_RATE_COLOR}
                />
                <path
                  d={roundedTopBarPath(
                    clickX,
                    yScale(point.clickRate),
                    barWidth,
                    plotHeight - yScale(point.clickRate)
                  )}
                  fill={CLICK_RATE_COLOR}
                />
                <text
                  x={centerX}
                  y={plotHeight + 16}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#52514e"
                >
                  {point.name.length > 12 ? `${point.name.slice(0, 11)}…` : point.name}
                </text>
              </g>
            );
          })}

          <line
            x1={0}
            x2={plotWidth}
            y1={plotHeight}
            y2={plotHeight}
            stroke="#c3c2b7"
            strokeWidth={1}
          />
        </g>
      </svg>

      {hovered && (
        <div className="pointer-events-none absolute top-0 right-0 rounded-md border bg-popover px-3 py-2 text-xs shadow-sm">
          <p className="mb-1 font-medium text-popover-foreground">{hovered.name}</p>
          <p className="flex items-center justify-between gap-4 text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span
                className="h-0.5 w-3 rounded-full"
                style={{ backgroundColor: OPEN_RATE_COLOR }}
              />
              Open Rate
            </span>
            <span className="font-medium text-popover-foreground">
              {hovered.openRate.toFixed(1)}%
            </span>
          </p>
          <p className="flex items-center justify-between gap-4 text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span
                className="h-0.5 w-3 rounded-full"
                style={{ backgroundColor: CLICK_RATE_COLOR }}
              />
              Click Rate
            </span>
            <span className="font-medium text-popover-foreground">
              {hovered.clickRate.toFixed(1)}%
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
