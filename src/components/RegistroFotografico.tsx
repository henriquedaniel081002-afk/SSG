/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, Upload, Info, AlertTriangle, Hammer, CheckCircle, 
  Trash2, Download, Maximize2, X, ChevronRight, Image as ImageIcon
} from 'lucide-react';
import { DBState, Garantia, Cliente, Equipamento, Foto, Usuario } from '../types';
import { buscarEstadoCompleto, excluirFoto, salvarFoto } from '../services/api';
import { TransformerPhotoRenderer } from './TransformerPhotoRenderer';

interface RegistroFotograficoProps {
  db: DBState;
  onUpdateState: (newState: DBState) => void;
  currentUser: Usuario | null;
}

export const RegistroFotografico: React.FC<RegistroFotograficoProps> = ({
  db,
  onUpdateState,
  currentUser
}) => {
  const { garantias, clientes, equipamentos, fotos } = db;

  // Active Warranty under edit
  const [selectedGarantiaId, setSelectedGarantiaId] = useState<string>('');
  
  // Camera state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraPhotoType, setCameraPhotoType] = useState<'antes' | 'depois' | null>(null);
  const [hasCameraError, setHasCameraError] = useState(false);

  // Form Fields
  const [descAntes, setDescAntes] = useState('');
  const [descDepois, setDescDepois] = useState('');

  // Zoom / Lightbox
  const [zoomedFoto, setZoomedFoto] = useState<Foto | null>(null);

  // References for camera stream
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Active selected warranty object
  const activeGarantia = garantias.find(g => g.id === selectedGarantiaId);
  const activeCliente = activeGarantia ? clientes.find(c => c.id === activeGarantia.clienteId) : null;
  const activeEquipamento = activeGarantia ? equipamentos.find(e => e.id === activeGarantia.equipamentoId) : null;

  // Filter existing photos for selected warranty
  const activeFotos = fotos.filter(f => f.garantiaId === selectedGarantiaId);
  const fotoAntes = activeFotos.find(f => f.tipo === 'antes');
  const fotoDepois = activeFotos.find(f => f.tipo === 'depois');

  // Set descriptions when active warranty changes
  useEffect(() => {
    if (selectedGarantiaId) {
      setDescAntes(fotoAntes ? fotoAntes.descricao : '');
      setDescDepois(fotoDepois ? fotoDepois.descricao : '');
    } else {
      setDescAntes('');
      setDescDepois('');
    }
  }, [selectedGarantiaId, fotoAntes, fotoDepois]);

  // Quick Description suggestions requested by user
  const sugestoesAntes = [
    "Bobina queimada por sobrecorrente",
    "Vazamento de óleo isolante na tampa",
    "Conexão rompida no secundário",
    "Pintura danificada com oxidação na base",
    "Núcleo oxidado por umidade excessiva"
  ];

  const sugestoesDepois = [
    "Bobina substituída e testada",
    "Conexão elétrica totalmente refeita",
    "Repintura industrial realizada com PU",
    "Teste dielétrico aprovado a 10 kV",
    "Troca de juntas e componentes concluída"
  ];

  // --- ACTIVATE REAL DEVICE CAMERA ---
  const handleStartCamera = async (tipo: 'antes' | 'depois') => {
    setCameraPhotoType(tipo);
    setIsCameraActive(true);
    setHasCameraError(false);

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, // Default to back camera on phones
        audio: false 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
    } catch (err) {
      console.warn("Could not access direct camera hardware inside iframe, using simulator.", err);
      setHasCameraError(true);
    }
  };

  // --- STOP CAMERA ---
  const handleStopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setStream(null);
    setIsCameraActive(false);
    setCameraPhotoType(null);
  };

  // --- CAPTURE SHUTTER CLICK ---
  const handleCapture = () => {
    if (!selectedGarantiaId || !cameraPhotoType) return;

    let base64Data = '';

    if (!hasCameraError && videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        base64Data = canvas.toDataURL('image/jpeg');
      }
    } else {
      // Simulator fallback: Draw a styled mock transformer drawing with state info
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw industrial pattern
        ctx.fillStyle = '#020403';
        ctx.fillRect(0, 0, 640, 480);
        
        ctx.fillStyle = '#007F3D';
        ctx.fillRect(20, 20, 600, 440);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px Inter, sans-serif';
        ctx.fillText(`MOCK SNAPSHOT: ${activeEquipamento?.numeroSerie || 'TR-MOCK'}`, 50, 80);
        
        ctx.font = '16px monospace';
        ctx.fillText(`OS: ${selectedGarantiaId}`, 50, 120);
        ctx.fillText(`FOTO TIPO: ${cameraPhotoType.toUpperCase()}`, 50, 150);
        ctx.fillText(`OPERADOR: ${currentUser?.nome || 'Tecnico'}`, 50, 180);
        ctx.fillText(`DATA: ${new Date().toLocaleString()}`, 50, 210);

        // draw small transformer icon
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#ffffff';
        ctx.strokeRect(220, 250, 200, 150);
        ctx.beginPath();
        ctx.arc(320, 325, 40, 0, Math.PI * 2);
        ctx.stroke();

        base64Data = canvas.toDataURL('image/jpeg');
      }
    }

    if (base64Data) {
      saveOrUpdatePhoto(cameraPhotoType, base64Data, cameraPhotoType === 'antes' ? descAntes : descDepois);
    }
    
    handleStopCamera();
  };

  // --- HANDLE FILE UPLOAD (GALLERY SELECT) ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, tipo: 'antes' | 'depois') => {
    const file = e.target.files?.[0];
    if (!file || !selectedGarantiaId) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      saveOrUpdatePhoto(tipo, base64String, tipo === 'antes' ? descAntes : descDepois);
    };
    reader.readAsDataURL(file);
  };

  // --- MULTIPLE PHOTO UPLOAD SIMULATION ---
  const handleMultipleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedGarantiaId) return;

    (Array.from(files) as File[]).forEach((file, index) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Determine placement: first goes to 'antes', second to 'depois' if empty, otherwise 'antes'
        const targetType = (!fotoAntes && index === 0) ? 'antes' : 'depois';
        saveOrUpdatePhoto(
          targetType, 
          base64String, 
          targetType === 'antes' ? `Lote importado #${index+1}` : `Lote finalizado #${index+1}`
        );
      };
      reader.readAsDataURL(file);
    });

    alert(`${files.length} fotos importadas e vinculadas com sucesso.`);
  };

  // --- PERSIST PHOTO OBJECT ---
  const saveOrUpdatePhoto = async (tipo: 'antes' | 'depois', base64Url: string, descricao: string) => {
    if (!selectedGarantiaId) return;

    try {
      await salvarFoto({
        garantiaId: selectedGarantiaId,
        tipo,
        url: base64Url,
        descricao: descricao || (tipo === 'antes' ? 'Defeito encontrado em inspeção.' : 'Serviço técnico realizado.'),
        usuarioResponsavel: currentUser?.nome || 'Usuário',
        usuarioId: currentUser?.id
      });

      const refreshed = await buscarEstadoCompleto(currentUser?.id);
      onUpdateState(refreshed);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Erro ao salvar foto.');
    }
  };

  // --- SAVE TEXT DESCRIPTION ONLY ---
  const handleSaveDescription = async (tipo: 'antes' | 'depois') => {
    if (!selectedGarantiaId) return;
    const existingPhoto = tipo === 'antes' ? fotoAntes : fotoDepois;
    
    if (existingPhoto) {
      await saveOrUpdatePhoto(tipo, existingPhoto.url, tipo === 'antes' ? descAntes : descDepois);
      alert('Descrição atualizada com sucesso.');
    } else {
      // Create mock container with photo description
      await saveOrUpdatePhoto(tipo, '', tipo === 'antes' ? descAntes : descDepois);
      alert('Descrição vinculada ao chamado (aguardando imagem correspondente).');
    }
  };

  // --- DELETE PHOTO ---
  const handleDeletePhoto = async (id: string) => {
    if (!window.confirm('Deseja realmente remover esta foto de vistoria?')) return;

    try {
      await excluirFoto(id);
      const refreshed = await buscarEstadoCompleto(currentUser?.id);
      onUpdateState(refreshed);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Erro ao excluir foto.');
    }
  };

  // --- PHOTO DOWNLOAD ---
  const handleDownload = (f: Foto) => {
    const link = document.createElement('a');
    link.href = f.url;
    link.download = `Vistoria-${f.tipo}-${selectedGarantiaId}.jpg`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h1 className="text-2xl font-bold text-brand-dark tracking-tight">Registro Fotográfico de Vistoria</h1>
        <p className="text-sm text-slate-500 font-medium">Vinculação instantânea de fotos "Antes" e "Depois" aos chamados de manutenção.</p>
      </div>

      {/* Select Active Warranty Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Selecione o Chamado de Garantia ativo:</label>
          <select
            value={selectedGarantiaId}
            onChange={(e) => setSelectedGarantiaId(e.target.value)}
            className="w-full max-w-xl px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-light"
          >
            <option value="">Escolher chamado de garantia por O.S. ou Série...</option>
            {garantias.map((g) => {
              const eq = equipamentos.find(e => e.id === g.equipamentoId);
              return (
                <option key={g.id} value={g.id}>
                  {g.id} — Nº Série: {eq?.numeroSerie} ({g.status})
                </option>
              );
            })}
          </select>
        </div>

        {/* Display connected info if selected */}
        {activeGarantia && activeCliente && activeEquipamento ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs font-medium animate-in fade-in duration-150">
            <div>
              <span className="text-[10px] text-slate-400 block mb-0.5">Cliente Solicitante</span>
              <span className="font-semibold text-slate-800">{activeCliente.nome.split(' S/A')[0]}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block mb-0.5">Nº Série / Modelo</span>
              <span className="font-bold text-slate-800 font-mono text-[11px] bg-slate-200/60 px-1 py-0.2 rounded inline-block">
                {activeEquipamento.numeroSerie}
              </span>
              <span className="text-slate-500 font-normal block mt-0.5">{activeEquipamento.modelo.split(' (')[0]}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block mb-0.5">Potência Nominal</span>
              <span className="font-semibold text-slate-800">{activeEquipamento.potencia}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block mb-0.5">Tensão de Trabalho</span>
              <span className="font-semibold text-slate-700 font-mono text-[11px]">{activeEquipamento.tensao}</span>
            </div>
            <div className="col-span-2 md:col-span-1">
              <span className="text-[10px] text-slate-400 block mb-0.5">Status Atual</span>
              <span className="inline-block bg-green-900/50 text-green-300 px-2 py-0.5 rounded text-[10px] font-bold">
                {activeGarantia.status}
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-center gap-3 text-xs text-amber-800">
            <Info className="w-4.5 h-4.5 shrink-0" />
            <span>Selecione uma garantia acima para começar a gerenciar e carregar as fotos comparativas.</span>
          </div>
        )}
      </div>

      {activeGarantia && (
        <div className="space-y-6">
          
          {/* Advanced options: Multiple uploads */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-brand-light" />
              <div className="text-left">
                <span className="text-xs font-bold text-slate-700 block">Upload Lote Múltiplo</span>
                <span className="text-[10px] text-slate-400">Importe múltiplas fotos simultaneamente para vinculação ágil.</span>
              </div>
            </div>
            <label className="px-4 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-200 transition-colors">
              <input 
                type="file" 
                multiple 
                accept="image/*" 
                className="hidden" 
                onChange={handleMultipleUpload} 
              />
              Escolher Várias Imagens
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* CARD: FOTO ANTES */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-2">
                <h3 className="font-bold text-rose-700 text-xs flex items-center gap-2 uppercase tracking-wider">
                  <AlertTriangle className="w-4.5 h-4.5" /> Foto Antes (Diagnóstico do Defeito)
                </h3>
                <p className="text-[10px] text-slate-400 font-normal">Registro visual das avarias encontradas no transformador.</p>
              </div>

              {/* Photo Renderer Panel */}
              <div className="relative rounded-xl border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center min-h-48">
                {fotoAntes ? (
                  <div className="w-full h-52 relative group">
                    <TransformerPhotoRenderer url={fotoAntes.url} className="w-full h-full" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2">
                      <button
                        onClick={() => setZoomedFoto(fotoAntes)}
                        className="p-2 bg-white text-slate-800 rounded-full hover:bg-slate-100 shadow-sm"
                        title="Zoom"
                      >
                        <Maximize2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDownload(fotoAntes)}
                        className="p-2 bg-white text-slate-800 rounded-full hover:bg-slate-100 shadow-sm"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeletePhoto(fotoAntes.id)}
                        className="p-2 bg-rose-600 text-white rounded-full hover:bg-rose-700 shadow-sm"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center text-slate-400 space-y-2">
                    <Camera className="w-8 h-8 mx-auto text-slate-300" />
                    <span className="text-xs font-semibold block">Sem imagem cadastrada</span>
                    <span className="text-[10px] block">Selecione um arquivo ou use a câmera</span>
                  </div>
                )}
              </div>

              {/* Image Control Triggers */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleStartCamera('antes')}
                  className="px-3 py-2 bg-brand-dark hover:bg-slate-800 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                >
                  <Camera className="w-4 h-4" /> Tirar Foto
                </button>
                
                <label className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-center">
                  <Upload className="w-4 h-4" /> Selecionar Arquivo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, 'antes')}
                  />
                </label>
              </div>

              {/* Problem Description Input with Examples */}
              <div className="space-y-2 pt-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Descrição do Problema Encontrado:</label>
                <textarea
                  rows={3}
                  placeholder="Ex: Vazamento de óleo na tampa superior por fadiga da borracha..."
                  value={descAntes}
                  onChange={(e) => setDescAntes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-light focus:bg-white"
                />
                
                {/* Suggestions Pills */}
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Modelos rápidos:</span>
                  <div className="flex flex-wrap gap-1">
                    {sugestoesAntes.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setDescAntes(sug)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-[9px] font-semibold transition-colors"
                      >
                        {sug.split(' por')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleSaveDescription('antes')}
                  className="w-full px-3 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-700 transition-colors mt-2"
                >
                  Salvar Descrição do Defeito
                </button>
              </div>
            </div>

            {/* CARD: FOTO DEPOIS */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-2">
                <h3 className="font-bold text-emerald-700 text-xs flex items-center gap-2 uppercase tracking-wider">
                  <CheckCircle className="w-4.5 h-4.5" /> Foto Depois (Reparo Concluído)
                </h3>
                <p className="text-[10px] text-slate-400 font-normal">Atestado visual de que a manutenção foi validada com sucesso.</p>
              </div>

              {/* Photo Renderer Panel */}
              <div className="relative rounded-xl border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center min-h-48">
                {fotoDepois ? (
                  <div className="w-full h-52 relative group">
                    <TransformerPhotoRenderer url={fotoDepois.url} className="w-full h-full" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2">
                      <button
                        onClick={() => setZoomedFoto(fotoDepois)}
                        className="p-2 bg-white text-slate-800 rounded-full hover:bg-slate-100 shadow-sm"
                        title="Zoom"
                      >
                        <Maximize2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDownload(fotoDepois)}
                        className="p-2 bg-white text-slate-800 rounded-full hover:bg-slate-100 shadow-sm"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeletePhoto(fotoDepois.id)}
                        className="p-2 bg-rose-600 text-white rounded-full hover:bg-rose-700 shadow-sm"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center text-slate-400 space-y-2">
                    <CheckCircle className="w-8 h-8 mx-auto text-slate-300" />
                    <span className="text-xs font-semibold block">Sem imagem cadastrada</span>
                    <span className="text-[10px] block">Selecione o relatório final após reparo</span>
                  </div>
                )}
              </div>

              {/* Image Control Triggers */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleStartCamera('depois')}
                  className="px-3 py-2 bg-brand-dark hover:bg-slate-800 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                >
                  <Camera className="w-4 h-4" /> Tirar Foto
                </button>
                
                <label className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-center">
                  <Upload className="w-4 h-4" /> Selecionar Arquivo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, 'depois')}
                  />
                </label>
              </div>

              {/* Repair Description Input with Examples */}
              <div className="space-y-2 pt-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Descrição do Serviço Executado:</label>
                <textarea
                  rows={3}
                  placeholder="Ex: Troca da bobina interna e purga de óleo isolante desoxigenado..."
                  value={descDepois}
                  onChange={(e) => setDescDepois(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-light focus:bg-white"
                />
                
                {/* Suggestions Pills */}
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Modelos rápidos:</span>
                  <div className="flex flex-wrap gap-1">
                    {sugestoesDepois.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setDescDepois(sug)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-[9px] font-semibold transition-colors"
                      >
                        {sug.split(' e')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleSaveDescription('depois')}
                  className="w-full px-3 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-700 transition-colors mt-2"
                >
                  Salvar Descrição do Reparo
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL CAMARA POPUP - REAL WEBCAM CAPTURE PANEL */}
      {isCameraActive && cameraPhotoType && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 text-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-800 overflow-hidden relative">
            <button 
              onClick={handleStopCamera}
              className="absolute top-4 right-4 p-2 bg-black/40 hover:bg-black/60 rounded-full text-slate-300 hover:text-white z-5"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-5 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-400">Captura em Tempo Real</span>
              <span className="text-xs text-slate-400">{cameraPhotoType === 'antes' ? 'Foto Antes (Entrada)' : 'Foto Depois (Retorno)'}</span>
            </div>

            {/* Cam Stream preview viewport */}
            <div className="relative bg-black h-80 flex items-center justify-center overflow-hidden">
              {!hasCameraError ? (
                <video 
                  ref={videoRef} 
                  className="w-full h-full object-cover"
                  playsInline 
                  muted
                />
              ) : (
                <div className="p-6 text-center space-y-3">
                  <ImageIcon className="w-12 h-12 text-slate-600 mx-auto animate-pulse" />
                  <p className="text-xs text-slate-400 font-semibold">Simulador de Captura de Câmera Ativo</p>
                  <p className="text-[10px] text-slate-500 max-w-xs mx-auto">Ambiente restrito de iframe bloqueia webcam direta. Clique abaixo para simular a captura de teste de um transformador.</p>
                </div>
              )}
            </div>

            <div className="p-5 bg-slate-950 flex items-center justify-between">
              <button 
                type="button"
                onClick={handleStopCamera}
                className="px-4 py-2 hover:bg-slate-800 rounded-lg text-xs text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleCapture}
                className="px-5 py-2.5 bg-brand-light hover:bg-green-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-brand-light/20"
              >
                <Camera className="w-4 h-4" /> {hasCameraError ? 'Simular Captura' : 'Bater Foto'}
              </button>
            </div>
          </div>
          
          {/* Hidden Canvas used to convert video feed into base64 image data */}
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {/* Lightbox photo viewer */}
      {zoomedFoto && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setZoomedFoto(null)}>
          <div className="max-w-4xl max-h-screen relative" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setZoomedFoto(null)}
              className="absolute -top-12 right-0 p-2 text-white bg-slate-800 hover:bg-slate-700 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
            <TransformerPhotoRenderer url={zoomedFoto.url} className="max-h-[80vh] w-auto rounded-xl object-contain shadow-2xl" />
            <div className="bg-slate-950/80 p-4 rounded-xl text-center text-white text-xs mt-3">
              <span className="font-bold uppercase tracking-wider block mb-1">Legenda Técnica</span>
              <p>{zoomedFoto.descricao}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
