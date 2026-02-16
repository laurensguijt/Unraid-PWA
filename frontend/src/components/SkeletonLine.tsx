type Props = {
  width?: string;
};

export function SkeletonLine({ width = "100%" }: Props) {
  return <div className="skeleton-line" style={{ width }} />;
}
