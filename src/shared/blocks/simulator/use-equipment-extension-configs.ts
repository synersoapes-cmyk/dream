'use client';

import { useEffect, useState } from 'react';

type EquipmentExtensionConfigItem = {
  configKey: string;
  value: unknown;
  enabled: boolean;
};

export function useEquipmentExtensionConfigs(keys: string[]) {
  const [configs, setConfigs] = useState<EquipmentExtensionConfigItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (keys.length === 0) {
      setConfigs([]);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        for (const key of keys) {
          params.append('keys', key);
        }

        const response = await fetch(
          `/api/simulator/equipment-extension-configs?${params.toString()}`,
          {
            method: 'GET',
            cache: 'no-store',
          }
        );
        const payload = await response.json();
        if (!response.ok || payload?.code !== 0 || !Array.isArray(payload?.data)) {
          throw new Error(
            payload?.message || 'failed to load simulator equipment extensions'
          );
        }

        if (!cancelled) {
          setConfigs(payload.data);
        }
      } catch (error) {
        console.error('Failed to load simulator equipment extension configs:', error);
        if (!cancelled) {
          setConfigs([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [keys.join('::')]);

  return {
    configs,
    isLoading,
  };
}
