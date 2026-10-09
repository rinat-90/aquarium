
import { useCallback, useEffect, useState } from 'react';

import {
  aquariumApi,
  type ApiAquarium,
} from '../lib/aquarium-api';

export function useAquarium() {
  const [aquariums, setAquariums] = useState<ApiAquarium[]>([]);
  const [aquarium, setAquarium] = useState<ApiAquarium | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshAquariums = useCallback(
    async (preferredAquariumId?: string) => {
      setError(null);

      try {
        const items = await aquariumApi.list();

        setAquariums(items);

        setAquarium((current) =>
          items.find((item) => item.id === preferredAquariumId) ??
          items.find((item) => item.id === current?.id) ??
          items.find((item) => item.isDefault) ??
          items[0] ??
          null,
        );

        return items;
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load aquariums',
        );
        throw err;
      }
    },
    [],
  );

  const selectAquarium = useCallback(
    (aquariumId: string) => {
      const selected = aquariums.find(
        (item) => item.id === aquariumId,
      );

      if (!selected) {
        return;
      }

      setAquarium(selected);
    },
    [aquariums],
  );

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      setLoading(true);

      try {
        const items = await aquariumApi.list();

        if (cancelled) return;

        setAquariums(items);

        setAquarium(
          items.find((item) => item.isDefault) ??
          items[0] ??
          null,
        );

        if (items.length === 0) {
          setError('No aquarium found for this account');
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load aquariums',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    aquarium,
    aquariums,
    loading,
    error,
    selectAquarium,
    refreshAquariums,
  };
}
