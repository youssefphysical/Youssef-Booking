import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  CreditCard,
  Copy,
  CheckCircle2,
  ArrowLeft,
  ShieldCheck,
  Wallet,
  Info,
} from "lucide-react";
import { useSettings } from "@/hooks/use-settings";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";

const FALLBACK_BANK_NAME = "Youssef Tarek Hashim Ahmed";
const FALLBACK_IBAN = "AE230260001015917468101";

export default function DirectPaymentPage() {
  const { data: settings } = useSettings();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const bankName = settings?.bankAccountName || FALLBACK_BANK_NAME;
  const iban = settings?.bankIban || FALLBACK_IBAN;
  const canSeeBank =
    user?.role === "admin" ||
    (user?.role === "client" && settings?.showBankDetailsPublicly === true);
  const isHidden = !canSeeBank;

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(label);
      toast({ title: t("payment.copySuccess").replace("{label}", label) });
      setTimeout(() => setCopiedField(null), 1800);
    } catch {
      toast({
        title: t("payment.copyFail"),
        description: t("payment.copyFailHint"),
        variant: "destructive",
      });
    }
  };

  const accountSuffix = user ? " " + t("payment.accountSuffix").replace("{name}", user.fullName) : ".";

  return (
    <div className="max-w-2xl mx-auto px-5 pt-24 pb-20">
      <Link
        href={user ? "/dashboard" : "/"}
        data-testid="link-back"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6"
      >
        <ArrowLeft size={14} /> {t("common.back")}
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/15 rounded-2xl text-primary">
            <CreditCard size={22} />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold" data-testid="text-page-title">
              {t("payment.pageTitle")}
            </h1>
            <p className="text-sm text-muted-foreground">{t("payment.pageSubtitle")}</p>
          </div>
        </div>

        {isHidden ? (
          <div className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-6 flex items-start gap-3">
            <Info className="text-amber-400 shrink-0 mt-1" size={20} />
            <div className="text-sm text-amber-100/90">
              <p className="font-semibold">{t("payment.confirmOnWa")}</p>
              <p className="mt-1 opacity-80">{t("payment.privateBody")}</p>
              <div className="flex flex-col sm:flex-row gap-2 mt-4">
                {!user && (
                  <Link
                    href="/auth"
                    className="inline-flex items-center justify-center h-10 px-4 rounded-xl bg-white/10 hover:bg-white/15 font-semibold text-sm"
                    data-testid="link-sign-in"
                  >
                    {t("nav.signIn")}
                  </Link>
                )}
                <WhatsAppButton
                  label={t("payment.requestDetails")}
                  message={`${t("payment.requestWaMsg")}${accountSuffix}`}
                  testId="button-request-whatsapp"
                />
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-3xl border border-white/10 bg-card/80 p-6 space-y-5">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-primary" />
                <p className="text-xs uppercase tracking-widest text-primary font-semibold">
                  {t("payment.bankDetails")}
                </p>
              </div>

              <BankRow
                label={t("payment.accountHolder")}
                value={bankName}
                copyKey={t("payment.copyAccountName")}
                copied={copiedField === t("payment.copyAccountName")}
                onCopy={() => copy(t("payment.copyAccountName"), bankName)}
                testId="row-bank-name"
                copyLabel={t("common.copy")}
                copiedLabel={t("common.copied")}
              />
              <BankRow
                label={t("payment.iban")}
                value={iban}
                copyKey={t("payment.copyIban")}
                copied={copiedField === t("payment.copyIban")}
                onCopy={() => copy(t("payment.copyIban"), iban)}
                testId="row-bank-iban"
                mono
                copyLabel={t("common.copy")}
                copiedLabel={t("common.copied")}
              />
              <BankRow
                label={t("payment.bankCountry")}
                value={t("payment.countryUae")}
                testId="row-bank-country"
                copyLabel={t("common.copy")}
                copiedLabel={t("common.copied")}
              />
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
              <div className="flex items-start gap-3">
                <Wallet size={18} className="text-primary shrink-0 mt-0.5" />
                <div className="text-sm text-foreground/90">
                  <p className="font-semibold">{t("payment.afterPayTitle")}</p>
                  <ol className="list-decimal pl-5 mt-2 space-y-1 text-muted-foreground text-[13px] leading-relaxed">
                    <li>{t("payment.afterPayStep1")}</li>
                    <li>{t("payment.afterPayStep2")}</li>
                    <li>{t("payment.afterPayStep3")}</li>
                  </ol>
                </div>
              </div>
              <WhatsAppButton
                label={t("payment.confirmPay")}
                message={`${t("payment.confirmPayMsg")}${accountSuffix} ${t("payment.confirmPayMsgEnd")}`}
                size="lg"
                testId="button-confirm-payment-whatsapp"
              />
            </div>

            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-xs text-muted-foreground leading-relaxed">
              {t("payment.disclaimer")}
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

function BankRow({
  label,
  value,
  copyKey,
  copied,
  onCopy,
  testId,
  mono = false,
  copyLabel,
  copiedLabel,
}: {
  label: string;
  value: string;
  copyKey?: string;
  copied?: boolean;
  onCopy?: () => void;
  testId: string;
  mono?: boolean;
  copyLabel: string;
  copiedLabel: string;
}) {
  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-2"
      data-testid={testId}
    >
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground sm:w-32 shrink-0">
        {label}
      </p>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <p
          className={`flex-1 text-sm break-all ${
            mono ? "font-mono tracking-wider" : "font-medium"
          }`}
        >
          {value}
        </p>
        {copyKey && onCopy && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCopy}
            data-testid={`button-copy-${copyKey.toLowerCase().replace(/\s/g, "-")}`}
            className="h-8 px-2 shrink-0 text-xs"
          >
            {copied ? (
              <CheckCircle2 size={14} className="text-emerald-400" />
            ) : (
              <Copy size={13} />
            )}
            <span className="ml-1.5 hidden sm:inline">{copied ? copiedLabel : copyLabel}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
