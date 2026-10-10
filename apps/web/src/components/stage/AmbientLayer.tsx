'use client';

import { motion } from 'motion/react';
import dynamic from 'next/dynamic';
import Noise from '@/components/vendor/react-bits/Noise';
import { useIsDesktop, usePrefersReducedMotion } from '@/lib/hooks';

const Threads = dynamic(() => import('@/components/vendor/react-bits/Threads'), { ssr: false });

interface AmbientLayerProps {
  /** 0–1, from `ambientLevel()`; the threads brighten while listening or thinking. */
  level: number;
  /** Speeds the threads slightly while an answer is being composed. */
  active: boolean;
}

/**
 * The stage's one ambient layer: slow ivory-to-ember threads across the lower third, under a
 * fixed film grain. Static (a single rendered frame) below 1024px and under reduced motion.
 */
export function AmbientLayer({ level, active }: AmbientLayerProps) {
  const desktop = useIsDesktop();
  const reduce = usePrefersReducedMotion();
  const still = !desktop || reduce;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <motion.div
        className="absolute inset-x-[-10%] top-[46%] h-[64%] [mask-image:radial-gradient(70%_60%_at_50%_45%,#000_30%,transparent_78%)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: level }}
        transition={{ duration: 1.4, ease: [0.23, 1, 0.32, 1] }}
      >
        {/* WebGL can't read CSS variables: these are --ivory-1 and --ember-0, literally. */}
        <Threads
          color="#cfc6b8"
          accentColor="#e3a857"
          lineCount={desktop ? 54 : 32}
          amplitude={1.15}
          distance={0.22}
          thickness={0.55}
          softness={1.25}
          speed={active ? 0.42 : 0.24}
          waves={0.9}
          angle={-7}
          taper={0.9}
          brightness={1.05}
          fade={0.32}
          seed={3}
          paused={still}
        />
      </motion.div>
      <Noise fixed opacity={0.05} fps={reduce ? 0 : 12} blendMode="screen" contrast={0.7} />
    </div>
  );
}
