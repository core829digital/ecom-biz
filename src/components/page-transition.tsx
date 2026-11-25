"use client";

import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Content of a page settles in when the route changes: a short rise and un-blur, no exit
 * animation (the new page appears as soon as it is ready, never delayed by the old one).
 */
const FULL_SCREEN = [/\/online-store\/theme$/];

export function PageTransition({ children, className }: { children: React.ReactNode; className?: string }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  // Full-screen tools (site editor) render fixed over everything: no transform around them at all.
  if (FULL_SCREEN.some((r) => r.test(pathname))) return <div className={className}>{children}</div>;
  return (
    <motion.div
      key={pathname}
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, filter: "blur(3px)" }}
      // Clear transform/filter afterwards: if they stayed set, fixed-position children (site editor,
      // dialogs, pickers) would be positioned inside this box instead of the viewport.
      animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { transform: "none", filter: "none" } }}
      transition={{ duration: reduce ? 0.15 : 0.38, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
