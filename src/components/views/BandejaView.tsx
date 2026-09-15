import React, { useState } from 'react';
import { useDemo } from '../../context/DemoContext';
import { 
  MessageSquare, 
  Phone, 
  Globe, 
  Send, 
  Sparkles, 
  CheckCircle2, 
  Calendar, 
  Clock, 
  User, 
  Car, 
  AlertCircle,
  FileText
} from 'lucide-react';

export const BandejaView: React.FC = () => {
  const { 
    conversations, 
    customers, 
    vehicles, 
    confirmMartaAppointment, 
    generateQuoteFromPrompt,
    setActiveSection 
  } = useDemo();

  const [selectedConvId, setSelectedConvId] = useState<string>('conv-marta');
  const [channelFilter, setChannelFilter] = useState<'all' | 'whatsapp' | 'phone' | 'web'>('all');
  const [replyInput, setReplyInput] = useState('');

  const filteredConvs = conversations.filter(c => {
    if (channelFilter === 'all') return true;
    return c.channel === channelFilter;
  });

  const selectedConv = conversations.find(c => c.id === selectedConvId) || conversations[0];
  const customer = customers.find(c => c.id === selectedConv?.customerId);
  const vehicle = vehicles.find(v => v.id === selectedConv?.vehicleId);

  const getChannelBadge = (channel: string) => {
    switch (channel) {
      case 'whatsapp':
        return <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded flex items-center gap-1"><MessageSquare className="w-3 h-3" /> WhatsApp</span>;
      case 'phone':
        return <span className="text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded flex items-center gap-1"><Phone className="w-3 h-3" /> Teléfono</span>;
      case 'web':
        return <span className="text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded flex items-center gap-1"><Globe className="w-3 h-3" /> Formulario Web</span>;
      default:
        return null;
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] p-4 flex flex-col gap-4 animate-fadeIn">
      {/* Top Filter Bar */}
      <div className="bg-[#131b2e] border border-slate-800 rounded-xl p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Filtrar Canal:</span>
          {(['all', 'whatsapp', 'phone', 'web'] as const).map(ch => (
            <button
              key={ch}
              onClick={() => setChannelFilter(ch)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                channelFilter === ch 
                  ? 'bg-orange-500 text-white shadow-sm' 
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {ch === 'all' ? 'Todos los canales' : ch.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-400">
          Recepción multicanal unificada · <strong className="text-slate-200">{conversations.length} conversaciones</strong>
        </div>
      </div>

      {/* 3 Columns Layout: Inbox List | Chat View | AI Interpretation Panel */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden">
        
        {/* Left Col (3 cols): Conversation List */}
        <div className="lg:col-span-3 bg-[#131b2e] border border-slate-800 rounded-2xl flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-800 bg-slate-900/60">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Bandeja de Entradas</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
            {filteredConvs.map(conv => {
              const cust = customers.find(c => c.id === conv.customerId);
              const veh = vehicles.find(v => v.id === conv.vehicleId);
              const isSelected = conv.id === selectedConvId;
              const lastMsg = conv.messages[conv.messages.length - 1];

              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConvId(conv.id)}
                  className={`w-full text-left p-3.5 transition-all flex flex-col gap-1.5 ${
                    isSelected ? 'bg-slate-800/90 border-l-4 border-orange-500' : 'hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white truncate">{cust?.name}</span>
                    <span className="text-[10px] text-slate-400">{conv.lastUpdate}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {getChannelBadge(conv.channel)}
                    {veh && <span className="license-plate text-[10px]">{veh.plate}</span>}
                  </div>

                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    {lastMsg ? lastMsg.content : 'Nueva consulta entrante'}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Center Col (5 cols): Active Chat Thread */}
        <div className="lg:col-span-5 bg-[#131b2e] border border-slate-800 rounded-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-200">
                {customer?.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">{customer?.name}</h3>
                <p className="text-xs text-slate-400">{customer?.phone} · {vehicle?.brand} {vehicle?.model}</p>
              </div>
            </div>
            {vehicle && <span className="license-plate">{vehicle.plate}</span>}
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-950/40">
            {selectedConv?.messages.map(msg => {
              const isClient = msg.sender === 'client';
              const isAi = msg.sender === 'ai';

              return (
                <div key={msg.id} className={`flex flex-col ${isClient ? 'items-start' : 'items-end'}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-semibold text-slate-400">{msg.senderName}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{msg.timestamp}</span>
                  </div>

                  <div className={`p-3.5 rounded-2xl max-w-sm text-xs leading-relaxed shadow-md ${
                    isClient 
                      ? 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none' 
                      : isAi
                      ? 'bg-gradient-to-tr from-orange-950/60 to-amber-950/60 border border-orange-500/30 text-slate-100 rounded-tr-none'
                      : 'bg-blue-900/40 border border-blue-700/50 text-slate-100 rounded-tr-none'
                  }`}>
                    {isAi && (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-orange-400 mb-1">
                        <Sparkles className="w-3 h-3" /> Asistente IA BibendIA
                      </div>
                    )}
                    <p>{msg.content}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Chat Reply Bar */}
          <div className="p-3 border-t border-slate-800 bg-slate-900/90 flex items-center gap-2">
            <input
              type="text"
              value={replyInput}
              onChange={e => setReplyInput(e.target.value)}
              placeholder="Escribe un mensaje o deja que la IA responda..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500"
            />
            <button className="p-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition-all">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Col (4 cols): AI Interpretation Panel */}
        <div className="lg:col-span-4 bg-[#131b2e] border border-slate-800 rounded-2xl flex flex-col p-4 space-y-4 overflow-y-auto">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <div className="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Interpretación IA en Tiempo Real</h3>
              <p className="text-[11px] text-slate-400">Análisis semántico de necesidad</p>
            </div>
          </div>

          {/* Vehicle summary card */}
          {vehicle && (
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200">{vehicle.brand} {vehicle.model}</span>
                <span className="license-plate">{vehicle.plate}</span>
              </div>
              <p className="text-xs text-slate-400">Año: {vehicle.year} · Motor: {vehicle.motorization}</p>
              <p className="text-xs text-slate-300 font-semibold">Kilometraje registrado: {vehicle.kilometers.toLocaleString('es-ES')} km</p>
            </div>
          )}

          {/* Detected Needs */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Necesidades Detectadas
            </h4>
            <div className="space-y-1.5">
              {selectedConv?.aiInterpretation.detectedNeeds.map((need, idx) => (
                <div key={idx} className="p-2.5 bg-emerald-950/30 border border-emerald-800/40 rounded-lg text-xs text-emerald-200 font-medium">
                  ✓ {need}
                </div>
              ))}
            </div>
          </div>

          {/* Recommended Next Action */}
          <div className="p-3.5 bg-gradient-to-br from-slate-900 to-orange-950/30 border border-orange-500/30 rounded-xl space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-orange-400">
              <Sparkles className="w-3.5 h-3.5" /> Siguiente Acción Recomendada por IA
            </div>
            <p className="text-xs font-semibold text-slate-200">
              {selectedConv?.aiInterpretation.recommendedAction}
            </p>

            {/* Quick Interactive Actions for Marta Walkthrough */}
            {selectedConv?.id === 'conv-marta' && (
              <div className="space-y-2 pt-1 border-t border-slate-800/80">
                <p className="text-[11px] font-bold text-slate-400">Proponer huecos de cita a Marta (1-clic):</p>
                
                <button
                  onClick={() => confirmMartaAppointment('2026-09-17', '10:30')}
                  className="w-full text-left p-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold flex items-center justify-between shadow-md transition-all"
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>Miércoles 17 — 10:30 h (Recomendado)</span>
                  </div>
                  <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded">Agendar</span>
                </button>

                <button
                  onClick={() => confirmMartaAppointment('2026-09-18', '08:30')}
                  className="w-full text-left p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-between transition-all"
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span>Jueves 18 — 08:30 h</span>
                  </div>
                  <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded">Agendar</span>
                </button>
              </div>
            )}

            {selectedConv?.id === 'conv-ander' && (
              <button
                onClick={() => {
                  generateQuoteFromPrompt("Discos y pastillas delanteras del BMW de Ander");
                  setActiveSection('presupuestos');
                }}
                className="w-full p-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all"
              >
                <FileText className="w-4 h-4" />
                <span>Ver Presupuesto IA Preparado (349,69 €)</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
