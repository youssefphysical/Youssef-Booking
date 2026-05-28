import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Mail,
  Star,
  Lock,
  Calendar,
  Clock,
  CreditCard,
  AlertTriangle,
  Trophy,
  XCircle,
  RefreshCw,
  AlertCircle,
  Zap,
  Send,
  Eye,
  RotateCcw,
  CheckCircle2,
  Bell,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ─── Types ───────────────────────────────────────────────────────────────────

interface EmailTemplate {
  key: string;
  name: string;
  description: string;
  icon: string;
  defaultSubject: string;
  defaultPreheader: string;
  subject: string | null;
  preheader: string | null;
  lastSentAt: string | null;
  hasBuilder: boolean;
}

// ─── Icon map ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ReactNode> = {
  star: <Star size={18} />,
  lock: <Lock size={18} />,
  mail: <Mail size={18} />,
  calendar: <Calendar size={18} />,
  clock: <Clock size={18} />,
  bell: <Bell size={18} />,
  "credit-card": <CreditCard size={18} />,
  "alert-triangle": <AlertTriangle size={18} />,
  trophy: <Trophy size={18} />,
  "x-circle": <XCircle size={18} />,
  "refresh-cw": <RefreshCw size={18} />,
  "alert-circle": <AlertCircle size={18} />,
  zap: <Zap size={18} />,
};

function TemplateIcon({ icon }: { icon: string }) {
  return (
    <span className="text-primary">{ICON_MAP[icon] ?? <Mail size={18} />}</span>
  );
}

// ─── Side panel / bottom-sheet ────────────────────────────────────────────────

interface TemplatePanelProps {
  template: EmailTemplate;
  onClose: () => void;
  open: boolean;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

function TemplatePanel({ template, onClose, open }: TemplatePanelProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeLoading, setIframeLoading] = useState(true);
  const isMobile = useIsMobile();

  const [subject, setSubject] = useState(template.subject ?? "");
  const [preheader, setPreheader] = useState(template.preheader ?? "");

  useEffect(() => {
    setSubject(template.subject ?? "");
    setPreheader(template.preheader ?? "");
    setIframeLoading(true);
  }, [template.key, template.subject, template.preheader]);

  const saveMutation = useMutation({
    mutationFn: async (data: { subject?: string; preheader?: string }) =>
      apiRequest("PATCH", `/api/admin/emails/${template.key}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/emails"] });
    },
    onError: () => {
      toast({ title: "Save failed", description: "Could not save changes.", variant: "destructive" });
    },
  });

  const testSendMutation = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/admin/emails/${template.key}/test`, {}),
    onSuccess: async (res: any) => {
      const data = await res.json();
      if (data.ok) {
        toast({ title: "Test email sent", description: data.message });
      } else {
        toast({ title: "Send failed", description: data.message, variant: "destructive" });
      }
    },
    onError: async (err: any) => {
      let message = "Failed to send test email.";
      try { message = (await err.json?.())?.message || message; } catch { /* fallback */ }
      toast({ title: "Send failed", description: message, variant: "destructive" });
    },
  });

  function handleBlurSubject() {
    if (subject !== (template.subject ?? "")) {
      saveMutation.mutate({ subject: subject || undefined });
    }
  }

  function handleBlurPreheader() {
    if (preheader !== (template.preheader ?? "")) {
      saveMutation.mutate({ preheader: preheader || undefined });
    }
  }

  function reloadPreview() {
    setIframeLoading(true);
    if (iframeRef.current) {
      const src = iframeRef.current.src;
      iframeRef.current.src = "";
      setTimeout(() => {
        if (iframeRef.current) iframeRef.current.src = src;
      }, 50);
    }
  }

  const previewUrl = `/api/admin/emails/${template.key}/preview`;

