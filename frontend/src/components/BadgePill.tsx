type Props = {
  value: string | number;
};

export function BadgePill({ value }: Props) {
  return <span className="pill">{value}</span>;
}
