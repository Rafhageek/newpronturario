'use client';

/** Slider acessível (equivalente ao shadcn Slider; shadcn não está instalado). */
export function Slider({
  value,
  onChange,
  min = 0,
  max = 10,
  color = '#38BDF8',
  label,
  valueLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  color?: string;
  label: string;
  valueLabel?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-medium text-fg-soft">{label}</label>
        <span className="text-sm font-semibold" style={{ color }}>
          {valueLabel ?? value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full outline-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow"
        style={{
          background: `linear-gradient(to right, ${color} ${pct}%, rgba(255,255,255,0.1) ${pct}%)`,
        }}
        aria-label={label}
      />
    </div>
  );
}
