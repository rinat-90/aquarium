import { useEffect, useRef, useState } from 'react';
import { socket } from '../lib/socket';
import { fishApi } from '../lib/aquarium-api';
import type { CreatedFish } from '../types/fish';
import { mapApiFish } from '../lib/mapApiFish';

export function useLiveAquariumFish(aquariumId?: string) {
  const [fish, setFish] = useState<CreatedFish[]>([]);
  const [loading, setLoading] = useState(Boolean(aquariumId));
  const [error, setError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const requestVersion = useRef(0);

  useEffect(() => {
    const version = ++requestVersion.current;
    if (!aquariumId) {
      setFish([]);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setFish([]);
    setLoading(true);
    setError(null);

    async function loadFish() {
      try {
        const items = await fishApi.list();
        const matching = items.filter(item => item.aquariumId === aquariumId);
        const mapped = await Promise.all(matching.map(mapApiFish));
        if (!cancelled && version === requestVersion.current) {
          setFish(mapped);
          setError(null);
        }
      } catch (err) {
        if (!cancelled && version === requestVersion.current) {
          setError(err instanceof Error ? err.message : 'Failed to load fish');
        }
      } finally {
        if (!cancelled && version === requestVersion.current) setLoading(false);
      }
    }
    void loadFish();
    return () => { cancelled = true; };
  }, [aquariumId, refreshVersion]);

  useEffect(() => {
    if (!aquariumId) return;
    const refresh = () => setRefreshVersion(value => value + 1);
    const join = () => {
      socket.emit('aquarium:join', aquariumId, (result: { ok: boolean }) => {
        if (result.ok) refresh();
        else console.warn('Failed to join aquarium room');
      });
    };
    const changed = (event: { aquariumId: string }) => {
      if (event.aquariumId === aquariumId) refresh();
    };
    socket.on('connect', join);
    socket.on('aquarium:changed', changed);
    socket.connect();
    if (socket.connected) join();
    return () => {
      socket.emit('aquarium:leave', aquariumId);
      socket.off('connect', join);
      socket.off('aquarium:changed', changed);
      // Do not disconnect the shared singleton: other consumers may use it.
    };
  }, [aquariumId]);

  return { fish, setFish, loading, error, refresh: () => setRefreshVersion(value => value + 1) };
}
