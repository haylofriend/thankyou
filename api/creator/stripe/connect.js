// api/creator/stripe/connect.js
//
// Starts Stripe Connect onboarding for the authenticated creator.
// Returns: { url } where url is a Stripe-hosted onboarding link.

const {
  stripe,
  supabase,
  parseBody,
  json,
  getUserFromAuthHeader
} = require('../../_stripeShared');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (!supabase) {
    return json(res, 500, { error: 'Supabase not configured' });
  }

  try {
    // 1) Identify the current user from the Authorization: Bearer <token> header
    const user = await getUserFromAuthHeader(req);
    if (!user) {
      return json(res, 401, { error: 'Unauthorized' });
    }

    // 2) Read optional return_url from body
    const body = parseBody(req);
    const requestedReturnUrl = body.return_url;

    const defaultDashboard =
      process.env.HAYLO_DASHBOARD_URL ||
      'https://www.haylofriend.com/your-impact';

    const returnUrl = requestedReturnUrl || defaultDashboard;
    const refreshUrl = `${defaultDashboard}?stripe=refresh`;

    // 3) Look up profile for this user to see if they already have a Stripe account
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, stripe_account_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError && profileError.code !== 'PGRST116') {
      console.warn('Profile lookup error', profileError);
    }

    let accountId = profile && profile.stripe_account_id
      ? profile.stripe_account_id
      : null;

    // 4) If no Stripe account yet, create one and store it
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: user.email || undefined,
        business_type: 'individual',
        capabilities: {
          transfers: { requested: true }
        },
        metadata: {
          supabase_user_id: user.id
        }
      });

      accountId = account.id;

      // Upsert stripe_account_id on profiles table
      await supabase
        .from('profiles')
        .upsert(
          {
            id: user.id,
            stripe_account_id: accountId
          },
          { onConflict: 'id' }
        );
    }

    // 5) Create an onboarding link for this Stripe account
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding'
    });

    return json(res, 200, { url: accountLink.url });
  } catch (err) {
    console.error('creator/stripe/connect error', err);
    return json(res, 500, { error: 'Failed to start Stripe onboarding' });
  }
};
