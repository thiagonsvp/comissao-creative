'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Botao } from '@/componentes/Botao';
import { CLASSE_ENTRADA } from '@/componentes/Campo';
import { hojeNegocio } from '@/dominio/datas';
import {
  aprovarLoteAction,
  cancelarLoteAction,
  desfazerAprovacaoAction,
  editarDatasLoteAction,
  excluirLoteAction,
} from '@/servidor/lotes/acoes';

type AcaoAberta = 'aprovar' | 'cancelar' | 'desfazer' | 'editarDatas' | 'excluir';
type ComMotivo = Extract<AcaoAberta, 'cancelar' | 'desfazer'>;

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
  dataEnvioInicial,
  dataAprovacaoInicial,
}: {
  loteId: string;
  estadoConferencia: string;
  dataEnvioInicial: string;
  dataAprovacaoInicial: string | null;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<AcaoAberta | null>(null);
  const [motivo, setMotivo] = useState('');
  const [dataEnvio, setDataEnvio] = useState(dataEnvioInicial);
  const [dataAprovacao, setDataAprovacao] = useState(dataAprovacaoInicial ?? hojeNegocio());
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

  if (aberto === 'aprovar') {
    return (
      <div className="flex max-w-md flex-col gap-3 rounded-xl border border-borda bg-superficie p-4">
        <p className="text-[13px] text-texto-2">
          Informe a data em que o lote foi aprovado pelo financeiro.
        </p>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-texto-2">Data da aprovação</span>
          <input
            type="date"
            value={dataAprovacao}
            max={hojeNegocio()}
            onChange={(evento) => setDataAprovacao(evento.target.value)}
            className={CLASSE_ENTRADA}
          />
        </label>
        {erro && <p role="alert" className="text-[13px] text-erro">{erro}</p>}
        <div className="flex flex-wrap gap-2">
          <Botao
            type="button"
            carregando={pendente}
            disabled={dataAprovacao === ''}
            onClick={() => executar(aprovarLoteAction(loteId, dataAprovacao))}
          >
            Confirmar aprovação
          </Botao>
          <Botao
            type="button"
            variante="secundario"
            onClick={() => { setAberto(null); setErro(null); }}
          >
            Voltar
          </Botao>
        </div>
      </div>
    );
  }

  if (aberto === 'editarDatas') {
    return (
      <div className="flex max-w-md flex-col gap-3 rounded-xl border border-borda bg-superficie p-4">
        <p className="text-[13px] text-texto-2">Corrija as datas efetivas deste lote.</p>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-texto-2">Data de envio</span>
          <input type="date" value={dataEnvio} max={hojeNegocio()} onChange={(e) => setDataEnvio(e.target.value)} className={CLASSE_ENTRADA} />
        </label>
        {estadoConferencia === 'aprovado' && (
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-texto-2">Data de aprovação</span>
            <input type="date" value={dataAprovacao} max={hojeNegocio()} onChange={(e) => setDataAprovacao(e.target.value)} className={CLASSE_ENTRADA} />
          </label>
        )}
        {erro && <p role="alert" className="text-[13px] text-erro">{erro}</p>}
        <div className="flex flex-wrap gap-2">
          <Botao
            type="button"
            carregando={pendente}
            disabled={!dataEnvio || (estadoConferencia === 'aprovado' && !dataAprovacao)}
            onClick={() => executar(editarDatasLoteAction(
              loteId,
              dataEnvio,
              estadoConferencia === 'aprovado' ? dataAprovacao : null,
            ))}
          >
            Salvar datas
          </Botao>
          <Botao type="button" variante="secundario" onClick={() => { setAberto(null); setErro(null); }}>
            Voltar
          </Botao>
        </div>
      </div>
    );
  }

  if (aberto === 'excluir') {
    const aprovado = estadoConferencia === 'aprovado';
    return (
      <div className="flex max-w-md flex-col gap-3 rounded-xl border border-erro bg-erro-suave p-4">
        <p className="text-[13px]">
          {aprovado
            ? 'Desfaça a aprovação antes de excluir este lote.'
            : 'A exclusão é permanente e remove os itens deste lote, liberando novamente as comissões.'}
        </p>
        {erro && <p role="alert" className="text-[13px] text-erro">{erro}</p>}
        <div className="flex flex-wrap gap-2">
          {!aprovado && (
            <Botao
              type="button"
              variante="destrutivo"
              carregando={pendente}
              onClick={() => iniciarTransicao(async () => {
                const resultado = await excluirLoteAction(loteId);
                if (resultado.erro) {
                  setErro(resultado.erro);
                  return;
                }
                router.replace('/lotes');
                router.refresh();
              })}
            >
              Confirmar exclusão
            </Botao>
          )}
          <Botao type="button" variante="secundario" onClick={() => { setAberto(null); setErro(null); }}>
            Voltar
          </Botao>
        </div>
      </div>
    );
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
        <Botao type="button" variante="secundario" onClick={() => { setErro(null); setAberto('editarDatas'); }}>
          Editar datas
        </Botao>
        {estadoConferencia === 'enviado' && (
          <>
            <Botao
              type="button"
              carregando={pendente}
              onClick={() => { setErro(null); setAberto('aprovar'); }}
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
        <Botao type="button" variante="destrutivo" onClick={() => { setErro(null); setAberto('excluir'); }}>
          Excluir lote
        </Botao>
      </div>
      {erro && (
        <p role="alert" className="text-[13px] text-erro">
          {erro}
        </p>
      )}
    </div>
  );
}
