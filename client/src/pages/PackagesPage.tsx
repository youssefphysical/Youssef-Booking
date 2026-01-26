import { usePackages } from "@/hooks/use-packages";
import { useCreatePayment } from "@/hooks/use-payments";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { Check, Upload, Loader2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Package } from "@shared/schema";

export default function PackagesPage() {
  const { data: packages, isLoading } = usePackages();
  const [selectedPkg, setSelectedPkg] = useState<Package | null>(null);

  return (
    <div className="pb-24 px-6 pt-10 md:pt-16 max-w-5xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-display font-bold mb-4">Choose Your Plan</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Invest in yourself with our premium training packages. Flexible options for every goal.
        </p>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-3 gap-6">
          {[1,2,3].map(i => <div key={i} className="h-96 bg-white/5 animate-pulse rounded-3xl" />)}
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          {packages?.map((pkg, idx) => (
            <PackageCard 
              key={pkg.id} 
              pkg={pkg} 
              delay={idx * 0.1}
              onSelect={() => setSelectedPkg(pkg)}
            />
          ))}
        </div>
      )}

      <PaymentModal 
        pkg={selectedPkg} 
        open={!!selectedPkg} 
        onClose={() => setSelectedPkg(null)} 
      />
    </div>
  );
}

function PackageCard({ pkg, delay, onSelect }: { pkg: Package, delay: number, onSelect: () => void }) {
  const isPremium = pkg.tier === 'platinum' || pkg.tier === 'gold';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`
        relative p-8 rounded-3xl border flex flex-col
        ${isPremium ? 'bg-gradient-to-b from-white/10 to-card border-primary/30 shadow-2xl shadow-primary/10' : 'bg-card border-white/10'}
      `}
    >
      {isPremium && (
        <div className="absolute top-0 right-0 bg-primary text-black text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-2xl">
          POPULAR
        </div>
      )}
      
      <h3 className="text-xl font-bold font-display">{pkg.name}</h3>
      <div className="mt-4 mb-6">
        <span className="text-4xl font-bold font-display">{Number(pkg.price)}</span>
        <span className="text-muted-foreground ml-2">AED</span>
      </div>

      <div className="space-y-3 mb-8 flex-1">
        <div className="flex items-center gap-3">
          <div className="p-1 rounded-full bg-primary/20 text-primary"><Check size={12} /></div>
          <span className="text-sm">{pkg.sessionCount} Sessions</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="p-1 rounded-full bg-primary/20 text-primary"><Check size={12} /></div>
          <span className="text-sm">Nutrition Plan Included</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="p-1 rounded-full bg-primary/20 text-primary"><Check size={12} /></div>
          <span className="text-sm">24/7 Support</span>
        </div>
      </div>

      <Button 
        onClick={onSelect}
        className={`w-full h-12 rounded-xl font-bold ${isPremium ? 'bg-primary text-black' : 'bg-white/10 hover:bg-white/20'}`}
      >
        Select Plan
      </Button>
    </motion.div>
  );
}

function PaymentModal({ pkg, open, onClose }: { pkg: Package | null, open: boolean, onClose: () => void }) {
  const { user } = useAuth();
  const createPayment = useCreatePayment();
  const [imageUrl, setImageUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !pkg || !imageUrl) return;

    createPayment.mutate({
      userId: user.id,
      packageId: pkg.id,
      amount: Number(pkg.price),
      receiptUrl: imageUrl
    }, {
      onSuccess: () => onClose()
    });
  };

  // Mock upload since we don't have a real file server in this demo context
  // In a real app, this would upload to S3/Cloudinary first
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      // Create a fake URL for demo
      setImageUrl("https://example.com/receipt.jpg"); 
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-white/10 sm:rounded-3xl max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Payment</DialogTitle>
          <DialogDescription>Upload your bank transfer receipt to activate.</DialogDescription>
        </DialogHeader>

        <div className="bg-white/5 p-4 rounded-xl border border-white/5 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <CreditCard className="text-primary" />
            <span className="font-bold">Bank Transfer Details</span>
          </div>
          <div className="text-sm text-muted-foreground space-y-1 font-mono">
            <p>Bank: Emirates NBD</p>
            <p>IBAN: AE12 3456 7890 1234 5678</p>
            <p>Account Name: Youssef Fitness LLC</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Amount</Label>
            <Input disabled value={`${pkg?.price} AED`} className="bg-black/20" />
          </div>

          <div className="space-y-2">
            <Label>Upload Receipt</Label>
            <div className="border-2 border-dashed border-white/10 rounded-xl p-6 flex flex-col items-center justify-center hover:bg-white/5 transition-colors cursor-pointer relative">
              <Input 
                type="file" 
                accept="image/*" 
                className="absolute inset-0 opacity-0 cursor-pointer" 
                onChange={handleFileChange}
              />
              <Upload className="mb-2 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {imageUrl ? "File selected" : "Click to upload image"}
              </span>
            </div>
          </div>

          <Button type="submit" className="w-full h-12" disabled={createPayment.isPending || !imageUrl}>
            {createPayment.isPending && <Loader2 className="mr-2 animate-spin" />}
            Submit Payment
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
