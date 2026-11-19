import type { ChangeEvent, ReactNode } from "react";

export function Section({
  title,
  right,
  children,
  description,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  description?: string;
}) {
  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between gap-2">
        <h3 className="label">{title}</h3>
        {right}
      </header>
      {description ? <p className="text-[11.5px] leading-relaxed text-muted-foreground">{description}</p> : null}
      {children}
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-[11.5px] font-medium text-muted-foreground">{label}</span>
        {hint ? <span className="text-[10.5px] text-muted-foreground/70">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] font-medium text-muted-foreground">{label}</span>
        <span className="rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-[10.5px] text-foreground/80">
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(Number(event.target.value))}
        className="w-full"
      />
    </div>
  );
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11.5px] font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10.5px] uppercase text-muted-foreground/80">{value}</span>
        <label className="relative h-7 w-9 overflow-hidden rounded-md border border-white/15">
          <span className="absolute inset-0" style={{ background: value }} />
          <input
            type="color"
            value={value.startsWith("#") ? value : "#ffffff"}
            onChange={event => onChange(event.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
      </div>
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: Array<{ value: T; label: string; icon?: ReactNode }>;
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg font-medium transition ${
            size === "sm" ? "px-2 py-1 text-[11px]" : "px-2.5 py-1.5 text-[11.5px]"
          } ${
            value === option.value
              ? "bg-[var(--studio-accent)] text-[#170b03] shadow-sm"
              : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
          }`}
        >
          {option.icon}
          <span className="truncate">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-lg py-1 text-left"
    >
      <span>
        <span className="block text-[12px] text-foreground/90">{label}</span>
        {hint ? <span className="block text-[10.5px] text-muted-foreground">{hint}</span> : null}
      </span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition ${
          checked ? "bg-[var(--studio-accent)]" : "bg-white/15"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-[#0a0a0d] transition-all ${
            checked ? "left-[18px]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={event => onChange(event.target.value as T)}
      className="studio-input appearance-none bg-[#14141b] pr-8"
    >
      {options.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-white/12 bg-white/[0.02] p-3 text-[11.5px] leading-relaxed text-muted-foreground">
      {children}
    </div>
  );
}
