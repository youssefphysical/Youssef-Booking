import { motion } from "framer-motion";

export function Loader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh] w-full">
      <div className="relative w-16 h-16">
        <motion.span
          className="absolute inset-0 border-4 border-primary/20 rounded-full"
        />
        <motion.span
          className="absolute inset-0 border-4 border-t-primary rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </div>
    </div>
  );
}
