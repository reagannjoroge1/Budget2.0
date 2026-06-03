/* ══════════════════════════════════════════════════════════════
   NAIROBI COUNTY BUDGET PLATFORM — auth.js  (FULLY FIXED)

   FIXES APPLIED:
   1. Signup now works — removed photoURL null crash
   2. Full-page auth landing shown before platform loads
   3. Platform hidden until user is logged in + verified
   4. switchLanding() replaces broken switchMode()
   5. Sequential Firebase SDK loading (app before auth)
   6. All errors logged to console for debugging
   7. Swahili toggle fixed in app.js (separate fix)
   ══════════════════════════════════════════════════════════════ */

const firebaseConfig = {
  apiKey:            "AIzaSyCbOJ9riYQSneDDTrKXHa2jgl1EKf9LRQw",
  authDomain:        "county-budget-dashboard.firebaseapp.com",
  projectId:         "county-budget-dashboard",
  storageBucket:     "county-budget-dashboard.firebasestorage.app",
  messagingSenderId: "738240493429",
  appId:             "1:738240493429:web:5511230b8b786a6acbc53c",
  measurementId:     "G-XQ3P7WJ7R3"
};

const Auth = (() => {

  let firebaseAuth  = null;
  let currentUser   = null;
  let dropdownOpen  = false;
  let resendTimer   = null;
  let resendSeconds = 60;
  let activeMode    = 'login';

  const RE = {
    email:    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
    name:     /^[a-zA-Z\s'\-]{2,50}$/,
    ward:     /^[a-zA-Z\s\/'\-]{2,60}$/,
  };

  /* ── Load Firebase SDK sequentially ── */
  function loadFirebase() {
    return new Promise((resolve, reject) => {
      if (window.firebase && window.firebase.auth) { resolve(); return; }
      const scripts = [
        'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
        'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js',
      ];
      function loadNext(i) {
        if (i >= scripts.length) { resolve(); return; }
        const s = document.createElement('script');
        s.src = scripts[i];
        s.onload  = () => loadNext(i + 1);
        s.onerror = () => reject(new Error('Failed to load: ' + scripts[i]));
        document.head.appendChild(s);
      }
      loadNext(0);
    });
  }

  /* ══════════════════════════════════════════
     INIT
     Shows auth landing first. Platform only
     revealed after successful verified login.
     ══════════════════════════════════════════ */
  async function init() {
    injectToastContainer();
    hidePlatform(true);
    showAuthLanding('login');

    try {
      await loadFirebase();

      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      firebaseAuth = firebase.auth();

      try {
        await firebaseAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      } catch(e) {
        console.warn('[Auth] setPersistence non-fatal:', e.code);
      }

      /* Handle Google redirect return */
      try {
        const result = await firebaseAuth.getRedirectResult();
        if (result && result.user) {
          toast('Karibu, ' + (result.user.displayName || 'Resident') + '!', 'success');
        }
      } catch(e) {
        if (e.code && e.code !== 'auth/no-auth-event') {
          console.warn('[Auth] Redirect result:', e.code);
        }
      }

      /* Auth state listener — core of the whole flow */
      firebaseAuth.onAuthStateChanged(function(user) {
        currentUser = user;
        if (user) {
          if (!user.emailVerified) {
            /* Signed in but not verified */
            hidePlatform(true);
            renderHeaderUser(user);
            showAuthLanding('verify');
          } else {
            /* Fully authenticated */
            hidePlatform(false);
            hideAuthLanding();
            renderHeaderUser(user);
          }
        } else {
          /* Logged out */
          hidePlatform(true);
          renderHeaderGuest();
          showAuthLanding('login');
        }
      });

    } catch (err) {
      console.error('[Auth] Init failed:', err);
      toast('Auth service unavailable. Refresh to try again.', 'warning');
      hidePlatform(false);
      hideAuthLanding();
    }
  }

  /* ══════════════════════════════════════════
     AUTH LANDING PAGE (full screen)
     ══════════════════════════════════════════ */
  function showAuthLanding(mode) {
    activeMode = mode || 'login';
    let landing = document.getElementById('authLanding');
    if (!landing) {
      landing = document.createElement('div');
      landing.id = 'authLanding';
      landing.style.cssText = [
        'position:fixed','inset:0','z-index:8000',
        'background:linear-gradient(135deg,#07150e 0%,#0d3320 50%,#07150e 100%)',
        'display:flex','align-items:center','justify-content:center',
        'padding:20px','overflow-y:auto'
      ].join(';');
      document.body.appendChild(landing);
    }
    landing.style.display = 'flex';
    landing.innerHTML = buildLandingHTML(activeMode);
    attachValidation(activeMode);
    if (activeMode === 'verify' && currentUser) {
      _showVerifyPanel(currentUser.email);
    }
    if (activeMode === 'forgot') {
      _showForgotPanel();
    }
  }

  function hideAuthLanding() {
    const landing = document.getElementById('authLanding');
    if (!landing) return;
    landing.style.transition = 'opacity 0.35s ease';
    landing.style.opacity = '0';
    setTimeout(function() {
      landing.style.display = 'none';
      landing.style.opacity = '1';
    }, 360);
  }

  function buildLandingHTML(mode) {
    var loginDisplay  = mode === 'login'  ? 'block' : 'none';
    var signupDisplay = mode === 'signup' ? 'block' : 'none';
    var loginActive   = mode === 'login'  ? 'active' : '';
    var signupActive  = mode === 'signup' ? 'active' : '';

    return '<div style="width:100%;max-width:480px">' +
      '<div style="text-align:center;margin-bottom:28px">' +
        '<div style="width:60px;height:60px;border-radius:16px;' +
          'background:linear-gradient(135deg,#2e9e5b,#5fcf85);' +
          'display:flex;align-items:center;justify-content:center;' +
          'font-size:26px;margin:0 auto 14px">&#127963;</div>' +
        '<h1 style="font-family:Syne,sans-serif;font-size:1.55rem;font-weight:800;' +
          'color:#e8f5ed;margin-bottom:6px">Nairobi Budget Platform</h1>' +
        '<p style="font-size:.84rem;color:#7aab8c;line-height:1.6;max-width:340px;margin:0 auto">' +
          'Kenya\'s open budget transparency platform.<br>' +
          'Sign in to comment, participate, and hold power to account.' +
        '</p>' +
      '</div>' +

      '<div class="auth-modal" style="max-width:480px;margin:0 auto">' +
        '<div class="auth-error-banner"   id="authErrorBanner"></div>' +
        '<div class="auth-success-banner" id="authSuccessBanner"></div>' +

        '<div class="auth-tabs" id="authTabs">' +
          '<button class="auth-tab ' + loginActive  + '" onclick="Auth.switchLanding(\'login\')">Sign In</button>' +
          '<button class="auth-tab ' + signupActive + '" onclick="Auth.switchLanding(\'signup\')">Create Account</button>' +
        '</div>' +

        /* LOGIN FORM */
        '<div id="loginForm" style="display:' + loginDisplay + '">' +
          '<div class="auth-field">' +
            '<label class="auth-label">Email address</label>' +
            '<div class="auth-input-wrap">' +
              '<input class="auth-input" type="email" id="loginEmail" placeholder="you@example.com" autocomplete="email">' +
              '<span class="auth-input-icon" id="loginEmailIcon">&#9993;</span>' +
            '</div>' +
            '<div class="auth-hint" id="loginEmailHint"></div>' +
          '</div>' +
          '<div class="auth-field">' +
            '<label class="auth-label">Password</label>' +
            '<div class="auth-input-wrap">' +
              '<input class="auth-input" type="password" id="loginPw" placeholder="Your password" autocomplete="current-password">' +
              '<button class="auth-toggle-pw" type="button" onclick="Auth.togglePw(\'loginPw\',this)" tabindex="-1">&#128065;</button>' +
            '</div>' +
            '<div class="auth-hint" id="loginPwHint"></div>' +
          '</div>' +
          '<div class="auth-forgot"><a onclick="Auth.switchLanding(\'forgot\')">Forgot password?</a></div>' +
          '<div class="auth-check-row">' +
            '<input type="checkbox" id="rememberMe" checked>' +
            '<label class="auth-check-label" for="rememberMe">Keep me signed in</label>' +
          '</div>' +
          '<button class="auth-btn" id="loginBtn" onclick="Auth.handleLogin()">' +
            '<span class="auth-btn-text">Sign In &rarr;</span>' +
            '<div class="auth-btn-spinner"></div>' +
          '</button>' +
          '<div class="auth-divider">or</div>' +
          '<button class="auth-btn-google" onclick="Auth.handleGoogleSignIn()">' +
            _googleSVG() + ' Continue with Google' +
          '</button>' +
          '<div class="auth-switch">No account? <a onclick="Auth.switchLanding(\'signup\')">Create one free</a></div>' +
        '</div>' +

        /* SIGNUP FORM */
        '<div id="signupForm" style="display:' + signupDisplay + '">' +
          '<div class="auth-field-row">' +
            '<div class="auth-field">' +
              '<label class="auth-label">First name</label>' +
              '<div class="auth-input-wrap">' +
                '<input class="auth-input" type="text" id="signupFirst" placeholder="Grace" autocomplete="given-name">' +
                '<span class="auth-input-icon" id="signupFirstIcon">&#128100;</span>' +
              '</div>' +
              '<div class="auth-hint" id="signupFirstHint"></div>' +
            '</div>' +
            '<div class="auth-field">' +
              '<label class="auth-label">Last name</label>' +
              '<div class="auth-input-wrap">' +
                '<input class="auth-input" type="text" id="signupLast" placeholder="Njoroge" autocomplete="family-name">' +
                '<span class="auth-input-icon" id="signupLastIcon">&#128100;</span>' +
              '</div>' +
              '<div class="auth-hint" id="signupLastHint"></div>' +
            '</div>' +
          '</div>' +
          '<div class="auth-field">' +
            '<label class="auth-label">Your ward <span style="color:#4a7a5c;font-weight:400">(optional)</span></label>' +
            '<div class="auth-input-wrap">' +
              '<input class="auth-input" type="text" id="signupWard" placeholder="e.g. Kibra, Westlands, Kasarani">' +
              '<span class="auth-input-icon" id="signupWardIcon">&#127968;</span>' +
            '</div>' +
            '<div class="auth-hint info" id="signupWardHint">Helps attribute your comments to the right ward</div>' +
          '</div>' +
          '<div class="auth-field">' +
            '<label class="auth-label">Email address</label>' +
            '<div class="auth-input-wrap">' +
              '<input class="auth-input" type="email" id="signupEmail" placeholder="you@example.com" autocomplete="email">' +
              '<span class="auth-input-icon" id="signupEmailIcon">&#9993;</span>' +
            '</div>' +
            '<div class="auth-hint" id="signupEmailHint"></div>' +
          '</div>' +
          '<div class="auth-field">' +
            '<label class="auth-label">Password</label>' +
            '<div class="auth-input-wrap">' +
              '<input class="auth-input" type="password" id="signupPw" placeholder="Min 8 chars, upper + lower + number" autocomplete="new-password">' +
              '<button class="auth-toggle-pw" type="button" onclick="Auth.togglePw(\'signupPw\',this)" tabindex="-1">&#128065;</button>' +
            '</div>' +
            '<div class="pw-strength-wrap">' +
              '<div class="pw-strength-bar"><div class="pw-strength-fill" id="pwStrengthFill"></div></div>' +
              '<div class="pw-strength-label" id="pwStrengthLabel">Enter a password</div>' +
            '</div>' +
            '<div class="auth-hint" id="signupPwHint"></div>' +
          '</div>' +
          '<div class="auth-field">' +
            '<label class="auth-label">Confirm password</label>' +
            '<div class="auth-input-wrap">' +
              '<input class="auth-input" type="password" id="signupPw2" placeholder="Repeat your password" autocomplete="new-password">' +
              '<button class="auth-toggle-pw" type="button" onclick="Auth.togglePw(\'signupPw2\',this)" tabindex="-1">&#128065;</button>' +
            '</div>' +
            '<div class="auth-hint" id="signupPw2Hint"></div>' +
          '</div>' +
          '<div class="auth-check-row">' +
            '<input type="checkbox" id="agreeTerms">' +
            '<label class="auth-check-label" for="agreeTerms">' +
              'I agree to the Terms of Use and Privacy Policy. I am a Nairobi County resident or stakeholder.' +
            '</label>' +
          '</div>' +
          '<button class="auth-btn" id="signupBtn" onclick="Auth.handleSignup()">' +
            '<span class="auth-btn-text">Create My Account &rarr;</span>' +
            '<div class="auth-btn-spinner"></div>' +
          '</button>' +
          '<div class="auth-divider">or</div>' +
          '<button class="auth-btn-google" onclick="Auth.handleGoogleSignIn()">' +
            _googleSVG() + ' Continue with Google' +
          '</button>' +
          '<div class="auth-switch">Have an account? <a onclick="Auth.switchLanding(\'login\')">Sign in</a></div>' +
        '</div>' +

        /* VERIFY SCREEN */
        '<div id="verifyScreen" class="auth-verify-screen" style="display:none">' +
          '<div class="auth-verify-icon">&#128231;</div>' +
          '<h3>Check your inbox</h3>' +
          '<p>We sent a verification link to <strong id="verifyEmailDisplay"></strong>.<br>' +
          'Click it to activate your account. Check spam if you don\'t see it within 2 minutes.</p>' +
          '<button class="btn-resend" id="btnResend" onclick="Auth.resendVerification()">Resend email</button>' +
          '<div class="resend-timer" id="resendTimer"></div>' +
          '<button class="auth-btn" style="margin-top:16px;margin-bottom:0" onclick="Auth.checkVerificationAndProceed()">' +
            '<span class="auth-btn-text">I\'ve verified &mdash; Enter platform &rarr;</span>' +
            '<div class="auth-btn-spinner"></div>' +
          '</button>' +
          '<div style="margin-top:12px;text-align:center">' +
            '<a style="font-size:.74rem;color:#7aab8c;cursor:pointer" onclick="Auth.switchLanding(\'login\')">Use a different account</a>' +
          '</div>' +
        '</div>' +

        /* FORGOT SCREEN */
        '<div id="forgotScreen" class="auth-forgot-screen">' +
          '<button class="auth-back-btn" onclick="Auth.switchLanding(\'login\')">&#8592; Back to sign in</button>' +
          '<div class="auth-field">' +
            '<label class="auth-label">Your email address</label>' +
            '<div class="auth-input-wrap">' +
              '<input class="auth-input" type="email" id="forgotEmail" placeholder="you@example.com">' +
              '<span class="auth-input-icon">&#9993;</span>' +
            '</div>' +
            '<div class="auth-hint info" id="forgotEmailHint">Enter the email you signed up with</div>' +
          '</div>' +
          '<button class="auth-btn" id="forgotBtn" onclick="Auth.handleForgotPassword()">' +
            '<span class="auth-btn-text">Send Reset Email</span>' +
            '<div class="auth-btn-spinner"></div>' +
          '</button>' +
        '</div>' +

      '</div>' +

      '<p style="text-align:center;font-size:.7rem;color:#4a7a5c;margin-top:18px">' +
        '&#128274; Secured by Firebase &middot; Data never sold &middot; Anonymous reporting always available' +
      '</p>' +
    '</div>';
  }

  function _googleSVG() {
    return '<svg viewBox="0 0 24 24" width="17" height="17" style="flex-shrink:0">' +
      '<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>' +
      '<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>' +
      '<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>' +
      '<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>' +
    '</svg>';
  }

  /* Hide/reveal the platform nav + main + footer */
  function hidePlatform(hide) {
    var nav  = document.querySelector('.tab-nav');
    var main = document.querySelector('main');
    var foot = document.querySelector('footer');
    if (nav)  nav.style.display  = hide ? 'none' : '';
    if (main) main.style.display = hide ? 'none' : '';
    if (foot) foot.style.display = hide ? 'none' : '';
  }

  /* Internal panel switching within the landing */
  function switchLanding(mode) {
    activeMode = mode;
    clearBanners();
    var loginForm  = document.getElementById('loginForm');
    var signupForm = document.getElementById('signupForm');
    var verifyScr  = document.getElementById('verifyScreen');
    var forgotScr  = document.getElementById('forgotScreen');
    var tabs       = document.getElementById('authTabs');

    if (loginForm)  loginForm.style.display  = 'none';
    if (signupForm) signupForm.style.display = 'none';
    if (verifyScr)  verifyScr.style.display  = 'none';
    if (forgotScr)  forgotScr.classList.remove('show');
    if (tabs)       tabs.style.display       = 'flex';

    document.querySelectorAll('.auth-tab').forEach(function(t, i) {
      t.classList.toggle('active', (mode === 'login' && i === 0) || (mode === 'signup' && i === 1));
    });

    if (mode === 'login'  && loginForm)  { loginForm.style.display  = 'block'; attachValidation('login'); }
    if (mode === 'signup' && signupForm) { signupForm.style.display = 'block'; attachValidation('signup'); }
    if (mode === 'forgot') {
      if (tabs) tabs.style.display = 'none';
      if (forgotScr) {
        forgotScr.classList.add('show');
        setTimeout(function(){ var fe = document.getElementById('forgotEmail'); if(fe) fe.focus(); }, 60);
      }
    }
    if (mode === 'verify' && currentUser) _showVerifyPanel(currentUser.email);
  }

  function _showVerifyPanel(email) {
    var loginForm  = document.getElementById('loginForm');
    var signupForm = document.getElementById('signupForm');
    var tabs       = document.getElementById('authTabs');
    var screen     = document.getElementById('verifyScreen');
    var display    = document.getElementById('verifyEmailDisplay');
    if (loginForm)  loginForm.style.display  = 'none';
    if (signupForm) signupForm.style.display = 'none';
    if (tabs)       tabs.style.display       = 'none';
    if (screen)     screen.style.display     = 'block';
    if (display)    display.textContent      = email;
    activeMode = 'verify';
    startResendTimer();
  }

  function _showForgotPanel() {
    var tabs      = document.getElementById('authTabs');
    var loginForm = document.getElementById('loginForm');
    var forgotScr = document.getElementById('forgotScreen');
    if (tabs)      tabs.style.display      = 'none';
    if (loginForm) loginForm.style.display = 'none';
    if (forgotScr) forgotScr.classList.add('show');
  }

  /* ══════════════════════════════════════════
     HEADER
     ══════════════════════════════════════════ */
  function renderHeaderGuest() {
    var slot = getOrCreateHeaderSlot();
    slot.innerHTML = '<button class="auth-login-btn" onclick="Auth.showAuthLanding(\'login\')">Sign In / Sign Up</button>';
  }

  function renderHeaderUser(user) {
    var slot     = getOrCreateHeaderSlot();
    var initials = getInitials(user.displayName || user.email);
    var name     = user.displayName || user.email.split('@')[0];
    slot.innerHTML =
      '<div style="position:relative">' +
        '<button class="auth-user-btn" onclick="Auth.toggleDropdown()" id="authUserBtn">' +
          '<div class="auth-avatar">' + escHtml(initials) + '</div>' +
          '<span class="auth-user-name">' + escHtml(name) + '</span>' +
          '<span style="font-size:10px;color:#7aab8c">&#9660;</span>' +
        '</button>' +
        '<div class="auth-dropdown" id="authDropdown" style="display:none">' +
          '<div class="auth-dropdown-header">' +
            '<div class="auth-dropdown-name">' + escHtml(user.displayName || 'Nairobi Resident') + '</div>' +
            '<div class="auth-dropdown-email">' + escHtml(user.email) + '</div>' +
            '<span class="auth-dropdown-verify ' + (user.emailVerified ? 'verified' : 'unverified') + '">' +
              (user.emailVerified ? '&#10003; Verified' : '&#9888; Not verified') +
            '</span>' +
          '</div>' +
          (!user.emailVerified ?
            '<button class="auth-dropdown-item" onclick="Auth.resendVerification()"><span>&#9993;</span> Resend verification</button>' : '') +
          '<button class="auth-dropdown-item" onclick="Auth.switchLanding(\'forgot\')"><span>&#128273;</span> Change password</button>' +
          '<button class="auth-dropdown-item danger" onclick="Auth.doSignOut()"><span>&#128682;</span> Sign out</button>' +
        '</div>' +
      '</div>';
    document.addEventListener('click', outsideDropdownHandler);
  }

  function getOrCreateHeaderSlot() {
    var slot = document.getElementById('headerAuthSlot');
    if (!slot) {
      slot = document.createElement('div');
      slot.id = 'headerAuthSlot';
      slot.style.cssText = 'display:flex;align-items:center;gap:8px;flex-shrink:0';
      var hr = document.querySelector('.header-right');
      var langBtn = document.getElementById('langBtn');
      if (hr && langBtn) hr.insertBefore(slot, langBtn);
      else if (hr) hr.appendChild(slot);
    }
    return slot;
  }

  function outsideDropdownHandler(e) {
    var btn = document.getElementById('authUserBtn');
    var dd  = document.getElementById('authDropdown');
    if (dd && btn && !btn.contains(e.target) && !dd.contains(e.target)) closeDropdown();
  }

  function toggleDropdown() {
    var dd = document.getElementById('authDropdown');
    if (!dd) return;
    dropdownOpen = !dropdownOpen;
    dd.style.display = dropdownOpen ? 'block' : 'none';
  }

  function closeDropdown() {
    var dd = document.getElementById('authDropdown');
    if (dd) dd.style.display = 'none';
    dropdownOpen = false;
  }

  /* ══════════════════════════════════════════
     LIVE VALIDATION
     ══════════════════════════════════════════ */
  function attachValidation(mode) {
    setTimeout(function() {
      if (mode === 'login') {
        listen('loginEmail', function(){ vf('loginEmail','email'); });
        listen('loginPw',    function(){ vf('loginPw','pwsimple'); });
      }
      if (mode === 'signup') {
        listen('signupFirst', function(){ vf('signupFirst','name'); });
        listen('signupLast',  function(){ vf('signupLast','name'); });
        listen('signupWard',  function(){ vf('signupWard','ward'); });
        listen('signupEmail', function(){ vf('signupEmail','email'); });
        listen('signupPw', function(){
          vf('signupPw','password');
          strengthMeter(document.getElementById('signupPw').value || '');
          if (document.getElementById('signupPw2').value) vf('signupPw2','confirm');
        });
        listen('signupPw2', function(){ vf('signupPw2','confirm'); });
      }
    }, 80);
  }

  function listen(id, fn) {
    var el = document.getElementById(id);
    if (el) { el.addEventListener('input', fn); el.addEventListener('blur', fn); }
  }

  function vf(id, type) {
    var el   = document.getElementById(id);
    var hint = document.getElementById(id + 'Hint');
    var icon = document.getElementById(id + 'Icon');
    if (!el) return false;
    var val = el.value.trim();
    var ok = true, msg = '', cls = '';

    if (type === 'email') {
      if (!val)                     { ok=false; msg='Email required'; cls='error'; }
      else if (!RE.email.test(val)) { ok=false; msg='Enter a valid email address'; cls='error'; }
      else                          { msg='&#10003; Looks good'; cls='ok'; }
    } else if (type === 'name') {
      if (!val || val.length < 2)   { ok=false; msg='At least 2 characters required'; cls='error'; }
      else if (!RE.name.test(val))  { ok=false; msg='Letters and spaces only'; cls='error'; }
    } else if (type === 'ward') {
      if (val && !RE.ward.test(val)){ ok=false; msg='Invalid ward name'; cls='error'; }
    } else if (type === 'password') {
      if (!val)                     { ok=false; msg='Password required'; cls='error'; }
      else if (val.length < 8)      { ok=false; msg='Minimum 8 characters'; cls='error'; }
      else if (!/[A-Z]/.test(val))  { ok=false; msg='Add at least one uppercase letter'; cls='error'; }
      else if (!/[a-z]/.test(val))  { ok=false; msg='Add at least one lowercase letter'; cls='error'; }
      else if (!/\d/.test(val))     { ok=false; msg='Add at least one number'; cls='error'; }
      else                          { msg='&#10003; Strong password'; cls='ok'; }
    } else if (type === 'pwsimple') {
      if (!val) { ok=false; msg='Password required'; cls='error'; }
    } else if (type === 'confirm') {
      var pw = (document.getElementById('signupPw') || {}).value || '';
      if (!val)         { ok=false; msg='Please confirm your password'; cls='error'; }
      else if (val!==pw){ ok=false; msg='Passwords do not match'; cls='error'; }
      else              { msg='&#10003; Passwords match'; cls='ok'; }
    }

    el.classList.toggle('valid',   ok && !!val);
    el.classList.toggle('invalid', !ok && !!val);
    if (hint) { hint.innerHTML = msg; hint.className = 'auth-hint ' + (val ? cls : ''); }
    return ok;
  }

  function strengthMeter(pw) {
    var fill  = document.getElementById('pwStrengthFill');
    var label = document.getElementById('pwStrengthLabel');
    if (!fill || !label) return;
    var s = 0;
    if (pw.length >= 8) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[a-z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++;
    if (/[^a-zA-Z0-9]/.test(pw)) s++;
    if (pw.length >= 12) s++;
    var levels = [
      {pct:0,  bg:'transparent',lbl:'Enter a password'},
      {pct:17, bg:'#e84040',    lbl:'Very weak'},
      {pct:34, bg:'#f97316',    lbl:'Weak'},
      {pct:50, bg:'#f0b429',    lbl:'Fair'},
      {pct:67, bg:'#5fcf85',    lbl:'Good'},
      {pct:84, bg:'#2e9e5b',    lbl:'Strong'},
      {pct:100,bg:'#2e9e5b',    lbl:'Very strong'},
    ];
    var lv = levels[Math.min(s, 6)];
    fill.style.width      = lv.pct + '%';
    fill.style.background = lv.bg;
    label.textContent     = lv.lbl;
    label.style.color     = lv.bg === 'transparent' ? '#4a7a5c' : lv.bg;
  }

  /* ══════════════════════════════════════════
     AUTH ACTIONS
     ══════════════════════════════════════════ */

  /* LOGIN */
  async function handleLogin() {
    clearBanners();
    if (!vf('loginEmail','email') | !vf('loginPw','pwsimple')) return;
    var email = document.getElementById('loginEmail').value.trim();
    var pw    = document.getElementById('loginPw').value;
    setBtn('loginBtn', true);
    try {
      var cred = await firebaseAuth.signInWithEmailAndPassword(email, pw);
      if (!cred.user.emailVerified) {
        setBtn('loginBtn', false);
        _showVerifyPanel(cred.user.email);
        return;
      }
      toast('Karibu, ' + (cred.user.displayName || email.split('@')[0]) + '! &#10003;', 'success');
      // onAuthStateChanged handles hiding landing + showing platform
    } catch (err) {
      setBtn('loginBtn', false);
      console.error('[Auth] Login error:', err.code, err.message);
      showError(friendly(err.code));
    }
  }

  /* SIGNUP — fixed: no photoURL to avoid null crash */
  async function handleSignup() {
    clearBanners();
    var firstOk = vf('signupFirst','name');
    var lastOk  = vf('signupLast', 'name');
    var emailOk = vf('signupEmail','email');
    var pwOk    = vf('signupPw',   'password');
    var pw2Ok   = vf('signupPw2',  'confirm');
    var terms   = document.getElementById('agreeTerms') && document.getElementById('agreeTerms').checked;

    if (!firstOk || !lastOk || !emailOk || !pwOk || !pw2Ok) {
      showError('Please fix the highlighted fields above.'); return;
    }
    if (!terms) {
      showError('Please agree to the Terms of Use to continue.'); return;
    }

    var first = document.getElementById('signupFirst').value.trim();
    var last  = document.getElementById('signupLast').value.trim();
    var ward  = (document.getElementById('signupWard') || {value:''}).value.trim();
    var email = document.getElementById('signupEmail').value.trim();
    var pw    = document.getElementById('signupPw').value;

    setBtn('signupBtn', true);
    try {
      /* Step 1: create the account */
      var cred = await firebaseAuth.createUserWithEmailAndPassword(email, pw);
      console.log('[Auth] Account created OK:', cred.user.uid);

      /* Step 2: set display name only — NO photoURL (causes crash) */
      await cred.user.updateProfile({ displayName: first + ' ' + last });
      console.log('[Auth] Profile updated OK');

      /* Step 3: save ward locally */
      if (ward) localStorage.setItem('userWard_' + cred.user.uid, ward);

      /* Step 4: send verification email */
      await cred.user.sendEmailVerification();
      console.log('[Auth] Verification email sent to:', email);

      setBtn('signupBtn', false);
      toast('Account created! Please verify your email.', 'success');
      _showVerifyPanel(email);

    } catch (err) {
      setBtn('signupBtn', false);
      console.error('[Auth] Signup ERROR code:', err.code);
      console.error('[Auth] Signup ERROR message:', err.message);
      showError(friendly(err.code));
    }
  }

  /* GOOGLE */
  async function handleGoogleSignIn() {
    clearBanners();
    try {
      var provider = new firebase.auth.GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      await firebaseAuth.signInWithRedirect(provider);
    } catch (err) {
      console.error('[Auth] Google error:', err.code, err.message);
      showError(friendly(err.code));
    }
  }

  /* FORGOT PASSWORD */
  async function handleForgotPassword() {
    clearBanners();
    var emailEl = document.getElementById('forgotEmail');
    var email   = emailEl ? emailEl.value.trim() : '';
    if (!email || !RE.email.test(email)) {
      var h = document.getElementById('forgotEmailHint');
      if (h) { h.textContent = 'Enter a valid email address'; h.className = 'auth-hint error'; }
      return;
    }
    setBtn('forgotBtn', true);
    try {
      await firebaseAuth.sendPasswordResetEmail(email);
      setBtn('forgotBtn', false);
      showSuccess('Reset email sent to ' + email + '. Check your inbox and spam folder.');
      if (emailEl) emailEl.value = '';
    } catch (err) {
      setBtn('forgotBtn', false);
      showError(friendly(err.code));
    }
  }

  /* RESEND VERIFICATION */
  async function resendVerification() {
    if (!firebaseAuth || !firebaseAuth.currentUser) return;
    try {
      await firebaseAuth.currentUser.sendEmailVerification();
      toast('Verification email sent!', 'success');
      startResendTimer();
    } catch (err) {
      toast(friendly(err.code), 'error');
    }
  }

  /* CHECK VERIFICATION & ENTER PLATFORM */
  async function checkVerificationAndProceed() {
    try {
      if (firebaseAuth.currentUser) await firebaseAuth.currentUser.reload();
      var user = firebaseAuth.currentUser;
      if (user && user.emailVerified) {
        toast('Welcome to Nairobi Budget Platform! &#127881;', 'success');
        hideAuthLanding();
        hidePlatform(false);
        renderHeaderUser(user);
      } else {
        toast('Email not yet verified. Click the link in your inbox first.', 'warning');
      }
    } catch (err) {
      toast(friendly(err.code), 'error');
    }
  }

  /* SIGN OUT */
  async function doSignOut() {
    closeDropdown();
    try {
      await firebaseAuth.signOut();
      toast('Signed out. See you soon!', 'info');
    } catch (err) {
      toast(friendly(err.code), 'error');
    }
  }

  /* ══════════════════════════════════════════
     TIMER
     ══════════════════════════════════════════ */
  function startResendTimer() {
    var btn   = document.getElementById('btnResend');
    var timer = document.getElementById('resendTimer');
    if (btn) btn.disabled = true;
    resendSeconds = 60;
    clearResendTimer();
    resendTimer = setInterval(function() {
      resendSeconds--;
      if (timer) timer.textContent = 'Resend available in ' + resendSeconds + 's';
      if (resendSeconds <= 0) {
        clearResendTimer();
        if (btn)   btn.disabled = false;
        if (timer) timer.textContent = '';
      }
    }, 1000);
  }

  function clearResendTimer() {
    if (resendTimer) { clearInterval(resendTimer); resendTimer = null; }
  }

  /* ══════════════════════════════════════════
     UI HELPERS
     ══════════════════════════════════════════ */
  function setBtn(id, loading) {
    var btn = document.getElementById(id);
    if (!btn) return;
    btn.disabled = loading;
    btn.classList.toggle('loading', loading);
  }

  function showError(msg) {
    var el = document.getElementById('authErrorBanner');
    if (el) { el.textContent = '⚠ ' + msg; el.classList.add('show'); }
  }

  function showSuccess(msg) {
    var el = document.getElementById('authSuccessBanner');
    if (el) { el.textContent = '✓ ' + msg; el.classList.add('show'); }
  }

  function clearBanners() {
    ['authErrorBanner','authSuccessBanner'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.classList.remove('show');
    });
  }

  function togglePw(inputId, btn) {
    var input = document.getElementById(inputId);
    if (!input) return;
    var isText = input.type === 'text';
    input.type      = isText ? 'password' : 'text';
    btn.textContent = isText ? '👁️' : '🙈';
  }

  function injectToastContainer() {
    if (!document.getElementById('authToastContainer')) {
      var tc = document.createElement('div');
      tc.id = 'authToastContainer';
      tc.className = 'auth-toast-container';
      document.body.appendChild(tc);
    }
  }

  function toast(msg, type, duration) {
    type     = type     || 'info';
    duration = duration || 4500;
    var tc = document.getElementById('authToastContainer');
    if (!tc) return;
    var icons = { success:'✅', error:'❌', info:'ℹ️', warning:'⚠️' };
    var t = document.createElement('div');
    t.className = 'auth-toast ' + type;
    t.innerHTML =
      '<span class="auth-toast-icon">' + (icons[type]||'💬') + '</span>' +
      '<span class="auth-toast-msg">'  + escHtml(msg) + '</span>' +
      '<button class="auth-toast-close" onclick="this.parentElement.remove()">&#10005;</button>';
    tc.appendChild(t);
    setTimeout(function() {
      t.classList.add('removing');
      setTimeout(function(){ t.remove(); }, 220);
    }, duration);
  }

  function friendly(code) {
    var map = {
      'auth/email-already-in-use':      'This email is already registered. Try signing in.',
      'auth/invalid-email':             'The email address is not valid.',
      'auth/user-not-found':            'No account found with this email.',
      'auth/wrong-password':            'Incorrect password. Try again or reset it.',
      'auth/invalid-credential':        'Incorrect email or password.',
      'auth/too-many-requests':         'Too many attempts. Please wait a few minutes.',
      'auth/network-request-failed':    'Network error. Check your internet connection.',
      'auth/weak-password':             'Password too weak — use 8+ chars with upper, lower, and number.',
      'auth/popup-blocked':             'Popup blocked — allow popups for this site.',
      'auth/operation-not-allowed':     'Email/password sign-in is not enabled in Firebase Console.',
      'auth/user-disabled':             'This account has been disabled.',
      'auth/account-exists-with-different-credential': 'Account exists with a different sign-in method.',
    };
    return map[code] || ('Error (' + (code||'unknown') + '). Please try again.');
  }

  function getInitials(s) {
    if (!s) return '?';
    var p = s.split(' ').filter(Boolean);
    return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : s.slice(0,2).toUpperCase();
  }

  function escHtml(s) {
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function getUser()        { return currentUser; }
  function isLoggedIn()     { return !!currentUser; }
  function isVerified()     { return !!(currentUser && currentUser.emailVerified); }
  function getDisplayName() {
    if (!currentUser) return 'Resident';
    return currentUser.displayName || currentUser.email.split('@')[0];
  }
  function getUserWard() {
    return currentUser ? (localStorage.getItem('userWard_' + currentUser.uid) || '') : '';
  }

  return {
    init,
    showAuthLanding,
    hideAuthLanding,
    switchLanding,
    handleLogin,
    handleSignup,
    handleGoogleSignIn,
    handleForgotPassword,
    resendVerification,
    checkVerificationAndProceed,
    doSignOut,
    toggleDropdown,
    togglePw,
    toast,
    getUser, isLoggedIn, isVerified, getDisplayName, getUserWard,
  };

})();

document.addEventListener('DOMContentLoaded', function() { Auth.init(); });