// Auth state
let accessToken = null;
let currentUser = null;

const AUTH_API = '/api/auth';

// Try to restore session on page load (silent refresh)
async function initAuth() {
    try {
        const res = await fetch(`${AUTH_API}/refresh`, {
            method: 'POST',
            credentials: 'include'  // sends HttpOnly cookie
        });
        if (res.ok) {
            const data = await res.json();
            accessToken = data.access_token;
            await fetchCurrentUser();
        }
    } catch (e) {
        // Not logged in, that's fine
    }
    updateAuthUI();
}

async function fetchCurrentUser() {
    const res = await authFetch('/api/users/me');
    if (res.ok) {
        currentUser = await res.json();
    }
}

// Wrapper for authenticated API calls
async function authFetch(url, options = {}) {
    if (!options.headers) options.headers = {};
    if (accessToken) {
        options.headers['Authorization'] = `Bearer ${accessToken}`;
    }
    options.credentials = 'include';

    let res = await fetch(url, options);

    // If 401/403, try refreshing token once
    if ((res.status === 401 || res.status === 403) && accessToken) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
            options.headers['Authorization'] = `Bearer ${accessToken}`;
            res = await fetch(url, options);
        }
    }
    return res;
}

async function refreshAccessToken() {
    try {
        const res = await fetch(`${AUTH_API}/refresh`, {
            method: 'POST',
            credentials: 'include'
        });
        if (res.ok) {
            const data = await res.json();
            accessToken = data.access_token;
            return true;
        }
    } catch (e) {}
    // Refresh failed — user needs to re-login
    accessToken = null;
    currentUser = null;
    return false;
}

async function signup(email, name, password, referralCode) {
    const body = { email, name, password };
    if (referralCode) body.referral_code = referralCode;

    const res = await fetch(`${AUTH_API}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
    });

    if (res.ok) {
        const data = await res.json();
        accessToken = data.access_token;
        currentUser = data.user;
        return { success: true };
    } else {
        const err = await res.json();
        return { success: false, error: err.detail || 'Signup failed' };
    }
}

async function login(email, password) {
    const res = await fetch(`${AUTH_API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
    });

    if (res.ok) {
        const data = await res.json();
        accessToken = data.access_token;
        currentUser = data.user;
        return { success: true };
    } else {
        const err = await res.json();
        return { success: false, error: err.detail || 'Login failed' };
    }
}

async function logout() {
    await fetch(`${AUTH_API}/logout`, {
        method: 'POST',
        credentials: 'include'
    });
    accessToken = null;
    currentUser = null;
    window.location.href = '/';
}

function isLoggedIn() {
    return !!accessToken && !!currentUser;
}

// Update nav UI based on auth state — call this after initAuth
function updateAuthUI() {
    // Look for elements with data-auth attributes
    document.querySelectorAll('[data-auth="logged-in"]').forEach(el => {
        el.style.display = isLoggedIn() ? '' : 'none';
    });
    document.querySelectorAll('[data-auth="logged-out"]').forEach(el => {
        el.style.display = isLoggedIn() ? 'none' : '';
    });

    // Update user name/email displays
    document.querySelectorAll('[data-auth-name]').forEach(el => {
        el.textContent = currentUser?.name || '';
    });
    document.querySelectorAll('[data-auth-email]').forEach(el => {
        el.textContent = currentUser?.email || '';
    });
    document.querySelectorAll('[data-auth-initials]').forEach(el => {
        el.textContent = currentUser?.name ? currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';
    });
}
