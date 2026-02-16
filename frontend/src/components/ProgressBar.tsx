type Props = {
  value: number;
};

export function ProgressBar({ value }: Props) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="bar">
      <div style={{ width: `${clamped}%` }} />
    </div>
  );
}
