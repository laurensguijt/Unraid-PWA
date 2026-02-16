import { CircleX, Gauge, LayoutGrid } from "lucide-react";
import type { SharesData } from "../../types";
import { BadgePill } from "../BadgePill";
import { FrostedCard } from "../FrostedCard";
import { IconRow } from "../IconRow";
import { ProgressBar } from "../ProgressBar";

type SharesTabProps = {
  shares: SharesData["shares"];
};

export function SharesTab({ shares }: SharesTabProps) {
  return (
    <>
      {shares.map((share) => (
        <FrostedCard key={share.id}>
          <div className="row">
            <h3>{share.name}</h3>
            <BadgePill value={share.location} />
          </div>
          <IconRow label="Split Level" value={share.splitLevel} />
          <IconRow label="Allocator" value={share.allocator} icon={LayoutGrid} />
          <IconRow label="Used" value={share.used} icon={Gauge} />
          <IconRow label="Free" value={share.free} icon={CircleX} />
          <ProgressBar value={share.usagePercent} />
        </FrostedCard>
      ))}
    </>
  );
}
