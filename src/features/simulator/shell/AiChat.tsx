// @ts-nocheck
import { Send, Bot, User as UserIcon } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export function AiChat() {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([
    { role: 'assistant', content: '你好，我是你的梦幻数值顾问！你可以问我关于装备搭配、属性分配、伤害计算等问题。' }
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    
    setMessages(prev => [...prev, { role: 'user', content: input }]);
    setInput('');
    
    // Simulate AI response
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: '根据你目前的五围和战力属性，建议优先提升伤害和命中。你可以尝试在装备栏替换高伤武器来看看面板变化！' 
      }]);
    }, 1000);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
              msg.role === 'user' ? 'bg-yellow-900/50 text-yellow-400' : 'bg-slate-800 border border-yellow-800/50 text-yellow-200'
            }`}>
              {msg.role === 'user' ? <UserIcon className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
            </div>
            <div className={`max-w-[85%] rounded-lg p-3 text-xs leading-relaxed ${
              msg.role === 'user' 
                ? 'bg-yellow-900/40 border border-yellow-800/40 text-yellow-50 rounded-tr-none shadow-lg' 
                : 'bg-slate-900/60 border border-yellow-800/30 text-yellow-100 rounded-tl-none shadow-lg'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-slate-900/80 border-t border-yellow-800/40 flex gap-2 flex-shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="问我数值问题..."
          className="flex-1 bg-slate-950/50 border border-yellow-800/50 rounded-lg px-3 py-2 text-xs text-yellow-50 focus:outline-none focus:border-yellow-600/50 transition-colors placeholder:text-yellow-800/50"
        />
        <button 
          onClick={handleSend}
          className="bg-yellow-900/40 hover:bg-yellow-800/60 border border-yellow-800/50 text-yellow-400 rounded-lg w-9 flex items-center justify-center transition-all hover:shadow-lg"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}