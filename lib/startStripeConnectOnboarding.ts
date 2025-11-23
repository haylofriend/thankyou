import authedFetch from './authedFetch';

/**
 * Starts Stripe Connect onboarding for the current creator.
 */
export default async function startStripeConnectOnboarding(): Promise<void> {
  try {
    const res = await authedFetch('/api/creator/stripe/connect', {
      method: 'POST',
    });

    const json = await res.json();

    if (json?.url) {
      window.location.href = json.url as string;
      return;
    }

    console.error('Stripe connect error', json);
  } catch (err) {
    console.error('Stripe connect error', err);
  }

  alert('Could not start Stripe setup. Please try again in a moment.');
}
