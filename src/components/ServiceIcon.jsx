import { hexLuminance, resolveBrandIcon } from "@/lib/brand-icons";

/**
 * Circular service icon: a brand logo on its brand colour when known,
 * otherwise a coloured initial avatar (fallback).
 */
export function ServiceIcon({ account, size = 36 }) {
  const brand = resolveBrandIcon(account.issuer, account.label);

  if (brand) {
    const glyph = hexLuminance(brand.hex) > 180 ? "#111827" : "#ffffff";
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full"
        style={{ width: size, height: size, backgroundColor: `#${brand.hex}` }}
      >
        <svg
          viewBox="0 0 24 24"
          width={size * 0.56}
          height={size * 0.56}
          fill={glyph}
          aria-hidden="true"
        >
          <path d={brand.path} />
        </svg>
      </div>
    );
  }

  const initials = (account.issuer || account.label || "?")
    .trim()
    .slice(0, 1)
    .toUpperCase();
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        backgroundColor: account.iconColor || "#4f46e5",
        fontSize: size * 0.42,
      }}
    >
      {initials}
    </div>
  );
}
