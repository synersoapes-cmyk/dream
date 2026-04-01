// @ts-nocheck
import { EquipmentReplaceDialog } from '../../../../features/simulator/overlays/EquipmentReplaceDialog';
import { AiChat } from '../../../../features/simulator/shell/AiChat';
import { AccountSwitcher } from '../../../../features/simulator/shell/AccountSwitcher';
import { useState } from 'react';
import { MessageSquare, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster } from 'sonner';
import { CharacterPanel, CombatPanel, EquipmentPanel, LaboratoryPanel } from '@/shared/blocks/generator';

export default function SimulatorApp() {
  const [mainTab, setMainTab] = useState<'status' | 'lab'>('status');
  const [showAI, setShowAI] = useState(false);

  return (
    <div className="dark h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col overflow-hidden">
      {/* 顶部装饰条 */}
      <div className="h-1 bg-gradient-to-r from-transparent via-yellow-500/80 to-transparent flex-shrink-0" />
      
      {/* 顶部工具栏 */}
      <div className="px-6 py-4 flex justify-between items-center bg-slate-950/40 border-b border-yellow-800/30">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-600 to-yellow-700 flex items-center justify-center text-slate-900 font-bold text-lg shadow-lg">
              梦
            </div>
            <div>
              <h1 className="text-lg font-bold text-yellow-100">梦幻数值实验室</h1>
              <p className="text-xs text-yellow-600">Fantasy Westward Journey Combat Simulator</p>
            </div>
          </div>
          
          <div className="h-6 w-px bg-yellow-800/40 mx-2"></div>
          <AccountSwitcher />
          
          {/* 主导航 Tabs */}
          <div className="flex bg-slate-900/60 rounded-xl p-1.5 border-2 border-purple-700/50 shadow-lg shadow-purple-900/30 ml-4">
            <button 
              className={`px-8 py-2.5 text-sm rounded-lg font-bold transition-all duration-200 ${
                mainTab === 'status' 
                  ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg shadow-purple-900/50 scale-105' 
                  : 'text-purple-300/70 hover:text-purple-200 hover:bg-purple-950/30'
              }`} 
              onClick={() => setMainTab('status')}
            >
              当前状态
            </button>
            <button 
              className={`px-8 py-2.5 text-sm rounded-lg font-bold transition-all duration-200 ${
                mainTab === 'lab' 
                  ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg shadow-purple-900/50 scale-105' 
                  : 'text-purple-300/70 hover:text-purple-200 hover:bg-purple-950/30'
              }`} 
              onClick={() => setMainTab('lab')}
            >
              实验室
            </button>
          </div>
        </div>
        
        {/* 右侧按钮组 */}
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowAI(!showAI)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
              showAI
                ? 'bg-yellow-600 text-slate-900'
                : 'bg-slate-900/60 border border-yellow-700/60 text-yellow-400 hover:border-yellow-600/80'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span className="text-sm font-medium">AI顾问</span>
          </motion.button>
        </div>
      </div>
      
      {/* 主容器 */}
      <div className="flex-1 w-full px-6 py-5 flex gap-6 min-h-0 overflow-hidden">
        {mainTab === 'status' ? (
          <>
            {/* 左侧：固定属性 - 33.33% */}
            <div className="flex-1 h-full overflow-hidden flex flex-col">
              <CharacterPanel />
            </div>
            
            {/* 中间：当前装备 - 33.33% */}
            <div className="flex-1 h-full overflow-hidden flex flex-col">
              <EquipmentPanel />
            </div>

            {/* 右侧：战斗参数 - 33.33% */}
            <div className="flex-1 h-full overflow-hidden flex flex-col">
              <CombatPanel />
            </div>
          </>
        ) : (
          <LaboratoryPanel />
        )}
      </div>
      
      {/* 底部装饰条 */}
      <div className="h-1 bg-gradient-to-r from-transparent via-yellow-500/80 to-transparent flex-shrink-0" />
      
      {/* 装备替换确认对话框 */}
      <EquipmentReplaceDialog />

      {/* 历史版本弹窗 */}

      {/* AI顾问弹窗 */}
      <AnimatePresence>
        {showAI && (
          <>
            {/* 背景遮罩 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAI(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
            />
            
            {/* 弹窗 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              transition={{ type: 'spring', duration: 0.5, bounce: 0.3 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[700px] z-[9999]"
            >
              <div className="h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border-2 border-yellow-700/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                {/* 弹窗标题 */}
                <div className="bg-gradient-to-r from-yellow-900/50 to-yellow-800/30 border-b border-yellow-700/60 px-5 py-4 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="w-5 h-5 text-yellow-400" />
                    <h2 className="text-base font-bold text-yellow-100">AI顾问</h2>
                  </div>
                  <button
                    onClick={() => setShowAI(false)}
                    className="w-8 h-8 rounded-lg bg-slate-900/60 hover:bg-slate-800/80 flex items-center justify-center text-yellow-400 transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                {/* 弹窗内容 */}
                <div className="flex-1 overflow-hidden">
                  <AiChat />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 通知提示 */}
      <Toaster 
        position="top-right" 
        toastOptions={{
          style: {
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            border: '2px solid rgba(202, 138, 4, 0.5)',
            borderRadius: '12px',
            color: '#fef3c7',
            boxShadow: '0 10px 40px rgba(202, 138, 4, 0.2)',
            fontWeight: '500',
          },
          className: 'toast-custom',
        }}
      />
    </div>
  );
}
