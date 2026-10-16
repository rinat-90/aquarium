import { onboardingApi } from './onboarding-api';

/** Complete onboarding only after a fish has been successfully persisted. */
export async function finishFirstFish(aquariumId: string): Promise<string> {
  const aquariumPath = `/aquariums/${encodeURIComponent(aquariumId)}`;
  try {
    const status = await onboardingApi.get();
    if (!status.onboardingCompleted) {
      await onboardingApi.complete();
      return `${aquariumPath}?firstFish=1`;
    }
  } catch (error) {
    // Fish creation succeeded. Do not block the child from seeing their fish
    // if the optional onboarding status request fails. The dashboard can retry.
    console.warn('Could not finish first-fish onboarding:', error);
  }
  return aquariumPath;
}
