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
  Sparkles,
  Check,
  AlertCircle
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
        return <span className="text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1"><MessageSquare className="w-3 h-3 text-emerald-600" /> WhatsApp</span>;
      case 'phone':
        return <span className="text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md flex items-center gap-1"><Phone className="w-3 h-3 text-blue-600" /> Teléfono</span>;
      case 'web':
        return <span className="text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-md flex items-center gap-1"><Globe className="w-3 h-3 text-purple-600" /> Web</span>;
      default:
        return null;
    }
  };

  return (
    <div className="h-[calc(100vh-5rem)] p-6 flex flex-col gap-5 animate-fadeIn">
      
      {/* Top Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filtrar Canal:</span>
          {(['all', 'whatsapp', 'phone', 'web'] as const).map(ch => (
            <button
              key={ch}
              onClick={() => setChannelFilter(ch)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                channelFilter === ch 
                  ? 'bg-blue-600 text-white shadow-xs' 
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {ch === 'all' ? 'Todos los canales' : ch.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-500 font-medium hidden sm:block">
          Recepción multicanal unificada · <strong className="text-slate-900 font-bold">{conversations.length} conversaciones</strong>
        </div>
      </div>

      {/* 3 Columns Layout: Inbox List | Chat View | Human Understanding Panel ("BibendIA ha entendido") */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-hidden">
        
        {/* Left Col (3 cols): Conversation List */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Bandeja de Entradas</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredConvs.map(conv => {
              const cust = customers.find(c => c.id === conv.customerId);
              const veh = vehicles.find(v => v.id === conv.vehicleId);
              const isSelected = conv.id === selectedConvId;
              const lastMsg = conv.messages[conv.messages.length - 1];

              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConvId(conv.id)}
                  className={`w-full text-left p-4 transition-all flex flex-col gap-1.5 ${
                    isSelected ? 'bg-blue-50/60 border-l-4 border-l-blue-600 font-semibold' : 'hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900 truncate">{cust?.name}</span>
                    <span className="text-xs text-slate-400 font-mono">{conv.lastUpdate}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {getChannelBadge(conv.channel)}
                    {veh && <span className="license-plate">{veh.plate}</span>}
                  </div>

                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {lastMsg ? lastMsg.content : 'Nueva consulta entrante'}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Center Col (5 cols): Active Chat Thread */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-xs">
          {/* Header */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center font-bold text-blue-700">
                {customer?.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">{customer?.name}</h3>
                <p className="text-xs text-slate-500">{customer?.phone} · {vehicle?.brand} {vehicle?.model}</p>
              </div>
            </div>
            {vehicle && <span className="license-plate">{vehicle.plate}</span>}
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/30">
            {selectedConv?.messages.map(msg => {
              const isClient = msg.sender === 'client';
              const isAi = msg.sender === 'ai';

              return (
                <div key={msg.id} className={`flex flex-col ${isClient ? 'items-start' : 'items-end'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-600">{msg.senderName}</span>
                    <span className="text-[11px] text-slate-400 font-mono">{msg.timestamp}</span>
                  </div>

                  <div className={`p-4 rounded-2xl max-w-md text-xs leading-relaxed shadow-xs ${
                    isClient 
                      ? 'bg-slate-100 border border-slate-200 text-slate-800 rounded-tl-none' 
                      : isAi
                      ? 'bg-blue-50 border border-blue-200 text-slate-900 rounded-tr-none'
                      : 'bg-slate-900 text-white rounded-tr-none'
                  }`}>
                    {isAi && (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 mb-1">
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" /> BibendIA (Recepción Taller)
                      </div>
                    )}
                    <p>{msg.content}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Chat Reply Bar */}
          <div className="p-3.5 border-t border-slate-100 bg-white flex items-center gap-2">
            <input
              type="text"
              value={replyInput}
              onChange={e => setReplyInput(e.target.value)}
              placeholder="Escribe un mensaje..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-sans"
            />
            <button className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Col (4 cols): Human Result Panel ("BibendIA ha entendido") */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl flex flex-col p-5 space-y-4 overflow-y-auto shadow-xs">
          {/* Header */}
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-extrabold text-sm">
              B
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">BibendIA ha entendido</h3>
              <p className="text-xs text-slate-500">Resumen claro de la recepción</p>
            </div>
          </div>

          {/* Customer & Vehicle Header Badge */}
          {customer && vehicle && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">{customer.name}</span>
                <span className="license-plate">{vehicle.plate}</span>
              </div>
              <p className="text-xs text-slate-600">{vehicle.brand} {vehicle.model} ({vehicle.motorization})</p>
            </div>
          )}

          {/* QUIERE */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider block">QUIERE:</span>
            <div className="space-y-1">
              {understanding?.wants.map((w, idx) => (
                <div key={idx} className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl text-xs text-amber-950 font-semibold">
                  • {w}
                </div>
              ))}
            </div>
          </div>

          {/* YA SÉ */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block">YA SÉ:</span>
            <div className="space-y-1">
              {understanding?.alreadyKnows.map((k, idx) => (
                <div key={idx} className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-medium text-emerald-800">
                  ✓ {k}
                </div>
              ))}
            </div>
          </div>

          {/* ME FALTA */}
          {understanding?.missingInfo && understanding.missingInfo.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wider block">ME FALTA:</span>
              <div className="space-y-1">
                {understanding.missingInfo.map((m, idx) => (
                  <div key={idx} className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-medium text-amber-800">
                    ⚠ {m}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SIGUIENTE PASO */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">SIGUIENTE PASO:</span>
            <p className="text-xs font-bold text-slate-900 leading-snug">{understanding?.nextStep}</p>

            {understanding?.autoActionNotice && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800">
                {understanding.autoActionNotice}
              </div>
            )}

            {/* Interactive Slot Proposals for Marta (Dates: Jueves 17 / Viernes 18) */}
            {selectedConv?.id === 'conv-marta' && (
              <div className="space-y-2 pt-3 border-t border-slate-200">
                <p className="text-xs font-bold text-slate-700">Proponer hueco a Marta:</p>
                
                <button
                  onClick={() => confirmMartaAppointment('2026-09-17', '10:30')}
                  className="w-full text-left p-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-between shadow-xs transition-all"
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>Jueves 17 Sept. — 10:30 h</span>
                  </div>
                  <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-md font-extrabold">Agendar</span>
                </button>

                <button
                  onClick={() => confirmMartaAppointment('2026-09-18', '08:30')}
                  className="w-full text-left p-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-between transition-all"
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span>Viernes 18 Sept. — 08:30 h</span>
                  </div>
                  <span className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-bold">Agendar</span>
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