  const panelContent = (
    <div className="flex flex-col h-full gap-4 overflow-y-auto">
      {/* Subject + Preheader */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="email-subject" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Subject line
          </Label>
          <Input
            id="email-subject"
            data-testid="input-email-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onBlur={handleBlurSubject}
            placeholder={template.defaultSubject}
            className="bg-black/30 border-white/10 text-sm"
          />
          {!subject && (
            <p className="text-xs text-muted-foreground/60">
              Default: <span className="italic">{template.defaultSubject}</span>
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email-preheader" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Preheader text
          </Label>
          <Input
            id="email-preheader"
            data-testid="input-email-preheader"
            value={preheader}
            onChange={(e) => setPreheader(e.target.value)}
            onBlur={handleBlurPreheader}
            placeholder={template.defaultPreheader}
            className="bg-black/30 border-white/10 text-sm"
          />
          {!preheader && (
            <p className="text-xs text-muted-foreground/60">
              Default: <span className="italic">{template.defaultPreheader}</span>
            </p>
          )}
        </div>

        {/* Metadata row */}
        <div className="flex flex-wrap gap-2 items-center pt-1">
          {saveMutation.isPending && (
            <span className="text-xs text-muted-foreground animate-pulse">Saving…</span>
          )}
          {saveMutation.isSuccess && !saveMutation.isPending && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle2 size={12} /> Saved
            </span>
          )}
          {template.lastSentAt && (
            <span className="text-xs text-muted-foreground">
              Last sent {formatDistanceToNow(new Date(template.lastSentAt), { addSuffix: true })}
            </span>
          )}
          <Badge variant="outline" className="text-[10px] border-white/10">
            {template.hasBuilder ? "Live preview" : "Static preview"}
          </Badge>
        </div>
      </div>

      {/* Preview iframe */}
      <div className="flex-1 rounded-lg overflow-hidden border border-white/[0.07] bg-white min-h-[400px] relative">
        <div className="absolute top-2 right-2 z-10 flex gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={reloadPreview}
            data-testid="button-reload-preview"
            className="h-7 w-7 p-0 bg-black/60 hover:bg-black/80 text-white"
          >
            <RotateCcw size={12} />
          </Button>
        </div>
        {iframeLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white">
            <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={previewUrl}
          title={`Preview: ${template.name}`}
          className="w-full h-full min-h-[400px]"
          style={{ border: "none" }}
          onLoad={() => setIframeLoading(false)}
          sandbox="allow-same-origin"
          data-testid="iframe-email-preview"
        />
      </div>

      {/* Send test button */}
      <Button
        onClick={() => testSendMutation.mutate()}
        disabled={testSendMutation.isPending}
        data-testid="button-send-test-email"
        className="w-full gap-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20"
        variant="ghost"
      >
        {testSendMutation.isPending ? (
          <span className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        ) : (
          <Send size={15} />
        )}
        Send test email to my inbox
      </Button>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "bg-card p-0 flex flex-col",
          isMobile
            ? "w-full border-t border-white/[0.07] max-h-[90dvh] rounded-t-2xl"
            : "w-full sm:max-w-xl md:max-w-2xl border-l border-white/[0.07]",
        )}
        data-testid="panel-template-detail"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-white/[0.07] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <TemplateIcon icon={template.icon} />
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-base font-semibold leading-tight">{template.name}</SheetTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
            </div>
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {panelContent}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Template card ─────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onClick,
}: {
  template: EmailTemplate;
  onClick: () => void;
}) {
  const hasOverrides = !!(template.subject || template.preheader);

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`card-email-template-${template.key}`}
      className={cn(
        "relative w-full text-left rounded-xl border bg-card/50 p-4 transition-all duration-150 group",
        "hover:border-primary/30 hover:bg-primary/[0.04] hover:shadow-[0_0_0_1px_hsla(183,100%,74%,0.1)]",
        "border-white/[0.07] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-primary/15 transition-colors">
          <TemplateIcon icon={template.icon} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{template.name}</span>
            {hasOverrides && (
              <Badge className="text-[9px] h-4 px-1.5 bg-primary/15 text-primary border-primary/20 border">
                Customised
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{template.description}</p>
        </div>
        <Eye size={14} className="shrink-0 text-muted-foreground/40 group-hover:text-primary/60 transition-colors mt-1" />
      </div>

      {/* Subject preview */}
      <div className="mt-3 pt-3 border-t border-white/[0.05]">
        <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider mb-1">Subject</p>
        <p className="text-xs text-muted-foreground truncate">
          {template.subject || <span className="italic opacity-60">{template.defaultSubject}</span>}
        </p>
      </div>

      {/* Last sent */}
      {template.lastSentAt && (
        <div className="mt-2">
          <p className="text-[10px] text-muted-foreground/50">
            Last sent {formatDistanceToNow(new Date(template.lastSentAt), { addSuffix: true })}
          </p>
        </div>
      )}
    </button>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function AdminEmails() {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const { data: templates = [], isLoading, error } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/admin/emails"],
  });

  const selected = templates.find((t) => t.key === selectedKey) ?? null;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-7 w-48 bg-white/[0.05] rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-36 rounded-xl bg-white/[0.03] animate-pulse border border-white/[0.05]" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load email templates. Please refresh.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Mail size={20} className="text-primary" />
            Email Templates
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Preview and customise subject lines and preheader text for every transactional email.
          </p>
        </div>
      </div>

      {/* Template grid */}
      {templates.length === 0 ? (
        <div className="rounded-xl border border-white/[0.07] bg-card/40 p-10 text-center">
          <Mail size={32} className="mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No templates found.</p>
        </div>
      ) : (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3"
          data-testid="grid-email-templates"
        >
          {templates.map((tmpl) => (
            <TemplateCard
              key={tmpl.key}
              template={tmpl}
              onClick={() => setSelectedKey(tmpl.key)}
            />
          ))}
        </div>
      )}

      {/* Side panel */}
      {selected && (
        <TemplatePanel
          key={selected.key}
          template={selected}
          open={!!selectedKey}
          onClose={() => setSelectedKey(null)}
        />
      )}
    </div>
  );
}
