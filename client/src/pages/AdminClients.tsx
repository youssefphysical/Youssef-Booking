import { useState } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Mail, Phone, Search, Target, Notebook, ExternalLink, X } from "lucide-react";
import { useClients } from "@/hooks/use-clients";
import { useBookings } from "@/hooks/use-bookings";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { whatsappUrl } from "@/lib/whatsapp";
import { useSettings } from "@/hooks/use-settings";
import { formatStatus, statusColor } from "@/lib/booking-utils";
import type { UserResponse } from "@shared/schema";
import { SiWhatsapp } from "react-icons/si";

export default function AdminClients() {
  const { data: clients = [], isLoading } = useClients();
  const [q, setQ] = useState("");

  const filtered = clients.filter((c) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      c.fullName.toLowerCase().includes(s) ||
      (c.email || "").toLowerCase().includes(s) ||
      (c.phone || "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="md:pl-64 p-6 pt-20 md:pt-8 min-h-screen">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.25em] text-primary mb-2">Clients</p>
        <h1 className="text-3xl font-display font-bold" data-testid="text-clients-title">
          Clients
        </h1>
        <p className="text-muted-foreground text-sm">{clients.length} registered</p>
      </div>

      <div className="relative mb-6 max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, email, phone..."
          className="pl-9 bg-white/5 border-white/10"
          data-testid="input-search-clients"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center text-muted-foreground">
          {q ? "No clients match your search." : "No clients yet. They'll appear here once they register."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((c) => (
            <ClientCard key={c.id} client={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function ClientCard({ client }: { client: UserResponse }) {
  const { data: settings } = useSettings();

  return (
    <Dialog>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-white/5 bg-card/60 p-5 flex flex-col gap-3"
        data-testid={`client-card-${client.id}`}
      >
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-primary font-bold">
            {client.fullName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate" data-testid={`client-name-${client.id}`}>{client.fullName}</p>
            {client.email && (
              <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5 mt-0.5">
                <Mail size={11} /> {client.email}
              </p>
            )}
            {client.phone && (
              <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5 mt-0.5">
                <Phone size={11} /> {client.phone}
              </p>
            )}
          </div>
        </div>

        {client.fitnessGoal && (
          <p className="text-xs text-amber-200/70 inline-flex items-start gap-1.5 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
            <Target size={12} className="mt-0.5 shrink-0" /> {client.fitnessGoal}
          </p>
        )}

        <div className="flex items-center gap-2 pt-1 mt-auto">
          <DialogTrigger asChild>
            <button
              data-testid={`button-view-client-${client.id}`}
              className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-semibold border border-white/10 hover:bg-white/5"
            >
              View details <ExternalLink size={11} />
            </button>
          </DialogTrigger>
          {client.phone && (
            <a
              href={whatsappUrl(settings?.whatsappNumber || client.phone)}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={`button-whatsapp-${client.id}`}
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[#25D366]/15 text-[#25D366] hover:bg-[#25D366]/25"
              title="WhatsApp this client"
            >
              <SiWhatsapp size={14} />
            </a>
          )}
        </div>
      </motion.div>

      <DialogContent className="bg-card border-white/10 sm:rounded-3xl max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display flex items-center gap-3">
            {client.fullName}
          </DialogTitle>
        </DialogHeader>
        <ClientDetails client={client} />
      </DialogContent>
    </Dialog>
  );
}

function ClientDetails({ client }: { client: UserResponse }) {
  const { data: bookings = [] } = useBookings({ userId: client.id });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Field icon={<Mail size={12} />} label="Email" value={client.email || "—"} />
        <Field icon={<Phone size={12} />} label="Phone" value={client.phone || "—"} />
        <Field
          icon={<Target size={12} />}
          label="Fitness Goal"
          value={client.fitnessGoal || "—"}
          className="col-span-2"
        />
        <Field
          icon={<Notebook size={12} />}
          label="Notes"
          value={client.notes || "—"}
          className="col-span-2"
        />
      </div>

      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Recent Bookings</p>
        {bookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No bookings yet.</p>
        ) : (
          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
            {bookings.slice(0, 20).map((b: any) => (
              <div
                key={b.id}
                className="flex items-center justify-between text-sm p-2.5 rounded-lg bg-white/5"
              >
                <span>
                  {format(new Date(b.date), "MMM d, yyyy")} • {b.timeSlot}
                </span>
                <span
                  className={`text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border ${statusColor(b.status)}`}
                >
                  {formatStatus(b.status)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`p-3 rounded-lg bg-white/5 border border-white/5 ${className ?? ""}`}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
        {icon} {label}
      </p>
      <p className="mt-1 text-sm break-words">{value}</p>
    </div>
  );
}
