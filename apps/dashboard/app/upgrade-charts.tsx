import type { CompletionBin, UpgradeTimelinePoint } from "@multi-coc/upgrade-availability";

const WIDTH = 720;
const HEIGHT = 150;
const LEFT = 28;
const RIGHT = 10;
const TOP = 12;
const BOTTOM = 25;

function AreaPlot({
  points,
  homeKey,
  allKey,
  label,
  homeLabel,
  allLabel,
  formatTime,
}: {
  points: UpgradeTimelinePoint[];
  homeKey: "activeHome" | "availableHome";
  allKey: "activeAll" | "availableAll";
  label: string;
  homeLabel: string;
  allLabel: string;
  formatTime: (value: number) => string;
}) {
  const start = points[0]?.at || 0;
  const end = points.at(-1)?.at || start + 1;
  const maximum = Math.max(1, ...points.map((point) => point[allKey]));
  const x = (at: number) => LEFT + ((at - start) / Math.max(1, end - start)) * (WIDTH - LEFT - RIGHT);
  const y = (value: number) => TOP + ((maximum - value) / maximum) * (HEIGHT - TOP - BOTTOM);
  const line = (key: typeof homeKey | typeof allKey) =>
    points.map((point, index) => `${index ? "L" : "M"}${x(point.at)},${y(point[key])}`).join(" ");
  const area = (key: typeof homeKey | typeof allKey) =>
    `${line(key)} L${x(end)},${HEIGHT - BOTTOM} L${x(start)},${HEIGHT - BOTTOM} Z`;
  const first = points[0];
  return (
    <div className="upgrade-area-chart">
      <div className="upgrade-chart-heading">
        <h3>{label}</h3>
        <span>
          <b className="legend-home" />
          {homeLabel} {first?.[homeKey] || 0}
          <b className="legend-all" />
          {allLabel} {first?.[allKey] || 0}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`${label}: ${homeLabel} ${first?.[homeKey] || 0}, ${allLabel} ${first?.[allKey] || 0}`}
      >
        {[0, Math.ceil(maximum / 2), maximum].map((value) => (
          <g key={value}>
            <line className="chart-grid" x1={LEFT} x2={WIDTH - RIGHT} y1={y(value)} y2={y(value)} />
            <text x={LEFT - 7} y={y(value) + 3} textAnchor="end">
              {value}
            </text>
          </g>
        ))}
        <path className="area-all" d={area(allKey)} />
        <path className="area-home" d={area(homeKey)} />
        <path className="line-all" d={line(allKey)} />
        <path className="line-home" d={line(homeKey)} />
        <text x={LEFT} y={HEIGHT - 6}>
          {formatTime(start)}
        </text>
        <text x={WIDTH - RIGHT} y={HEIGHT - 6} textAnchor="end">
          {formatTime(end)}
        </text>
      </svg>
    </div>
  );
}

export default function UpgradeCharts({
  bins,
  timeline,
  formatTime,
  labels,
}: {
  bins: CompletionBin[];
  timeline: UpgradeTimelinePoint[];
  formatTime: (value: number) => string;
  labels: {
    title: string;
    description: string;
    completions: string;
    active: string;
    available: string;
    home: string;
    all: string;
    empty: string;
  };
}) {
  const maximum = Math.max(1, ...bins.map((bin) => bin.all));
  const hasUpgrades = timeline[0]?.activeAll > 0;
  return (
    <section className="upgrade-outlook" aria-labelledby="upgrade-outlook-title">
      <div className="section-title">
        <div>
          <p className="eyebrow">UPGRADE OUTLOOK</p>
          <h2 id="upgrade-outlook-title">{labels.title}</h2>
        </div>
        <span>{labels.description}</span>
      </div>
      {!hasUpgrades ? (
        <div className="empty chart-empty">{labels.empty}</div>
      ) : (
        <div className="upgrade-chart-layout">
          <div className="completion-chart">
            <div className="upgrade-chart-heading">
              <h3>{labels.completions}</h3>
              <span>
                <b className="legend-home" />
                {labels.home}
                <b className="legend-all" />
                {labels.all}
              </span>
            </div>
            <div className="completion-bars" role="img" aria-label={labels.completions}>
              {bins.map((bin, index) => (
                <div className="completion-bin" key={bin.start}>
                  <div className="bar-space">
                    <i className="bar-all" style={{ height: `${(bin.all / maximum) * 100}%` }} />
                    <i className="bar-home" style={{ height: `${(bin.home / maximum) * 100}%` }} />
                    {bin.all > 0 && <b>{bin.all}</b>}
                  </div>
                  <small>
                    {index === 0 || index === bins.length - 1 || index === Math.floor(bins.length / 2)
                      ? formatTime(bin.end)
                      : ""}
                  </small>
                </div>
              ))}
            </div>
          </div>
          <AreaPlot
            points={timeline}
            homeKey="activeHome"
            allKey="activeAll"
            label={labels.active}
            homeLabel={labels.home}
            allLabel={labels.all}
            formatTime={formatTime}
          />
          <AreaPlot
            points={timeline}
            homeKey="availableHome"
            allKey="availableAll"
            label={labels.available}
            homeLabel={labels.home}
            allLabel={labels.all}
            formatTime={formatTime}
          />
        </div>
      )}
    </section>
  );
}
