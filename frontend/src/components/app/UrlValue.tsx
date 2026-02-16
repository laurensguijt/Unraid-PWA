import { isHttpUrl } from "../../lib/ui";

type UrlValueProps = {
  value: string;
  label?: string;
};

export function UrlValue({ value, label }: UrlValueProps) {
  if (!isHttpUrl(value)) {
    return <small className="url-text">{value}</small>;
  }

  return (
    <a className="url-link" href={value} target="_blank" rel="noreferrer">
      {label ?? value}
    </a>
  );
}
