import { AlertCircle, Bot, Loader2, Send, Sparkles, User as UserIcon } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useGameStore } from '@/features/simulator/store/gameStore';
import { buildSimulatorAdvisorContext } from '@/features/simulator/utils/simulatorAdvisorContext';

const QUICK_PROMPTS = [
  '我现在最值得优先换哪个部位？',
  '这件候选装备值不值得入库？',
  '当前伤害提升最可能来自哪些属性？',
];

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type AdvisorStatus = {
  isChecking: boolean;
  ready: boolean;
  missing: string[];
  error: string | null;
};

export function AiChat() {
  const simulatorState = useGameStore();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: '你好，我是你的梦幻数值顾问！你可以问我关于装备搭配、属性分配、伤害计算等问题。' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [advisorStatus, setAdvisorStatus] = useState<AdvisorStatus>({
    isChecking: true,
    ready: false,
    missing: [],
    error: null,
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    let cancelled = false;

    const loadAdvisorStatus = async () => {
      setAdvisorStatus({
        isChecking: true,
        ready: false,
        missing: [],
        error: null,
      });

      try {
        const statusResponse = await fetch('/api/simulator/advisor', {
          method: 'GET',
          cache: 'no-store',
        });
        const statusPayload = await statusResponse.json();
        if (!statusResponse.ok || statusPayload?.code !== 0) {
          throw new Error(statusPayload?.message || 'AI 顾问状态读取失败');
        }

        if (!cancelled) {
          setAdvisorStatus({
            isChecking: false,
            ready: Boolean(statusPayload?.data?.ready),
            missing: Array.isArray(statusPayload?.data?.missing)
              ? statusPayload.data.missing
              : [],
            error: null,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setAdvisorStatus({
            isChecking: false,
            ready: false,
            missing: [],
            error:
              error instanceof Error
                ? error.message
                : 'AI 顾问状态读取失败',
          });
        }
      }
    };

    void loadAdvisorStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSend = async (message?: string) => {
    const trimmedInput = (message ?? input).trim();
    if (!trimmedInput || isLoading) return;
    if (advisorStatus.isChecking) return;
    if (!advisorStatus.ready) {
      const reason = advisorStatus.error || advisorStatus.missing.join(', ') || '配置未完成';
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `AI 顾问暂时不可用：${reason}`,
        },
      ]);
      return;
    }

    setMessages(prev => [...prev, { role: 'user', content: trimmedInput }]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/simulator/advisor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: trimmedInput,
          context: buildSimulatorAdvisorContext(simulatorState),
          history: messages.slice(-6),
        }),
      });

      const payload = await response.json();
      if (!response.ok || payload?.code !== 0 || !payload?.data?.reply) {
        throw new Error(payload?.message || 'AI 顾问暂时无法回答');
      }

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: payload.data.reply,
        },
      ]);
    } catch (error) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content:
            error instanceof Error
              ? error.message
              : 'AI 顾问暂时不可用，请稍后重试。',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="border-b border-yellow-800/30 bg-slate-950/70 px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-yellow-100">
          {advisorStatus.isChecking ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-yellow-400" />
              <span>正在检查 Gemini 顾问配置...</span>
            </>
          ) : advisorStatus.ready ? (
            <>
              <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
              <span>已接入 Gemini，会结合当前角色、候选装备和实验室席位回答。</span>
            </>
          ) : (
            <>
              <AlertCircle className="h-3.5 w-3.5 text-amber-300" />
              <span>
                AI 顾问暂不可用：
                {advisorStatus.error || advisorStatus.missing.join('、') || '配置未完成'}
              </span>
            </>
          )}
        </div>
        {!advisorStatus.isChecking && advisorStatus.ready ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => {
                  setInput(prompt);
                  void handleSend(prompt);
                }}
                disabled={isLoading}
                className="rounded-full border border-yellow-700/40 bg-yellow-500/10 px-3 py-1 text-[11px] text-yellow-100 transition hover:bg-yellow-500/15 disabled:opacity-60"
              >
                {prompt}
              </button>
            ))}
          </div>
        ) : null}
      </div>

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
          id="simulator-ai-chat-input"
          name="simulator-ai-chat-input"
          aria-label="AI 顾问输入框"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void handleSend()}
          placeholder="问我数值问题..."
          disabled={isLoading || advisorStatus.isChecking || !advisorStatus.ready}
          className="flex-1 bg-slate-950/50 border border-yellow-800/50 rounded-lg px-3 py-2 text-xs text-yellow-50 focus:outline-none focus:border-yellow-600/50 transition-colors placeholder:text-yellow-800/50"
        />
        <button 
          onClick={() => void handleSend()}
          disabled={isLoading || advisorStatus.isChecking || !advisorStatus.ready}
          className="bg-yellow-900/40 hover:bg-yellow-800/60 border border-yellow-800/50 text-yellow-400 rounded-lg w-9 flex items-center justify-center transition-all hover:shadow-lg disabled:opacity-60"
        >
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}
