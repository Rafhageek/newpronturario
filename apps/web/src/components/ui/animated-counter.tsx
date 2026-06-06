'use client';

import { useEffect } from 'react';
import { animate, useMotionValue, useTransform, motion } from 'framer-motion';

/** Conta de 0 até `value` com easing (Framer Motion). */
export function AnimatedCounter({
  value,
  decimals = 0,
  className,
}: {
  value: number;
  decimals?: number;
  className?: string;
}) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) =>
    v.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }),
  );

  useEffect(() => {
    const controls = animate(count, value, { duration: 0.9, ease: 'easeOut' });
    return controls.stop;
  }, [count, value]);

  return <motion.span className={className}>{rounded}</motion.span>;
}
