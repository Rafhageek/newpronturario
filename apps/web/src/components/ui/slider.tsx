'use client';

/**
 * Slider acessível (equivalente ao shadcn Slider; shadcn não está instalado).
 *
 * Correções de contraste do redesign:
 *  - cor padrão era `#38BDF8` (2,9:1 sobre o canvas creme, reprovando no valor
 *    em texto); agora é o `--status-info-ink`, que é AA em ambos os temas;
 *  - o trilho vazio era `rgba(255,255,255,0.1)`, ou seja, branco quase invisível
 *    sobre o tema claro — virou `--surface-3`, que existe nos dois temas.
 */
export function Slider({
  value,
  onChange,
  min = 0,
  max = 10,
  color = 'var(--status-info-ink, #0442bf)',
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
      {/* Aro escuro no polegar: um círculo branco sobre trilho claro não tem
          os 3:1 que a SC 1.4.11 pede para um controle. */}
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full outline-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_0_2px_var(--line-strong)] [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[var(--line-strong)] [&::-moz-range-thumb]:bg-white"
        style={{
          background: `linear-gradient(to right, ${color} ${pct}%, var(--surface-3) ${pct}%)`,
        }}
        aria-label={label}
      />
    </div>
  );
}
