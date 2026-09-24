import Image from "next/image";

type BrandLogoProps = {
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
};

export function BrandLogo({
  width = 160,
  height = 36,
  className,
  priority = false,
}: BrandLogoProps) {
  // The logo (pot mark + wordmark) is sized by width everywhere it appears, and
  // its intrinsic ratio (900:200 ≈ 4.5:1) does not match every width/height pair
  // callers ask for. Letting the height follow keeps the ratio honest and
  // silences Next's "width or height modified, but not the other" warning.
  const classes = ["h-auto", className].filter(Boolean).join(" ");

  return (
    <Image
      alt="Naša Kuchyňa logo"
      className={classes}
      height={height}
      priority={priority}
      src="/logo.svg"
      width={width}
    />
  );
}
