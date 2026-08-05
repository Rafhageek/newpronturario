'use client';

import { QrCode } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui';

/**
 * Situação da consulta de alergias que alimenta o cartão.
 * - `ok`: a lista chegou do servidor e pode ser afirmada;
 * - `carregando`: ainda não chegou;
 * - `erro`: a busca falhou.
 */
export type AllergiesStatus = 'ok' | 'carregando' | 'erro';

export function EmergencyQrModal({
  open,
  onClose,
  name,
  bloodType,
  allergies,
  allergiesStatus,
  onRetry,
  retrying,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  bloodType?: string | null;
  /** Alergias graves confirmadas. Só é lida quando `allergiesStatus === 'ok'`. */
  allergies: string[];
  allergiesStatus: AllergiesStatus;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  /*
   * O cartão só é montado com a lista de alergias confirmada.
   *
   * Quem lê este cartão é socorrista, e a linha "Alergias graves" é lida como
   * afirmação. Se a consulta falhou (ou ainda não voltou), a lista chega vazia
   * — e vazio aqui viraria "Nenhuma", ou seja, o app afirmaria ausência de
   * alergia grave sem nunca ter recebido esse dado. Preferimos não entregar
   * cartão nenhum a entregar um cartão que pode estar mentindo.
   */
  const confirmado = allergiesStatus === 'ok';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cartão de Emergência"
      description="Acesso rápido a dados vitais (gratuito, sempre)."
      className="max-w-sm"
    >
      {confirmado ? (
        <>
          <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-2xl border-2 border-dashed border-line bg-surface-2">
            <QrCode className="h-20 w-20 text-muted" />
          </div>
          <p className="mt-2 text-center text-[11px] text-muted">QR público chega na Fase 5</p>

          <div className="mt-5 space-y-1.5 rounded-xl border border-line bg-surface p-4 text-left text-sm">
            <Row label="Nome" value={name} />
            <Row label="Tipo sanguíneo" value={bloodType && bloodType !== 'unknown' ? bloodType : '—'} />
            <Row
              label="Alergias graves"
              value={allergies.length ? allergies.join(', ') : 'Nenhuma'}
              alert={allergies.length > 0}
            />
          </div>
        </>
      ) : (
        <div className="space-y-3">
          {/* Tom de alerta aqui é do SISTEMA (a busca falhou), não do corpo de ninguém. */}
          <Alert
            tone={allergiesStatus === 'erro' ? 'danger' : 'info'}
            title={
              allergiesStatus === 'erro'
                ? 'Não foi possível carregar suas alergias'
                : 'Carregando suas alergias…'
            }
          >
            <p className="mt-1">
              {allergiesStatus === 'erro'
                ? 'O cartão não é gerado sem essa lista. Sem ela, o cartão diria “Alergias graves: Nenhuma” — uma informação que ninguém conferiu e que um socorrista leria como verdade.'
                : 'O cartão aparece assim que a lista de alergias terminar de carregar.'}
            </p>
          </Alert>
          {allergiesStatus === 'erro' && onRetry && (
            <Button onClick={onRetry} loading={retrying} className="w-full">
              Tentar de novo
            </Button>
          )}
        </div>
      )}
    </Modal>
  );
}

function Row({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className={`text-right font-medium ${alert ? 'text-rose-700 dark:text-rose-300' : 'text-fg'}`}>{value}</span>
    </div>
  );
}
