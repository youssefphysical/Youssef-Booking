import { whatsappUrl } from "@/lib/whatsapp";
import { useSettings } from "@/hooks/use-settings";
import { SiWhatsapp } from "react-icons/si";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";

interface Props {
  message?: string;
  label?: string;
  className?: string;
  variant?: "solid" | "outline" | "ghost" | "subtle";
  size?: "sm" | "md" | "lg";
  testId?: string;
  // Optional click hook so callers can record/persist the request before
  // the user is sent off to WhatsApp (best-effort, never blocks the link).
  onClick?: () => void;
}

export function WhatsAppButton({
  message,
  label,
  className,
  variant = "solid",
  size = "md",
  testId = "button-whatsapp",
  onClick,
}: Props) {
  const { data: settings } = useSettings();
  const { t } = useTranslation();
  const url = whatsappUrl(settings?.whatsappNumber, message);
  const buttonLabel = label ?? t("whatsapp.label");

  const sizeStyles =
    size === "lg" ? "h-14 px-6 text-base" : size === "sm" ? "h-9 px-4 text-sm" : "h-12 px-5 text-sm";

  const variantStyles =
    variant === "solid"
      ? "bg-[#25D366] hover:bg-[#1faa55] text-white shadow-lg shadow-[#25D366]/20"
      : variant === "outline"
        ? "border border-[#25D366]/40 text-[#25D366] hover:bg-[#25D366]/10"
        : variant === "subtle"
          ? "border border-white/10 bg-white/5 text-foreground hover:border-primary/30 hover:bg-white/10"
          : "text-[#25D366] hover:bg-[#25D366]/10";

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      data-testid={testId}
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all",
        sizeStyles,
        variantStyles,
        className,
      )}
    >
      <SiWhatsapp className="shrink-0" size={size === "lg" ? 20 : size === "sm" ? 14 : 18} />
      <span>{buttonLabel}</span>
    </a>
  );
}
