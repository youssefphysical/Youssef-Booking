import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useTranslation } from "@/i18n";

const FAQ_KEYS = [
  "rates",
  "location",
  "fitnessZone",
  "duration",
  "cancellation",
  "nutrition",
  "trial",
  "couples",
  "kids",
  "results",
] as const;

interface FaqAccordionProps {
  /** Optionally limit to N questions (e.g. 5 for homepage preview). */
  limit?: number;
}

/**
 * Public FAQ accordion (Task #32, brief §35). 10 brief questions, shared
 * between the homepage section and the dedicated `/faq` page. Content is
 * 100% i18n so en + ar (and other locales) stay aligned automatically.
 */
export function FaqAccordion({ limit }: FaqAccordionProps) {
  const { t } = useTranslation();
  const keys = limit ? FAQ_KEYS.slice(0, limit) : FAQ_KEYS;

  return (
    <Accordion
      type="single"
      collapsible
      className="rounded-2xl border border-white/10 bg-white/[0.02] divide-y divide-white/5"
      data-testid="faq-accordion"
    >
      {keys.map((k, i) => (
        <AccordionItem
          key={k}
          value={`faq-${k}`}
          className="border-0 px-4 sm:px-5"
        >
          <AccordionTrigger
            className="text-start py-4 text-base sm:text-lg font-display font-semibold hover:no-underline data-[state=open]:text-primary"
            data-testid={`faq-question-${k}`}
          >
            <span className="flex items-baseline gap-3 min-w-0 pr-3">
              <span className="text-[11px] font-mono text-primary/60 tabular-nums shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0">{t(`faq.q.${k}`)}</span>
            </span>
          </AccordionTrigger>
          <AccordionContent
            className="pb-5 text-sm sm:text-[15px] leading-relaxed text-muted-foreground"
            data-testid={`faq-answer-${k}`}
          >
            {t(`faq.a.${k}`)}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

export default FaqAccordion;
