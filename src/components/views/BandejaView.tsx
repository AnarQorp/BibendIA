import React, { useState } from 'react';
import { useDemo } from '../../context/DemoContext';
import { 
  MessageSquare, 
  Phone, 
  Globe, 
  Send, 
  CheckCircle2, 
  Calendar, 
  Clock, 
  User, 
  Car, 
  AlertTriangle,
  FileText,
  Sparkles
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
  const understanding = selectedConv?.understanding;

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
              {ch === 'all' ? 'Todos' : ch.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-400">
          Recepción multicanal unificada · <strong className="text-slate-200">{conversations.length} conversaciones</strong>
        </div>
      </div>

      {/* 3 Columns Layout: Inbox List | Chat View | Human Understanding Panel ("BibendIA ha entendido") */}
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
                      ? 'bg-slate-800/90 border border-orange-500/30 text-slate-100 rounded-tr-none'
                      : 'bg-blue-900/40 border border-blue-700/50 text-slate-100 rounded-tr-none'
                  }`}>
                    {isAi && (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-orange-400 mb-1">
                        BibendIA (Recepción Taller)
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
              placeholder="Escribe un mensaje..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500"
            />
            <button className="p-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition-all">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Col (4 cols): Human Result Panel ("BibendIA ha entendido") */}
        <div className="lg:col-span-4 bg-[#131b2e] border border-slate-800 rounded-2xl flex flex-col p-4 space-y-4 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <div className="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center font-extrabold text-sm">
              ⚡
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">BibendIA ha entendido</h3>
              <p className="text-[11px] text-slate-400">Resumen y estado de la recepción</p>
            </div>
          </div>

          {/* Customer & Vehicle Header Badge */}
          {customer && vehicle && (
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">{customer.name}</span>
                <span className="license-plate text-[11px]">{vehicle.plate}</span>
              </div>
              <p className="text-xs text-slate-400">{vehicle.brand} {vehicle.model} ({vehicle.motorization})</p>
            </div>
          )}

          {/* QUIERE */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-orange-400 uppercase tracking-wider block">QUIERE:</span>
            <div className="space-y-1">
              {understanding?.wants.map((w, idx) => (
                <div key={idx} className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 font-semibold">
                  • {w}
                </div>
              ))}
            </div>
          </div>

          {/* YA SÉ */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">YA SÉ:</span>
            <div className="space-y-1">
              {understanding?.alreadyKnows.map((k, idx) => (
                <div key={idx} className="p-2 bg-emerald-950/30 border border-emerald-800/40 rounded-lg text-[11px] text-emerald-300">
                  ✓ {k}
                </div>
              ))}
            </div>
          </div>

          {/* ME FALTA */}
          {understanding?.missingInfo && understanding.missingInfo.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">ME FALTA:</span>
              <div className="space-y-1">
                {understanding.missingInfo.map((m, idx) => (
                  <div key={idx} className="p-2 bg-amber-950/30 border border-amber-800/40 rounded-lg text-[11px] text-amber-300">
                    ⚠ {m}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SIGUIENTE PASO */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">SIGUIENTE PASO:</span>
            <p className="text-xs font-bold text-white">{understanding?.nextStep}</p>

            {understanding?.autoActionNotice && (
              <div className="p-2 bg-emerald-950/40 border border-emerald-800/40 rounded-lg text-[11px] font-semibold text-emerald-300">
                {understanding.autoActionNotice}
              </div>
            )}

            {/* Interactive Slot Proposals for Marta (Dates fixed: Jueves 17 / Viernes 18) */}
            {selectedConv?.id === 'conv-marta' && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <p className="text-[11px] font-bold text-slate-400">Proponer hueco a Marta:</p>
                
                <button
                  onClick={() => confirmMartaAppointment('2026-09-17', '10:30')}
                  className="w-full text-left p-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold flex items-center justify-between shadow-md transition-all"
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>Jueves 17 Sept. — 10:30 h</span>
                  </div>
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-extrabold">Agendar</span>
                </button>

                <button
                  onClick={() => confirmMartaAppointment('2026-09-18', '08:30')}
                  className="w-full text-left p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold flex items-center justify-between transition-all"
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span>Viernes 18 Sept. — 08:30 h</span>
                  </div>
                  <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded font-bold">Agendar</span>
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
