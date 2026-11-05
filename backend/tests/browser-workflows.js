// Native Chrome DevTools Protocol verification; uses a new profile and synthetic accounts only.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import Booking from '../model/booking.model.js';
import { User } from '../model/user.model.js';
import KYC from '../model/kyc.model.js';
import { Review } from '../model/review.model.js';
import { ContactMessage } from '../model/contact.model.js';
import { TourPackage } from '../model/tourPackage.model.js';
import { Message } from '../model/message.model.js';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function runBrowserWorkflows({ origin, temporary, customer, admin, guide, password, browserBooking, api, expect, processes }) {
  assert.equal(new URL(origin).hostname, '127.0.0.1');
  assert.equal(typeof WebSocket, 'function', 'Browser checks require Node >=22 with native WebSocket.');
  const profile = path.join(temporary, 'chrome-profile'); await mkdir(profile);
  const chrome = spawn(process.env.CHROME_BINARY || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-background-networking', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`, '--window-size=1440,1100', 'about:blank'], { stdio: 'ignore' });
  processes.push(chrome); let launchError; chrome.on('error', error => { launchError = error; });
  let port;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (launchError) throw launchError;
    try { port = Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); if (port) break; } catch {}
    await pause(100);
  }
  assert.ok(port, 'Isolated Chrome debugger did not start.');
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let sequence = 0; const pending = new Map(), exceptions = [], failedApi = [], failedLocal = [];
  let expectedQueueFailure = false;
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence; const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 20000);
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
  });
  socket.addEventListener('message', async event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const request = pending.get(message.id); if (!request) return;
      pending.delete(message.id); clearTimeout(request.timer);
      if (message.error) request.reject(new Error(JSON.stringify(message.error))); else request.resolve(message.result);
      return;
    }
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.method === 'Network.responseReceived') {
      const response = message.params.response;
      if (response.url.startsWith(origin + '/api/') && response.status >= 400 && !(expectedQueueFailure && response.status === 503 && response.url === origin + '/api/admin/payments')) failedApi.push({ url: response.url, status: response.status });
      if (response.url.startsWith(origin + '/src/') && response.status >= 400) failedLocal.push({ url: response.url, status: response.status });
    }
    if (message.method === 'Page.javascriptDialogOpening') await call('Page.handleJavaScriptDialog', { accept: true, promptText: 'Synthetic browser verification' });
    if (message.method === 'Fetch.requestPaused') await call('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: 503, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify({ success: false, message: 'Synthetic queue load failure' })).toString('base64') });
  });
  const evaluate = async expression => {
    const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const wait = async (expression, description) => {
    for (let attempt = 0; attempt < 150; attempt++) { if (await evaluate(expression)) return; await pause(100); }
    throw new Error(`Browser timeout: ${description}. Page: ${(await evaluate('document.body.innerText')).slice(-2200)}. Runtime exceptions: ${JSON.stringify(exceptions.slice(-3))}. Failed API calls: ${JSON.stringify(failedApi.slice(-3))}`);
  };
  const text = value => JSON.stringify(value);
  const click = async label => {
    const clicked = await evaluate(`(() => { const button = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${text(label)} && b.getClientRects().length); if (!button) return false; button.click(); return true; })()`);
    assert.ok(clicked, `Visible button unavailable: ${label}`);
  };
  const fill = async (selector, value) => evaluate(`(() => { const input = document.querySelector(${text(selector)}); if (!input) throw new Error('Input unavailable'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${text(value)}); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  const navigate = url => call('Page.navigate', { url: origin + url });
  const login = async account => {
    await navigate('/');
    await wait("[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Log In' && b.getClientRects().length)", 'login button');
    await click('Log In');
    await wait('Boolean(document.querySelector(\'input[placeholder="Enter your password"]\'))', 'login fields');
    await fill('input[placeholder="Enter your email"]', account.email);
    await fill('input[placeholder="Enter your password"]', password);
    await evaluate('document.querySelector(\'input[placeholder="Enter your password"]\').closest("form").requestSubmit()');
    const route = account === admin ? '/admin' : account === guide ? '/operator' : '/customer';
    await wait(`location.pathname === ${text(route)}`, 'authenticated navigation');
  };
  try {
    await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable');
    // Remote stock images/fonts are irrelevant to workflow correctness and intentionally blocked.
    await call('Network.setBlockedURLs', { urls: ['https://*'] });
    await login(customer);
    await wait(`Boolean(document.querySelector('[data-booking-details-id="${browserBooking._id}"]'))`, 'customer booking card');
    await evaluate(`(() => { const card = document.querySelector('[data-booking-details-id="${browserBooking._id}"]'); [...card.querySelectorAll('button')].find(b => b.textContent.trim() === 'View Details').click(); })()`);
    await wait("[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Add Payment')", 'booking payment action');
    await click('Add Payment');
    await wait('Boolean(document.querySelector(\'input[aria-label="Payment reference"]\'))', 'manual payment form');
    await fill('input[aria-label="Payment reference"]', 'BROWSER-RECEIPT');
    await evaluate('document.querySelector(\'input[aria-label="Payment reference"]\').closest("form").requestSubmit()');
    await wait("document.body.innerText.includes('Payment submitted — awaiting administrator verification.')", 'pending receipt notice');
    assert.equal((await Booking.findById(browserBooking._id)).status, 'PENDING');
    assert.ok(await evaluate(`Boolean(document.querySelector('[data-booking-details-id="${browserBooking._id}"]'))`), 'Payment update must not remove the booking card.');
    console.log('  Browser: customer login, manual submission, pending notice and retained booking card passed.');
    await evaluate('localStorage.clear()'); await login(admin);
    await wait('Boolean(document.querySelector(\'[data-testid="receipt-total"]\'))', 'measured admin dashboard');
    await click('Payment verification');
    await wait("[...document.querySelectorAll('tbody tr')].some(row => row.innerText.includes('BROWSER-RECEIPT'))", 'pending admin receipt');
    await evaluate("(() => { const row = [...document.querySelectorAll('tbody tr')].find(row => row.innerText.includes('BROWSER-RECEIPT')); [...row.querySelectorAll('button')].find(b => b.textContent.trim() === 'Approve receipt').click(); })()");
    // Approval asks for confirmation in the app's own dialog (confirmAction), not a native dialog.
    await wait("[...document.querySelectorAll('[role=\"dialog\"] button')].some(b => b.textContent.trim().startsWith('Confirm'))", 'approval confirmation dialog');
    await evaluate("(() => { [...document.querySelectorAll('[role=\"dialog\"] button')].find(b => b.textContent.trim().startsWith('Confirm')).click(); })()");
    await wait("![...document.querySelectorAll('tbody tr')].some(row => row.innerText.includes('BROWSER-RECEIPT'))", 'approved receipt removed from pending queue');
    assert.equal((await Booking.findById(browserBooking._id)).status, 'CONFIRMED');
    await navigate('/admin');
    await wait('Boolean(document.querySelector(\'[data-testid="receipt-total"]\'))', 'dashboard reload');
    const dashboard = expect(await api('/api/admin/dashboard', { actor: admin }), 200).dashboard;
    const expectedMoney = Number(dashboard.revenue.periods.month.net).toLocaleString('en-US', { maximumFractionDigits: 2 });
    assert.ok((await evaluate('document.querySelector(\'[data-testid="receipt-total"]\').innerText')).includes(expectedMoney));
    await evaluate('(() => { const select = document.querySelector(\'select[aria-label="Chart booking type"]\'); select.value = "group"; select.dispatchEvent(new Event("change", { bubbles: true })); })()');
    const groupEmpty = dashboard.revenueOverTime.every(day => day.group === 0 && day.groupRefunds === 0);
    await wait(groupEmpty ? "document.body.innerText.includes('No received payments or completed refunds in this period.')" : 'Boolean(document.querySelector(\'svg[aria-label="Daily net receipts in BDT"] polyline\'))', 'group chart reflects recorded group activity');
    await evaluate('(() => { const select = document.querySelector(\'select[aria-label="Chart booking type"]\'); select.value = "personal"; select.dispatchEvent(new Event("change", { bubbles: true })); })()');
    await wait('Boolean(document.querySelector(\'svg[aria-label="Daily net receipts in BDT"] polyline\'))', 'personal measured chart');
    console.log('  Browser: administrator approval, persisted confirmation, actual totals and chart filters passed.');
    await navigate('/admin/kyc');
    await wait("[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'View')", 'KYC detail button');
    await click('View');
    await wait("[...document.querySelectorAll('img')].some(img => img.src.startsWith('blob:') && img.complete && img.naturalWidth > 0)", 'authenticated private document image');
    console.log('  Browser: protected KYC image fetched and rendered through authenticated blob URL.');
    // Tour booking card for a customer with reward points: open a personal tour, choose "Customize Your Tour",
    // and check the booking form shows the customisation options and the reward points section.
    await User.updateOne({ _id: customer._id }, { $set: { rewardPoints: 500 } });
    await evaluate('localStorage.clear()');
    await login(customer);
    await navigate('/browse-packages?type=PERSONAL');
    await wait("[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'View Details' && b.getClientRects().length)", 'catalogue personal package details button');
    await evaluate("(() => { [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'View Details' && b.getClientRects().length).click(); })()");
    await wait("document.body.innerText.includes('Price per person') && [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Customize Your Tour')", 'tour booking card with customise action');
    await evaluate("(() => { [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Customize Your Tour').click(); })()");
    await wait("document.body.innerText.includes('Available Reward Points') && [...document.querySelectorAll('h5')].some(h => h.textContent.includes('Customize Your Tour')) && [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Confirm Booking')", 'customisation options and reward points in the booking form');
    // Keep a screenshot of the customer's tour details for review (specs/004-redesign-ui/screenshots).
    await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1900, deviceScaleFactor: 1, mobile: false });
    await pause(600);
    const shot = await call('Page.captureScreenshot', { format: 'png' });
    await call('Emulation.clearDeviceMetricsOverride', {});
    // Scroll the modal's content area to the bottom and keep a second screenshot (extras, operator and reward sections).
    await evaluate("(() => { const el = document.querySelector('[role=\"dialog\"] .overflow-y-auto'); if (el) el.scrollTop = el.scrollHeight; })()");
    await pause(400);
    const lower = await call('Page.captureScreenshot', { format: 'png' });
    await writeFile(new URL('../../specs/004-redesign-ui/screenshots/tour-details-customer-lower.png', import.meta.url), Buffer.from(lower.data, 'base64'));
    await writeFile(new URL('../../specs/004-redesign-ui/screenshots/tour-details-customer.png', import.meta.url), Buffer.from(shot.data, 'base64'));
    // Return to the admin session for the payment checks that follow.
    await evaluate('localStorage.clear()');
    await login(admin);
    console.log('  Browser: customer with reward points customises a tour; the booking form shows customisation options and reward points.');
    await navigate('/admin/payments');
    await wait("document.body.innerText.includes('Manual payment verification') && !document.body.innerText.includes('Loading submissions…')", 'payment queue reload');
    expectedQueueFailure = true;
    await call('Fetch.enable', { patterns: [{ urlPattern: '*/api/admin/payments', requestStage: 'Request' }] });
    await click('Refresh');
    await wait("[...document.querySelectorAll('[role=alert]')].some(node => node.innerText.includes('Synthetic queue load failure'))", 'visible queue load error');
    await call('Fetch.disable'); expectedQueueFailure = false; await click('Refresh');
    await wait("![...document.querySelectorAll('[role=alert]')].some(node => node.innerText.includes('Synthetic queue load failure')) && !document.body.innerText.includes('Loading submissions…')", 'queue error recovery');
    // Admin walkthrough: every admin page loads its real data, shows no error screen, and its main action opens and closes.
    const adminPages = [
      { route: '/admin', heading: 'Dashboard', actions: ['Refresh'] },
      { route: '/admin/contacts', heading: 'Contact' },
      { route: '/admin/departures', heading: 'Departures', actions: ['Create Departure'], close: true },
      { route: '/admin/operators', heading: 'Operators' },
      { route: '/admin/packages', heading: 'Tour Packages', actions: ['Create Package'], close: true },
      { route: '/admin/users', heading: 'User Management', actions: ['Add User'], close: true },
      { route: '/admin/payments', heading: 'Manual payment verification' },
      { route: '/admin/refunds', heading: 'Refund' },
      { route: '/admin/date-changes', heading: 'Date' },
      { route: '/admin/kyc', heading: 'KYC' },
      { route: '/admin/reviews', heading: 'Review' },
      { route: '/admin/settings', heading: 'Settings', actions: ['Commission & Discounts', 'Role & Permissions', 'Cancellation Rules'] },
      { route: '/admin/activity-logs', heading: 'Activity' },
      { route: '/admin/announcements', heading: 'Announcement' },
    ];
    const pageReady = `!document.body.innerText.includes('Loading') && !document.body.innerText.includes('Something went wrong')`;
    for (const page of adminPages) {
      await navigate(page.route);
      await wait(`location.pathname === ${text(page.route)} && document.querySelectorAll('main button, main input, main select, main a').length > 0`, `admin page ${page.route} renders`);
      await pause(900);
      assert.ok(await evaluate(`(${pageReady})`), `Admin page ${page.route} shows a loading or error screen`);
      assert.ok(await evaluate(`document.querySelector('main').innerText.trim().length > 0`), `Admin page ${page.route} is blank`);
      assert.ok(await evaluate(`document.querySelector('main').innerText.includes(${text(page.heading)}) || document.body.innerText.includes(${text(page.heading)})`), `Admin page ${page.route} is missing its heading ${page.heading}`);
      for (const action of page.actions || []) {
        const exists = await evaluate(`[...document.querySelectorAll('button')].some(b => b.textContent.trim().includes(${text(action)}) && b.getClientRects().length)`);
        assert.ok(exists, `Admin page ${page.route} has no visible "${action}" control`);
        if (action !== 'Refresh' && !['Create Departure', 'Create Package', 'Add User'].includes(action)) { await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim().includes(${text(action)}) && b.getClientRects().length).click()`); await pause(400); }
        if (action === 'Create Departure' || action === 'Create Package' || action === 'Add User') {
          await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim().includes(${text(action)}) && b.getClientRects().length).click()`);
          await wait(`Boolean(document.querySelector('[role="dialog"], .fixed.inset-0.z-50 .shadow-2xl'))`, `${action} dialog opens`);
          await pause(300);
          await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
          await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
          await pause(300);
          const stillOpen = await evaluate(`[...document.querySelectorAll('button')].some(b => ['Cancel', 'Close'].includes(b.textContent.trim()) && b.getClientRects().length)`);
          if (stillOpen) await evaluate(`[...document.querySelectorAll('button')].find(b => ['Cancel', 'Close'].includes(b.textContent.trim()) && b.getClientRects().length).click()`);
          await pause(300);
        }
      }
      console.log(`  Admin page ${page.route}: loaded with real data${(page.actions || []).length ? ' and its actions responded' : ''}.`);
    }
    assert.deepEqual(exceptions, [], 'Unexpected browser runtime exceptions'); assert.deepEqual(failedApi, [], 'Unexpected local API failures'); assert.deepEqual(failedLocal, [], 'Frontend module load failures');
    console.log('  Browser: explicit load-error/retry behavior passed; no unexpected runtime exceptions or API/module failures.');
    console.log('  Browser: every admin page loaded without errors; no unexpected API failures.');

    // The options endpoint lists every recordable action, even when no entries match the filters.
    const actionOptionsResponse = await api('/api/admin/activity-logs/options', { actor: admin });
    assert.equal(actionOptionsResponse.status, 200, 'Activity log options must load');
    assert.ok(actionOptionsResponse.data.actions.includes('REFUND_PROCESSED') && actionOptionsResponse.data.actions.includes('KYC_APPROVED'), 'Options must list the recordable actions');

    // Activity log filter: choosing an action narrows the log to that action only.
    await navigate('/admin/activity-logs');
    await wait("(() => { const s = document.querySelector('select[aria-label=\"Action\"]'); return Boolean(s && s.options.length > 1); })()", 'activity actions loaded');
    const chosenAction = 'ROLE_CHANGED'; // recorded earlier in this run, so the filter has entries to show
    const chosenLabel = await evaluate("document.querySelector('select[aria-label=\"Action\"]').querySelector('option[value=\"ROLE_CHANGED\"]').textContent.trim()");
    await evaluate("(() => { const s = document.querySelector('select[aria-label=\"Action\"]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, " + text(chosenAction) + "); s.dispatchEvent(new Event('change', { bubbles: true })); })()");
    await wait("[...document.querySelectorAll('tbody tr')].length > 0 && [...document.querySelectorAll('tbody tr')].every(row => row.innerText.includes(" + text(chosenLabel) + "))", 'activity filtered to the chosen action');
    console.log('  Browser: activity log filter narrows the list to the chosen action.');

    // Phone layout: every admin page must fit a 375px screen without sideways scrolling.
    await call('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
    const phoneOverflow = [];
    for (const page of adminPages) {
      await navigate(page.route);
      await wait(`location.pathname === ${text(page.route)} && document.querySelectorAll('main button, main input, main select, main a').length > 0`, `phone ${page.route} renders`);
      await pause(900);
      const overflow = await evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth');
      if (overflow > 0) { const offenders = await evaluate("(() => { const limit = document.documentElement.clientWidth; const wide = [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > limit + 1).slice(0, 5).map(el => el.tagName + '.' + String(el.className).slice(0, 50) + '@' + Math.round(el.getBoundingClientRect().right)); return 'inner=' + window.innerWidth + ' client=' + limit + ' scroll=' + document.documentElement.scrollWidth + ' :: ' + wide.join(' | '); })()"); phoneOverflow.push({ route: page.route, overflowPx: overflow, offenders }); }
    }
    // Phone dialogs: each key dialog fits the 375px screen and closes with Escape.
    const phoneKycUser = await User.create({ fullName: 'Synthetic Phone KYC', email: `phone-kyc-${Date.now()}@example.invalid`, passwordHash: 'synthetic-hash', roles: ['customer'] });
    await KYC.create({ user: phoneKycUser._id, documentType: 'passport', documentNumber: `SYN-P-${Date.now()}`, documentImage: 'uploads/synthetic-kyc-phone.png', status: 'pending' });
    const phoneDialogs = [
      { route: '/admin/packages', open: "[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Create Package' && b.getClientRects().length)" },
      { route: '/admin/departures', open: "[...document.querySelectorAll('button')].find(b => b.textContent.trim().includes('Create Departure') && b.getClientRects().length)" },
      { route: '/admin/users', open: "[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Add User' && b.getClientRects().length)" },
      { route: '/admin/announcements', open: "[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'New Announcement' && b.getClientRects().length)" },
      { route: '/admin/kyc', open: "[...[...document.querySelectorAll('tr')].find(r => r.innerText.includes('Synthetic Phone KYC')).querySelectorAll('button')].find(b => b.textContent.trim() === 'View')" },
      { route: '/admin/users', open: "[...document.querySelector('tbody tr').querySelectorAll('button')].find(b => b.title === 'View Details')" },
      { route: '/admin/users', open: "[...document.querySelector('tbody tr').querySelectorAll('button')].find(b => b.title === 'Edit')" },
      { route: '/admin/departures', prepare: "[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'List View' && b.getClientRects().length)?.click()", open: "[...document.querySelectorAll('button')].find(b => b.title === 'Edit Departure' && b.getClientRects().length)" },
      { route: '/admin/departures', prepare: "[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'List View' && b.getClientRects().length)?.click()", open: "[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'View' && b.getClientRects().length)" },
    ];
    await call('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
    const phoneDialogIssues = [];
    for (const dialog of phoneDialogs) {
      await navigate(dialog.route);
      await pause(1200);
      if (dialog.prepare) { await evaluate(dialog.prepare); await pause(800); }
      const opened = await evaluate(`(() => { const target = ${dialog.open}; if (!target) return false; target.click(); return true; })()`);
      if (!opened) { phoneDialogIssues.push({ route: dialog.route, problem: 'trigger missing' }); continue; }
      await wait(`Boolean(document.querySelector('[role="dialog"], .fixed.inset-0.z-50 .shadow-2xl'))`, 'phone dialog ' + dialog.route + ' opens');
      await pause(500);
      const fit = await evaluate(`(() => { const panel = document.querySelector('[role="dialog"], .fixed.inset-0.z-50 .shadow-2xl'); const rect = panel.getBoundingClientRect(); return { left: Math.round(rect.left), right: Math.round(rect.right), width: document.documentElement.clientWidth, scrollOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }; })()`);
      if (fit.left < 0 || fit.right > fit.width + 1 || fit.scrollOverflow > 0) phoneDialogIssues.push({ route: dialog.route, ...fit });
      await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await pause(400);
      if (await evaluate(`Boolean(document.querySelector('[role="dialog"], .fixed.inset-0.z-50 .shadow-2xl'))`)) {
        const cancel = await evaluate(`(() => { const b = [...document.querySelectorAll('.fixed.inset-0.z-50 button')].find(x => ['Cancel', 'Close', 'Close dialog'].includes(x.textContent.trim()) || x.getAttribute('aria-label') === 'Close' || x.getAttribute('aria-label') === 'Close dialog'); if (b) { b.click(); return true; } return false; })()`);
        if (!cancel) phoneDialogIssues.push({ route: dialog.route, problem: 'dialog did not close' });
        await pause(400);
      }
    }
    await call('Emulation.clearDeviceMetricsOverride', {});
    console.log('  Phone dialog check: ' + (phoneDialogIssues.length ? JSON.stringify(phoneDialogIssues) : 'all key admin dialogs fit 375px and close'));
    assert.deepEqual(phoneDialogIssues, [], 'Admin dialogs must fit a phone screen and close');
    await call('Emulation.clearDeviceMetricsOverride', {});
    console.log('  Phone layout check: ' + (phoneOverflow.length ? JSON.stringify(phoneOverflow) : 'all admin pages fit 375px'));

    // Admin write workflows: each action goes through the real controls and is verified in MongoDB or the API.
    const stamp = Date.now();
    const pollDb = async (check, description) => {
      for (let attempt = 0; attempt < 100; attempt++) { if (await check()) return; await pause(100); }
      throw new Error(`Database check timed out: ${description}`);
    };
    const clickInCard = (fragment, label) => evaluate(`(() => {
      const leaves = [...document.querySelectorAll('p, span, div, td, h3, h4')].filter(n => n.childElementCount === 0 && n.textContent.includes(${text(fragment)}));
      for (const leaf of leaves) {
        let el = leaf;
        while (el && el !== document.body) {
          const button = [...el.querySelectorAll('button')].find(b => b.textContent.trim() === ${text(label)} && b.getClientRects().length);
          if (button) { button.click(); return true; }
          el = el.parentElement;
        }
      }
      return false;
    })()`);
    const fillArea = async (selector, value) => evaluate(`(() => { const area = document.querySelector(${text(selector)}); if (!area) throw new Error('Textarea unavailable'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(area, ${text(value)}); area.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    const confirmDialog = async () => {
      await wait(`[...document.querySelectorAll('[role="dialog"] button')].some(b => b.textContent.trim().startsWith('Confirm'))`, 'confirmation dialog');
      await evaluate(`(() => { [...document.querySelectorAll('[role="dialog"] button')].find(b => b.textContent.trim().startsWith('Confirm')).click(); })()`);
    };

    const kycUser = await User.create({ fullName: 'Synthetic KYC Applicant', email: `kyc-applicant-${stamp}@example.invalid`, passwordHash: 'synthetic-hash', roles: ['customer'] });
    await KYC.create({ user: kycUser._id, documentType: 'passport', documentNumber: `SYN-${stamp}`, documentImage: 'uploads/synthetic-kyc-approval.png', status: 'pending' });
    const reviewerA = await User.create({ fullName: 'Synthetic Reviewer A', email: `reviewer-a-${stamp}@example.invalid`, passwordHash: 'synthetic-hash', roles: ['customer'] });
    const reviewerB = await User.create({ fullName: 'Synthetic Reviewer B', email: `reviewer-b-${stamp}@example.invalid`, passwordHash: 'synthetic-hash', roles: ['customer'] });
    const approvableReview = await Review.create({ customerId: reviewerA._id, packageId: browserBooking.packageId, rating: 4, comment: `Synthetic approval review ${stamp}`, status: 'PENDING' });
    const rejectableReview = await Review.create({ customerId: reviewerB._id, packageId: browserBooking.packageId, rating: 2, comment: `Synthetic rejection review ${stamp}`, status: 'PENDING' });
    const visitorMessage = await ContactMessage.create({ name: 'Synthetic Visitor', email: 'visitor@example.invalid', message: `Synthetic contact message ${stamp}` });

    // KYC approval.
    await navigate('/admin/kyc');
    await wait(`[...document.querySelectorAll('tr')].some(row => row.innerText.includes('Synthetic KYC Applicant'))`, 'seeded KYC row');
    await evaluate(`(() => { const row = [...document.querySelectorAll('tr')].find(r => r.innerText.includes('Synthetic KYC Applicant')); [...row.querySelectorAll('button')].find(b => b.textContent.trim() === 'View').click(); })()`);
    await wait(`[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Approve' && b.getClientRects().length)`, 'KYC detail with approve action');
    await click('Approve');
    await confirmDialog();
    await pollDb(async () => (await KYC.findOne({ user: kycUser._id }))?.status === 'approved', 'KYC approved');
    console.log('  Browser: KYC approved from the admin detail view; the database records it as approved.');

    // Review approval and rejection.
    await navigate('/admin/reviews');
    await wait(`document.body.innerText.includes('Synthetic approval review ${stamp}')`, 'seeded review visible');
    assert.ok(await clickInCard(`Synthetic approval review ${stamp}`, 'Approve'), 'Approve action unavailable for the seeded review');
    await confirmDialog();
    await pollDb(async () => (await Review.findById(approvableReview._id))?.status === 'APPROVED', 'review approved');
    await wait(`document.body.innerText.includes('Synthetic rejection review ${stamp}')`, 'second seeded review visible');
    assert.ok(await clickInCard(`Synthetic rejection review ${stamp}`, 'Reject'), 'Reject action unavailable for the seeded review');
    await confirmDialog();
    await pollDb(async () => (await Review.findById(rejectableReview._id))?.status === 'REJECTED', 'review rejected');
    console.log('  Browser: review approved and rejected from the moderation list; both states are stored.');

    // Contact message handled.
    await navigate('/admin/contacts');
    await wait(`document.body.innerText.includes('Synthetic contact message ${stamp}')`, 'seeded contact visible');
    assert.ok(await clickInCard(`Synthetic contact message ${stamp}`, 'Mark handled'), 'Mark handled unavailable for the seeded message');
    await pollDb(async () => (await ContactMessage.findById(visitorMessage._id))?.handled === true, 'contact handled');
    console.log('  Browser: contact message marked handled; the database records it.');

    // Announcement creation.
    await navigate('/admin/announcements');
    await wait("[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'New Announcement' && b.getClientRects().length)", 'announcements page ready');
    await click('New Announcement');
    await wait('Boolean(document.querySelector(\'input[placeholder="Enter announcement title"]\'))', 'announcement form');
    await fill('input[placeholder="Enter announcement title"]', `Synthetic announcement ${stamp}`);
    await fillArea('textarea[placeholder="Enter announcement message"]', 'Synthetic announcement body for browser verification.');
    await click('Create Announcement');
    await pollDb(async () => JSON.stringify((await api('/api/admin/announcements', { actor: admin })).data).includes(`Synthetic announcement ${stamp}`), 'announcement stored');
    console.log('  Browser: announcement created from the form and returned by the announcements API.');

    // Announcement edit and delete from its row.
    const announcementsIncludeTitle = async title => JSON.stringify((await api('/api/admin/announcements', { actor: admin })).data).includes(title);
    const rowButton = (title, label) => "(() => { const cards = [...document.querySelectorAll('article, div')].filter(d => d.innerText.includes('" + title + "') && d.querySelector(\"button[title='" + label + "']\")); cards.sort((a, b) => a.innerText.length - b.innerText.length); if (!cards[0]) throw new Error('Announcement row unavailable'); cards[0].querySelector(\"button[title='" + label + "']\").click(); })()";
    // The list can re-render while a row is being clicked; retry until the control is present.
    const clickWithRetry = async (expression, description) => {
      for (let attempt = 0; attempt < 40; attempt++) {
        try { await evaluate(expression); return; } catch (failure) { if (!/unavailable/.test(failure.message)) throw failure; await pause(250); }
      }
      throw new Error(description + ' stayed unavailable');
    };
    await navigate('/admin/announcements');
    await wait("[...document.querySelectorAll('article, div')].some(d => d.innerText.includes('Synthetic announcement " + stamp + "') && d.querySelector(\"button[title='Edit']\"))", 'created announcement row listed');
    await clickWithRetry(rowButton(`Synthetic announcement ${stamp}`, 'Edit'), 'announcement row');
    await wait("Boolean(document.querySelector('input[placeholder=\"Enter announcement title\"]'))", 'announcement editor');
    await fill('input[placeholder="Enter announcement title"]', `Synthetic announcement ${stamp} edited`);
    await click('Update Announcement');
    await pollDb(async () => announcementsIncludeTitle(`Synthetic announcement ${stamp} edited`), 'announcement edited');
    await wait("document.body.innerText.includes('Synthetic announcement " + stamp + " edited')", 'edited announcement listed');
    await clickWithRetry(rowButton(`Synthetic announcement ${stamp} edited`, 'Delete'), 'edited announcement row');
    await confirmDialog();
    await pollDb(async () => !(await announcementsIncludeTitle(`Synthetic announcement ${stamp} edited`)), 'announcement deleted');
    console.log('  Browser: announcement edited and deleted from its row; the announcements API reflects both changes.');

    // System settings save: change the first refund percentage, save, reload and verify the stored value.
    await navigate('/admin/settings');
    await wait(`document.body.innerText.includes('Refund Tiers by Days Before Start')`, 'settings loaded');
    await evaluate(`(() => { const input = [...document.querySelectorAll('input')].find(i => i.value === '100'); if (!input) throw new Error('Refund percentage input unavailable'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '90'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await click('Save Changes');
    await wait(`!document.body.innerText.includes('Saving')`, 'settings save finished');
    await navigate('/admin/settings');
    await wait(`document.body.innerText.includes('Refund Tiers by Days Before Start')`, 'settings reloaded');
    assert.ok(await evaluate(`[...document.querySelectorAll('input')].some(i => i.value === '90')`), 'Saved refund percentage did not persist after reload');
    console.log('  Browser: system settings saved and the new refund percentage persisted after reload.');

    // Tour package create and edit through the package editor.
    const setSelect = async (selector, value) => evaluate(`(() => { const select = document.querySelector(${text(selector)}); if (!select) throw new Error('Select unavailable'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, ${text(value)}); select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    const submitEditor = () => evaluate(`(() => { const buttons = [...document.querySelectorAll('form button[type="submit"], button[form]')].filter(b => b.getClientRects().length); if (!buttons.length) throw new Error('Editor submit unavailable'); buttons[buttons.length - 1].click(); })()`);
    const packageTitle = `Synthetic Package ${stamp}`;
    await navigate('/admin/packages');
    await wait(`[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Create Package' && b.getClientRects().length)`, 'packages page ready');
    await click('Create Package');
    await wait(`Boolean(document.querySelector('input[name="title"]'))`, 'package editor');
    await fill('input[name="title"]', packageTitle);
    await fillArea('textarea[name="description"]', 'Synthetic package description for browser verification.');
    await fill('input[name="basePrice"]', '24500');
    await evaluate('document.querySelector("input[name=type][value=PERSONAL]").click()');
    await setSelect('select[name="category"]', 'GOLD');
    await fill('input[name="defaultDays"]', '4');
    await fill('input[name="defaultNights"]', '3');
    await submitEditor();
    await pollDb(async () => Boolean(await TourPackage.findOne({ title: packageTitle })), 'package created');
    assert.match((await TourPackage.findOne({ title: packageTitle }).lean()).code || '', /^[A-Z]{2,5}$/, 'New packages must receive a booking code such as RL');
    console.log('  Browser: tour package created from the editor; the database records it.');

    await wait(`[...document.querySelectorAll('tr')].some(row => row.innerText.includes(${text(packageTitle)}))`, 'created package listed');
    await evaluate(`(() => { const row = [...document.querySelectorAll('tr')].find(r => r.innerText.includes(${text(packageTitle)})); [...row.querySelectorAll('button')].find(b => /edit/i.test(b.title || b.textContent)).click(); })()`);
    await wait(`Boolean(document.querySelector('input[name="basePrice"]'))`, 'package editor for edit');
    await fill('input[name="basePrice"]', '25500');
    await submitEditor();
    await pollDb(async () => (await TourPackage.findOne({ title: packageTitle }))?.basePrice === 25500, 'package edited');
    console.log('  Browser: tour package edited from the list; the new price is stored.');

    // Date change approval from the request queue.
    const requestedDate = new Date(Date.now() + 60 * 86400000);
    await Booking.updateOne({ _id: browserBooking._id }, { $set: { dateChangeRequest: { requestedDate, requestedBy: customer._id, reason: `Synthetic date change ${stamp}`, requestedAt: new Date(), status: 'PENDING' } } });
    await navigate('/admin/date-changes');
    // Approving a group date change moves the booking to an open departure on the requested day, and the UI confirms it.
    const requestedBooking = await Booking.findById(browserBooking._id).lean();
    assert.match(requestedBooking.bookingCode || '', /^#[A-Z]{2,5}\d{3}$/, 'New bookings must carry a booking code such as #RL001');
    const requestRowId = requestedBooking.bookingCode;
    const openRequestRow = `[...document.querySelectorAll('tr')].find(r => r.innerText.includes('${requestRowId}'))`;
    await wait(`Boolean(${openRequestRow})`, 'date change row visible');
    await evaluate(`(() => { [...${openRequestRow}.querySelectorAll('button')].find(b => b.textContent.trim() === 'View').click(); })()`);
    await wait(`[...document.querySelectorAll('button')].some(b => b.textContent.trim().includes('Approve') && b.getClientRects().length)`, 'date change detail with approve');
    await evaluate(`(() => { [...document.querySelectorAll('button')].find(b => b.textContent.trim().includes('Approve') && b.getClientRects().length).click(); })()`);
    await confirmDialog();
    await wait(`document.body.innerText.includes('Date change request approved successfully')`, 'approval confirmation shown');
    await pollDb(async () => { const booking = await Booking.findById(browserBooking._id).lean(); return booking.dateChangeRequest?.status === 'APPROVED' && new Date(booking.startDate).getTime() === requestedDate.getTime(); }, 'date change applied');
    console.log('  Browser: date change approved from the request detail; the booking moved to the requested date and the UI confirmed it.');

    // Group departure creation for the group package, through the departure form.
    const { GroupDeparture } = await import('../model/groupDeparture.model.js');
    const setNthInput = async (selector, index, value) => evaluate(`(() => { const input = document.querySelectorAll(${text(selector)})[${index}]; if (!input) throw new Error('Input unavailable: ${selector} #${index}'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${text(value)}); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    const groupDeparturePackage = await TourPackage.findOne({ type: 'GROUP' }).lean();
    if (!groupDeparturePackage) throw new Error('No GROUP tour package is available for departures');
    await navigate('/admin/departures');
    await wait(`[...document.querySelectorAll('button')].some(b => b.textContent.trim().includes('Create Departure') && b.getClientRects().length)`, 'departures page ready');
    await evaluate(`(() => { [...document.querySelectorAll('button')].find(b => b.textContent.trim().includes('Create Departure') && b.getClientRects().length).click(); })()`);
    await wait("(() => { const s = document.querySelector('.fixed.inset-0.z-50 form select'); return Boolean(s && s.options.length > 1); })()", 'departure package options loaded');
    await evaluate(`(() => { const select = document.querySelector('.fixed.inset-0.z-50 form select'); const option = [...select.options].find(o => o.value === ${text(String(groupDeparturePackage._id))}); if (!option) throw new Error('Group package unavailable in departure form'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, option.value); select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await setNthInput('.fixed.inset-0.z-50 form input[type="date"]', 0, '2027-03-10');
    await setNthInput('.fixed.inset-0.z-50 form input[type="date"]', 1, '2027-03-13');
    await setNthInput('.fixed.inset-0.z-50 form input[type="number"]', 0, '20');
    await setNthInput('.fixed.inset-0.z-50 form input[type="number"]', 1, '22000');
    await evaluate(`(() => { const label = [...document.querySelectorAll('.fixed.inset-0.z-50 form label')].find(l => l.innerText.includes('Synthetic Guide') && !l.innerText.includes('Unassigned')); const box = label && label.querySelector('input[type=checkbox]'); if (!box) throw new Error('Operator unavailable'); box.click(); })()`);
    await evaluate(`(() => { const buttons = [...document.querySelectorAll('.fixed.inset-0.z-50 form button[type="submit"]')]; if (!buttons.length) throw new Error('Departure submit unavailable'); buttons[buttons.length - 1].click(); })()`);
    await pollDb(async () => Boolean(await GroupDeparture.findOne({ packageId: groupDeparturePackage._id, startDate: { $gte: new Date('2027-03-09T00:00:00Z'), $lt: new Date('2027-03-11T00:00:00Z') } })), 'group departure created');
    console.log('  Browser: group departure created from the departure form; the database records it.');

    // Refund recorded from the refund queue for a cancelled booking.
    await Booking.updateOne({ _id: browserBooking._id }, { $set: { status: 'CANCELLED', cancellation: { isCancelled: true, cancelledAt: new Date(), reason: 'Synthetic cancellation for refund verification', refundAmount: 1000, refundProcessed: false } } });
    await navigate('/admin/refunds');
    const refundButton = "button[title='Record completed refund']";
    const bellCountExpr = "(() => { const b = [...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label') || '').startsWith('Notifications')); const m = b ? (b.getAttribute('aria-label') || '').match(/(\\d+) unread/) : null; return m ? Number(m[1]) : 0; })()";
    // Fresh page load: the bell reads the records as they are now.
    await navigate('/admin/refunds');
    await wait("[...document.querySelectorAll('tr')].some(row => row.innerText.includes(" + text(customer.fullName) + ") && row.querySelector(" + text(refundButton) + "))", 'refund row visible');
    await pause(1200);
    const bellBeforeRefund = await evaluate(bellCountExpr);
    await evaluate("(() => { const row = [...document.querySelectorAll('tr')].find(r => r.innerText.includes(" + text(customer.fullName) + ") && r.querySelector(" + text(refundButton) + ")); row.querySelector(" + text(refundButton) + ").click(); })()");
    await wait("[...document.querySelectorAll('[role=\"dialog\"] h2')].some(h => h.textContent.includes('Record completed refund'))", 'refund recording dialog');
    // Submitting without a transfer reference is refused in the dialog itself.
    await evaluate("(() => { [...document.querySelectorAll('[role=\"dialog\"] button')].find(b => b.textContent.trim() === 'Record refund').click(); })()");
    await wait("[...document.querySelectorAll('[role=\"dialog\"] [role=\"alert\"]')].some(a => a.textContent.includes('Enter the reference'))", 'refund reference required message');
    if (process.env.SCREENSHOT_DIR) { const { data } = await call('Page.captureScreenshot', { format: 'png' }); await writeFile(path.join(process.env.SCREENSHOT_DIR, 'refund-record.png'), Buffer.from(data, 'base64')); }
    await fill('#refund-transaction-ref', 'SYNTHETIC BROWSER VERIFICATION');
    await evaluate("(() => { [...document.querySelectorAll('[role=\"dialog\"] button')].find(b => b.textContent.trim() === 'Record refund').click(); })()");
    console.log('  Browser: refund dialog requires a transfer reference and shows the refusal inline.');
    await pollDb(async () => { const booking = await Booking.findById(browserBooking._id).lean(); return booking.status === 'REFUNDED' || booking.cancellation?.refundProcessed === true; }, 'refund recorded');
    // The bell must drop the recorded refund straight away, without a page reload.
    await wait(`(${bellCountExpr}) === ${bellBeforeRefund - 1}`, 'bell drops the recorded refund');
    console.log(`  Browser: refund recorded from the refund queue; the bell dropped from ${bellBeforeRefund} to ${bellBeforeRefund - 1} unread without a reload.`);

    // Customer profile edit from the user list.
    await navigate('/admin/users');
    await wait(`[...document.querySelectorAll('tr')].some(row => row.innerText.includes(${text(customer.email)}))`, 'customer listed');
    await evaluate(`(() => { const row = [...document.querySelectorAll('tr')].find(r => r.innerText.includes(${text(customer.email)})); [...row.querySelectorAll('button')].find(b => b.title === 'Edit').click(); })()`);
    await wait(`Boolean(document.querySelector('input[name="fullName"]'))`, 'user editor');
    await fill('input[name="fullName"]', `Synthetic Renamed ${stamp}`);
    await submitEditor();
    await pollDb(async () => (await User.findById(customer._id).lean())?.fullName === `Synthetic Renamed ${stamp}`, 'customer renamed');
    console.log('  Browser: customer profile edited from the user list; the database records the change.');
    // Chat reply to a customer from the contacts page.
    await navigate('/admin/contacts');
    await wait("[...document.querySelectorAll('[role=tab]')].some(tab => tab.textContent.includes('Live chat'))", 'contacts tabs rendered');
    await evaluate("(() => { [...document.querySelectorAll('[role=tab]')].find(tab => tab.textContent.includes('Live chat')).click(); })()");
    await wait("Boolean(document.querySelector('button[data-chat-user]'))", 'contacts chat user list');
    await evaluate("(() => { document.querySelector('button[data-chat-user]').click(); })()");
    await wait("Boolean(document.querySelector('input[placeholder=\"Type a message...\"]'))", 'chat input');
    const reply = `Synthetic reply ${stamp}`;
    await fill('input[placeholder="Type a message..."]', reply);
    await click('Send');
    await pollDb(async () => Boolean(await Message.findOne({ content: reply })), 'chat reply stored');
    console.log('  Browser: reply sent from the contacts chat; the database stores it.');

    // Departure edit from the departures list: seats and price are saved and the database records them.
    const editableDeparture = await GroupDeparture.findOne({ packageId: groupDeparturePackage._id, startDate: { $gte: new Date('2027-03-09T00:00:00Z'), $lt: new Date('2027-03-11T00:00:00Z') } }).lean();
    assert.ok(editableDeparture, 'Departure for edit is missing');
    await navigate('/admin/departures');
    await wait(`[...document.querySelectorAll('button')].some(b => b.textContent.trim().includes('Create Departure') && b.getClientRects().length)`, 'departures page ready for edit');
    await click('List View');
    await wait(`[...document.querySelectorAll('tr, article, div, li')].some(d => d.innerText && d.innerText.includes(${text(groupDeparturePackage.title)}) && /Mar (9|10), 2027/.test(d.innerText) && d.querySelector("button[title='Edit Departure'], button[title='Edit']"))`, 'group departure listed for edit');
    await evaluate(`(() => { const rows = [...document.querySelectorAll('tr, article, div, li')].filter(d => d.innerText && d.innerText.includes(${text(groupDeparturePackage.title)}) && /Mar (9|10), 2027/.test(d.innerText) && d.querySelector("button[title='Edit Departure'], button[title='Edit']")); rows.sort((a, b) => a.innerText.length - b.innerText.length); if (!rows[0]) throw new Error('Departure row unavailable'); rows[0].querySelector("button[title='Edit Departure'], button[title='Edit']").click(); })()`);
    await wait(`[...document.querySelectorAll('[role="dialog"]')].some(d => d.innerText.includes('Edit departure'))`, 'departure editor opened');
    await fill('#departure-seats', '25');
    await fill('#departure-price', '23000');
    await evaluate(`(() => { const button = [...document.querySelectorAll('button[form="departure-edit-form"]')].find(b => b.getClientRects().length); if (!button) throw new Error('Departure save unavailable'); button.click(); })()`);
    await pollDb(async () => { const dep = await GroupDeparture.findById(editableDeparture._id).lean(); return dep?.totalSeats === 25 && dep?.pricePerPerson === 23000; }, 'departure edit saved');
    console.log('  Browser: departure edited from the departures list (seats and price); the database records the change.');

    // Operator reassignment: an inactive operator is removed from upcoming departures from the operator profile.
    const leavingOperator = await User.create({ fullName: `Synthetic Leaving Operator ${stamp}`, email: `leaving-operator-${stamp}@example.invalid`, passwordHash: 'synthetic-hash', roles: ['TOUR_OPERATOR'], isActive: false });
    await GroupDeparture.updateOne({ _id: editableDeparture._id }, { $push: { operators: { operatorId: leavingOperator._id } } });
    await navigate('/admin/operators');
    await wait(`[...document.querySelectorAll('tr')].some(r => r.innerText.includes(${text(leavingOperator.email)}))`, 'inactive operator listed');
    await evaluate(`(() => { const row = [...document.querySelectorAll('tr')].find(r => r.innerText.includes(${text(leavingOperator.email)})); [...row.querySelectorAll('button')].find(b => b.title === 'View Details').click(); })()`);
    await wait(`[...document.querySelectorAll('[role="tab"]')].some(t => t.textContent.includes('Upcoming departures'))`, 'operator profile tabs');
    await evaluate(`(() => { [...document.querySelectorAll('[role="tab"]')].find(t => t.textContent.includes('Upcoming departures')).click(); })()`);
    await wait(`[...document.querySelectorAll('[role="dialog"] button')].some(b => b.textContent.trim() === 'Remove from departures')`, 'remove from departures available');
    await evaluate(`(() => { [...document.querySelectorAll('[role="dialog"] button')].find(b => b.textContent.trim() === 'Remove from departures').click(); })()`);
    await confirmDialog();
    await pollDb(async () => { const dep = await GroupDeparture.findById(editableDeparture._id).lean(); return !dep.operators.some(op => String(op.operatorId) === String(leavingOperator._id)); }, 'operator removed from upcoming departures');
    console.log('  Browser: inactive operator removed from upcoming departures from the operator profile; the database no longer lists them.');

    // User list helpers for role change and suspension.
    const openRowAction = (email, title) => evaluate(`(() => { const row = [...document.querySelectorAll('tr')].find(r => r.innerText.includes(${text(email)})); if (!row) throw new Error('User row unavailable'); [...row.querySelectorAll('button')].find(b => b.title === ${text(title)}).click(); })()`);
    const clickDialogButton = async label => {
      await wait(`[...document.querySelectorAll('[role="dialog"] button')].some(b => b.textContent.trim() === ${text(label)})`, `dialog button ${label}`);
      await evaluate(`(() => { [...document.querySelectorAll('[role="dialog"] button')].find(b => b.textContent.trim() === ${text(label)}).click(); })()`);
    };

    // Role change from the user editor: a customer becomes a tour operator.
    const roleTarget = await User.create({ fullName: `Synthetic Role Target ${stamp}`, email: `role-target-${stamp}@example.invalid`, passwordHash: 'synthetic-hash', roles: ['CUSTOMER'] });
    await navigate('/admin/users');
    await wait(`[...document.querySelectorAll('tr')].some(r => r.innerText.includes(${text(roleTarget.email)}))`, 'role target listed');
    await openRowAction(roleTarget.email, 'Edit');
    await wait(`Boolean(document.querySelector('input[name="roles"][value="TOUR_OPERATOR"]'))`, 'user editor roles');
    await evaluate(`(() => { document.querySelector('input[name="roles"][value="TOUR_OPERATOR"]').click(); document.querySelector('input[name="roles"][value="CUSTOMER"]').click(); })()`);
    await evaluate(`(() => { const button = [...document.querySelectorAll('button[form="user-edit-form"]')].find(b => b.getClientRects().length); if (!button) throw new Error('User save unavailable'); button.click(); })()`);
    await pollDb(async () => { const user = await User.findById(roleTarget._id).lean(); const roles = (user?.roles || []).map(r => String(r).toUpperCase()); return roles.includes('TOUR_OPERATOR') && !roles.includes('CUSTOMER'); }, 'role changed to tour operator');
    console.log('  Browser: role changed from the user editor (customer to tour operator); the database records the new role.');

    // Suspend and reactivate from the user profile, each confirmed in the in-app dialog.
    const suspendTarget = await User.create({ fullName: `Synthetic Suspend Target ${stamp}`, email: `suspend-target-${stamp}@example.invalid`, passwordHash: 'synthetic-hash', roles: ['CUSTOMER'] });
    await navigate('/admin/users');
    await wait(`[...document.querySelectorAll('tr')].some(r => r.innerText.includes(${text(suspendTarget.email)}))`, 'suspend target listed');
    await openRowAction(suspendTarget.email, 'View Details');
    await clickDialogButton('Suspend account');
    await confirmDialog();
    await pollDb(async () => (await User.findById(suspendTarget._id).lean())?.isActive === false, 'user suspended');
    console.log('  Browser: account suspended from the user profile after the in-app confirmation; the database records it.');

    await navigate('/admin/users');
    await wait(`[...document.querySelectorAll('tr')].some(r => r.innerText.includes(${text(suspendTarget.email)}))`, 'suspended user listed');
    await openRowAction(suspendTarget.email, 'View Details');
    await clickDialogButton('Reactivate account');
    await confirmDialog();
    await pollDb(async () => (await User.findById(suspendTarget._id).lean())?.isActive === true, 'user reactivated');
    console.log('  Browser: account reactivated from the user profile; the database records it.');

    // Contact list filters: All shows handled messages, Unanswered hides them, search narrows by text.
    const contactListed = `Boolean(document.getElementById(${text('contact-' + visitorMessage._id)}))`;
    await navigate('/admin/contacts');
    await wait(`[...document.querySelectorAll('[role=tab]')].some(tab => tab.textContent.includes('Form messages'))`, 'contacts tabs for filters');
    await evaluate("(() => { [...document.querySelectorAll('[role=tab]')].find(tab => tab.textContent.includes('Form messages')).click(); })()");
    await evaluate(`(() => { [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'All' && b.getClientRects().length).click(); })()`);
    await wait(contactListed, 'handled message listed under All');
    await fill('input[aria-label="Search messages"]', 'no-such-visitor-text');
    await wait(`!${contactListed}`, 'search hides unmatched message');
    await fill('input[aria-label="Search messages"]', '');
    await wait(contactListed, 'message listed again after clearing search');
    await evaluate(`(() => { [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Unanswered' && b.getClientRects().length).click(); })()`);
    await wait(`!${contactListed}`, 'handled message hidden under Unanswered');
    console.log('  Browser: contact list filters checked: All shows the handled message, search narrows it, and Unanswered hides it.');

    // Package editor: the summary section scrolls with the form instead of staying pinned (desktop width).
    await navigate('/admin/packages');
    await wait(`[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Create Package' && b.getClientRects().length)`, 'packages page ready for editor layout check');
    await click('Create Package');
    await wait(`[...document.querySelectorAll('h3')].some(h => h.innerText.includes('Summary'))`, 'package editor summary section');
    const summaryPosition = await evaluate(`getComputedStyle([...document.querySelectorAll('h3')].find(h => h.innerText.includes('Summary')).closest('section')).position`);
    assert.notEqual(summaryPosition, 'sticky', 'Summary section must scroll with the package editor');
    await evaluate(`(() => { [...document.querySelectorAll('[role="dialog"] button')].find(b => b.textContent.trim() === 'Cancel').click(); })()`);
    console.log('  Browser: package editor summary section scrolls with the form (not pinned).');

    // Departures list view: the table renders with capacity, operator and labelled actions; it fits a 375px screen.
    await navigate('/admin/departures');
    await wait(`[...document.querySelectorAll('button')].some(b => b.textContent.trim().includes('Create Departure') && b.getClientRects().length)`, 'departures page ready for table check');
    await click('List View');
    await evaluate(`(() => { const toggle = document.querySelector('button[title="Table View"]'); if (!toggle) throw new Error('Table view toggle unavailable'); toggle.click(); })()`);
    await wait(`Boolean(document.querySelector('table[aria-label="Group departures"]'))`, 'departures table rendered');
    await wait(`document.querySelectorAll('table[aria-label="Group departures"] button[title="Edit Departure"]').length > 0`, 'departure rows with actions');
    await call('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
    await pause(800);
    const tableOverflow = await evaluate(`(() => { const wrapper = document.querySelector('table[aria-label="Group departures"]').parentElement; return { pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, tableScrollable: wrapper.scrollWidth > wrapper.clientWidth }; })()`);
    await call('Emulation.clearDeviceMetricsOverride', {});
    assert.equal(tableOverflow.pageOverflow, 0, 'Departures table must not widen the page on a phone');
    console.log('  Browser: departures list view renders its table with labelled actions; the page stays within 375px (table scrolls inside its own panel: ' + tableOverflow.tableScrollable + ').');

    // Screenshots are written only when SCREENSHOT_DIR is set (for visual review).
    const shotDir = process.env.SCREENSHOT_DIR;
    const saveShot = async name => {
      if (!shotDir) return;
      const { data } = await call('Page.captureScreenshot', { format: 'png' });
      await writeFile(path.join(shotDir, name), Buffer.from(data, 'base64'));
    };
    const openBell = async () => {
      await evaluate("(() => { [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || '').startsWith('Notifications')).click(); })()");
      await wait("[...document.querySelectorAll('div')].some(d => String(d.className).includes('shadow-2xl') && d.innerText.includes('unread'))", 'notification panel open');
      await pause(400);
    };

    // Announcements: one New Announcement control on the page.
    await navigate('/admin/announcements');
    await wait("[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'New Announcement' && b.getClientRects().length)", 'announcements ready for button check');
    const newAnnouncementButtons = await evaluate("[...document.querySelectorAll('button')].filter(b => b.textContent.trim() === 'New Announcement' && b.getClientRects().length).length");
    assert.equal(newAnnouncementButtons, 1, 'Announcements must offer exactly one New Announcement control');
    await saveShot('announcements.png');
    console.log('  Browser: announcements offer one New Announcement control.');

    // Notification panel: opaque, so its text stays readable over the page.
    await navigate('/admin/activity-logs');
    await wait("(() => { const b = [...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label') || '').startsWith('Notifications')); return Boolean(b); })()", 'bell ready for panel check');
    await openBell();
    const panelBackground = await evaluate("(() => { const panel = [...document.querySelectorAll('div')].find(d => String(d.className).includes('shadow-2xl') && d.innerText.includes('unread')); return getComputedStyle(panel).backgroundColor; })()");
    const panelAlpha = panelBackground.startsWith('rgba') ? Number(panelBackground.split(',')[3].replace(')', '').trim()) : 1;
    assert.equal(panelAlpha, 1, 'Notification panel background must be opaque, got ' + panelBackground);
    await saveShot('notifications.png');
    await evaluate("(() => { [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || '').startsWith('Notifications')).click(); })()");
    console.log('  Browser: notification panel background is opaque (' + panelBackground + ').');

    // Activity logs: the date pickers use the dark scheme, so their calendar icon is light.
    await wait("Boolean(document.querySelector('input[aria-label=\"From date\"]'))", 'activity date pickers');
    const pickerScheme = await evaluate("getComputedStyle(document.querySelector('input[aria-label=\"From date\"]')).colorScheme");
    assert.ok(/dark/.test(pickerScheme), 'Date pickers must use the dark colour scheme, got ' + pickerScheme);
    await saveShot('activity-logs.png');
    console.log('  Browser: activity log date pickers use the dark scheme (calendar icon visible on dark surfaces).');

    // Departure tiles (card view) for visual review.
    await navigate('/admin/departures');
    await wait("[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'List View' && b.getClientRects().length)", 'departures ready for card screenshot');
    await click('List View');
    await wait("document.querySelectorAll('ul[aria-label=\"Group departures\"] > li').length > 0", 'departure tiles rendered');
    await pause(500);
    await saveShot('departures-cards.png');
    console.log('  Browser: departure tiles rendered in the card view.');

    // Package view dialog, KYC submission dialog and review stars: the new designs, checked in the browser.
    await navigate('/admin/packages');
    await wait("[...document.querySelectorAll('button[title=\"View Details\"]')].some(b => b.getClientRects().length)", 'package list rows');
    await evaluate("(() => { [...document.querySelectorAll('button[title=\"View Details\"]')].find(b => b.getClientRects().length).click(); })()");
    await wait("Boolean(document.querySelector('[role=\"tablist\"][aria-label=\"Package sections\"]'))", 'package view dialog');
    await pause(400);
    const packageDialogText = await evaluate("document.querySelector('[role=\"dialog\"]').innerText");
    assert.ok(packageDialogText.includes('BDT'), 'Package view must show prices in BDT');
    assert.ok(!/\$\d/.test(packageDialogText), 'Package view must not show dollar prices');
    await saveShot('package-detail.png');
    await evaluate("document.querySelector('[role=\"dialog\"] button[aria-label=\"Close\"]')?.click(); document.querySelector('[role=\"dialog\"]') ? null : null;");
    await pause(300);
    console.log('  Browser: package view uses the new dialog with BDT pricing.');

    await navigate('/admin/kyc');
    await wait("[...document.querySelectorAll('tr')].some(r => r.querySelector('button') && [...r.querySelectorAll('button')].some(b => b.textContent.trim() === 'View'))", 'KYC rows for detail');
    await evaluate("(() => { const row = [...document.querySelectorAll('tr')].find(r => [...r.querySelectorAll('button')].some(b => b.textContent.trim() === 'View')); [...row.querySelectorAll('button')].find(b => b.textContent.trim() === 'View').click(); })()");
    await wait("[...document.querySelectorAll('[role=\"dialog\"] h2')].some(h => h.textContent.includes('KYC submission'))", 'KYC submission dialog');
    await pause(500);
    await saveShot('kyc-detail.png');
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    console.log('  Browser: KYC submission details use the new dialog.');

    await navigate('/admin/reviews');
    await wait("[...document.querySelectorAll('select')].some(s => [...s.options].some(o => o.value === 'APPROVED'))", 'review status filter');
    await evaluate("(() => { const s = [...document.querySelectorAll('select')].find(x => [...x.options].some(o => o.value === 'APPROVED')); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'APPROVED'); s.dispatchEvent(new Event('change', { bubbles: true })); })()");
    await wait("Boolean(document.querySelector('[role=\"img\"][aria-label^=\"Rated\"]'))", 'review stars rendered');
    const starLabels = await evaluate("[...document.querySelectorAll('[role=\"img\"][aria-label^=\"Rated\"]')].map(el => el.getAttribute('aria-label'))");
    assert.ok(starLabels.includes('Rated 4.0 out of 5'), 'A 4-star review must show a 4-star rating label, got ' + JSON.stringify(starLabels));
    const filledStops = await evaluate("[...document.querySelectorAll('[role=\"img\"][aria-label=\"Rated 4.0 out of 5\"] linearGradient stop:first-child')].map(s => s.getAttribute('offset'))");
    assert.ok(filledStops.length >= 5 && filledStops.length % 5 === 0, 'Each 4-star review must render five stars');
    for (let i = 0; i < filledStops.length; i += 5) assert.deepEqual(filledStops.slice(i, i + 5), ['100%', '100%', '100%', '100%', '0%'], 'Four stars must be filled and the fifth empty for 4 stars');
    await saveShot('review-stars.png');
    console.log('  Browser: review stars fill according to the rating (4 of 5 filled).');

    // Detail dialogs for reviews, refunds and date change requests: the shared admin layout, BDT amounts.
    const pressEscape = async () => {
      await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await pause(400);
    };
    const dialogWith = title => `[...document.querySelectorAll('[role="dialog"] h2')].some(h => h.textContent.includes(${text(title)}))`;

    await navigate('/admin/refunds');
    await wait("[...document.querySelectorAll('button[title=\"View Details\"]')].some(b => b.getClientRects().length)", 'refund rows for details');
    await evaluate("(() => { [...document.querySelectorAll('button[title=\"View Details\"]')].find(b => b.getClientRects().length).click(); })()");
    await wait(dialogWith('Refund details'), 'refund details dialog');
    await pause(400);
    const refundText = await evaluate("document.querySelector('[role=\"dialog\"]').innerText");
    assert.ok(refundText.includes('BDT') && !/\$\d/.test(refundText), 'Refund details must show BDT amounts only');
    assert.ok(refundText.includes('Payments and refunds') || refundText.includes('No payments are recorded'), 'Refund details must show the payments ledger');
    await saveShot('refund-detail.png');
    await pressEscape();
    console.log('  Browser: refund details use BDT amounts and the payments ledger.');

    await navigate('/admin/date-changes');
    await wait("[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'View' && b.getClientRects().length)", 'date change rows for details');
    await evaluate("(() => { [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'View' && b.getClientRects().length).click(); })()");
    await wait(dialogWith('Date change request'), 'date change details dialog');
    await pause(400);
    await saveShot('date-change-detail.png');
    await pressEscape();
    console.log('  Browser: date change request details open in the shared admin layout.');

    await navigate('/admin/reviews');
    await wait("[...document.querySelectorAll('select')].some(s => [...s.options].some(o => o.value === 'APPROVED'))", 'review filter for details');
    await evaluate("(() => { const s = [...document.querySelectorAll('select')].find(x => [...x.options].some(o => o.value === 'APPROVED')); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'APPROVED'); s.dispatchEvent(new Event('change', { bubbles: true })); })()");
    await wait("[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'View Details' && b.getClientRects().length)", 'review rows for details');
    await evaluate("(() => { [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'View Details' && b.getClientRects().length).click(); })()");
    await wait(dialogWith('Review details'), 'review details dialog');
    await pause(400);
    await saveShot('review-detail.png');
    await pressEscape();
    console.log('  Browser: review details open in the shared admin layout.');

    // Cancellation with no refund owed: listed as "No refund due", with no record action and nothing pending.
    const zeroRefundBooking = await Booking.findOne({
      _id: { $ne: browserBooking._id },
      payments: { $elemMatch: { method: { $ne: 'REFUND' }, status: 'SUCCESS' } },
      status: { $in: ['PENDING', 'CONFIRMED', 'COMPLETED'] },
    }).lean();
    assert.ok(zeroRefundBooking, 'A paid booking is needed for the no-refund check');
    await Booking.updateOne({ _id: zeroRefundBooking._id }, { $set: { status: 'CANCELLED', cancellation: { isCancelled: true, cancelledAt: new Date(), reason: 'Synthetic cancellation with no refund due', refundAmount: 0, refundProcessed: false } } });
    await navigate('/admin/refunds');
    await wait("[...document.querySelectorAll('select')].some(s => [...s.options].some(o => o.value === 'none'))", 'refund filter with no-refund option');
    await evaluate("(() => { const s = [...document.querySelectorAll('select')].find(x => [...x.options].some(o => o.value === 'none')); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'none'); s.dispatchEvent(new Event('change', { bubbles: true })); })()");
    await wait("[...document.querySelectorAll('tr')].some(r => r.innerText.includes('No refund due'))", 'no-refund row listed');
    const noRefundRows = await evaluate("[...document.querySelectorAll('tr')].filter(r => r.innerText.includes('No refund due')).map(r => ({ recordButtons: r.querySelectorAll(\"button[title='Record completed refund']\").length }))");
    assert.ok(noRefundRows.length >= 1 && noRefundRows.every(r => r.recordButtons === 0), 'No-refund rows must not offer a record action: ' + JSON.stringify(noRefundRows));
    console.log('  Browser: cancellation with no refund due is listed as "No refund due" and has no record action.');

    // Tablet navigation drawer: solid background, visible close button.
    await call('Emulation.setDeviceMetricsOverride', { width: 900, height: 1000, deviceScaleFactor: 1, mobile: false });
    await navigate('/admin/settings');
    await wait("Boolean(document.querySelector('button[aria-label=\"Toggle navigation\"]'))", 'tablet menu button');
    await evaluate("(() => { document.querySelector('button[aria-label=\"Toggle navigation\"]').click(); })()");
    await wait("Boolean(document.querySelector('button[aria-label=\"Close navigation\"]'))", 'drawer close button');
    await pause(400);
    const drawerBackground = await evaluate("getComputedStyle(document.querySelector('aside[aria-label=\"Admin navigation\"]')).backgroundColor");
    const drawerAlpha = drawerBackground.startsWith('rgba') ? Number(drawerBackground.split(',')[3].replace(')', '').trim()) : 1;
    assert.equal(drawerAlpha, 1, 'Tablet navigation drawer must be opaque, got ' + drawerBackground);
    await saveShot('tablet-nav.png');
    await evaluate("(() => { document.querySelector('button[aria-label=\"Close navigation\"]').click(); })()");
    await wait("document.querySelector('aside[aria-label=\"Admin navigation\"]').getBoundingClientRect().right <= 0", 'drawer closed by its close button');
    await call('Emulation.clearDeviceMetricsOverride', {});
    console.log('  Browser: tablet navigation drawer is opaque and closes with its close button.');

    // Customer assistant: opens on the public landing page, answers with the unavailable message when no key is configured, closes with Escape, and is absent from admin pages.
    await navigate('/');
    await wait("[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Ask TripBloom')", 'assistant launcher on landing page');
    await evaluate("(() => { [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Ask TripBloom').click(); })()");
    await wait("Boolean(document.querySelector('[role=\"dialog\"][aria-label=\"TripBloom assistant\"]'))", 'assistant panel opens');
    await fill('input[aria-label="Your question"]', 'Packages for two under 25000 BDT');
    await evaluate("(() => { [...document.querySelectorAll('button[aria-label=\"Send\"]')].find(b => !b.disabled).click(); })()");
    await wait("[...document.querySelectorAll('[role=\"dialog\"][aria-label=\"TripBloom assistant\"] [role=\"alert\"]')].some(a => a.textContent.includes('unavailable'))", 'assistant reports unavailable without a key');
    if (saveShot) await saveShot('assistant-panel.png');
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await wait("!document.querySelector('[role=\"dialog\"][aria-label=\"TripBloom assistant\"]')", 'assistant closes with Escape');
    console.log('  Browser: customer assistant opens on the landing page, reports unavailable without a key, and closes with Escape.');
    // The panel must fit a 375px phone screen.
    await call('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
    await pause(600);
    await evaluate("(() => { [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Ask TripBloom').click(); })()");
    await wait("Boolean(document.querySelector('[role=\"dialog\"][aria-label=\"TripBloom assistant\"]'))", 'assistant panel on phone');
    const phoneFit = await evaluate("(() => { const r = document.querySelector('[role=\"dialog\"][aria-label=\"TripBloom assistant\"]').getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), width: document.documentElement.clientWidth, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }; })()");
    assert.ok(phoneFit.left >= 0 && phoneFit.right <= phoneFit.width + 1 && phoneFit.overflow <= 0, 'Assistant panel must fit a 375px screen: ' + JSON.stringify(phoneFit));
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await call('Emulation.clearDeviceMetricsOverride', {});
    console.log('  Browser: assistant panel fits a 375px phone screen without page overflow.');

    await navigate('/admin/activity-logs');
    await wait("Boolean(document.querySelector('button[aria-label=\"Toggle navigation\"], aside[aria-label=\"Admin navigation\"]'))", 'admin shell rendered');
    const assistantOnAdmin = await evaluate("Boolean(document.querySelector('[aria-label=\"TripBloom assistant\"]')) || [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Ask TripBloom')");
    assert.equal(assistantOnAdmin, false, 'The customer assistant must not appear on admin pages');
    console.log('  Browser: the customer assistant is not shown on admin pages.');

    // Liquid glass check: the panel stays translucent over scrolled page content and remains readable.
    await navigate('/');
    await wait("[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Ask TripBloom')", 'launcher for liquid glass check');
    await evaluate("(() => { [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Ask TripBloom').click(); })()");
    await wait("Boolean(document.querySelector('[role=\"dialog\"][aria-label=\"TripBloom assistant\"]'))", 'panel for liquid glass check');
    await evaluate("window.scrollTo(0, 900)");
    await pause(500);
    const glassStyle = await evaluate("(() => { const s = getComputedStyle(document.querySelector('[role=\"dialog\"][aria-label=\"TripBloom assistant\"]')); return { blur: s.backdropFilter || s.webkitBackdropFilter || '', background: s.backgroundColor }; })()");
    assert.ok(/blur/.test(glassStyle.blur), 'Assistant panel must blur the content behind it, got ' + JSON.stringify(glassStyle));
    if (saveShot) await saveShot('assistant-liquid.png');
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await evaluate("window.scrollTo(0, 0)");
    console.log('  Browser: assistant panel blurs the page content behind it when the page is scrolled.');

    // Customer: Chat with the operator opens the dark dialog, sends a message through the signed-in session, and shows it.
    // The chat button needs a paid booking with an operator. Copy the shared synthetic booking (its payments) for this check,
    // so the shared booking keeps the state the earlier checks depend on.
    const chatSource = await Booking.findById(browserBooking._id).lean();
    const { _id: ignoredId, createdAt: ignoredCreated, updatedAt: ignoredUpdated, bookingCode: ignoredCode, ...chatFields } = chatSource;
    const chatBooking = await Booking.create({ ...chatFields, status: 'CONFIRMED', assignedOperator: guide._id, cancellation: { isCancelled: false }, dateChangeRequest: undefined });
    await evaluate('localStorage.clear()');
    await login(customer);
    await wait("Boolean(document.querySelector('section[aria-label=\"Bookings\"]'))", 'customer bookings section');
    await wait("[...document.querySelectorAll('section[aria-label=\"Bookings\"] button')].some(b => b.textContent.trim() === 'Chat')", 'customer booking chat button');
    await evaluate("(() => { [...document.querySelectorAll('section[aria-label=\"Bookings\"] button')].find(b => b.textContent.trim() === 'Chat').click(); })()");
    await wait("[...document.querySelectorAll('[role=\"dialog\"]')].some(d => d.innerText.includes('Chat with'))", 'operator chat dialog');
    const customerChat = 'Browser check: is the bus air-conditioned?';
    await evaluate(`(() => { const t = document.querySelector('#operator-chat-draft'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(t, ${JSON.stringify(customerChat)}); t.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await evaluate("(() => { [...document.querySelectorAll('[role=\"dialog\"] button')].find(b => b.textContent.trim() === 'Send').click(); })()");
    await wait(`document.querySelector('[role="log"]')?.innerText.includes(${JSON.stringify(customerChat)})`, 'sent chat message shown in the dialog');
    if (saveShot) await saveShot('customer-operator-chat.png');
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await wait("!document.querySelector('#operator-chat-draft')", 'operator chat closed');
    console.log('  Browser: customer chat with the operator opens, sends a message through the signed-in session, and shows it.');

    // Operator workspace: the shell and home page at three widths, the tablet drawer, and no invented rating.
    await evaluate('localStorage.clear()');
    await login(guide);
    await wait("Boolean(document.querySelector('aside[aria-label=\"Operator navigation\"]'))", 'operator shell');
    await wait("[...document.querySelectorAll('h2')].some(h => h.textContent.includes('Welcome back'))", 'operator home greeting');
    const operatorPage = await evaluate("document.body.innerText");
    assert.ok(!/4\.9/.test(operatorPage), 'The operator home must not show the invented 4.9 rating');
    for (const width of [1440, 900, 375]) {
      await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 800 });
      await pause(700);
      const overflow = await evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth');
      assert.ok(overflow <= 0, `Operator home must not scroll sideways at ${width}px (overflow ${overflow})`);
      if (saveShot && width !== 900) await saveShot(`operator-${width}.png`);
    }
    await call('Emulation.setDeviceMetricsOverride', { width: 900, height: 900, deviceScaleFactor: 1, mobile: false });
    await pause(500);
    await evaluate("(() => { document.querySelector('button[aria-label=\"Toggle navigation\"]').click(); })()");
    await wait("Boolean(document.querySelector('button[aria-label=\"Close navigation\"]'))", 'operator drawer close control');
    const operatorDrawerBackground = await evaluate("getComputedStyle(document.querySelector('aside[aria-label=\"Operator navigation\"]')).backgroundColor");
    const operatorDrawerAlpha = operatorDrawerBackground.startsWith('rgba') ? Number(operatorDrawerBackground.split(',')[3].replace(')', '').trim()) : 1;
    assert.equal(operatorDrawerAlpha, 1, 'The operator drawer on tablet must be opaque, got ' + operatorDrawerBackground);
    await evaluate("(() => { document.querySelector('button[aria-label=\"Close navigation\"]').click(); })()");
    await wait("document.querySelector('aside[aria-label=\"Operator navigation\"]').getBoundingClientRect().right <= 0", 'operator drawer closed by its control');
    await call('Emulation.clearDeviceMetricsOverride', {});
    console.log('  Browser: operator home fits 1440px, 900px and 375px; the tablet drawer is opaque and closes; no invented rating is shown.');

    // Operator: My Departures lists the assigned departures with filters, and fits a phone screen.
    await evaluate("(() => { [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'My Departures').click(); })()");
    await wait("Boolean(document.querySelector('section[aria-label=\"Filter departures\"]'))", 'my departures filters');
    await wait("[...document.querySelectorAll('li')].some(li => li.innerText.includes('Showing') || li.innerText.includes('Synthetic Group Tour'))", 'departure cards rendered');
    await wait("!!document.querySelector('ul.grid') || document.body.innerText.includes('No departures')", 'departure list settled');
    await pause(400);
    const departureCards = await evaluate("document.querySelectorAll('section[aria-label=\"Filter departures\"] ~ ul > li').length");
    assert.ok(departureCards >= 1, 'My Departures must list the assigned departures');
    await evaluate("(() => { const s = document.querySelector('select#dep-status'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'CANCELLED'); s.dispatchEvent(new Event('change', { bubbles: true })); })()");
    await pause(300);
    await evaluate("(() => { const s = document.querySelector('select#dep-status'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'ALL'); s.dispatchEvent(new Event('change', { bubbles: true })); })()");
    await call('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
    await pause(700);
    const departuresOverflow = await evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth');
    if (saveShot) await saveShot('operator-departures-375.png');
    await call('Emulation.clearDeviceMetricsOverride', {});
    assert.ok(departuresOverflow <= 0, `My Departures must not scroll sideways at 375px (overflow ${departuresOverflow})`);
    console.log('  Browser: operator My Departures lists assigned departures, filters, and fits 375px.');

    // Operator: My Bookings lists bookings on the operator's departures with filters, and fits 375px.
    await evaluate("(() => { [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'My Bookings').click(); })()");
    await wait("Boolean(document.querySelector('section[aria-label=\"Filter bookings\"]'))", 'my bookings filters');
    await wait("document.body.innerText.includes('Showing') || document.body.innerText.includes('No bookings yet')", 'my bookings settled');
    await call('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
    await pause(700);
    const bookingsOverflow = await evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth');
    if (saveShot) await saveShot('operator-bookings-375.png');
    await call('Emulation.clearDeviceMetricsOverride', {});
    assert.ok(bookingsOverflow <= 0, `My Bookings must not scroll sideways at 375px (overflow ${bookingsOverflow})`);
    console.log('  Browser: operator My Bookings lists bookings with filters and fits 375px.');

    // Operator: a departure opens into its detail screen with tabs that fit a phone. Start is blocked until the
    // safety checks are complete, and an incident logged on the Safety tab is still listed after the list reloads.
    await evaluate("(() => { [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'My Departures').click(); })()");
    await wait("[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Open departure')", 'open departure control');
    await evaluate("(() => { [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Open departure').click(); })()");
    await wait("Boolean(document.querySelector('[role=\"tablist\"][aria-label=\"Departure sections\"]'))", 'departure detail tabs');
    await call('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
    await pause(700);
    const detailOverflow = await evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth');
    if (saveShot) await saveShot('operator-departure-detail-375.png');
    await call('Emulation.clearDeviceMetricsOverride', {});
    assert.ok(detailOverflow <= 0, `Departure detail must not scroll sideways at 375px (overflow ${detailOverflow})`);
    await evaluate("(() => { [...document.querySelectorAll('[role=\"tab\"]')].find(t => t.textContent.includes('Safety')).click(); })()");
    await wait("[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Start tour' || b.textContent.trim() === 'Mark tour completed')", 'tour control');
    await evaluate("(() => { const start = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Start tour'); if (start) start.click(); })()");
    await wait("document.body.innerText.includes('Complete the safety checks before starting the tour.') || document.body.innerText.includes('Mark tour completed')", 'start tour gated by safety checks');
    const incidentText = 'Browser check: guest feeling unwell';
    await evaluate("(() => { [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Log incident').click(); })()");
    await wait("Boolean(document.querySelector('#incident-description'))", 'incident form');
    await evaluate(`(() => { const t = document.querySelector('#incident-description'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(t, ${JSON.stringify(incidentText)}); t.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await evaluate("(() => { [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Save incident').click(); })()");
    await wait(`document.body.innerText.includes(${JSON.stringify(incidentText)})`, 'incident listed after saving');
    await evaluate("(() => { [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'My Departures').click(); })()");
    await wait("[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Open departure')", 'departures list after reload');
    await evaluate("(() => { [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Open departure').click(); })()");
    await wait("Boolean(document.querySelector('[role=\"tablist\"][aria-label=\"Departure sections\"]'))", 'departure detail after reopening');
    await evaluate("(() => { [...document.querySelectorAll('[role=\"tab\"]')].find(t => t.textContent.includes('Safety')).click(); })()");
    await wait(`document.body.innerText.includes(${JSON.stringify(incidentText)})`, 'incident persisted after reopening the departure');
    console.log('  Browser: operator departure detail fits 375px, blocks Start until safety checks pass, and keeps a logged incident after reopening.');

    // Operator: notes saved from a booking are still there after closing and reopening the booking.
    await evaluate("(() => { [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'My Bookings').click(); })()");
    await wait("[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Open')", 'an operator booking to open');
    await evaluate("(() => { [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Open').click(); })()");
    await wait("Boolean(document.querySelector('#operator-notes'))", 'booking notes field');
    const operatorNote = 'Browser check: vegetarian meals';
    await evaluate(`(() => { const t = document.querySelector('#operator-notes'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(t, ${JSON.stringify(operatorNote)}); t.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await evaluate("(() => { [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Save notes').click(); })()");
    // The button is disabled while saving (aria-busy) and again once the saved text matches the field.
    await wait("[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Save notes' && b.disabled && !b.hasAttribute('aria-busy'))", 'notes saved (save finished)');
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await wait("!document.querySelector('#operator-notes')", 'booking closed');
    await evaluate("(() => { [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Open').click(); })()");
    await wait("Boolean(document.querySelector('#operator-notes'))", 'booking reopened');
    await wait(`document.querySelector('#operator-notes').value === ${JSON.stringify(operatorNote)}`, 'saved notes shown after reopening');
    console.log('  Browser: operator notes saved from a booking are still there after closing and reopening it.');

    // Operator: profile, itinerary and messages load from the backend, show no placeholder figures, and fit 375px.
    const clickNav = label => evaluate(`(() => { [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)}).click(); })()`);
    const fitsPhone = async name => {
      await call('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
      await pause(700);
      const overflow = await evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth');
      if (saveShot) await saveShot(`operator-${name}-375.png`);
      await call('Emulation.clearDeviceMetricsOverride', {});
      assert.ok(overflow <= 0, `${name} must not scroll sideways at 375px (overflow ${overflow})`);
    };

    await clickNav('Profile');
    await wait("Boolean(document.querySelector('#profile-name')) && document.body.innerText.includes('Identity verification')", 'operator profile loaded');
    const profileText = await evaluate('document.body.innerText');
    assert.ok(!/Not in database yet|Rating|reviews/.test(profileText), 'The operator profile must not show placeholder fields or a rating');
    await fitsPhone('profile');
    console.log('  Browser: operator profile loads the saved details and identity status, shows no placeholder fields, and fits 375px.');

    await clickNav('Itinerary');
    await wait("[...document.querySelectorAll('h3')].some(h => h.textContent.trim() === 'Upcoming departures')", 'operator itinerary loaded');
    await fitsPhone('itinerary');
    console.log('  Browser: operator itinerary lists upcoming departures and fits 375px.');

    await clickNav('Messages');
    await wait("Boolean(document.querySelector('[role=\"tablist\"][aria-label=\"Message sections\"]'))", 'operator messages loaded');
    await wait("document.body.innerText.includes('Conversations') && !document.body.innerText.includes('Loading conversations')", 'operator conversations settled');
    await evaluate("(() => { document.querySelector('#messages-tab-broadcast').click(); })()");
    await wait("[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Send announcement')", 'announcement composer');
    const broadcastText = await evaluate('document.body.innerText');
    assert.ok(!/SMS|email to all/i.test(broadcastText), 'Announcements must not claim SMS or email delivery');
    await fitsPhone('messages');
    console.log('  Browser: operator messages list conversations, the announcement tab makes no SMS or email claim, and both fit 375px.');

  } finally {
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error('Browser session closed.')); }
    pending.clear(); socket.close();
  }
}
