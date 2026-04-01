// @ts-nocheck
import React, { useState, useRef, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { ChevronDown, Plus, User, Trash2, Edit2, Check, X, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export function AccountSwitcher() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAccountName, setNewAccountName] = useState('新角色');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  
  const accounts = useGameStore(state => state.accounts || []);
  const activeAccountId = useGameStore(state => state.activeAccountId);
  const switchAccount = useGameStore(state => state.switchAccount);
  const addAccount = useGameStore(state => state.addAccount);
  const deleteAccount = useGameStore(state => state.deleteAccount);
  const updateAccountName = useGameStore(state => state.updateAccountName);
  
  const activeAccount = accounts.find(a => a.id === activeAccountId) || accounts[0];

  const inputRef = useRef<HTMLInputElement>(null);
  const newAccountInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingId]);

  useEffect(() => {
    if (showAddModal && newAccountInputRef.current) {
      newAccountInputRef.current.focus();
      newAccountInputRef.current.select();
    }
  }, [showAddModal]);

  const handleAdd = () => {
    setNewAccountName('新角色');
    setShowAddModal(true);
  };

  const confirmAdd = () => {
    if (newAccountName.trim()) {
      addAccount(newAccountName.trim());
      toast.success(`已创建并切换到账号：${newAccountName.trim()}`);
      setShowAddModal(false);
      setNewAccountName('新角色');
    }
  };

  const cancelAdd = () => {
    setShowAddModal(false);
    setNewAccountName('新角色');
  };

  const handleDelete = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (accounts.length <= 1) {
      toast.error('无法删除最后一个账号');
      return;
    }
    setDeleteConfirm({ id, name });
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteAccount(deleteConfirm.id);
      toast.success(`已删除账号：${deleteConfirm.name}`);
      setDeleteConfirm(null);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirm(null);
  };

  const startEdit = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    setEditingId(id);
    setEditName(name);
  };

  const saveEdit = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.stopPropagation();
    if (editingId && editName.trim()) {
      updateAccountName(editingId, editName.trim());
      setEditingId(null);
      toast.success(`账号名称已更新为：${editName.trim()}`);
    } else {
      setEditingId(null);
    }
  };

  const cancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  return (
    <div className="flex items-center gap-2">
      {accounts.map(acc => (
        <div key={acc.id} className="relative">
          {editingId === acc.id ? (
            <div className="flex items-center gap-1 bg-slate-900/80 border border-yellow-600/60 rounded-lg px-3 py-1.5" onClick={e => e.stopPropagation()}>
              <input
                ref={inputRef}
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') saveEdit(e);
                  if (e.key === 'Escape') cancelEdit(e as any);
                }}
                className="w-24 bg-slate-950 border border-yellow-600/50 rounded px-2 py-0.5 text-xs text-yellow-100 outline-none"
              />
              <button onClick={saveEdit} className="text-green-500 hover:text-green-400 p-0.5">
                <Check className="w-3 h-3" />
              </button>
              <button onClick={cancelEdit} className="text-slate-400 hover:text-red-400 p-0.5">
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                switchAccount(acc.id);
                toast.success(`已切换到账号：${acc.name}`);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                acc.id === activeAccountId
                  ? 'bg-yellow-600 text-slate-900'
                  : 'bg-slate-900/80 border border-yellow-800/40 text-yellow-100 hover:border-yellow-600/80'
              }`}
            >
              <User className={`w-3.5 h-3.5 ${acc.id === activeAccountId ? 'text-slate-900' : 'text-yellow-500'}`} />
              <span>{acc.name}</span>
              <div className="flex items-center ml-1 gap-0.5 opacity-60 hover:opacity-100">
                <span 
                  onClick={(e) => startEdit(e, acc.id, acc.name)}
                  className={`p-0.5 cursor-pointer ${acc.id === activeAccountId ? 'hover:text-slate-700' : 'hover:text-yellow-400'}`}
                >
                  <Edit2 className="w-3 h-3" />
                </span>
                {accounts.length > 1 && (
                  <span 
                    onClick={(e) => handleDelete(e, acc.id, acc.name)}
                    className="p-0.5 cursor-pointer hover:text-red-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </span>
                )}
              </div>
            </button>
          )}
        </div>
      ))}
      
      <button
        onClick={handleAdd}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/80 border border-yellow-800/40 rounded-lg text-yellow-500 hover:border-yellow-600/80 hover:text-yellow-400 transition-all text-sm font-medium"
      >
        <Plus className="w-3.5 h-3.5" />
        新建账号
      </button>

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={cancelAdd}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.2 }}
              onClick={e => e.stopPropagation()}
              className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-2 border-yellow-700/60 rounded-2xl shadow-2xl shadow-yellow-900/30 overflow-hidden w-96"
            >
              {/* 标题栏 */}
              <div className="bg-gradient-to-r from-yellow-900/50 to-yellow-800/30 border-b border-yellow-700/60 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-yellow-600 flex items-center justify-center">
                    <Plus className="w-5 h-5 text-slate-900" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-yellow-100">新建账号</h3>
                    <p className="text-xs text-yellow-400/80">Create New Account</p>
                  </div>
                </div>
              </div>

              {/* 内容区域 */}
              <div className="p-6">
                <div className="mb-2">
                  <label className="text-sm text-yellow-400/90 font-medium mb-2 block">角色名称</label>
                  <input
                    ref={newAccountInputRef}
                    type="text"
                    value={newAccountName}
                    onChange={e => setNewAccountName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') confirmAdd();
                      if (e.key === 'Escape') cancelAdd();
                    }}
                    placeholder="请输入角色名称"
                    className="w-full bg-slate-950/80 border-2 border-yellow-700/40 focus:border-yellow-600/80 rounded-lg px-4 py-2.5 text-sm text-yellow-100 placeholder:text-slate-500 outline-none transition-all"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-2">提示：按 Enter 确认，按 Esc 取消</p>
              </div>

              {/* 按钮区域 */}
              <div className="border-t border-yellow-800/30 px-6 py-4 flex justify-end gap-3 bg-slate-950/40">
                <button 
                  onClick={cancelAdd}
                  className="px-4 py-2 rounded-lg border border-slate-600/60 bg-slate-800/60 text-slate-300 hover:bg-slate-700/60 hover:text-slate-100 hover:border-slate-500/80 transition-all text-sm font-medium"
                >
                  取消
                </button>
                <button 
                  onClick={confirmAdd}
                  className="px-4 py-2 rounded-lg bg-yellow-600 text-slate-900 hover:bg-yellow-500 shadow-lg shadow-yellow-900/30 transition-all text-sm font-bold"
                >
                  确认创建
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {deleteConfirm && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" 
            onClick={cancelDelete}
            onKeyDown={(e) => {
              if (e.key === 'Escape') cancelDelete();
              if (e.key === 'Enter') confirmDelete();
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.2 }}
              onClick={e => e.stopPropagation()}
              className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-2 border-red-700/60 rounded-2xl shadow-2xl shadow-red-900/50 overflow-hidden w-96"
            >
              {/* 标题栏 */}
              <div className="bg-gradient-to-r from-red-900/50 to-red-800/30 border-b border-red-700/60 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center animate-pulse">
                    <AlertTriangle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-yellow-100">删除账号</h3>
                    <p className="text-xs text-red-400/90">Delete Account</p>
                  </div>
                </div>
              </div>

              {/* 内容区域 */}
              <div className="p-6">
                <div className="bg-red-950/30 border border-red-800/40 rounded-lg p-4 mb-4">
                  <p className="text-sm text-slate-300 text-center">
                    确定要删除账号 <span className="text-yellow-400 font-bold">\"{deleteConfirm.name}\"</span> 吗？
                  </p>
                  <p className="text-xs text-red-400 text-center mt-2">⚠️ 此操作无法恢复</p>
                </div>
                <p className="text-xs text-slate-400 text-center">提示：按 Enter 确认，按 Esc 取消</p>
              </div>

              {/* 按钮区域 */}
              <div className="border-t border-red-800/30 px-6 py-4 flex justify-end gap-3 bg-slate-950/40">
                <button 
                  onClick={cancelDelete}
                  className="px-4 py-2 rounded-lg border border-slate-600/60 bg-slate-800/60 text-slate-300 hover:bg-slate-700/60 hover:text-slate-100 hover:border-slate-500/80 transition-all text-sm font-medium"
                >
                  取消
                </button>
                <button 
                  onClick={confirmDelete}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-500 hover:to-red-600 shadow-lg shadow-red-900/50 transition-all text-sm font-bold"
                >
                  确认删除
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}