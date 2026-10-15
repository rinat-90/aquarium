import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { socket } from '../../lib/socket';
import { aquariumApi, type ApiAquarium } from '../../lib/aquarium-api';
import { ThreeAquariumView } from '../../components/Aquarium3D/ThreeAquariumView';
import { useLiveAquariumFish } from '../../hooks/useLiveAquariumFish';
import {
  DEFAULT_AQUARIUM_CUSTOMIZATION,
  type AquariumCustomization,
} from '../../features/aquarium-customization/types';
import { AquariumAppearanceEditor } from '../../components/AquariumAppearanceEditor/AquariumAppearanceEditor';
import '../../components/AquariumAppearanceEditor/AquariumAppearanceEditor.css';
import { saveAquariumAppearance } from '../../lib/save-aquarium-appearance';
import { applyAquariumTheme } from '../../features/aquarium-customization/themeRegistry';
import { AQUARIUM_THEMES } from '../../features/aquarium-customization/themeRegistry';
import './EditAquariumPage.css';

type Section = 'overview' | 'fish' | 'appearance' | 'decorations' | 'feeding' | 'settings';
const sections: { id: Section; icon: string; label: string }[] = [
  { id: 'overview', icon: '▦', label: 'Overview' },
  { id: 'fish', icon: '🐠', label: 'Fish' },
  { id: 'appearance', icon: '🎨', label: 'Appearance' },
  { id: 'decorations', icon: '🪸', label: 'Decorations' },
  { id: 'feeding', icon: '◌', label: 'Feeding' },
  { id: 'settings', icon: '⚙', label: 'Settings' },
];
const themeIcons: Record<string, string> = {
  'sunny-reef': '🪸',
  'ocean-garden': '🌿',
  'midnight-sea': '🌙',
  'magic-lagoon': '🍄',
};
const backgroundThemes: Record<string, string> = {
  coral: 'sunny-reef',
  ocean: 'ocean-garden',
  'deep-sea': 'midnight-sea',
  fantasy: 'magic-lagoon',
};

