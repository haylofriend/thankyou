// api/creator/stripe/status.js
//
// Returns the Stripe Connect status for the authenticated creator.
// Shape:
//   {
//     connected: boolean,
//     payouts_enabled: boolean,
//     details_submitted: boolean
//   }

const {
  stripe,
  supabase,
  json,
  getUserFromAuthHeader
} = require('../../_stripeShared');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (!supabase) {
    return json(res, 500, { error: 'Supabase not configured' });
  }

  try {
    // 1) Identify the current user
    const user = await getUserFromAuthHeader(req);
    if (!user) {
      return json(res, 401, { error: 'Unauthorized' });
    }

    // 2) Look up their profile to find stripe_account_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, stripe_account_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('creator/stripe/status profile error', profileError);
      return json(res, 500, { error: 'Failed to fetch Stripe profile' });
    }

    if (!profile || !profile.stripe_account_id) {
      // No Stripe account on file yet
      return json(res, 200, {
        connected: false,
        payouts_enabled: false,
        details_submitted: false
      });
    }

    // 3) Ask Stripe for the account details
    const account = await stripe.accounts.retrieve(profile.stripe_account_id);

    return json(res, 200, {
      connected: !!account.charges_enabled,
      payouts_enabled: !!account.payouts_enabled,
      details_submitted: !!account.details_submitted
    });
  } catch (err) {
    console.error('creator/stripe/status error', err);
    return json(res, 500, { error: 'Failed to fetch Stripe status' });
  }
};

