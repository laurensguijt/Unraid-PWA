import type { ReactNode } from "react";

type Props = {
  title: string;
  right?: ReactNode;
};

export function SectionHeader({ title, right }: Props) {
  return (
    <div className="row section-header">
      <h2>{title}</h2>
      {right}
    </div>
  );
}
