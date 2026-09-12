'use client';

import { useState, useTransition } from 'react';
import { Botao } from '@/componentes/Botao';
import { CLASSE_ENTRADA } from '@/componentes/Campo';
import {
  aprovarLoteAction,
  cancelarLoteAction,
  desfazerAprovacaoAction,
} from '@/servidor/lotes/acoes';

type ComMotivo = 'cancelar' | 'desfazer';

const TEXTOS: Record<ComMotivo, { botao: string; titulo: string; confirmar: string }> = {
  cancelar: {
    botao: 'Cancelar lote',
    titulo:
      'Cancelar devolve a comissão deste lote para "disponível". O documento continua existindo, marcado como cancelado.',
    confirmar: 'Confirmar cancelamento',
  },
  desfazer: {
    botao: 'Desfazer aprovação',
    titulo:
      'O lote volta para "aguardando conferência". Use se a aprovação foi por engano.',
    confirmar: 'Confirmar',
  },
};

export function AcoesLote({
  loteId,
  estadoConferencia,
}: {
  loteId: string;
  estadoConferencia: string;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<ComMotivo | null>(null);
  const [motivo, setMotivo] = useState('');
  const [pendente, iniciarTransicao] = useTransition();

  function executar(promessa: Promise<{ erro: string | null }>) {
    iniciarTransicao(async () => {
      const resultado = await promessa;
      setErro(resultado.erro);
      if (!resultado.erro) {
        setAberto(null);
        setMotivo('');
      }
    });
  }

  if (aberto) {
    const texto = TEXTOS[aberto];
    return (
      <div className="flex max-w-md flex-col gap-3 rounded-xl border border-borda bg-superficie p-4">
        <p className="text-[13px] text-texto-2">{texto.titulo}</p>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-texto-2">Motivo</span>
          <input
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
            className={CLASSE_ENTRADA}
          />
        </label>
        {erro && (
          <p role="alert" className="text-[13px] text-erro">
            {erro}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Botao
            type="button"
            variante={aberto === 'cancelar' ? 'destrutivo' : 'primario'}
            carregando={pendente}
            disabled={motivo.trim() === ''}
            onClick={() =>
              executar(
                aberto === 'cancelar'
                  ? cancelarLoteAction(loteId, motivo)
                  : desfazerAprovacaoAction(loteId, motivo),
              )
            }
          >
            {texto.confirmar}
          </Botao>
          <Botao
            type="button"
            variante="secundario"
            onClick={() => {
              setAberto(null);
              setErro(null);
              setMotivo('');
            }}
          >
            Voltar
          </Botao>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {estadoConferencia === 'enviado' && (
          <>
            <Botao
              type="button"
              carregando={pendente}
              onClick={() => executar(aprovarLoteAction(loteId))}
            >
              Marcar como aprovado pelo financeiro
            </Botao>
            <Botao type="button" variante="destrutivo" onClick={() => setAberto('cancelar')}>
              {TEXTOS.cancelar.botao}
            </Botao>
          </>
        )}
        {estadoConferencia === 'aprovado' && (
          <Botao type="button" variante="secundario" onClick={() => setAberto('desfazer')}>
            {TEXTOS.desfazer.botao}
          </Botao>
        )}
      </div>
      {erro && (
        <p role="alert" className="text-[13px] text-erro">
          {erro}
        </p>
      )}
    </div>
  );
}
