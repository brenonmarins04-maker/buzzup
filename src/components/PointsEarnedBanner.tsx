import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trophy } from "lucide-react";
import { useData } from "@/contexts/DataContext";

export default function PointsEarnedBanner() {
  const { pointsEarnedNotice, dismissPointsEarnedNotice } = useData();

  useEffect(() => {
    if (pointsEarnedNotice == null) return;
    const t = setTimeout(() => dismissPointsEarnedNotice(), 3000);
    return () => clearTimeout(t);
  }, [pointsEarnedNotice, dismissPointsEarnedNotice]);

  return (
    <AnimatePresence>
      {pointsEarnedNotice != null && (
        <motion.div
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-1.5rem)] max-w-sm px-2"
        >
          <div className="flex items-center gap-3 rounded-2xl bg-primary text-primary-foreground shadow-2xl shadow-primary/30 px-4 py-3">
            <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Trophy className="h-4 w-4" />
            </div>
            <p className="flex-1 text-sm font-medium leading-snug">
              Desde a última vez que entrou por aqui, você ganhou{" "}
              <span className="font-extrabold">{pointsEarnedNotice} ponto{pointsEarnedNotice > 1 ? "s" : ""}</span>! Parabéns! 🎉
            </p>
            <button
              onClick={dismissPointsEarnedNotice}
              className="shrink-0 p-1 rounded-full hover:bg-white/15 transition-colors"
              title="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
