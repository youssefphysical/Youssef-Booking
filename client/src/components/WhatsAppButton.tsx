import { whatsappUrl } from "@/lib/whatsapp";
import { useSettings } from "@/hooks/use-settings";
import { SiWhatsapp } from "react-icons/si";
import { cn } from "@/lib/utils";

interface Props {
  message?: string;
  label?: string;
  className?: string;
  variant?: "solid" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  testId?: string;
}

export function WhatsAppButton({
  message,
  label = "Contact on WhatsApp",
  className,
  variant = "solid",
  size = "md",
  testId = "button-whatsapp",
}: Props) {
  const { data: settings } = useSettings();
  const url = whatsappUrl(settings?.whatsappNumber, message);

  const sizeStyles =
    size === "lg" ? "h-14 px-6 text-base" : size === "sm" ? "h-9 px-4 text-sm" : "h-12 px-5 text-sm";

  const variantStyles =
    variant === "solid"
      ? "bg-[#25D366] hover:bg-[#1faa55] text-white shadow-lg shadow-[#25D366]/20"
      : variant === "outline"
        ? "border border-[#25D366]/40 text-[#25D366] hover:bg-[#25D366]/10"
        : "text-[#25D366] hover:bg-[#25D366]/10";

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      data-testid={testId}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all",
        sizeStyles,
        variantStyles,
        className,
      )}
    >
      <SiWhatsapp className="shrink-0" size={size === "lg" ? 20 : size === "sm" ? 14 : 18} />
      <span>{label}</span>
    </a>
  );
}
