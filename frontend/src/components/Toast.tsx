type Props = {
  message: string;
  variant?: "success" | "error";
};

export function Toast({ message, variant }: Props) {
  if (!message) {
    return null;
  }
  const className = variant ? `toast toast--${variant}` : "toast";
  return <p className={className}>{message}</p>;
}
