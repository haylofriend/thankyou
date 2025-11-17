// /public/admin-guard-ui.js

(async function hayloAdminGuardUI() {
  if (!window.HayloAuth || typeof window.HayloAuth.whoami !== 'function') {
    console.warn('HayloAuth or whoami() not available; cannot enforce admin UI guard.');
    return;
  }

  try {
    const user = await window.HayloAuth.whoami();
    // Adjust to match your actual user shape
    const role = user?.role || user?.user_metadata?.role;

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
