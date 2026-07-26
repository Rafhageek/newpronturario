import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Badge } from '@/components/ui';

// Semente: garante que o harness renderiza um componente do design-system (@/components/ui)
// e que o texto passado aparece na árvore.
describe('Badge', () => {
  it('renderiza o texto recebido', async () => {
    await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 0, height: 0 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <Badge tone="ok">Em dia</Badge>
      </SafeAreaProvider>,
    );

    expect(screen.getByText('Em dia')).toBeTruthy();
  });
});
