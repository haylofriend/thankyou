import { test, expect } from '@playwright/test';

// Helper: wait for navigation to Supabase/Google OAuth
async function expectOAuthRedirect(page: any) {
  await page.waitForURL(
    url => /accounts\.google\.com/.test(String(url)) || /supabase\.co\/auth\/v1/.test(String(url)),
    { timeout: 15000 }
  );
}

test.describe('Auth QA', () => {
  test('env.js exists and injects globals', async ({ request, page, baseURL }) => {
    // 1) /env.js returns 200
    const envRes = await request.get(`${baseURL}/env.js`);
    expect(envRes.status()).toBe(200);
    // 2) globals appear on page after load
    await page.goto('/get-started');
    const supaUrl = await page.evaluate(() => (window as any).SUPABASE_URL || (window as any).__ENV__?.SUPABASE_URL);
    const anonKey = await page.evaluate(() => (window as any).SUPABASE_ANON_KEY || (window as any).__ENV__?.SUPABASE_ANON_KEY);
    expect(supaUrl, 'SUPABASE_URL missing').toBeTruthy();
    expect(anonKey, 'SUPABASE_ANON_KEY missing').toBeTruthy();
  });

  test('get-started renders and Vue is present', async ({ page }) => {
    await page.goto('/get-started');
    await expect(page.locator('h1:text("In. One Click.")')).toBeVisible();
    const hasVue = await page.evaluate(() => !!(window as any).Vue);
    expect(hasVue).toBeTruthy();
  });

  test('Smart One-Click → OAuth fallback when One Tap unavailable', async ({ page }) => {
    // Block the GIS script so One Tap is "unavailable"
    await page.route('https://accounts.google.com/gsi/client', route => route.abort());
    await page.goto('/get-started');
    // Click Smart One-Click
    await page.getByRole('button', { name: /Smart One-Click/i }).click();
    await expectOAuthRedirect(page);
  });

  test('Continue with Google → OAuth redirect', async ({ page }) => {
    await page.goto('/get-started');
    await page.getByRole('button', { name: /Continue with Google/i }).click();
    await expectOAuthRedirect(page);
  });

  test('Magic Link triggers Supabase OTP request', async ({ page }) => {
    await page.goto('/get-started');
    // Capture Supabase URL from the page
    const supa = await page.evaluate(() => ({
      url: (window as any).SUPABASE_URL || (window as any).__ENV__?.SUPABASE_URL
    }));
    expect(supa.url, 'SUPABASE_URL not injected').toBeTruthy();
    const otpRegex = new RegExp(`${supa.url.replaceAll('.', '\\.').replaceAll('/', '\\/')}/auth\\/v1\\/otp`);

    // Handle prompt() for email and watch network
    page.on('dialog', d => d.accept('qa+magiclink@haylofriend.com'));
    const reqPromise = page.waitForRequest(otpRegex, { timeout: 15000 });
    await page.getByRole('button', { name: /Magic Link/i }).click();
    const req = await reqPromise;
    expect(req.method()).toBe('POST');
  });

  test('Autostart (?autostart=1) behaves like Smart One-Click when One Tap unavailable', async ({ page }) => {
    // Block GIS to force fallback again
    await page.route('https://accounts.google.com/gsi/client', route => route.abort());
    await page.goto('/get-started?autostart=1');
    await expectOAuthRedirect(page);
  });
});
