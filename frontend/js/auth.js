document.addEventListener('DOMContentLoaded', () => {
  // 1. Page Route Guard Check
  const path = window.location.pathname;
  const token = API.getToken();
  const user = API.getUser();

  if (path.includes('dashboard.html')) {
    if (!token || !user) {
      window.location.href = '/login.html';
      return;
    }
  } else if (path.includes('login.html') || path.includes('signup.html')) {
    if (token && user) {
      window.location.href = '/dashboard.html';
      return;
    }
  }

  // 2. Handle Signup Form Submission
  const signupForm = document.getElementById('signup-form');
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const full_name = document.getElementById('signup-name').value.trim();
      const email = document.getElementById('signup-email').value.trim();
      const mobile_number = document.getElementById('signup-mobile').value.trim();
      const password = document.getElementById('signup-password').value;
      const submitBtn = signupForm.querySelector('button[type="submit"]');

      if (!full_name || !email || !mobile_number || !password) {
        showToast('Please fill out all fields.', 'error');
        return;
      }

      // Validate mobile number: 10 to 15 digits (allowing optional leading +)
      const mobileRegex = /^\+?[0-9]{10,15}$/;
      if (!mobileRegex.test(mobile_number)) {
        showToast('Please enter a valid mobile number (10 to 15 digits).', 'error');
        return;
      }

      if (password.length < 6) {
        showToast('Password must be at least 6 characters.', 'error');
        return;
      }

      // Show loader
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Creating Account...';

      try {
        const response = await API.request('/auth/signup', {
          method: 'POST',
          body: { full_name, email, mobile_number, password }
        });

        showToast(response.message || 'Account created! Verification email sent.', 'success');
        signupForm.reset();
        
        // Wait and redirect to verify page for OTP entry
        setTimeout(() => {
          window.location.href = '/verify.html';
        }, 3000);

      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }

  // 3. Handle Login Form Submission
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    // Check url params for expired or registration messages
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('expired')) {
      showToast('Your session has expired. Please log in again.', 'warning');
    } else if (urlParams.get('registered')) {
      showToast('Registration successful! Please check your email and verify your account.', 'info');
    } else if (urlParams.get('verified')) {
      showToast('Email verified successfully! You can now log in.', 'success');
    }

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const submitBtn = loginForm.querySelector('button[type="submit"]');

      if (!email || !password) {
        showToast('Please enter both email and password.', 'error');
        return;
      }

      // Show loader
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Signing In...';

      try {
        const response = await API.request('/auth/login', {
          method: 'POST',
          body: { email, password }
        });

        API.setToken(response.token);
        API.setUser(response.user);

        showToast('Login successful! Redirecting...', 'success');
        
        setTimeout(() => {
          window.location.href = '/dashboard.html';
        }, 1200);

      } catch (err) {
        // If unverified email, redirect them to the verify OTP page
        if (err.message.includes('verify') || err.message.includes('verified')) {
          showToast(err.message, 'error');
          setTimeout(() => {
            window.location.href = '/verify.html';
          }, 2000);
        } else {
          showToast(err.message, 'error');
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }

  // 4. Handle Logout Button Trigger
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      
      try {
        // Notify backend of logout
        await API.request('/auth/logout', { method: 'POST' });
      } catch (err) {
        console.warn('Backend logout failed or ignored:', err.message);
      } finally {
        // Clean local state and redirect anyway
        API.clearToken();
        API.clearUser();
        window.location.href = '/login.html';
      }
    });
  }

  // 5. Handle Verification Page Trigger
  if (path.includes('verify.html')) {
    const statusContainer = document.getElementById('verify-status-box');
    const urlParams = new URLSearchParams(window.location.search);
    const verifyToken = urlParams.get('token');

    if (!verifyToken) {
      statusContainer.innerHTML = `
        <div class="brand-header" style="margin-bottom: 2rem;">
          <div class="brand-logo">ENTER OTP</div>
          <div class="brand-tagline">We sent a 6-digit verification code to your email</div>
        </div>
        <form id="manual-otp-form" style="max-width: 320px; margin: 0 auto;">
          <div class="form-group">
            <div class="input-wrapper">
              <input 
                type="text" 
                id="manual-otp-input" 
                class="form-input" 
                placeholder="e.g. 123456" 
                required
                maxlength="6"
                pattern="[0-9]{6}"
                style="font-size: 1.8rem; letter-spacing: 0.4rem; text-align: center; padding: 0.8rem;"
              >
            </div>
          </div>
          <button type="submit" class="btn btn-primary mt-4">
            ⚡ Verify Code
          </button>
        </form>
        <div class="form-footer" style="margin-top: 1.5rem;">
          <a href="/login.html" class="form-link">Back to Login</a>
        </div>
      `;

      const otpForm = document.getElementById('manual-otp-form');
      otpForm.addEventListener('submit', (evt) => {
        evt.preventDefault();
        const code = document.getElementById('manual-otp-input').value.trim();
        if (/^[0-9]{6}$/.test(code)) {
          window.location.search = `?token=${code}`;
        } else {
          showToast('Please enter a valid 6-digit OTP code.', 'error');
        }
      });
      return;
    }

    // Call API to verify email
    const performEmailVerification = async () => {
      statusContainer.innerHTML = `
        <span class="spinner" style="width: 3rem; height: 3rem; margin-bottom: 1.5rem;"></span>
        <h2>Verifying Email...</h2>
        <p style="color: var(--text-secondary);">Validating token with database. Please hold on.</p>
      `;

      try {
        const response = await API.request(`/auth/verify-email?token=${verifyToken}`, {
          method: 'GET'
        });

        statusContainer.innerHTML = `
          <div class="brand-logo" style="font-size: 4rem; background: linear-gradient(135deg, #10b981 0%, #059669 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">✓</div>
          <h2 class="mb-4">Email Verified!</h2>
          <p class="mb-4" style="color: #a7f3d0;">${response.message || 'Your email has been verified successfully.'}</p>
          <a href="/login.html?verified=true" class="btn btn-primary" style="text-decoration:none;">Go to Login</a>
        `;
        showToast('Email verified successfully!', 'success');

      } catch (err) {
        statusContainer.innerHTML = `
          <div class="brand-logo" style="font-size: 4rem; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">✕</div>
          <h2 class="mb-4">Verification Failed</h2>
          <p class="mb-4" style="color: #fca5a5;">${err.message || 'The token is invalid or has expired.'}</p>
          <a href="/signup.html" class="btn btn-primary" style="text-decoration:none; margin-bottom: 0.5rem;">Create New Account</a>
          <a href="/login.html" class="btn btn-secondary" style="text-decoration:none;">Back to Login</a>
        `;
        showToast(err.message, 'error');
      }
    };

    performEmailVerification();
  }
});
