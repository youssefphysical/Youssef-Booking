import { Checkbox } from "@/components/ui/checkbox";
import { ShieldCheck } from "lucide-react";

interface Props {
  checked: boolean;
  onChange: (v: boolean) => void;
  text: string;
  testId?: string;
}

/** Inline upload-consent checkbox shown next to InBody / Progress photo uploads. */
export function ConsentNote({ checked, onChange, text, testId }: Props) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 cursor-pointer hover:bg-white/[0.06]">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        data-testid={testId}
        className="mt-0.5"
      />
      <span className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
        <ShieldCheck size={14} className="text-primary shrink-0 mt-0.5" />
        <span>{text}</span>
      </span>
    </label>
  );
}
