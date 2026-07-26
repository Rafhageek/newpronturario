export interface SafeFailureContext {
  /** Status HTTP, nunca corpo/resposta do provedor. */
  httpStatus?: number;
  /** Código curto e não sensível, por exemplo ZERO_RESULTS. */
  providerStatus?: string;
  error?: unknown;
}

function safeStatus(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return /^[A-Z0-9_-]{1,40}$/.test(value) ? value : 'INVALID_PROVIDER_STATUS';
}

/**
 * Log estruturado para Edge Functions. Nunca serializa mensagem, stack, corpo de
 * resposta, coordenadas, endereço, CRM, token ou identificadores do paciente.
 */
export function logSafeFailure(
  event: string,
  errorId: string,
  context: SafeFailureContext = {},
): void {
  console.error(
    JSON.stringify({
      event,
      errorId,
      ...(context.httpStatus === undefined ? {} : { httpStatus: context.httpStatus }),
      ...(safeStatus(context.providerStatus) === undefined
        ? {}
        : { providerStatus: safeStatus(context.providerStatus) }),
      ...(context.error === undefined
        ? {}
        : {
            errorType: context.error instanceof Error ? context.error.name : typeof context.error,
          }),
    }),
  );
}
