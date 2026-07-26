import { render, screen, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorFallback } from '@/components/error-fallback';

// Silencia o logger.error (o ErrorFallback registra o erro no mount) p/ não poluir a saída.
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn() } }));

const renderFallback = (retry: () => void) =>
  // render() é async no RTL v14 — devolve a Promise p/ os testes aguardarem.
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 0, height: 0 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <ErrorFallback error={new Error('boom')} retry={retry} />
    </SafeAreaProvider>,
  );

describe('ErrorFallback', () => {
  it('mostra a mensagem amigável e o botão de retry', async () => {
    await renderFallback(jest.fn());

    expect(screen.getByText('Algo deu errado')).toBeTruthy();
    expect(screen.getByText('Tentar de novo')).toBeTruthy();
  });

  it('chama retry ao tocar no botão', async () => {
    const retry = jest.fn();
    await renderFallback(retry);

    fireEvent.press(screen.getByLabelText('Tentar de novo'));

    expect(retry).toHaveBeenCalledTimes(1);
  });
});
