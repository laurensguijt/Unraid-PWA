import { useEffect, useState } from "react";
import { Boxes } from "lucide-react";

type Props = {
  name: string;
  iconUrl: string;
  fallbackIconUrl?: string;
};

export function DockerLogo({ name, iconUrl, fallbackIconUrl }: Props) {
  const [failed, setFailed] = useState(false);
  const [hasTriedFallback, setHasTriedFallback] = useState(false);
  const [src, setSrc] = useState("");

  useEffect(() => {
    setFailed(false);
    setHasTriedFallback(false);
    setSrc(iconUrl || fallbackIconUrl || "");
  }, [iconUrl, fallbackIconUrl]);

  if (!src || failed) {
    return (
      <span className="docker-icon docker-icon-fallback" aria-label={`${name} docker fallback logo`}>
        <Boxes size={16} />
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={`${name} logo`}
      className="docker-icon"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => {
        if (!hasTriedFallback && fallbackIconUrl && src !== fallbackIconUrl) {
          setHasTriedFallback(true);
          setSrc(fallbackIconUrl);
          return;
        }
        setFailed(true);
      }}
    />
  );
}
