import {
  useEffect,
  useState,
} from 'react';

import type {
  CreatedFish,
} from '../../App';

import {
  Fish3DPreview,
} from '../Fish3D/Fish3DPreview';

type FishProfileCardProps = {
  fish: CreatedFish;

  onRename: (
    name: string,
  ) => void;

  onRelease: () => void;

  onClose: () => void;
};

export function FishProfileCard({
                                  fish,
                                  onRename,
                                  onRelease,
                                  onClose,
                                }: FishProfileCardProps) {
  const [name, setName] =
    useState(fish.name);

  const [
    confirmingRelease,
    setConfirmingRelease,
  ] = useState(false);

  useEffect(() => {
    setName(fish.name);
    setConfirmingRelease(false);
  }, [
    fish.id,
    fish.name,
  ]);

  const handleSave = () => {
    const trimmedName =
      name.trim();

    if (!trimmedName) {
      return;
    }

    onRename(trimmedName);
  };

  const createdDate =
    new Date(
      fish.createdAt,
    );

  return (
    <div
      style={{
        position: 'fixed',
        top: 24,
        right: 24,

        width: 280,

        zIndex: 20,

        padding: 20,

        borderRadius: 24,

        background:
          'rgba(255, 255, 255, 0.94)',

        boxShadow:
          '0 12px 40px rgba(0, 0, 0, 0.22)',

        backdropFilter:
          'blur(12px)',

        color: '#17324d',

        fontFamily:
          'system-ui, sans-serif',
      }}
    >
      <button
        type="button"
        aria-label="Close fish profile"
        onClick={onClose}
        style={{
          position: 'absolute',

          top: 12,
          right: 12,

          width: 34,
          height: 34,

          border: 0,

          borderRadius: '50%',

          background:
            '#eaf5f8',

          fontSize: 18,

          cursor: 'pointer',

          zIndex: 2,
        }}
      >
        ✕
      </button>

      <div
        style={{
          height: 150,

          display: 'flex',

          alignItems: 'center',
          justifyContent: 'center',

          marginBottom: 14,

          borderRadius: 18,

          background:
            '#dff6fb',

          overflow: 'hidden',
        }}
      >
        {fish.type === 'drawn' ? (
          <img
            src={fish.image}
            alt={fish.name}
            style={{
              maxWidth: '90%',
              maxHeight: 125,

              objectFit: 'contain',
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
            }}
          >
            <Fish3DPreview
              key={`${fish.id}-${fish.model}`}
              species={fish.model === 'angelfish' ? 'angelfish' : 'classic'}
              bodyColor={fish.bodyColor}
              finColor={fish.finColor}
              paintImage={fish.paintImage}
              size={fish.size}
              height={150}
              editable={false}
            />
          </div>
        )}
      </div>

      <div
        style={{
          marginBottom: 4,

          fontSize: 13,
          fontWeight: 700,

          color: '#60849a',

          textTransform:
            'uppercase',

          letterSpacing: 1,
        }}
      >
        {fish.type === '3d'
          ? 'My 3D Fish'
          : 'My Fish'}
      </div>

      <div
        style={{
          marginBottom: 16,

          paddingRight: 36,

          fontSize: 26,
          fontWeight: 800,
        }}
      >
        {fish.name}
      </div>

      <div
        style={{
          marginBottom: 18,

          fontSize: 14,

          color: '#688397',
        }}
      >
        🐠 Created{' '}
        {createdDate
          .toLocaleDateString(
            undefined,
            {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            },
          )}
      </div>

      <label
        style={{
          display: 'block',

          marginBottom: 6,

          fontSize: 13,
          fontWeight: 700,
        }}
      >
        Fish name
      </label>

      <input
        value={name}
        maxLength={30}
        onChange={(event) =>
          setName(
            event.target.value,
          )
        }
        onKeyDown={(event) => {
          if (
            event.key === 'Enter'
          ) {
            handleSave();
          }
        }}
        style={{
          boxSizing: 'border-box',

          width: '100%',

          padding: '11px 12px',

          border:
            '2px solid #cce8ef',

          borderRadius: 12,

          outline: 'none',

          fontSize: 16,

          color: '#17324d',

          background: 'white',
        }}
      />

      <button
        type="button"
        onClick={handleSave}
        disabled={
          !name.trim() ||
          name.trim() ===
          fish.name
        }
        style={{
          width: '100%',

          marginTop: 10,

          padding: '11px 16px',

          border: 0,

          borderRadius: 12,

          background: '#37b6d5',

          color: 'white',

          fontSize: 15,
          fontWeight: 800,

          cursor: 'pointer',

          opacity:
            !name.trim() ||
            name.trim() ===
            fish.name
              ? 0.5
              : 1,
        }}
      >
        Save Name
      </button>

      <div
        style={{
          height: 1,

          margin:
            '18px 0',

          background:
            '#e1edf1',
        }}
      />

      {!confirmingRelease ? (
        <button
          type="button"
          onClick={() =>
            setConfirmingRelease(
              true,
            )
          }
          style={{
            width: '100%',

            padding:
              '11px 16px',

            border:
              '2px solid #f0a0a0',

            borderRadius: 12,

            background:
              'transparent',

            color: '#c44747',

            fontSize: 15,
            fontWeight: 800,

            cursor: 'pointer',
          }}
        >
          🌊 Release Fish
        </button>
      ) : (
        <div
          style={{
            padding: 12,

            borderRadius: 14,

            background:
              '#fff1f1',
          }}
        >
          <div
            style={{
              marginBottom: 10,

              fontSize: 14,
              fontWeight: 700,

              lineHeight: 1.4,

              textAlign:
                'center',
            }}
          >
            Release{' '}
            {fish.name} from
            your aquarium?
          </div>

          <div
            style={{
              display: 'flex',
              gap: 8,
            }}
          >
            <button
              type="button"
              onClick={() =>
                setConfirmingRelease(
                  false,
                )
              }
              style={{
                flex: 1,

                padding:
                  '10px 12px',

                border: 0,

                borderRadius: 10,

                background:
                  '#dcecef',

                color:
                  '#17324d',

                fontWeight: 700,

                cursor:
                  'pointer',
              }}
            >
              Keep
            </button>

            <button
              type="button"
              onClick={onRelease}
              style={{
                flex: 1,

                padding:
                  '10px 12px',

                border: 0,

                borderRadius: 10,

                background:
                  '#dc5b5b',

                color: 'white',

                fontWeight: 800,

                cursor:
                  'pointer',
              }}
            >
              Release
            </button>
          </div>
        </div>
      )}
    </div>
  );
}