export function EditAquariumPage() {
  const { id } = useParams<{ id: string }>();
  const [aquarium, setAquarium] = useState<ApiAquarium | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<Section>('overview');
  const tabsRef = useRef<HTMLElement | null>(null);
  const { fish, loading: fishLoading } = useLiveAquariumFish(id);
  const [appearance, setAppearance] = useState<AquariumCustomization>(
    DEFAULT_AQUARIUM_CUSTOMIZATION,
  );
  const [savedAppearance, setSavedAppearance] = useState<AquariumCustomization>(
    DEFAULT_AQUARIUM_CUSTOMIZATION,
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [selectedDecorationId, setSelectedDecorationId] = useState<string | null>(null);
  const [feedSequence, setFeedSequence] = useState(0);
  const [feeding, setFeeding] = useState(false);
  const [feedCooldownUntil, setFeedCooldownUntil] = useState(0);
  const [feedRemaining, setFeedRemaining] = useState(0);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const onFeed = (event: { aquariumId: string }) => {
      if (event.aquariumId === id) setFeedSequence((value) => value + 1);
    };
    socket.on('aquarium:feed', onFeed);
    return () => {
      socket.off('aquarium:feed', onFeed);
    };
  }, [id]);

  useEffect(() => {
    if (!feedCooldownUntil) return;
    const tick = () =>
      setFeedRemaining(Math.max(0, Math.ceil((feedCooldownUntil - Date.now()) / 1000)));
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [feedCooldownUntil]);

  const feedFish = () => {
    if (!id || feeding || Date.now() < feedCooldownUntil) return;
    setFeeding(true);
    setFeedError(null);
    socket
      .timeout(5000)
      .emit(
        'aquarium:feed',
        id,
        (err: Error | null, result?: { ok: boolean; retryAfterMs?: number }) => {
          setFeeding(false);
          if (err || !result) {
            setFeedError('Could not reach the aquarium. Please try again.');
            return;
          }
          if (result.ok) {
            setFeedCooldownUntil(Date.now() + 3000);
            return;
          }
          if (result.retryAfterMs) setFeedCooldownUntil(Date.now() + result.retryAfterMs);
          setFeedError('Feeding is temporarily unavailable. Please try again shortly.');
        },
      );
  };

  const saveName = async () => {
    if (!aquarium || settingsBusy) return;
    const name = nameDraft.trim();
    if (!name) {
      setSettingsError('Please enter an aquarium name.');
      return;
    }
    setSettingsBusy(true);
    setSettingsError(null);
    setSettingsMessage(null);
    try {
      const updated = await aquariumApi.update(aquarium.id, name);
      setAquarium((current) => (current ? { ...current, name: updated.name } : current));
      setNameDraft(updated.name);
      setSettingsMessage('Aquarium name saved.');
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Could not rename aquarium.');
    } finally {
      setSettingsBusy(false);
    }
  };

  const makeDefault = async () => {
    if (!aquarium || settingsBusy || aquarium.isDefault) return;
    setSettingsBusy(true);
    setSettingsError(null);
    setSettingsMessage(null);
    try {
      await aquariumApi.setDefault(aquarium.id);
      setAquarium((current) => (current ? { ...current, isDefault: true } : current));
      setSettingsMessage('This is now your default aquarium.');
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Could not set default aquarium.');
    } finally {
      setSettingsBusy(false);
    }
  };

  const saveAppearance = async () => {
    if (!id || saving) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await saveAquariumAppearance(id, appearance);
      setSavedAppearance(appearance);
      setSaveSuccess(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save changes');
    } finally {
      setSaving(false);
    }
  };

  const changeSection = (next: Section) => {
    setSection(next);
    setSaveError(null);
    setSaveSuccess(false);
  };

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError('Aquarium ID is missing');
      return;
    }
    let active = true;
    setLoading(true);
    void aquariumApi
      .get(id)
      .then((result) => {
        if (active) {
          setAquarium(result);
          setNameDraft(result.name);
          const initial = { ...DEFAULT_AQUARIUM_CUSTOMIZATION, ...(result.appearance ?? {}) };
          setAppearance(initial);
          setSavedAppearance(initial);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load aquarium');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const themeId =
    appearance.themeId === null
      ? null
      : appearance.themeId ||
        aquarium?.themeId ||
        backgroundThemes[appearance.background] ||
        'sunny-reef';
  const hasUnsavedChanges = JSON.stringify(appearance) !== JSON.stringify(savedAppearance);
  const aquariumUrl = `/aquariums/${encodeURIComponent(id ?? '')}`;

  if (loading) return <div className="edit-aquarium-loading">Loading your underwater world…</div>;
  if (!aquarium || !id)
    return <div className="edit-aquarium-loading">{error ?? 'Aquarium not found'}</div>;

  return (
    <div className="edit-aquarium-page">
      <header className="edit-aquarium-header">
        <div className="edit-aquarium-header-left">
          <Link className="edit-aquarium-back" to="/aquariums">
            ← Back
          </Link>
          <h1>{aquarium.name}</h1>
          <span className="edit-aquarium-status" aria-label="Live aquarium preview">
            ● Live preview
          </span>
        </div>
        <div className="edit-aquarium-header-actions">
          <Link className="edit-aquarium-secondary" to={aquariumUrl}>
            ↗ Open Aquarium
          </Link>
          <button
            type="button"
            className="edit-aquarium-primary"
            onClick={() => changeSection('appearance')}
          >
            ⚙ Customize
          </button>
        </div>
      </header>

      <div className="edit-aquarium-layout">
        <div className="edit-aquarium-nav-wrap">
          <nav ref={tabsRef} className="edit-aquarium-nav" aria-label="Aquarium editor sections">
            {sections.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`edit-aquarium-nav-item${section === item.id ? ' is-active' : ''}`}
                aria-current={section === item.id ? 'page' : undefined}
                onClick={(event) => {
                  changeSection(item.id);
                  event.currentTarget.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'center',
                  });
                }}
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
                {item.id === 'fish' ? ` (${fish.length})` : ''}
              </button>
            ))}
          </nav>
          <button
            type="button"
            className="edit-aquarium-nav-next"
            aria-label="Scroll to more editor sections"
            onClick={() => tabsRef.current?.scrollBy({ left: 180, behavior: 'smooth' })}
          >
            ›
          </button>
        </div>

        <main className="edit-aquarium-main">
          <div className="edit-aquarium-viewport" aria-label="Live 3D aquarium preview">
            <ThreeAquariumView
              createdFish={fish}
              appearance={appearance}
              embedded
              interactive={false}
              showDebugStats={false}
              feedSequence={feedSequence}
            />
            {fishLoading && <span className="edit-aquarium-preview-note">Loading fish…</span>}
            <Link
              className="edit-aquarium-fullscreen"
              to={aquariumUrl}
              aria-label="View fullscreen aquarium"
            >
              ⛶
            </Link>
          </div>

          {section === 'overview' && fish.length === 0 && appearance.themeId === null && (
            <div className="edit-aquarium-empty-guide">
              <strong>Your underwater world is ready!</strong>
              <p>Start with a blank canvas: add your first fish or choose a theme below.</p>
              <Link
                className="edit-aquarium-primary"
                to={`/fish/create?aquariumId=${encodeURIComponent(id)}`}
              >
                ＋ Add Your First Fish
              </Link>
            </div>
          )}

          {section === 'overview' || section === 'appearance' || section === 'decorations' ? (
            <section
              className="edit-aquarium-below"
              aria-label={
                section === 'overview'
                  ? 'Aquarium themes'
                  : section === 'appearance'
                    ? 'Aquarium appearance'
                    : 'Aquarium decorations'
              }
            >
              {section === 'overview' && (
                <div className="edit-aquarium-themes">
                  <button
                    type="button"
                    onClick={() => {
                      setAppearance({
                        ...DEFAULT_AQUARIUM_CUSTOMIZATION,
                        themeId: null,
                        bubbles: 'none',
                      });
                      setSaveSuccess(false);
                    }}
                    className={`edit-aquarium-theme edit-aquarium-theme--empty${appearance.themeId === null ? ' is-selected' : ''}`}
                    title="Start with an empty aquarium"
                  >
                    <div
                      className="edit-aquarium-theme-art edit-aquarium-theme-art--empty"
                      aria-hidden="true"
                    >
                      <span className="edit-aquarium-theme-light" />
                      <span className="edit-aquarium-theme-sand" />
                    </div>
                    <strong>Empty Aquarium</strong>
                    {appearance.themeId === null && (
                      <span className="edit-aquarium-theme-check">✓</span>
                    )}
                  </button>
                  {AQUARIUM_THEMES.filter((theme) =>
                    Object.keys(themeIcons).includes(theme.id),
                  ).map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => {
                        setAppearance((current) => applyAquariumTheme(current, theme));
                        setSaveSuccess(false);
                      }}
                      className={`edit-aquarium-theme edit-aquarium-theme--${theme.id}${themeId === theme.id ? ' is-selected' : ''}`}
                      title={`Preview ${theme.name}`}
                    >
                      <div className="edit-aquarium-theme-art" aria-hidden="true">
                        <span className="edit-aquarium-theme-light" />
                        <span className="edit-aquarium-theme-scenery">{themeIcons[theme.id]}</span>
                        <span className="edit-aquarium-theme-fish">🐠</span>
                        <span className="edit-aquarium-theme-sand" />
                      </div>
                      <strong>{theme.name}</strong>
                      {themeId === theme.id && <span className="edit-aquarium-theme-check">✓</span>}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => changeSection('appearance')}
                    className="edit-aquarium-more"
                  >
                    <span>＋</span>
                    <strong>More</strong>
                  </button>
                </div>
              )}
              {(section === 'appearance' || section === 'decorations') && (
                <div className="edit-aquarium-inline-controls">
                  <AquariumAppearanceEditor
                    key={section}
                    open
                    embedded
                    embeddedSection={section === 'decorations' ? 'decorations' : 'appearance'}
                    initialTab={section === 'decorations' ? 'decorate' : 'worlds'}
                    value={appearance}
                    onChange={(next) => {
                      setAppearance(next);
                      setSaveSuccess(false);
                    }}
                    onClose={() => changeSection('overview')}
                    onSave={() => void saveAppearance()}
                    saving={saving}
                    saveError={saveError}
                    themes={AQUARIUM_THEMES}
                    selectedDecorationId={selectedDecorationId}
                    onDecorationSelect={setSelectedDecorationId}
                  />
                </div>
              )}
              {hasUnsavedChanges && (
                <div className="edit-aquarium-savebar">
                  <span>Unsaved aquarium changes</span>
                  <button type="button" onClick={() => setAppearance(savedAppearance)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="edit-aquarium-primary"
                    disabled={saving}
                    onClick={() => void saveAppearance()}
                  >
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              )}
              {saveSuccess && !hasUnsavedChanges && (
                <p className="edit-aquarium-success" role="status">
                  ✓ Aquarium appearance saved
                </p>
              )}
              {saveError && (
                <p className="edit-aquarium-error" role="alert">
                  {saveError}
                </p>
              )}
            </section>
          ) : section === 'fish' ? (
            <section className="edit-aquarium-below edit-aquarium-fish-section">
              <div className="edit-aquarium-info-section">
                <div>
                  <h2>Your Fish</h2>
                  <p>{fish.length} swimming in this aquarium</p>
                </div>
                <Link
                  className="edit-aquarium-primary"
                  to={`/fish/create?aquariumId=${encodeURIComponent(id)}`}
                >
                  ＋ Add Fish
                </Link>
              </div>
              <div className="edit-aquarium-fish-grid">
                {aquarium.fish.map((item) => (
                  <article key={item.id} className="edit-aquarium-fish-card">
                    <span
                      className="edit-aquarium-fish-avatar"
                      style={{ backgroundColor: item.bodyColor || '#3fa7cf' }}
                    >
                      🐠
                    </span>
                    <div>
                      <strong>{item.name}</strong>
                      <span>{item.species}</span>
                    </div>
                  </article>
                ))}
                {aquarium.fish.length === 0 && <p>No fish yet. Create your first fish!</p>}
              </div>
            </section>
          ) : section === 'feeding' ? (
            <section className="edit-aquarium-below edit-aquarium-control-card">
              <div className="edit-aquarium-info-section">
                <div>
                  <h2>Feeding time 🫧</h2>
                  <p>Drop food into your aquarium and watch your fish swim over.</p>
                </div>
                <button
                  type="button"
                  className="edit-aquarium-primary"
                  disabled={feeding || feedRemaining > 0 || fish.length === 0}
                  onClick={feedFish}
                >
                  {feeding
                    ? 'Feeding…'
                    : feedRemaining > 0
                      ? `Wait ${feedRemaining}s`
                      : '🍽 Feed Fish'}
                </button>
              </div>
              {fish.length === 0 && (
                <p className="edit-aquarium-hint">Add some fish before feeding.</p>
              )}
              {feedError && (
                <p className="edit-aquarium-error" role="alert">
                  {feedError}
                </p>
              )}
              <p className="edit-aquarium-hint">
                Feeding also reaches connected TV displays through the aquarium's existing live
                event.
              </p>
            </section>
          ) : (
            <section className="edit-aquarium-below edit-aquarium-control-card">
              <h2>Aquarium Settings</h2>
              <p className="edit-aquarium-hint">Manage this aquarium without leaving the editor.</p>
              <form
                className="edit-aquarium-settings-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveName();
                }}
              >
                <label htmlFor="edit-aquarium-name">Aquarium name</label>
                <div className="edit-aquarium-settings-row">
                  <input
                    id="edit-aquarium-name"
                    value={nameDraft}
                    maxLength={100}
                    onChange={(event) => {
                      setNameDraft(event.target.value);
                      setSettingsMessage(null);
                    }}
                  />
                  <button
                    type="submit"
                    className="edit-aquarium-primary"
                    disabled={
                      settingsBusy || !nameDraft.trim() || nameDraft.trim() === aquarium.name
                    }
                  >
                    Save Name
                  </button>
                </div>
              </form>
              <div className="edit-aquarium-settings-row edit-aquarium-default-row">
                <div>
                  <strong>Default aquarium</strong>
                  <p className="edit-aquarium-hint">
                    Your default aquarium is selected first when creating fish.
                  </p>
                </div>
                <button
                  type="button"
                  className="edit-aquarium-secondary"
                  disabled={settingsBusy || aquarium.isDefault}
                  onClick={() => void makeDefault()}
                >
                  {aquarium.isDefault ? '✓ Default' : 'Set as Default'}
                </button>
              </div>
              {settingsMessage && (
                <p className="edit-aquarium-success" role="status">
                  ✓ {settingsMessage}
                </p>
              )}
              {settingsError && (
                <p className="edit-aquarium-error" role="alert">
                  {settingsError}
                </p>
              )}
              <div className="edit-aquarium-settings-footer">
                <Link to={aquariumUrl}>Open fullscreen aquarium →</Link>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
