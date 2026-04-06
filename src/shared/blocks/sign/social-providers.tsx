'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Github } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { signIn } from '@/core/auth/client';
import { defaultLocale } from '@/config/locale';
import { Button } from '@/shared/components/ui/button';
import { useAppContext } from '@/shared/contexts/app';
import { cn } from '@/shared/lib/utils';
import { Button as ButtonType } from '@/shared/types/blocks/common';

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-.8 2.3-1.7 3.1l2.7 2.1c1.6-1.5 2.5-3.7 2.5-6.4 0-.6-.1-1.2-.2-1.7H12z"
      />
      <path
        fill="#34A853"
        d="M12 21c2.4 0 4.5-.8 6-2.2l-2.7-2.1c-.8.5-1.9.9-3.3.9-2.5 0-4.7-1.7-5.4-4H3.8v2.2C5.3 18.9 8.4 21 12 21z"
      />
      <path
        fill="#4A90E2"
        d="M6.6 13.6c-.2-.5-.3-1.1-.3-1.6s.1-1.1.3-1.6V8.2H3.8A9 9 0 0 0 3 12c0 1.4.3 2.7.8 3.8l2.8-2.2z"
      />
      <path
        fill="#FBBC05"
        d="M12 6.4c1.4 0 2.6.5 3.6 1.4l2.7-2.7C16.5 3.4 14.4 2.5 12 2.5c-3.6 0-6.7 2.1-8.2 5.2l2.8 2.2c.7-2.3 2.9-3.5 5.4-3.5z"
      />
    </svg>
  );
}

export function SocialProviders({
  configs,
  callbackUrl,
  loading,
  setLoading,
}: {
  configs: Record<string, string>;
  callbackUrl: string;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}) {
  const t = useTranslations('common.sign');
  const locale = useLocale();

  const { setIsShowSignModal } = useAppContext();
  const popupRef = useRef<Window | null>(null);
  const popupTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  if (callbackUrl) {
    if (
      locale !== defaultLocale &&
      callbackUrl.startsWith('/') &&
      !callbackUrl.startsWith(`/${locale}`)
    ) {
      callbackUrl = `/${locale}${callbackUrl}`;
    }
  }

  const cleanupPopup = useCallback(() => {
    if (popupTimerRef.current) {
      clearInterval(popupTimerRef.current);
      popupTimerRef.current = null;
    }
    popupRef.current = null;
  }, []);

  const handleAuthCallback = useCallback(() => {
    cleanupPopup();
    setIsShowSignModal(false);
    // Hard reload the page so the browser picks up the new session cookie
    window.location.reload();
  }, [cleanupPopup, setIsShowSignModal]);

  // Listen for localStorage event from the popup callback page
  // (works even when COOP blocks window.opener / postMessage)
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'auth-callback-success') {
        handleAuthCallback();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [handleAuthCallback]);

  const handleSignIn = async ({ provider }: { provider: string }) => {
    setLoading(true);

    // Open popup to the intermediate page that triggers signIn.social()
    const popupPath =
      locale !== defaultLocale
        ? `/${locale}/auth-popup?provider=${provider}`
        : `/auth-popup?provider=${provider}`;
    const popupUrl = `${window.location.origin}${popupPath}`;

    // Open centered popup window
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      popupUrl,
      'oauth-popup',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`
    );

    if (!popup) {
      // Popup blocked - fall back to redirect
      toast.error('Popup blocked. Trying redirect...');
      setLoading(false);
      await signIn.social(
        { provider, callbackURL: callbackUrl },
        {
          onRequest: () => setLoading(true),
          onSuccess: () => setIsShowSignModal(false),
          onError: (e: any) => {
            toast.error(e?.error?.message || 'Sign in failed');
            setLoading(false);
          },
        }
      );
      return;
    }

    popupRef.current = popup;

    // Poll to detect if popup was closed manually (without completing auth)
    popupTimerRef.current = setInterval(() => {
      try {
        if (popup.closed) {
          cleanupPopup();
          setLoading(false);
        }
      } catch {
        // COOP may block access to popup.closed; ignore and keep polling
      }
    }, 500);
  };

  const providers: ButtonType[] = [];

  if (configs.google_auth_enabled === 'true') {
    providers.push({
      name: 'google',
      title: t('google_sign_in_title'),
      icon: <GoogleIcon />,
      onClick: () => handleSignIn({ provider: 'google' }),
    });
  }

  if (configs.github_auth_enabled === 'true') {
    providers.push({
      name: 'github',
      title: t('github_sign_in_title'),
      icon: <Github />,
      onClick: () => handleSignIn({ provider: 'github' }),
    });
  }

  return (
    <div
      className={cn(
        'flex w-full items-center gap-2',
        'flex-col justify-between'
      )}
    >
      {providers.map((provider) => (
        <Button
          key={provider.name}
          type="button"
          variant="outline"
          className={cn('w-full gap-2')}
          disabled={loading}
          onClick={provider.onClick}
        >
          {provider.icon}
          <h3>{provider.title}</h3>
        </Button>
      ))}
    </div>
  );
}
