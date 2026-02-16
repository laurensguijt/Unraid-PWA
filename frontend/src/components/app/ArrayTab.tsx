import { useMemo } from "react";
import { Activity, CircleX, Gauge, HardDrive, LayoutGrid, Thermometer } from "lucide-react";
import type { ArrayAction, ArrayData } from "../../types";
import { BadgePill } from "../BadgePill";
import { FrostedCard } from "../FrostedCard";
import { IconRow } from "../IconRow";
import { ProgressBar } from "../ProgressBar";
import { SectionHeader } from "../SectionHeader";

type ArrayTabProps = {
  arrayData: ArrayData;
  canWriteControls: boolean;
  onRequestArrayAction: (action: ArrayAction) => void;
};

export function ArrayTab({ arrayData, canWriteControls, onRequestArrayAction }: ArrayTabProps) {
  const isZeroLikeValue = (value: string): boolean => {
    const normalized = value.trim().toLowerCase();
    return normalized === "0 b" || normalized === "0.0 b" || normalized === "-" || normalized === "0";
  };

  const parityDisks = useMemo(
    () =>
      arrayData.devices
        .filter((device) => device.isParity)
        .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: "base" })),
    [arrayData.devices],
  );

  const arrayDisks = useMemo(
    () =>
      arrayData.devices
        .filter((device) => !device.isParity && device.diskType === "array")
        .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: "base" })),
    [arrayData.devices],
  );

  const poolDisks = useMemo(
    () =>
      arrayData.devices
        .filter((device) => !device.isParity && device.diskType === "pool")
        .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: "base" })),
    [arrayData.devices],
  );

  const redundantPoolMemberFlags = useMemo(() => {
    const flags = poolDisks.map(() => false);
    if (poolDisks.length < 2) {
      return flags;
    }

    for (let index = 0; index < poolDisks.length; index += 1) {
      const device = poolDisks[index];
      const unknownFilesystem = device.filesystem.trim().toLowerCase() === "unknown";
      const hasNoUsageStats =
        device.usagePercent === 0 &&
        isZeroLikeValue(device.used) &&
        isZeroLikeValue(device.free);
      const hasSiblingWithFilesystem = poolDisks.some(
        (sibling, siblingIndex) =>
          siblingIndex !== index &&
          sibling.filesystem.trim().toLowerCase() !== "unknown" &&
          !isZeroLikeValue(sibling.size),
      );

      if (unknownFilesystem && hasNoUsageStats && hasSiblingWithFilesystem) {
        flags[index] = true;
      }
    }

    return flags;
  }, [poolDisks]);

  return (
    <>
      <FrostedCard>
        <SectionHeader title="Array Overview" right={<BadgePill value={arrayData.devices.length} />} />
        <div className="array-grid">
          <IconRow label="State" value={arrayData.state} icon={HardDrive} />
          <IconRow label="Used" value={arrayData.capacity.used} icon={Gauge} />
          <IconRow label="Free" value={arrayData.capacity.free} icon={CircleX} />
          <IconRow label="Total" value={arrayData.capacity.total} icon={LayoutGrid} />
        </div>
        <ProgressBar value={arrayData.capacity.usagePercent} showPercentage />
        <div className="actions">
          <button disabled={!canWriteControls} onClick={() => onRequestArrayAction("start")}>
            Start array
          </button>
          <button disabled={!canWriteControls} onClick={() => onRequestArrayAction("stop")}>
            Stop array
          </button>
        </div>
      </FrostedCard>

      <FrostedCard>
        <SectionHeader title="Parity disks" right={<BadgePill value={parityDisks.length} />} />
        {parityDisks.map((device, index) => (
          <div key={device.id} className="list-item">
            <div className="row">
              <strong>{`Parity disk ${index + 1}`}</strong>
              <BadgePill value={device.id} />
            </div>
            <div className="array-grid">
              <IconRow label="Temp" value={device.temp} icon={Thermometer} />
              <IconRow label="Size" value={device.size} icon={LayoutGrid} />
              <IconRow label="Errors" value={String(device.errors)} icon={Activity} />
            </div>
          </div>
        ))}
        {parityDisks.length === 0 && <small>No parity disks detected.</small>}
      </FrostedCard>

      <FrostedCard>
        <SectionHeader title="Array disks" right={<BadgePill value={arrayDisks.length} />} />
        {arrayDisks.map((device, index) => (
          <div key={device.id} className="list-item">
            <div className="row">
              <strong>{`Array disk ${index + 1}`}</strong>
              <BadgePill value={device.id} />
            </div>
            <div className="array-grid">
              <IconRow label="Temp" value={device.temp} icon={Thermometer} />
              <IconRow label="Filesystem" value={device.filesystem} icon={HardDrive} />
              <IconRow label="Size" value={device.size} icon={LayoutGrid} />
              <IconRow label="Errors" value={String(device.errors)} icon={Activity} />
              <IconRow label="Used" value={device.used} icon={Gauge} />
              <IconRow label="Free" value={device.free} icon={CircleX} />
            </div>
            <ProgressBar value={device.usagePercent} showPercentage />
          </div>
        ))}
        {arrayDisks.length === 0 && <small>No array disks detected.</small>}
      </FrostedCard>

      <FrostedCard>
        <SectionHeader title="Pool disks" right={<BadgePill value={poolDisks.length} />} />
        {poolDisks.map((device, index) => {
          const isLikelyRedundantMember = redundantPoolMemberFlags[index] ?? false;
          return (
            <div key={device.id} className="list-item">
              <div className="row">
                <strong>{`Pool disk ${index + 1}`}</strong>
                <BadgePill value={device.id} />
              </div>
              <div className="array-grid">
                <IconRow label="Temp" value={device.temp} icon={Thermometer} />
                <IconRow
                  label="Filesystem"
                  value={isLikelyRedundantMember ? "redundant member" : device.filesystem}
                  icon={HardDrive}
                />
                <IconRow label="Size" value={device.size} icon={LayoutGrid} />
                <IconRow label="Errors" value={String(device.errors)} icon={Activity} />
                {!isLikelyRedundantMember ? (
                  <>
                    <IconRow label="Used" value={device.used} icon={Gauge} />
                    <IconRow label="Free" value={device.free} icon={CircleX} />
                  </>
                ) : null}
              </div>
              {isLikelyRedundantMember ? (
                <small>Likely redundant pool member; usage is reported on the primary pool disk.</small>
              ) : (
                <ProgressBar value={device.usagePercent} showPercentage />
              )}
            </div>
          );
        })}
        {poolDisks.length === 0 && <small>No pool disks detected.</small>}
      </FrostedCard>
    </>
  );
}
