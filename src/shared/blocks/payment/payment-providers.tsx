'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Github } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { signIn } from '@/core/auth/client';
import { useRouter } from '@/core/i18n/navigation';
import { defaultLocale } from '@/config/locale';
import { Button } from '@/shared/components/ui/button';
import { useAppContext } from '@/shared/contexts/app';
import { cn } from '@/shared/lib/utils';
import { Button as ButtonType } from '@/shared/types/blocks/common';
import { PricingItem } from '@/shared/types/blocks/pricing';

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

export function PaymentProviders({
  configs,
  callbackUrl,
  loading,
  setLoading,
  pricingItem,
  onCheckout,
  className,
}: {
  configs: Record<string, string>;
  callbackUrl: string;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  pricingItem: PricingItem | null;
  onCheckout: (item: PricingItem, paymentProvider?: string) => void;
  className?: string;
}) {
  const t = useTranslations('common.payment');
  const router = useRouter();

  const { setIsShowPaymentModal } = useAppContext();

  const [paymentProvider, setPaymentProvider] = useState<string | null>(null);

  if (callbackUrl) {
    const locale = useLocale();
    if (
      locale !== defaultLocale &&
      callbackUrl.startsWith('/') &&
      !callbackUrl.startsWith(`/${locale}`)
    ) {
      callbackUrl = `/${locale}${callbackUrl}`;
    }
  }

  const handlePayment = async ({ provider }: { provider: string }) => {
    if (!provider) {
      toast.error('please select payment method');
      return;
    }
    if (!pricingItem) {
      toast.error('please select a pricing item');
      return;
    }

    onCheckout(pricingItem, provider);
  };

  // Get allowed payment providers from pricing item
  // If payment_providers is set, use it; otherwise show all enabled providers
  const allowedProviders = pricingItem?.payment_providers;
  
  // Helper function to check if a provider is allowed
  const isProviderAllowed = (providerName: string): boolean => {
    // If no payment_providers specified, allow all
    if (!allowedProviders || allowedProviders.length === 0) {
      return true;
    }
    // Check if provider is in the allowed list
    return allowedProviders.includes(providerName);
  };

  const providers: ButtonType[] = [];

  if (configs.stripe_enabled === 'true' && isProviderAllowed('stripe')) {
    providers.push({
      name: 'stripe',
      title: 'Stripe',
      icon_url: '/imgs/icons/stripe.png',
      onClick: () => handlePayment({ provider: 'stripe' }),
    });
  }

  if (configs.creem_enabled === 'true' && isProviderAllowed('creem')) {
    providers.push({
      name: 'creem',
      title: 'Creem',
      icon_url: '/imgs/icons/creem.png',
      onClick: () => handlePayment({ provider: 'creem' }),
    });
  }

  if (configs.paypal_enabled === 'true' && isProviderAllowed('paypal')) {
    providers.push({
      name: 'paypal',
      title: 'Paypal',
      icon_url: '/imgs/icons/paypal.svg',
      onClick: () => handlePayment({ provider: 'paypal' }),
    });
  }

  return (
    <div
      className={cn(
        'flex w-full items-center gap-2',
        'flex-col justify-between',
        className
      )}
    >
      {providers.map((provider) => (
        <Button
          key={provider.name}
          variant="outline"
          className={cn('w-full gap-2')}
          disabled={loading}
          onClick={() => {
            if (!provider.onClick || !provider.name) {
              toast.error('invalid payment method');
              return;
            }

            setPaymentProvider(provider.name);
            provider.onClick();
          }}
        >
          {provider.icon_url && (
            <Image
              src={provider.icon_url}
              alt={provider.title || provider.name || ''}
              width={24}
              height={24}
              className="rounded-full"
            />
          )}
          <h3>{provider.title}</h3>
          {paymentProvider === provider.name && loading && (
            <Loader2 className="size-4 animate-spin" />
          )}
        </Button>
      ))}
    </div>
  );
}
