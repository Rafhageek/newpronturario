'use client';

import { motion } from 'framer-motion';

/**
 * Transição de rota do app.
 *
 * Por que `template.tsx` e não `layout.tsx`: o template do App Router **remonta
 * a cada navegação** (o layout persiste). Como o nó é novo a cada rota, a
 * animação de entrada dispara sozinha — não precisa de `AnimatePresence` nem de
 * `key` manual, e não existe animação de saída para orquestrar.
 *
 * Movimento: 8px de subida + fade em 240 ms com a curva "emphasized decelerate"
 * do M3 (`easing.enter` = [0.05, 0.7, 0.1, 1] em @hubpatients/ui-tokens).
 * Deslocamento pequeno de propósito: o movimento confirma que a página trocou,
 * sem varrer a tela — movimento periférico é gatilho vestibular (35,4% dos
 * adultos 40+ têm disfunção vestibular, NHANES).
 *
 * `prefers-reduced-motion` já é respeitado globalmente pelo
 * `<MotionConfig reducedMotion="user">` de `components/providers.tsx`: com a
 * preferência ligada, o framer-motion mantém a opacidade e descarta o `y`.
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.05, 0.7, 0.1, 1] }}
    >
      {children}
    </motion.div>
  );
}
