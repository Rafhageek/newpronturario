import { useEffect, useRef, useState } from 'react';
import { dateBRToIso, isoToDateBR, maskDateBR } from '@hubpatients/core';
import { Input } from './ui';

/**
 * Campo de data no padrão brasileiro (DD/MM/AAAA).
 *
 * A pessoa SEMPRE lê e escreve DD/MM/AAAA; o resto do app continua trabalhando
 * em ISO (AAAA-MM-DD), que é o formato do banco. A tradução acontece aqui, num
 * lugar só — por isso cada tela muda pouco e todas se comportam igual.
 *
 * Por que existe: os formulários pediam AAAA-MM-DD, formato de banco exposto ao
 * usuário. Além de estranho para quem digita, é ambíguo: "05/03" é março para
 * uma pessoa e maio para o computador.
 *
 * `onChangeIso` recebe '' enquanto a data está incompleta OU não existe de
 * fato (31/02, 29/02 fora de bissexto). Assim a tela nunca salva data
 * inventada — e o aviso `Data inválida` aparece só depois de 8 dígitos, para
 * não acusar erro enquanto a pessoa ainda está digitando.
 */
export function DateInputBR({
  label,
  value,
  onChangeIso,
  placeholder = 'DD/MM/AAAA',
  error,
}: {
  label: string;
  /** Data em ISO (AAAA-MM-DD) ou '' — o mesmo estado que a tela já tinha. */
  value: string;
  onChangeIso: (iso: string) => void;
  placeholder?: string;
  error?: string;
}) {
  const [texto, setTexto] = useState(() => isoToDateBR(value));
  // Guarda o último ISO que ESTE campo emitiu, para distinguir "o pai mudou o
  // valor" de "o pai só devolveu o que acabei de mandar". Sem isso, o
  // componente reescreveria o texto no meio da digitação.
  const ultimoEmitido = useRef(value);

  useEffect(() => {
    if (value === ultimoEmitido.current) return;
    ultimoEmitido.current = value;
    setTexto(isoToDateBR(value));
  }, [value]);

  // Só acusa erro com os 8 dígitos preenchidos: reclamar enquanto a pessoa
  // ainda está digitando é ruído, não ajuda.
  const invalida = texto.length === 10 && dateBRToIso(texto) === null;

  return (
    <Input
      label={label}
      value={texto}
      onChangeText={(t) => {
        const masked = maskDateBR(t);
        setTexto(masked);
        const iso = dateBRToIso(masked) ?? '';
        ultimoEmitido.current = iso;
        onChangeIso(iso);
      }}
      keyboardType="number-pad"
      placeholder={placeholder}
      maxLength={10}
      error={error ?? (invalida ? 'Data inválida.' : undefined)}
    />
  );
}
