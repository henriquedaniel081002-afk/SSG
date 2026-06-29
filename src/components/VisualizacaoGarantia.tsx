/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  X, Calendar, User, MapPin, Phone, Mail, FileText, 
  Settings, Award, Clock, ArrowRight, Download, Maximize2, Printer, CheckCircle
} from 'lucide-react';
import { Garantia, Cliente, Equipamento, Foto, Historico, StatusGarantia, Usuario } from '../types';
import { TransformerPhotoRenderer } from './TransformerPhotoRenderer';

interface VisualizacaoGarantiaProps {
  garantia: Garantia;
  clientes: Cliente[];
  equipamentos: Equipamento[];
  fotos: Foto[];
  historicos: Historico[];
  usuarios: Usuario[];
  onClose: () => void;
  onEdit?: () => void;
}

export const VisualizacaoGarantia: React.FC<VisualizacaoGarantiaProps> = ({
  garantia,
  clientes,
  equipamentos,
  fotos,
  historicos,
  usuarios,
  onClose,
  onEdit
}) => {
  const [zoomedPhoto, setZoomedPhoto] = useState<Foto | null>(null);

  const cliente = clientes.find(c => c.id === garantia.clienteId);
  const equipamento = equipamentos.find(e => e.id === garantia.equipamentoId);
  const responsavel = usuarios.find(u => u.id === garantia.responsavelId);

  // Filter photos for this warranty
  const garantiaFotos = fotos.filter(f => f.garantiaId === garantia.id);
  const fotoAntes = garantiaFotos.find(f => f.tipo === 'antes');
  const fotoDepois = garantiaFotos.find(f => f.tipo === 'depois');

  // Filter history for this warranty and sort by date descending
  const garantiaHistoricos = historicos
    .filter(h => h.garantiaId === garantia.id)
    .sort((a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime());

  // Determine stage active index
  const stages = [
    { name: 'Recebido', status: StatusGarantia.RECEBIDO, color: 'bg-slate-500 border-slate-600' },
    { name: 'Em Análise', status: StatusGarantia.EM_ANALISE, color: 'bg-blue-500 border-blue-600' },
    { name: 'Em Reparo', status: StatusGarantia.EM_REPARO, color: 'bg-amber-500 border-amber-600' },
    { name: 'Teste Final', status: StatusGarantia.TESTE_FINAL, color: 'bg-purple-500 border-purple-600' },
    { name: 'Concluído', status: StatusGarantia.CONCLUIDO, color: 'bg-emerald-500 border-emerald-600' }
  ];

  // Current index based on status
  let currentStageIndex = 0;
  if (garantia.status === StatusGarantia.RECEBIDO) currentStageIndex = 0;
  else if (garantia.status === StatusGarantia.EM_ANALISE) currentStageIndex = 1;
  else if (garantia.status === StatusGarantia.AGUARDANDO_PECAS) currentStageIndex = 2; // Treat under repair block
  else if (garantia.status === StatusGarantia.EM_REPARO) currentStageIndex = 2;
  else if (garantia.status === StatusGarantia.TESTE_FINAL) currentStageIndex = 3;
  else if (garantia.status === StatusGarantia.CONCLUIDO || garantia.status === StatusGarantia.ENCERRADO) currentStageIndex = 4;

  // Find date for each status stage from history
  const getStageDate = (stageStatus: StatusGarantia) => {
    const hist = garantiaHistoricos.find(h => h.alteracaoRealizada.includes(stageStatus));
    if (hist) {
      const parts = hist.dataHora.split(' ');
      return parts[0]; // Returns just the date YYYY-MM-DD
    }
    // Fallback if it is current or pre-seeded
    if (stageStatus === StatusGarantia.RECEBIDO) return garantia.dataEntrada;
    if (stageStatus === StatusGarantia.CONCLUIDO && garantia.dataEncerramento) return garantia.dataEncerramento;
    return null;
  };

  // Trigger browser printing of warranty certificate
  const handlePrint = () => {
    window.print();
  };

  // Mock download of photo base64 or info
  const handleDownloadPhoto = (foto: Foto) => {
    const link = document.createElement('a');
    link.href = (foto.url.startsWith('data:image/') || foto.url.startsWith('http://') || foto.url.startsWith('https://')) ? foto.url : `#`;
    link.download = `Foto-${foto.tipo}-${garantia.id}.png`;
    if (foto.url.startsWith('data:image/') || foto.url.startsWith('http://') || foto.url.startsWith('https://')) {
      link.click();
    } else {
      alert(`Download de esquema industrial do tipo "${foto.url}" gerado com sucesso.`);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden print:border-none print:shadow-none">
      {/* Header section */}
      <div className="bg-brand-dark text-white p-5 flex justify-between items-center print:bg-white print:text-brand-dark print:border-b print:border-slate-300">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-brand-light/30 text-sky-200 px-2 py-0.5 rounded font-mono font-medium print:border print:border-slate-300 print:text-brand-dark">
              ORDEM DE SERVIÇO
            </span>
            <span className="text-xs bg-slate-700 text-slate-200 px-2 py-0.5 rounded font-mono">
              Prazo: {garantia.prazoDias} dias
            </span>
          </div>
          <h2 className="text-xl font-bold font-mono tracking-tight mt-1">{garantia.id}</h2>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <button 
            onClick={handlePrint}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/90 hover:text-white"
            title="Imprimir Ficha Técnica"
          >
            <Printer className="w-5 h-5" />
          </button>
          {onEdit && (
            <button 
              onClick={onEdit}
              className="px-3 py-1.5 bg-brand-light text-white text-xs font-semibold rounded-lg hover:bg-blue-600 transition-colors shadow-sm"
            >
              Editar Registro
            </button>
          )}
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto print:max-h-full print:overflow-visible">
        {/* DIFERENCIAL VISUAL: Linha do tempo de progresso */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-brand-light" /> Linha do Tempo da Garantia
          </h3>
          <div className="relative flex flex-col md:flex-row items-center justify-between gap-4 md:gap-2">
            {/* Horizontal progress bar background (desktop) */}
            <div className="hidden md:block absolute left-4 right-4 top-5 h-0.5 bg-slate-200 -z-10" />

            {stages.map((stage, idx) => {
              const isCompleted = idx <= currentStageIndex;
              const isCurrent = idx === currentStageIndex;
              const stageDate = getStageDate(stage.status);

              return (
                <div key={idx} className="flex md:flex-col items-center gap-3 md:gap-2 w-full md:w-1/5 text-left md:text-center relative">
                  {/* Circle Indicator */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 z-10 transition-all shadow-sm ${
                    isCompleted 
                      ? isCurrent 
                        ? 'bg-brand-light border-brand-light text-white ring-4 ring-blue-100' 
                        : 'bg-brand-dark border-brand-dark text-white'
                      : 'bg-white border-slate-300 text-slate-400'
                  }`}>
                    {isCompleted && !isCurrent ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <span className="text-sm font-semibold font-mono">{idx + 1}</span>
                    )}
                  </div>

                  {/* Stage Label and Date */}
                  <div className="flex flex-col">
                    <span className={`text-xs font-bold leading-tight ${isCurrent ? 'text-brand-light' : isCompleted ? 'text-slate-800' : 'text-slate-400'}`}>
                      {stage.name}
                    </span>
                    {stageDate ? (
                      <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {new Date(stageDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-300 italic mt-0.5">Aguardando</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dual Column Info: Client & Transformer */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Col 1: Client Information */}
          <div className="border border-slate-200 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
              <span className="w-1.5 h-3 bg-brand-light rounded-full" /> Dados do Cliente
            </h3>
            {cliente ? (
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-xs text-slate-400 block">Razão Social</span>
                  <span className="font-semibold text-slate-800">{cliente.nome}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-xs text-slate-400 block">Responsável / Contato</span>
                    <span className="font-medium text-slate-700">{cliente.contato}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Telefone</span>
                    <span className="font-medium text-slate-700 font-mono">{cliente.telefone}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-xs text-slate-400 block">E-mail</span>
                    <span className="font-medium text-slate-700 truncate block" title={cliente.email}>
                      {cliente.email}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Localização</span>
                    <span className="font-medium text-slate-700 flex items-center gap-0.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {cliente.cidade} - {cliente.estado}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded">Dados do cliente não vinculados.</p>
            )}
          </div>

          {/* Col 2: Equipment Specification */}
          <div className="border border-slate-200 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
              <span className="w-1.5 h-3 bg-brand-light rounded-full" /> Especificações do Equipamento
            </h3>
            {equipamento ? (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-xs text-slate-400 block">Número de Série</span>
                    <span className="font-bold text-slate-800 font-mono text-sm bg-slate-100 px-1.5 py-0.5 rounded inline-block">
                      {equipamento.numeroSerie}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Modelo / Tipo</span>
                    <span className="font-semibold text-slate-700">{equipamento.modelo.split(' (')[0]}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-xs text-slate-400 block">Potência</span>
                    <span className="font-semibold text-slate-800 text-sm">{equipamento.potencia}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Tensão de Operação</span>
                    <span className="font-semibold text-slate-700 font-mono text-xs">{equipamento.tensao}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-xs text-slate-400 block">Data de Fabricação</span>
                    <span className="font-medium text-slate-700 font-mono">
                      {new Date(equipamento.dataFabricacao + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Data de Venda</span>
                    <span className="font-medium text-slate-700 font-mono">
                      {new Date(equipamento.dataVenda + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded">Dados do equipamento não cadastrados.</p>
            )}
          </div>
        </div>

        {/* Diagnostic Descriptions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-5 space-y-2">
            <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4" /> Reclamação do Cliente (Defeito)
            </h4>
            <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">
              {garantia.descricaoReclamacao}
            </p>
          </div>

          <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-5 space-y-2">
            <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
              <Award className="w-4 h-4" /> Laudo de Análise & Observações
            </h4>
            <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">
              {garantia.observacoesGerais || 'Nenhuma observação técnica registrada até o momento.'}
            </p>
            <div className="pt-2 border-t border-emerald-100/60 flex items-center justify-between text-xs text-slate-500">
              <span>Responsável Técnico:</span>
              <span className="font-semibold text-slate-700 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                {responsavel ? responsavel.nome : 'Não designado'}
              </span>
            </div>
          </div>
        </div>

        {/* PHOTO REGISTRATION BEFORE AND AFTER */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
            <span className="w-1.5 h-3 bg-brand-light rounded-full" /> Registro Fotográfico Comparativo
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Photo Before */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/40 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-2 border-b border-rose-100 pb-1 flex items-center justify-between">
                  <span>FOTO ANTES (ENTRADA DO EQUIPAMENTO)</span>
                  {fotoAntes && (
                    <span className="text-[10px] text-slate-400 font-mono font-normal">
                      {fotoAntes.dataRegistro}
                    </span>
                  )}
                </h4>
                {fotoAntes ? (
                  <div className="relative group rounded-lg overflow-hidden border border-slate-200 bg-white">
                    <TransformerPhotoRenderer url={fotoAntes.url} className="w-full h-44" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 print:hidden">
                      <button
                        onClick={() => setZoomedPhoto(fotoAntes)}
                        className="p-2 bg-white/90 text-slate-800 rounded-full hover:bg-white transition-transform scale-90 group-hover:scale-100"
                        title="Ver em Tela Cheia"
                      >
                        <Maximize2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDownloadPhoto(fotoAntes)}
                        className="p-2 bg-white/90 text-slate-800 rounded-full hover:bg-white transition-transform scale-90 group-hover:scale-100"
                        title="Baixar Foto"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border border-dashed border-slate-300 rounded-lg h-44 flex flex-col items-center justify-center text-slate-400 p-4">
                    <span className="text-xs">Nenhuma foto registrada antes do reparo</span>
                  </div>
                )}
                <p className="text-xs text-slate-600 mt-2 font-medium bg-white p-2 rounded border border-slate-100">
                  <span className="text-slate-400 font-semibold uppercase block text-[10px] mb-0.5">Descrição Técnica do Problema:</span>
                  {fotoAntes ? fotoAntes.descricao : "Aguardando upload de foto e descrição."}
                </p>
              </div>
              {fotoAntes && (
                <div className="mt-3 text-[10px] text-slate-400 flex justify-between items-center bg-slate-100/50 px-2 py-1 rounded">
                  <span>Registrado por: <strong>{fotoAntes.usuarioResponsavel}</strong></span>
                </div>
              )}
            </div>

            {/* Photo After */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/40 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2 border-b border-emerald-100 pb-1 flex items-center justify-between">
                  <span>FOTO DEPOIS (REPARO EXECUTADO)</span>
                  {fotoDepois && (
                    <span className="text-[10px] text-slate-400 font-mono font-normal">
                      {fotoDepois.dataRegistro}
                    </span>
                  )}
                </h4>
                {fotoDepois ? (
                  <div className="relative group rounded-lg overflow-hidden border border-slate-200 bg-white">
                    <TransformerPhotoRenderer url={fotoDepois.url} className="w-full h-44" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 print:hidden">
                      <button
                        onClick={() => setZoomedPhoto(fotoDepois)}
                        className="p-2 bg-white/90 text-slate-800 rounded-full hover:bg-white transition-transform scale-90 group-hover:scale-100"
                        title="Ver em Tela Cheia"
                      >
                        <Maximize2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDownloadPhoto(fotoDepois)}
                        className="p-2 bg-white/90 text-slate-800 rounded-full hover:bg-white transition-transform scale-90 group-hover:scale-100"
                        title="Baixar Foto"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border border-dashed border-slate-300 rounded-lg h-44 flex flex-col items-center justify-center text-slate-400 p-4">
                    <span className="text-xs">Nenhuma foto registrada após o reparo</span>
                  </div>
                )}
                <p className="text-xs text-slate-600 mt-2 font-medium bg-white p-2 rounded border border-slate-100">
                  <span className="text-slate-400 font-semibold uppercase block text-[10px] mb-0.5">Descrição do Serviço Executado:</span>
                  {fotoDepois ? fotoDepois.descricao : "Aguardando conclusão do reparo e foto final."}
                </p>
              </div>
              {fotoDepois && (
                <div className="mt-3 text-[10px] text-slate-400 flex justify-between items-center bg-slate-100/50 px-2 py-1 rounded">
                  <span>Registrado por: <strong>{fotoDepois.usuarioResponsavel}</strong></span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Audit Log Timeline */}
        <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/30">
          <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
            <Settings className="w-4 h-4 text-slate-500" /> Histórico Completo de Alterações
          </h3>
          <div className="relative border-l border-slate-200 pl-4 ml-2 space-y-4">
            {garantiaHistoricos.map((hist, index) => (
              <div key={hist.id} className="relative">
                {/* Dot */}
                <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-slate-300 border-2 border-white ring-4 ring-slate-100" />
                <div className="text-xs">
                  <div className="flex items-center gap-2 text-slate-400 mb-0.5">
                    <span className="font-mono bg-slate-100 px-1.5 py-0.2 rounded">{hist.dataHora}</span>
                    <span className="font-semibold text-slate-600">{hist.usuarioNome}</span>
                  </div>
                  <p className="text-slate-700 font-medium">{hist.alteracaoRealizada}</p>
                </div>
              </div>
            ))}
            {garantiaHistoricos.length === 0 && (
              <p className="text-xs text-slate-400 italic">Nenhum histórico registrado.</p>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox / Zoom Modal for Photo */}
      {zoomedPhoto && (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-4 print:hidden">
          <button 
            onClick={() => setZoomedPhoto(null)}
            className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="max-w-4xl w-full flex flex-col items-center space-y-4">
            <div className="bg-white/5 rounded-xl border border-white/10 p-2 w-full max-h-[75vh] flex items-center justify-center overflow-hidden">
              <TransformerPhotoRenderer url={zoomedPhoto.url} className="max-h-[70vh] w-auto max-w-full rounded-lg object-contain" />
            </div>
            
            <div className="text-center text-white max-w-2xl bg-slate-900/80 p-4 rounded-xl border border-slate-800">
              <span className="text-xs bg-brand-light text-white px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider mb-2 inline-block">
                Foto {zoomedPhoto.tipo === 'antes' ? 'Antes do Reparo' : 'Depois do Reparo'}
              </span>
              <p className="text-sm font-medium mt-1">{zoomedPhoto.descricao}</p>
              <div className="flex justify-between text-xs text-slate-400 font-mono mt-3 border-t border-slate-800 pt-2">
                <span>Registrado por: {zoomedPhoto.usuarioResponsavel}</span>
                <span>Data: {zoomedPhoto.dataRegistro}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
