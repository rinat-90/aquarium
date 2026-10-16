import { apiFetch } from './api-client';

type OnboardingStatus = { onboardingCompleted: boolean };

export const onboardingApi = {
  get: () => apiFetch<OnboardingStatus>('/api/onboarding'),
  complete: () => apiFetch<OnboardingStatus>('/api/onboarding/complete', { method: 'POST' }),
};
