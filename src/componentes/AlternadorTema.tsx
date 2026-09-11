'use client';

import { useEffect, useState } from 'react';

type Preferencia = 'sistema' | 'claro' | 'escuro';

const OPCOES: { valor: Preferencia; rotulo: string }[] = [
  { valor: 'sistema', rotulo: 'Sistema' },
  { valor: 'claro', rotulo: 'Claro' },
  { valor: 'escuro', rotulo: 'Escuro' },
];

function aplicar(preferencia: Preferencia): void {
  const escuroDoSistema = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const escuro = preferencia === 'escuro' || (preferencia === 'sistema' && escuroDoSistema);
  document.documentElement.dataset.tema = escuro ? 'escuro' : 'claro';
}

export function AlternadorTema() {
  const [preferencia, setPreferencia] = useState<Preferencia>('sistema');

  useEffect(() => {
    const guardada = window.localStorage.getItem('tema') as Preferencia | null;
    if (guardada === 'claro' || guardada === 'escuro' || guardada === 'sistema') {
      setPreferencia(guardada);
    }
  }, []);

  // Enquanto a preferência for "sistema", seguir o sistema operacional ao vivo.
  useEffect(() => {
    if (preferencia !== 'sistema') return;
    const consulta = window.matchMedia('(prefers-color-scheme: dark)');
    const aoMudar = () => aplicar('sistema');
    consulta.addEventListener('change', aoMudar);
    return () => consulta.removeEventListener('change', aoMudar);
  }, [preferencia]);

  function escolher(valor: Preferencia) {
    setPreferencia(valor);
    window.localStorage.setItem('tema', valor);
    aplicar(valor);
  }

  return (
    <div
      role="group"
      aria-label="Tema da interface"
      className="inline-flex gap-0.5 rounded-full border border-borda bg-superficie-2 p-0.5"
    >
      {OPCOES.map((opcao) => (
        <button
          key={opcao.valor}
          type="button"
          aria-pressed={preferencia === opcao.valor}
          onClick={() => escolher(opcao.valor)}
          className={
            preferencia === opcao.valor
              ? 'rounded-full bg-destaque px-3 py-1.5 text-xs font-medium text-sobre-destaque'
              : 'rounded-full px-3 py-1.5 text-xs font-medium text-texto-2 hover:text-texto'
          }
        >
          {opcao.rotulo}
        </button>
      ))}
    </div>
  );
}
