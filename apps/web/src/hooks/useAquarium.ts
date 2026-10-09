
import { useEffect, useState } from 'react';
import {
  aquariumApi,
  type ApiAquarium,
} from '../lib/aquarium-api';

export function useAquarium() {
  const [aquarium, setAquarium] = useState<ApiAquarium | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAquarium() {
      try {
        const aquariums = await aquariumApi.list();

        if (cancelled) return;

        let selected = aquariums.find((item) => item.isDefault)
          ?? aquariums[0];

        if (!selected) {
          throw new Error('No aquarium found for this account');
        }

        if (!cancelled) {
          setAquarium(selected);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load aquarium',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadAquarium();

    return () => {
      cancelled = true;
    };
  }, []);

  return { aquarium, loading, error };
}
