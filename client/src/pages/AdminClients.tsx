import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Mail, Phone, MapPin, Search, Target, ExternalLink } from "lucide-react";
import { useClients } from "@/hooks/use-clients";
import { Input } from "@/components/ui/input";
import { whatsappUrl } from "@/lib/whatsapp";
import { useSettings } from "@/hooks/use-settings";
import type { UserResponse } from "@shared/schema";
import { SiWhatsapp } from "react-icons/si";
import { UserAvatar } from "@/components/UserAvatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";

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
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/5 bg-card/60 p-5 flex flex-col gap-3"
      data-testid={`client-card-${client.id}`}
    >
      <div className="flex items-start gap-3">
        <UserAvatar
          src={client.profilePictureUrl}
          name={client.fullName}
          size={48}
          testId={`img-client-avatar-${client.id}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <p
              className="font-semibold truncate"
              data-testid={`client-name-${client.id}`}
            >
              {client.fullName}
            </p>
            {client.isVerified && (
              <VerifiedBadge size="xs" testId={`badge-verified-${client.id}`} />
            )}
          </div>
          {client.email && (
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5 mt-0.5">
              <Mail size={11} />
              <span className="truncate">{client.email}</span>
            </p>
          )}
          {client.phone && (
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5 mt-0.5">
              <Phone size={11} /> {client.phone}
            </p>
          )}
          {client.area && (
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5 mt-0.5">
              <MapPin size={11} /> {client.area}
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
        <Link
          href={`/admin/clients/${client.id}`}
          data-testid={`link-view-client-${client.id}`}
          className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-semibold border border-white/10 hover:bg-white/5 whitespace-nowrap"
        >
          Open profile <ExternalLink size={11} />
        </Link>
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
  );
}
