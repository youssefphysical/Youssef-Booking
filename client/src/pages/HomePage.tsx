import { useAuth } from "@/hooks/use-auth";
import { useBookings } from "@/hooks/use-bookings";
import { format } from "date-fns";
import { Calendar, ArrowRight, Activity, Zap } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Loader } from "@/components/Loader";

export default function HomePage() {
  const { user } = useAuth();
  const { data: bookings, isLoading } = useBookings(user?.id);

  if (!user) return null;

  const nextBooking = bookings?.filter(b => b.status === 'booked')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

  const sessionsLeft = user.sessionsRemaining || 0;
  const progressPercent = Math.min(100, (sessionsLeft / 20) * 100); // Assuming 20 is standard max for visualization

  return (
    <div className="pb-24 px-6 pt-12 md:pt-16 max-w-4xl mx-auto">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl md:text-4xl font-display font-bold">
          Good Morning, <br />
          <span className="text-primary">{user.fullName.split(' ')[0]}</span>
        </h1>
        <p className="text-muted-foreground mt-2">Ready to crush your goals today?</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Next Session Card */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-card to-card/50 border border-white/5 p-6 rounded-3xl shadow-xl relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-primary/20 transition-all duration-500" />
          
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-white/5 rounded-2xl">
                <Calendar className="text-primary" size={24} />
              </div>
              <Link href="/book" className="text-xs font-semibold bg-white/5 px-3 py-1.5 rounded-full hover:bg-primary hover:text-black transition-colors">
                Book Now
              </Link>
            </div>
            
            <h3 className="text-lg text-muted-foreground font-medium mb-1">Next Session</h3>
            {isLoading ? (
              <div className="h-8 w-32 bg-white/5 animate-pulse rounded" />
            ) : nextBooking ? (
              <div>
                <p className="text-2xl font-bold text-white">
                  {format(new Date(nextBooking.date), 'EEEE, MMM d')}
                </p>
                <p className="text-primary font-mono mt-1 text-lg">
                  {nextBooking.timeSlot}
                </p>
              </div>
            ) : (
              <p className="text-xl font-bold text-white">No upcoming sessions</p>
            )}
          </div>
        </motion.div>

        {/* Sessions Remaining Card */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-white/5 p-6 rounded-3xl shadow-xl flex items-center justify-between relative overflow-hidden"
        >
          <div>
            <h3 className="text-lg text-muted-foreground font-medium mb-1">Sessions Left</h3>
            <p className="text-4xl font-display font-bold text-white">{sessionsLeft}</p>
            <Link href="/packages" className="inline-flex items-center text-primary text-sm mt-2 hover:underline">
              Top up <ArrowRight size={14} className="ml-1" />
            </Link>
          </div>
          
          <div className="relative w-24 h-24 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white/5" />
              <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-primary" 
                strokeDasharray={251.2} strokeDashoffset={251.2 - (251.2 * progressPercent) / 100} strokeLinecap="round" 
              />
            </svg>
            <Activity className="absolute text-white/50" size={24} />
          </div>
        </motion.div>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-4">
          <Link href="/nutrition">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="bg-white/5 p-5 rounded-2xl border border-white/5 hover:border-primary/50 transition-colors cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center mb-3">
                <Activity className="text-green-500" size={20} />
              </div>
              <h3 className="font-bold">Log Meal</h3>
              <p className="text-xs text-muted-foreground">Track your macros</p>
            </motion.div>
          </Link>
          <Link href="/packages">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="bg-white/5 p-5 rounded-2xl border border-white/5 hover:border-primary/50 transition-colors cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center mb-3">
                <Zap className="text-primary" size={20} />
              </div>
              <h3 className="font-bold">Upgrade</h3>
              <p className="text-xs text-muted-foreground">Get more sessions</p>
            </motion.div>
          </Link>
        </div>
      </div>
    </div>
  );
}
