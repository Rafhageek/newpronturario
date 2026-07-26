import { toast } from '@/components/toast';

// Semente do emissor de toast (a nível de módulo): toast.success/error/info não
// devem lançar mesmo sem o <ToastHost/> montado (haptics está mockado no setup).
describe('toast emitter', () => {
  it('não lança ao emitir success/error/info', () => {
    expect(() => toast.success('Salvo!')).not.toThrow();
    expect(() => toast.error('Falhou')).not.toThrow();
    expect(() => toast.info('Aviso')).not.toThrow();
  });
});
