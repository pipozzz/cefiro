/**
 * A chef's toque, used as the placeholder inside avatar bubbles when a cook has
 * no photo — friendlier and on-brand than an initial (and it avoids the odd "@"
 * that a handle-only name produced). Inherits color via `currentColor`, so it
 * sits on the same tinted bubble as the initial did.
 */
export function ChefHatIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Puffy top */}
      <path d="M12 3c-1.86 0-3.48 1.02-4.34 2.53a4.5 4.5 0 0 0-.9 8.72V15h10.48v-.75a4.5 4.5 0 0 0-.9-8.72A4.99 4.99 0 0 0 12 3Z" />
      {/* Band */}
      <path d="M6.76 16.5v2.75c0 .69.56 1.25 1.25 1.25h8c.69 0 1.25-.56 1.25-1.25V16.5H6.76Z" />
    </svg>
  );
}
