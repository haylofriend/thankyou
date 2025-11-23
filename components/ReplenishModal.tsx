import React, { useEffect, useMemo, useState } from 'react';
import authedFetch from '../lib/authedFetch';
import { MagicShareButton } from '../components/MagicShareButton';

type StripeStatus = {
  connected: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
};

type BalanceResponse = {
  ok: boolean;
  available_cents: number;
  currency: string;
};

type PayoutSuccess = {
  ok: true;
  speed: string;
  payout: {
    id: string;
    amount_cents: number;
    currency: string;
    type: string;
  };
};

type PayoutError = {
  error: string;
  message?: string;
};

type PayoutResponse = PayoutSuccess | PayoutError;

type StripeStatusState = StripeStatus | null;

type FlowState =
  | 'loading'
  | 'notConnected'
  | 'needsSetup'
  | 'noFunds'
  | 'ready'
  | 'payoutInProgress'
  | 'payoutSuccess'
  | 'payoutError';

interface ReplenishModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Optional: link to share your page when there are no funds yet */
  shareLink?: string;
}

/**
 * ReplenishModal
 *
 * One button that "just works":
 * - If Stripe isn’t connected → guides user to connect  (POST /api/creator/stripe/connect)
 * - If Stripe needs more info → guides user to finish setup
 * - If Stripe ready but no funds → explains + offers "Share your link"
 * - If Stripe ready and has funds → starts payout (POST /api/creator/payout/start)
 */
