import { useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { useCreateBooking } from "@/hooks/use-bookings";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Calendar as CalendarIcon, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const TIME_SLOTS = [
  "06:00", "07:00", "08:00", "09:00", "10:00", 
  "16:00", "17:00", "18:00", "19:00", "20:00"
];

export default function BookingPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const { user } = useAuth();
  const createBooking = useCreateBooking();

  const handleBook = () => {
    if (!date || !selectedSlot || !user) return;
    
    createBooking.mutate({
      userId: user.id,
      date: format(date, 'yyyy-MM-dd'),
      timeSlot: selectedSlot,
      notes: ""
    }, {
      onSuccess: () => {
        setIsConfirmOpen(false);
        setSelectedSlot(null);
      }
    });
  };

  return (
    <div className="pb-24 px-6 pt-10 md:pt-16 max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-primary/10 rounded-2xl text-primary">
          <CalendarIcon size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold">Book Session</h1>
          <p className="text-muted-foreground">Select date and time</p>
        </div>
      </div>

      <div className="space-y-8">
        {/* Calendar Card */}
        <div className="bg-card border border-white/5 rounded-3xl p-4 shadow-xl flex justify-center">
          <DayPicker
            mode="single"
            selected={date}
            onSelect={setDate}
            className="p-3"
            modifiersClassNames={{
              selected: "bg-primary text-primary-foreground font-bold hover:bg-primary/90 rounded-full",
              today: "text-primary font-bold"
            }}
            styles={{
              head_cell: { color: "hsl(var(--muted-foreground))" },
              caption: { color: "hsl(var(--primary))" }
            }}
          />
        </div>

        {/* Time Slots */}
        {date && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <Clock size={18} className="text-primary" />
              Available Slots for {format(date, 'MMM d')}
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {TIME_SLOTS.map((slot) => (
                <button
                  key={slot}
                  onClick={() => setSelectedSlot(slot)}
                  className={`
                    py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200
                    border border-white/5
                    ${selectedSlot === slot 
                      ? "bg-primary text-black shadow-lg shadow-primary/20 scale-105 border-primary" 
                      : "bg-white/5 hover:bg-white/10 hover:border-white/20"}
                  `}
                >
                  {slot}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Floating Action Button for Confirmation */}
      <AnimatePresence>
        {selectedSlot && date && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-24 left-0 right-0 px-6 z-40 md:static md:mt-10 md:px-0"
          >
            <div className="max-w-2xl mx-auto">
              <Button 
                onClick={() => setIsConfirmOpen(true)}
                className="w-full h-14 text-lg font-bold rounded-2xl shadow-2xl shadow-primary/20"
              >
                Confirm Booking
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="bg-card border-white/10 sm:rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-display">Confirm Session</DialogTitle>
            <DialogDescription>
              You are about to book a training session.
            </DialogDescription>
          </DialogHeader>
          
          <div className="bg-white/5 p-4 rounded-xl space-y-2 my-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium">{date && format(date, 'PPPP')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Time</span>
              <span className="font-medium text-primary">{selectedSlot}</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsConfirmOpen(false)}>Cancel</Button>
            <Button onClick={handleBook} disabled={createBooking.isPending}>
              {createBooking.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Book Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
