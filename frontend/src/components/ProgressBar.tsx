type Props = {
  value: number;
  showPercentage?: boolean;
};

export function ProgressBar({ value, showPercentage = false }: Props) {
  const clamped = Math.max(0, Math.min(100, value));
  const percentage = Math.round(clamped);

  if (showPercentage) {
    return (
      <div className="progress-with-value">
        <div className="progress-value">{percentage}%</div>
        <div className="bar">
          <div style={{ width: `${clamped}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="bar">
      <div style={{ width: `${clamped}%` }} />
    </div>
  );
}
