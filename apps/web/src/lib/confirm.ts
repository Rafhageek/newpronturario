/**
 * Confirmação para ações destrutivas. Usa o diálogo nativo (acessível por
 * teclado e leitor de tela). Centralizado para, no futuro, virar um modal
 * estilizado sem tocar nos pontos de chamada.
 */
export function confirmAction(message: string): boolean {
  if (typeof window === 'undefined') return false;
  return window.confirm(message);
}
