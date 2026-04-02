'use client';

import { Cloud, User } from 'lucide-react';

import { Badge } from '@/shared/components/ui/badge';
import { useGameStore } from '@/features/simulator/store/gameStore';

export function AccountSwitcher() {
  const accounts = useGameStore((state) => state.accounts || []);
  const activeAccountId = useGameStore((state) => state.activeAccountId);

  const activeAccount =
    accounts.find((account) => account.id === activeAccountId) ?? accounts[0];

  return (
    <div className="flex items-center gap-3 rounded-xl border border-yellow-800/40 bg-slate-900/60 px-4 py-2 shadow-lg">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-500/15 text-yellow-400">
        <User className="h-4 w-4" />
      </div>

      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-yellow-100">
          {activeAccount?.name || 'Current Character'}
        </div>
        <div className="text-[11px] text-slate-400">
          Synced from Cloudflare D1
        </div>
      </div>

      <Badge
        variant="outline"
        className="border-emerald-700/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/10"
      >
        <Cloud className="mr-1 h-3 w-3" />
        Cloud
      </Badge>
    </div>
  );
}
