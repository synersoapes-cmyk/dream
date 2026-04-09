'use client';

import { useState } from 'react';
import { ChevronDown, Cloud, Loader2, LogOut, User } from 'lucide-react';

import { signOut, useSession } from '@/core/auth/client';
import { useRouter } from '@/core/i18n/navigation';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { useGameStore } from '@/features/simulator/store/gameStore';

export function AccountSwitcher() {
  const router = useRouter();
  const { data: session } = useSession();
  const accounts = useGameStore((state) => state.accounts || []);
  const activeAccountId = useGameStore((state) => state.activeAccountId);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const activeAccount =
    accounts.find((account) => account.id === activeAccountId) ?? accounts[0];

  const sessionUser = session?.user;

  const handleSignOut = async () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);

    await signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push('/');
          router.refresh();
        },
        onError: () => {
          setIsSigningOut(false);
        },
      },
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto rounded-xl border border-yellow-800/40 bg-slate-900/60 px-4 py-2 shadow-lg hover:bg-slate-900/80"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-500/15 text-yellow-400">
              <User className="h-4 w-4" />
            </div>

            <div className="min-w-0 text-left">
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

            <ChevronDown className="h-4 w-4 text-slate-400" />
          </div>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="w-72 border-yellow-800/40 bg-slate-950/95 text-slate-100"
      >
        <DropdownMenuLabel className="space-y-1">
          <div className="text-sm font-semibold text-yellow-100">
            {sessionUser?.name || '当前账号'}
          </div>
          <div className="truncate text-xs font-normal text-slate-400">
            {sessionUser?.email || '已连接 Cloudflare D1'}
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="bg-yellow-900/30" />

        <DropdownMenuItem
          className="cursor-pointer text-red-300 focus:bg-red-950/40 focus:text-red-200"
          disabled={isSigningOut}
          onClick={() => {
            void handleSignOut();
          }}
        >
          {isSigningOut ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="mr-2 h-4 w-4" />
          )}
          <span>{isSigningOut ? '退出中...' : '退出登录'}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
