
import { useCallback, useEffect, useState } from 'react';
import {
  aquariumApi,
  type ApiAquarium,
} from '../lib/aquarium-api';

export function useAquarium(aquariumId?: string) {
  const [aquariums, setAquariums] = useState<ApiAquarium[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const aquarium =
    aquariums.find((item) => item.id === aquariumId) ?? null;

  const refreshAquariums = useCallback(async () => {
    setError(null);

    try {
      const items = await aquariumApi.list();
      setAquariums(items);
      return items;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load aquariums',
      );
      throw err;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      setLoading(true);
      setError(null);

      try {
        const items = await aquariumApi.list();

        if (!cancelled) {
          setAquariums(items);
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
    error:
      error ??
      (!loading && aquariumId && !aquarium
        ? 'Aquarium not found'
        : null),
    refreshAquariums,
  };
}
