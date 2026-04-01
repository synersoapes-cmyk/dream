// @ts-nocheck
import React, { useState, useRef, useEffect } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Upload, X, FileText, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useGameStore } from '@/features/simulator/store/gameStore';
import { validateImageFile } from '@/features/simulator/utils/demoLoader';

interface UploadPopoverProps {
  type: 'attributes' | 'equipment';
  trigger: React.ReactNode;
}

export function UploadPopover({ type, trigger }: UploadPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Pending attribute action
  const [pendingAttribute, setPendingAttribute] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const ocrLogs = useGameStore(state => state.ocrLogs);
  const addOcrLog = useGameStore(state => state.addOcrLog);
  const setCharacter = useGameStore(state => state.setCharacter);
  const activeAccountName = useGameStore(state => {
    const account = state.accounts.find(a => a.id === state.activeAccountId);
    return account ? account.name : '当前账号';
  });

  // Handle pasting when popover is open
  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const file = new File([blob], 'pasted-image.png', { type: blob.type });
            processFile(file);
          }
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [isOpen]);

  const processFile = async (file: File) => {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast.error(validation.error || '文件验证失败');
      return;
    }

    setIsProcessing(true);
    setPendingAttribute(null);
    toast.info('正在识别...', { description: '使用 OCR 技术分析中' });

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      
      if (type === 'equipment') {
        const itemNames = ['无级别破血狂攻', '愤怒腰带', '晶清诀头盔', '神农项链'];
        const itemName = itemNames[Math.floor(Math.random() * itemNames.length)];
        
        // 生成一个模拟装备数据
        const mockEquip = {
          id: Date.now().toString(),
          name: itemName,
          type: ['weapon', 'belt', 'helmet', 'necklace'][Math.floor(Math.random() * 4)] as any,
          mainStat: '属性测试 +100',
          stats: { damage: 100, defense: 100 }
        };
        
        useGameStore.getState().addPendingEquipment(mockEquip);
        
        // 根据用户的精确需求文案: "上传后会提示 XX时XX分XX秒，识别到新物品XXXX"
        addOcrLog({
          type: 'success',
          message: `${timeStr}，识别到新物品${itemName}`,
        });
        toast.success(`识别到新物品`);
        
        // After successful identification, we can close it or leave it open to show log
      } else {
        // Attributes type
        setPendingAttribute({
          hpAdd: Math.floor(Math.random() * 300) + 100,
          defSub: Math.floor(Math.random() * 50) + 10,
          skillOld: 120,
          skillNew: 130,
          skillName: '强身术',
          timeStr
        });
        toast.success('识别到新属性待确认');
      }
    } catch (error) {
      toast.error('识别失败', { description: '请重试或更换清晰图片' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmAttribute = () => {
    if (!pendingAttribute) return;
    
    // Simulate updating attributes (mocking changes)
    setCharacter({ physique: 200 }); // just a dummy mock update to show it works globally
    
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    addOcrLog({
      type: 'success',
      message: `${timeStr}：已更新成功，其中气血增加${pendingAttribute.hpAdd}，防御减少${pendingAttribute.defSub}，${pendingAttribute.skillName} 由${pendingAttribute.skillOld}变更为${pendingAttribute.skillNew}。`,
    });
    
    setPendingAttribute(null);
    toast.success('属性更新成功');
  };

  const handleCancelAttribute = () => {
    setPendingAttribute(null);
  };

  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    processFile(files[0]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  };

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        {trigger}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-[9999] w-[var(--radix-popover-trigger-width)] bg-slate-900 border border-yellow-700/60 rounded-xl shadow-2xl flex flex-col focus:outline-none overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
          sideOffset={8}
          align="start"
        >
          <div className="flex justify-between items-center px-4 py-3 border-b border-yellow-800/40 bg-slate-950/40 shrink-0">
            <h2 className="text-base font-bold text-yellow-100 flex items-center gap-2">
              <Upload className="w-4 h-4 text-yellow-500" />
              {type === 'attributes' ? '上传属性截图' : '上传装备截图'}
            </h2>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-red-400 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 flex flex-col gap-4 overflow-hidden max-h-[60vh]">
            {/* 上传区域 */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`shrink-0 relative border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-yellow-500 bg-yellow-900/20'
                  : 'border-yellow-800/50 bg-slate-900/40 hover:border-yellow-700/70 hover:bg-slate-800/60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e.target.files)}
                className="hidden"
              />
              
              {isProcessing ? (
                <div className="flex flex-col items-center py-2">
                  <motion.div 
                    animate={{ rotate: 360 }} 
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }} 
                    className="w-6 h-6 border-2 border-yellow-600/30 border-t-yellow-600 rounded-full mb-2"
                  />
                  <p className="text-yellow-400 font-medium text-xs">智能识别中...</p>
                </div>
              ) : (
                <div className="text-center py-2">
                  <Upload className={`w-8 h-8 mx-auto mb-2 ${isDragging ? 'text-yellow-400' : 'text-yellow-600/60'}`} />
                  <p className="text-yellow-100 font-medium text-xs mb-1">点击或拖拽图片到此处</p>
                  <p className="text-slate-400 text-[10px]">支持直接使用 Ctrl+V / Cmd+V 粘贴截图</p>
                </div>
              )}
            </div>

            {/* 属性确认区域 */}
            <AnimatePresence>
              {pendingAttribute && (
                <motion.div
                  initial={{ opacity: 0, y: -10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -10, height: 0 }}
                  className="bg-yellow-950/40 border border-yellow-600/50 rounded-lg p-3 shrink-0"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="text-yellow-100 font-bold text-xs mb-1">
                        {pendingAttribute.timeStr}：即将更新人物属性
                      </h3>
                      <p className="text-yellow-200/80 text-[10px] mb-2">
                        即将更新到账号 <span className="font-bold text-yellow-400">{activeAccountName}</span>，本次变更如下：
                      </p>
                      <div className="bg-slate-900/60 rounded border border-slate-700/50 p-2 mb-2 text-[10px] space-y-1">
                        <div className="flex justify-between items-center text-slate-300">
                          <span>气血</span>
                          <span className="text-green-400 font-mono font-medium">+{pendingAttribute.hpAdd}</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-300">
                          <span>防御</span>
                          <span className="text-red-400 font-mono font-medium">-{pendingAttribute.defSub}</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-300">
                          <span>{pendingAttribute.skillName}</span>
                          <span className="text-blue-400 font-mono font-medium">{pendingAttribute.skillOld} ➔ {pendingAttribute.skillNew}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleConfirmAttribute}
                          className="px-3 py-1 bg-yellow-600 hover:bg-yellow-500 text-slate-900 text-[10px] font-bold rounded transition-colors"
                        >
                          确认更新
                        </button>
                        <button
                          onClick={handleCancelAttribute}
                          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium rounded border border-slate-600 transition-colors"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 识别记录展示区域 */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-[120px]">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-3 h-3 text-slate-400" />
                <h3 className="text-xs font-bold text-slate-300">识别记录</h3>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-2">
                {ocrLogs.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-500 text-xs italic border border-dashed border-slate-700/50 rounded-lg py-4">
                    暂无识别记录
                  </div>
                ) : (
                  // 只显示与当前类型相关的记录？ 这里保持展示所有也可以，或者可以加个过滤
                  ocrLogs.map((log) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-2 text-[10px] flex items-start gap-2"
                    >
                      {log.type === 'success' ? (
                        <CheckCircle className="w-3 h-3 text-green-500 shrink-0 mt-0.5" />
                      ) : log.type === 'error' ? (
                        <X className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />
                      ) : (
                        <Clock className="w-3 h-3 text-blue-400 shrink-0 mt-0.5" />
                      )}
                      <span className="text-slate-300 leading-relaxed break-words">{log.message}</span>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
