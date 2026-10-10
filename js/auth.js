/* Budget Planner: sign-in.
 *
 * There is no server, so this is a browser-side login for the school project:
 *  - the password is never stored as text; the code only contains the SHA-256 hash of "salt + password";
 *  - the entered password is hashed the same way and the two hashes are compared;
 *  - a successful sign-in is remembered for the current browser tab only (sessionStorage);
 *  - after 5 wrong attempts the form is locked for 30 seconds.
 * This is not real security (anyone can read the page code), it only controls access to the app screen.
 */
(function (root) {
  'use strict';

  const SALT = 'budget-planner:v1:';
  const SESSION_KEY = 'bp_session';
  const MAX_ATTEMPTS = 5;
  const LOCK_MS = 30000;

  // Demo account: username "admin", password "admin". Hash = SHA-256("budget-planner:v1:admin").
  const USERS = [
    { username: 'admin', hash: '1d8209ee23888e4810003d83b2277c20ca20bd5f4cc3d79469a57378074510b9' },
  ];

  let failedAttempts = 0;
  let lockedUntil = 0;

  /* ---- SHA-256 ---- */

  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));

  /** Plain JavaScript SHA-256 (used when the browser has no Web Crypto, e.g. on an insecure http page). */
  function sha256Fallback(message) {
    const bytes = Array.from(new TextEncoder().encode(message));
    const bitLength = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    const high = Math.floor(bitLength / 0x100000000), low = bitLength >>> 0;
    for (let i = 3; i >= 0; i--) bytes.push((high >>> (i * 8)) & 255);
    for (let i = 3; i >= 0; i--) bytes.push((low >>> (i * 8)) & 255);

    let h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const w = new Array(64);
    for (let off = 0; off < bytes.length; off += 64) {
      for (let i = 0; i < 16; i++) {
        w[i] = (bytes[off + i * 4] << 24) | (bytes[off + i * 4 + 1] << 16) | (bytes[off + i * 4 + 2] << 8) | bytes[off + i * 4 + 3];
      }
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, hh] = h;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (hh + S1 + ch + K[i] + w[i]) | 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h = [h[0] + a, h[1] + b, h[2] + c, h[3] + d, h[4] + e, h[5] + f, h[6] + g, h[7] + hh].map(x => x | 0);
    }
    return h.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
  }

  /** SHA-256 as a hex string. Uses the browser's Web Crypto when available (MDN: SubtleCrypto.digest). */
  async function sha256Hex(text) {
    if (root.crypto && root.crypto.subtle) {
      try {
        const data = new TextEncoder().encode(text);
        const digest = await root.crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (e) { /* fall through to the plain JavaScript version */ }
    }
    return sha256Fallback(text);
  }

  /* ---- Session ---- */

  function isLoggedIn() {
    try {
      const name = root.sessionStorage.getItem(SESSION_KEY);
      return USERS.some(u => u.username === name);
    } catch (e) { return false; }
  }
  function setSession(username) { try { root.sessionStorage.setItem(SESSION_KEY, username); } catch (e) { /* storage blocked */ } }
  function logout() { try { root.sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ } }

  /**
   * Checks the entered username and password.
   * Returns { ok: true } or { ok: false, error: 'message' }.
   */
  async function login(username, password) {
    const now = Date.now();
    if (now < lockedUntil) {
      return { ok: false, error: 'Too many attempts. Try again in ' + Math.ceil((lockedUntil - now) / 1000) + ' seconds.' };
    }
    const hash = await sha256Hex(SALT + password);
    const user = USERS.find(u => u.username === String(username).trim());
    // The hash is always computed, so a wrong username and a wrong password take the same time.
    if (user && user.hash === hash) {
      failedAttempts = 0;
      setSession(user.username);
      return { ok: true };
    }
    failedAttempts++;
    if (failedAttempts >= MAX_ATTEMPTS) {
      failedAttempts = 0;
      lockedUntil = Date.now() + LOCK_MS;
      return { ok: false, error: 'Too many attempts. The form is locked for 30 seconds.' };
    }
    return { ok: false, error: 'Wrong username or password.' };
  }

  const api = { login, logout, isLoggedIn, sha256Hex, sha256Fallback, SALT };
  root.Auth = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
