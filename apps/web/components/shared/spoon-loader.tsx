"use client";

/**
 * The app's loading indicator: a wooden spoon stirring in a pot. Pure SVG + SMIL
 * (no JS timers), so it animates even while the main thread is busy importing.
 *
 * The pot rim and the swirling highlight use `currentColor`, so set a text color
 * on a parent to theme them (defaults to the brand accent); the spoon keeps its
 * wooden tones. The markup is injected verbatim so the animation matches the
 * approved asset exactly, independent of how React reconciles SMIL attributes.
 */
export function SpoonLoader({
  size = 64,
  className,
  label = "Loading",
}: {
  size?: number;
  className?: string;
  label?: string;
}) {
  return (
    <span
      aria-label={label}
      className={className}
      role="status"
      style={{ display: "inline-flex", width: size, height: size, color: "var(--accent, #336640)" }}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: SPOON_SVG }}
    />
  );
}

const SPOON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 96 96" fill="none" aria-hidden="true">
  <circle cx="48" cy="50" r="30" fill="none" stroke="currentColor" stroke-opacity="0.13" stroke-width="4"/>
  <circle cx="48" cy="50" r="30" fill="none" stroke="currentColor" stroke-opacity="0.4" stroke-width="4" stroke-linecap="round" stroke-dasharray="30 300">
    <animateTransform attributeName="transform" type="rotate" from="0 48 50" to="360 48 50" dur="1.15s" repeatCount="indefinite"/>
  </circle>
  <g transform="translate(48,46)">
    <g>
      <animateMotion dur="1.15s" repeatCount="indefinite" rotate="0" path="M -10,0 a 10,10 0 1,1 20,0 a 10,10 0 1,1 -20,0"/>
      <g>
        <animateTransform attributeName="transform" type="rotate" values="-14 0 -18; 10 0 -18; -14 0 -18" keyTimes="0;0.5;1" calcMode="spline" keySplines="0.42 0 0.58 1; 0.42 0 0.58 1" dur="1.15s" repeatCount="indefinite"/>
        <rect x="-4" y="-18" width="8" height="30" rx="4" fill="#C08A4E"/>
        <ellipse cx="0" cy="16" rx="10.5" ry="13.5" fill="#A9743F"/>
        <ellipse cx="0" cy="15" rx="5.5" ry="7.5" fill="#D9A86A" opacity="0.55"/>
      </g>
    </g>
  </g>
</svg>`;
