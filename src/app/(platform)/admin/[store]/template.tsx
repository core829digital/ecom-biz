"use client";

import { motion, useReducedMotion } from "framer-motion";

/** Subtle enter transition on every admin navigation. */
export default function Template({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}>
      {children}
    </motion.div>
  );
}
