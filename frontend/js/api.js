// Base URL for API requests
const API_BASE = '/api';

const API = {
  // Token Storage Helpers
  getToken: () => localStorage.getItem('token'),
  setToken: (token) => localStorage.setItem('token', token),
  clearToken: () => localStorage.removeItem('token'),
  
  // User Profile Storage Helpers
  setUser: (user) => localStorage.setItem('user', JSON.stringify(user)),
  getUser: () => {
    try {
      return JSON.parse(localStorage.getItem('user'));
    } catch {
      return null;
    }
  },
  clearUser: () => localStorage.removeItem('user'),

  /**
   * Generic request wrapper for fetch
   * @param {string} path - Endpoint path (e.g. '/auth/login')
   * @param {object} options - Request options (method, headers, body)
   */
  async request(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers
    };

    // Auto-serialize request body if it is an object
    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(`${API_BASE}${path}`, config);
      
      // Auto-handle 401 Unauthorized / Token Expiry
      if (response.status === 401 && path !== '/auth/login') {
        this.clearToken();
        this.clearUser();
        if (!window.location.pathname.includes('login.html') && 
            !window.location.pathname.includes('signup.html') && 
            !window.location.pathname.includes('index.html') &&
            window.location.pathname !== '/') {
          window.location.href = '/login.html?expired=true';
        }
      }

      const data = await response.json().catch(() => ({}));
      
      if (!response.ok) {
        throw new Error(data.error || 'An unexpected error occurred.');
      }

      return data;
    } catch (err) {
      console.error(`API Request Error [${path}]:`, err.message);
      throw err;
    }
  }
};

/**
 * Global Toast Notification Helper
 * Displays interactive glassmorphism status cards
 * @param {string} message - Message text
 * @param {string} type - 'success' | 'error' | 'warning' | 'info'
 */
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  toast.innerHTML = `
    <span class="toast-message">${message}</span>
    <button class="toast-close">&times;</button>
  `;

  // Close toast event listener
  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px) scale(0.9)';
    setTimeout(() => toast.remove(), 300);
  });

  container.appendChild(toast);

  // Auto-remove toast after 4.5 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px) scale(0.9)';
      setTimeout(() => toast.remove(), 300);
    }
  }, 4500);
}

// Make functions globally accessible
window.API = API;
window.showToast = showToast;
