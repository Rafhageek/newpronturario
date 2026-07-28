import { onlyDigits } from './br';

/**
 * Busca de endereço por CEP (ViaCEP).
 *
 * Por que ViaCEP: é público, gratuito, sem cadastro nem chave, e é o padrão de
 * fato em formulário brasileiro. Sem chave = nada de segredo para vazar, e
 * funciona igual em web e mobile.
 *
 * PRIVACIDADE: sai deste app apenas o CEP — nunca nome, CPF ou qualquer dado
 * de saúde. Um CEP sozinho não identifica ninguém (é a quadra, não a casa).
 *
 * Nunca lança: falha de rede, CEP inexistente ou resposta estranha devolvem
 * `null`. Preencher endereço é conveniência; se não der, a pessoa digita à mão
 * e o cadastro segue. Travar um formulário de saúde por causa de um serviço
 * externo fora do ar seria trocar um problema pequeno por um grande.
 */
export interface CepAddress {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

interface ViaCepResponse {
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean | string;
}

/** Milissegundos até desistir da consulta. */
const TIMEOUT_MS = 6000;

export async function lookupCep(cep: string): Promise<CepAddress | null> {
  const digits = onlyDigits(cep);
  if (digits.length !== 8) return null;

  // AbortController: sem isso, rede ruim deixaria o campo "buscando" para sempre.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ViaCepResponse;
    // CEP inexistente devolve 200 com `{ "erro": true }` — não é erro de HTTP.
    if (data.erro) return null;
    const found = {
      street: data.logradouro?.trim() ?? '',
      neighborhood: data.bairro?.trim() ?? '',
      city: data.localidade?.trim() ?? '',
      state: data.uf?.trim() ?? '',
    };
    // Resposta sem cidade não serve para nada: trata como não encontrado.
    return found.city ? found : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
