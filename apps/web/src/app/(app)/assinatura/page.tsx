import { CreditCard } from 'lucide-react';
import { ComingSoon } from '@/components/app/coming-soon';

export default function AssinaturaPage() {
  return (
    <ComingSoon
      icon={CreditCard}
      title="Assinatura"
      description="Gerencie seu plano e forma de pagamento (cartão ou Pix). As features de segurança são sempre gratuitas."
      phase={2}
    />
  );
}
