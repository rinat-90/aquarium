import type {
  AquariumBackground,
  AquariumLighting,
  AquariumBubbles,
} from '../../../features/aquarium-customization/types';

export type AquariumEnvironmentPreset = {
  id: AquariumBackground;
  background: {
    top: string;
    bottom: string;
  };
  fog: {
    color: string;
    density: number;
  };
};

export const ENVIRONMENT_PRESETS: Record<
  AquariumBackground,
  AquariumEnvironmentPreset
> = {
  ocean: {
    id: 'ocean',
    background: {
      top: '#075b91',
      bottom: '#04132f',
    },
    fog: {
      color: '#082c50',
      density: 0.018,
    },
  },
  coral: {
    id: 'coral',
    background: {
      top: '#26b9c5',
      bottom: '#07586e',
    },
    fog: {
      color: '#138e9a',
      density: 0.022,
    },
  },
  'deep-sea': {
    id: 'deep-sea',
    background: {
      top: '#182b61',
      bottom: '#020818',
    },
    fog: {
      color: '#08112e',
      density: 0.028,
    },
  },
  fantasy: {
    id: 'fantasy',
    background: {
      top: '#6951bd',
      bottom: '#15113d',
    },
    fog: {
      color: '#30245c',
      density: 0.018,
    },
  },
};

export const LIGHTING_PRESETS: Record<
  AquariumLighting,
  {
    ambientIntensity: number;
    sunlightIntensity: number;
    hemisphereIntensity: number;
  }
> = {
  sunny: {
    ambientIntensity: 1.2,
    sunlightIntensity: 1.65,
    hemisphereIntensity: 1.35,
  },
  soft: {
    ambientIntensity: 1.15,
    sunlightIntensity: 1.1,
    hemisphereIntensity: 1.1,
  },
  night: {
    ambientIntensity: 0.65,
    sunlightIntensity: 0.3,
    hemisphereIntensity: 0.55,
  },
};

export const BUBBLE_PRESETS: Record<AquariumBubbles, number> = {
  none: 0,
  some: 35,
  lots: 65,
};

export const DEEP_OCEAN = ENVIRONMENT_PRESETS.ocean;