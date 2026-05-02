import { cn } from "@/lib/utils";

type UserAvatarProps = {
  /** Either a `data:` URL (profile pictures) or a regular `/uploads/...` URL. */
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
  testId?: string;
};

function initialsFor(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join("") || "?";
}

/**
 * Circular avatar — shows the user's profile picture when available, otherwise
 * falls back to a primary-tinted initials disc. Single source of truth for
 * avatar rendering across the app (nav, dashboards, admin lists).
 */
export function UserAvatar({ src, name, size = 40, className, testId }: UserAvatarProps) {
  const dim = `${size}px`;
  const initials = initialsFor(name);
  // Tailwind picks the font size from the element font-size property; here we
  // size relative to the avatar diameter so initials always look balanced.
  const fontSize = Math.max(11, Math.round(size * 0.38));

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        data-testid={testId}
        loading="lazy"
        className={cn(
          "rounded-full object-cover border border-white/10 bg-white/5",
          className,
        )}
        style={{ width: dim, height: dim }}
      />
    );
  }

  return (
    <div
      data-testid={testId}
      className={cn(
        "rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-primary font-semibold select-none",
        className,
      )}
      style={{ width: dim, height: dim, fontSize }}
      aria-label={name}
    >
      {initials}
    </div>
  );
}
