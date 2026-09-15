/** Read-only average rating: a grey 5-star row with a gold overlay clipped to
 * the average, so fractional averages render accurate partial stars. */
export function StarsDisplay({
  value,
  size = 16,
  className,
}: {
  value: number;
  size?: number;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));

  return (
    <span
      className={`relative inline-flex whitespace-nowrap leading-none ${className ?? ""}`}
      style={{ fontSize: size }}
      role="img"
      aria-label={`${value.toFixed(1)} z 5`}
    >
      <span className="text-default-300">★★★★★</span>
      <span
        className="absolute inset-0 overflow-hidden text-yellow-400"
        style={{ width: `${pct}%` }}
      >
        ★★★★★
      </span>
    </span>
  );
}
