'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

/**
 * Block-level reveal: a completed block resolves out of a soft blur — the same gesture as the
 * wordmark. Under reduced motion it simply fades.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, filter: 'blur(10px)', y: 10 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, filter: 'blur(0px)', y: 0 }}
      transition={{ duration: reduce ? 0.2 : 0.6, delay, ease: [0.23, 1, 0.32, 1] }}
    >
      {children}
    </motion.div>
  );
}
