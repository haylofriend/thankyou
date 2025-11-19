// /public/admin-guard-ui.js

(async function hayloAdminGuardUI() {
  if (!window.HayloAuth || typeof window.HayloAuth.whoami !== 'function') {
    console.warn('HayloAuth or whoami() not available; cannot enforce admin UI guard.');
    return;
  }

  try {
    const info = await window.HayloAuth.whoami();
    const user = info?.user || null;

    if (!user) {
      throw new Error('No authenticated user returned from HayloAuth.whoami()');
    }

    // role can be on the root user, user_metadata, or app_metadata depending on Supabase config
    const role =
      user.role ||
      user.user_metadata?.role ||
      user.app_metadata?.role;

    const isAdmin = role === 'admin' || role === 'super_admin';

    if (!isAdmin) {
      // Optional: show a quick message before leaving
      alert('You do not have permission to access Mission Control.');
      window.location.replace('/your-impact'); // or a 404 page
    }
  } catch (err) {
    console.error('Admin UI guard failed:', err);
    window.location.replace('/'); // safest default
  }
})();