export const ReplenishModal: React.FC<ReplenishModalProps> = ({
  isOpen,
  onClose,
  shareLink,
}) => {
  const [stripeStatus, setStripeStatus] = useState<StripeStatusState>(null);
  const [balance, setBalance] = useState<BalanceResponse | null>(null);
  const [flowState, setFlowState] = useState<FlowState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [payoutAmountCents, setPayoutAmountCents] = useState<number | null>(
    null
  );

  // Load status + balance whenever the modal opens
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setFlowState('loading');
    setErrorMessage(null);

    async function fetchData() {
      try {
        const [statusRes, balanceRes] = await Promise.all([
          fetch('/api/creator/stripe/status'),
          authedFetch('/api/creator/balance'),
        ]);

        const statusJson = (await statusRes.json()) as StripeStatus;
        const balanceJson = (await balanceRes.json()) as BalanceResponse;

        if (cancelled) return;

        setStripeStatus(statusJson);
        setBalance(balanceJson);
      } catch (err) {
        console.error('Error loading replenish data', err);
        if (!cancelled) {
          setErrorMessage('Something went wrong while loading your payouts.');
          setFlowState('payoutError');
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Derive primary state from status + balance
  const derivedState: FlowState = useMemo(() => {
    if (!stripeStatus || !balance) return 'loading';
    if (!stripeStatus.connected) return 'notConnected';
    if (!stripeStatus.details_submitted || !stripeStatus.payouts_enabled)
      return 'needsSetup';
    if (!balance.ok || balance.available_cents <= 0) return 'noFunds';
    return 'ready';
  }, [stripeStatus, balance]);

  useEffect(() => {
    // Only override flow state when not actively in payout progress/result
    if (flowState === 'payoutInProgress' || flowState === 'payoutSuccess') {
      return;
    }
    if (derivedState === 'ready') {
      // Pre-fill payout amount for the UI
      if (balance && balance.available_cents > 0) {
        setPayoutAmountCents(balance.available_cents);
      }
    }
    setFlowState(derivedState);
  }, [derivedState, balance, flowState]);

  const amountDollars =
    payoutAmountCents != null ? (payoutAmountCents / 100).toFixed(2) : '0.00';

  async function handleStripeConnect() {
    try {
      setFlowState('loading');
      setErrorMessage(null);

      const res = await fetch('/api/creator/stripe/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const json = await res.json();

      if (!res.ok || !json.url) {
        console.error('Stripe connect error', json);
        setErrorMessage('Could not start Stripe setup. Please try again.');
        setFlowState(derivedState);
        return;
      }

      window.location.href = json.url as string;
    } catch (err) {
      console.error('Stripe connect error', err);
      setErrorMessage('Could not start Stripe setup. Please try again.');
      setFlowState(derivedState);
    }
  }

  async function handleShareLink() {
    if (!shareLink) {
      console.warn('Share link pressed but no shareLink provided');
      setErrorMessage('We could not find your Haylo link yet. Please try again in a moment.');
      return;
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        const shareText =
          'Hey, I set up a tiny thank-you space on Haylofriend.\n\n' +
          'No pressure at all, but if you ever feel like saying thanks or supporting my work, this is where to do it 💛';

        await navigator.share({
          title: 'Share a little gratitude',
          text: `${shareText}\n${shareLink}`,
          url: shareLink,
        });
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        const shareText =
          'Quick thank-you link for small kindnesses—no pressure at all:\n' +
          shareLink;

        await navigator.clipboard.writeText(shareText);
        setErrorMessage('Gratitude link copied. Paste it into any message 💌');
      } else {
        setErrorMessage(
          'Here is your gratitude link. Copy and share it with someone who made your day brighter:\n' +
            shareLink
        );
      }
    } catch (err) {
      console.error('Share link error', err);
      setErrorMessage('Could not open share dialog. Try copying the link.');
    }
  }

  async function handlePayout() {
    try {
      setFlowState('payoutInProgress');
      setErrorMessage(null);

      const res = await fetch('/api/creator/payout/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speed: 'standard' }),
      });

      const json = (await res.json()) as PayoutResponse;

      if (!res.ok || !(json as PayoutSuccess).ok) {
        const errJson = json as PayoutError;
        console.warn('Payout error', errJson);

        const msg =
          errJson.message ||
          'We could not start your payout. Please try again in a moment.';

        setErrorMessage(msg);
        setFlowState('payoutError');
        return;
      }

      const success = json as PayoutSuccess;
      setPayoutAmountCents(success.payout.amount_cents);
      setFlowState('payoutSuccess');
    } catch (err) {
      console.error('Payout start error', err);
      setErrorMessage(
        'We could not start your payout. Please try again in a moment.'
      );
      setFlowState('payoutError');
    }
  }

  if (!isOpen) return null;

  function renderPrimaryAction() {
    switch (flowState) {
      case 'notConnected':
      case 'needsSetup':
        return (
          <button
            onClick={handleStripeConnect}
            className="w-full rounded-xl bg-amber-500 px-4 py-3 font-semibold text-slate-950 shadow hover:bg-amber-400 transition"
          >
            Connect Stripe
          </button>
        );
      case 'noFunds':
        return (
          <MagicShareButton
            onClick={handleShareLink}
            disabled={flowState === 'loading' || flowState === 'payoutInProgress'}
            className="w-full"
          />
        );
      case 'ready':
        return (
          <button
            onClick={handlePayout}
            className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 shadow hover:bg-emerald-400 transition"
          >
            Send to your bank
          </button>
        );
      case 'payoutInProgress':
        return (
          <button
            disabled
            className="w-full rounded-xl bg-slate-700 px-4 py-3 font-semibold text-slate-300"
          >
            Sending...
          </button>
        );
      case 'payoutSuccess':
        return (
          <button
            onClick={onClose}
            className="w-full rounded-xl border border-emerald-400/70 px-4 py-3 font-semibold text-emerald-100 hover:border-emerald-300 transition"
          >
            Close
          </button>
        );
      case 'payoutError':
        return (
          <button
            onClick={() => setFlowState(derivedState)}
            className="w-full rounded-xl bg-amber-500 px-4 py-3 font-semibold text-slate-950 shadow hover:bg-amber-400 transition"
          >
            Try again
          </button>
        );
      default:
        return (
          <button
            disabled
            className="w-full rounded-xl bg-slate-700 px-4 py-3 font-semibold text-slate-300"
          >
            Loading...
          </button>
        );
    }
  }

  function renderStateDescription() {
    switch (flowState) {
      case 'loading':
        return 'Checking your payouts...';
      case 'notConnected':
        return 'Connect your Stripe account to start receiving payouts.';
      case 'needsSetup':
        return 'Stripe needs a few more details before we can send payouts.';
      case 'noFunds':
        return 'Invite one person to say thanks and turn their appreciation into support—only if it feels right to them.';
      case 'ready':
        return 'Ready to transfer your available balance to your bank.';
      case 'payoutInProgress':
        return 'Starting your payout...';
      case 'payoutSuccess':
        return 'Payout started! Funds will arrive based on your payout speed.';
      case 'payoutError':
        return 'We hit a snag while starting your payout.';
      default:
        return '';
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
      <div className="relative max-w-md w-full rounded-2xl bg-slate-950/90 text-slate-50 shadow-xl border border-slate-800 p-6">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 text-slate-400 hover:text-slate-200 text-sm"
        >
          ✕
        </button>

        <div className="mb-4 text-xs tracking-[0.18em] text-slate-400 uppercase">
          Transparency
        </div>
        <h2 className="text-lg font-semibold mb-2">
          How your source is calculated
        </h2>

        <div className="mt-4 rounded-2xl bg-gradient-to-br from-slate-800/70 to-slate-900/70 p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-200 font-semibold">
              {renderStateDescription()}
            </div>
            {balance && (
              <div className="rounded-full bg-slate-900/80 px-3 py-1 text-xs text-slate-300 border border-slate-700">
                Available: {balance.available_cents / 100} {balance.currency}
              </div>
            )}
          </div>

          {flowState === 'payoutSuccess' && (
            <div className="rounded-xl border border-emerald-400/50 bg-emerald-400/10 p-3 text-sm text-emerald-100">
              We started a payout of ${amountDollars}. It may take a few days to arrive.
            </div>
          )}

          {flowState === 'payoutError' && errorMessage && (
            <div className="rounded-xl border border-amber-400/50 bg-amber-400/10 p-3 text-sm text-amber-100">
              {errorMessage}
            </div>
          )}

          {flowState === 'noFunds' && shareLink && (
            <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3 text-sm text-slate-200">
              Share your Haylo thank-you link with someone who made your day brighter:
              <br />
              <span className="break-all text-slate-300 text-xs">{shareLink}</span>
            </div>
          )}

          {flowState === 'ready' && payoutAmountCents != null && (
            <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3 text-sm text-slate-200">
              You have ${amountDollars} available to send to your bank.
            </div>
          )}

          {flowState === 'loading' && (
            <div className="text-sm text-slate-400">Loading payout info...</div>
          )}

          {renderPrimaryAction()}

          {errorMessage && flowState !== 'payoutError' && (
            <div className="text-xs text-amber-200/80">{errorMessage}</div>
          )}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 text-xs text-slate-400">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <div className="text-slate-300 font-semibold mb-1">Stripe</div>
            <div>
              {stripeStatus?.connected ? 'Connected' : 'Not connected'}.{' '}
              {stripeStatus?.details_submitted ? 'Details submitted.' : ''}{' '}
              {stripeStatus?.payouts_enabled ? 'Payouts on.' : 'Payouts off.'}
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <div className="text-slate-300 font-semibold mb-1">Balance</div>
            <div>
              {balance
                ? `${(balance.available_cents / 100).toFixed(2)} ${balance.currency}`
                : 'Loading...'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

