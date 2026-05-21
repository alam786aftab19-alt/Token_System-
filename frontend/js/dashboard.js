document.addEventListener('DOMContentLoaded', () => {
  const user = API.getUser();
  const token = API.getToken();

  if (!user || !token) {
    window.location.href = '/login.html';
    return;
  }

  // 1. Initialize UI with User Info
  const welcomeName = document.getElementById('welcome-name');
  if (welcomeName) welcomeName.textContent = user.full_name;

  const userEmail = document.getElementById('user-email');
  if (userEmail) userEmail.textContent = user.email;

  // Show Admin Panel if user is admin
  const adminPanel = document.getElementById('admin-panel');
  if (adminPanel) {
    if (user.is_admin) {
      adminPanel.classList.remove('hidden');
    } else {
      adminPanel.classList.add('hidden');
    }
  }

  // 2. Connect to Socket.io for Real-time Queue Sync
  // io() automatically points to the host serving the page.
  const socket = io();

  socket.on('connect', () => {
    console.log('Real-time queue socket connected!');
  });

  // Listen for updates from the server
  socket.on('queue-updated', () => {
    console.log('Queue update broadcast received. Refreshing UI...');
    fetchDashboardData();
  });

  // 3. UI Element References
  const activeTokenVal = document.getElementById('active-token-value');
  const nextTokenVal = document.getElementById('next-token-value');
  const pendingCountVal = document.getElementById('pending-count-value');
  const queueList = document.getElementById('queue-list');
  const searchInput = document.getElementById('search-token-input');
  
  // User status card elements
  const userTokenSection = document.getElementById('user-token-section');
  const generateTokenBtn = document.getElementById('generate-token-btn');

  // Admin buttons
  const nextTokenBtn = document.getElementById('next-token-btn');

  // Local copy of the queue list for client-side search filtering
  let localQueueList = [];

  // 4. Fetch and render dashboard state
  const fetchDashboardData = async () => {
    try {
      const data = await API.request('/tokens/queue', { method: 'GET' });
      
      localQueueList = data.queueList || [];

      // Render Stat Counters
      if (activeTokenVal) {
        activeTokenVal.textContent = data.activeToken ? `#${data.activeToken.token_number}` : '--';
      }
      if (nextTokenVal) {
        nextTokenVal.textContent = data.nextToken ? `#${data.nextToken.token_number}` : '--';
      }
      if (pendingCountVal) {
        pendingCountVal.textContent = data.pendingCount;
      }

      // Render User status orb
      renderUserTokenStatus(data.userToken);

      // Render general queue list
      renderQueueList(localQueueList);

    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  /**
   * Render the authenticated user's current token status card
   */
  const renderUserTokenStatus = (userToken) => {
    if (!userToken) {
      userTokenSection.innerHTML = `
        <div class="user-status-header">
          <h3 class="user-status-title">Your Token Status</h3>
          <p class="user-status-desc">You do not have a token in the queue yet.</p>
        </div>
        <div class="token-badge-container">
          <div class="live-token-orb no-token">
            <span class="live-token-number" style="font-size: 1.8rem; color: var(--text-muted);">None</span>
          </div>
        </div>
        <div class="text-center">
          <span class="token-status-badge completed">Ready to generate</span>
        </div>
      `;
      generateTokenBtn.disabled = false;
      generateTokenBtn.innerHTML = '⚡ Generate Token';
    } else {
      let badgeClass = 'pending';
      let statusDesc = 'Your token is currently waiting in the queue.';

      if (userToken.status === 'active') {
        badgeClass = 'active';
        statusDesc = 'Your token is currently ACTIVE. Please proceed!';
      }

      userTokenSection.innerHTML = `
        <div class="user-status-header">
          <h3 class="user-status-title">Your Token Status</h3>
          <p class="user-status-desc">${statusDesc}</p>
        </div>
        <div class="token-badge-container">
          <div class="live-token-orb">
            <span class="live-token-label">Token</span>
            <span class="live-token-number">#${userToken.token_number}</span>
          </div>
        </div>
        <div class="text-center">
          <span class="token-status-badge ${badgeClass}">${userToken.status}</span>
        </div>
      `;
      generateTokenBtn.disabled = true;
      generateTokenBtn.innerHTML = '✓ Token Generated';
    }
  };

  /**
   * Render the general queue list on the dashboard
   */
  const renderQueueList = (tokens) => {
    if (!queueList) return;

    if (tokens.length === 0) {
      queueList.innerHTML = `
        <div class="queue-empty-state">
          <p>No tokens are in the queue currently.</p>
        </div>
      `;
      return;
    }

    queueList.innerHTML = tokens
      .map((t) => {
        const isMyToken = t.user_id === user.id;
        const activeClass = t.status === 'active' ? 'active' : '';
        const myTokenClass = isMyToken ? 'my-token' : '';

        return `
          <div class="queue-item ${activeClass} ${myTokenClass}">
            <div class="queue-item-info">
              <div class="queue-item-number">${t.token_number}</div>
              <div>
                <div class="queue-item-name">${t.users?.full_name || 'Anonymous'} ${isMyToken ? '(You)' : ''}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">
                  Generated: ${new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
            <span class="queue-item-status ${t.status}">${t.status}</span>
          </div>
        `;
      })
      .join('');
  };

  // 5. Generate Token Trigger
  if (generateTokenBtn) {
    generateTokenBtn.addEventListener('click', async () => {
      const originalText = generateTokenBtn.innerHTML;
      generateTokenBtn.disabled = true;
      generateTokenBtn.innerHTML = '<span class="spinner"></span> Processing...';

      try {
        const response = await API.request('/tokens/generate', {
          method: 'POST'
        });

        showToast(`Success! Token #${response.token.token_number} generated.`, 'success');
        fetchDashboardData();

      } catch (err) {
        showToast(err.message, 'error');
        generateTokenBtn.disabled = false;
        generateTokenBtn.innerHTML = originalText;
      }
    });
  }

  // 6. Admin Control - Move to Next Token Trigger
  if (nextTokenBtn) {
    nextTokenBtn.addEventListener('click', async () => {
      const originalText = nextTokenBtn.innerHTML;
      nextTokenBtn.disabled = true;
      nextTokenBtn.innerHTML = '<span class="spinner"></span> Advancing...';

      try {
        const response = await API.request('/tokens/next', {
          method: 'POST'
        });

        showToast(response.message, 'success');
        fetchDashboardData();

      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        nextTokenBtn.disabled = false;
        nextTokenBtn.innerHTML = originalText;
      }
    });
  }

  // 7. Client-side Real-time Search Filter
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim().toLowerCase();

      if (!query) {
        renderQueueList(localQueueList);
        return;
      }

      const filtered = localQueueList.filter((t) => {
        const numberMatch = t.token_number.toString().includes(query);
        const nameMatch = t.users?.full_name?.toLowerCase().includes(query);
        return numberMatch || nameMatch;
      });

      renderQueueList(filtered);
    });
  }

  // 8. Run Initial Page Load Fetch
  fetchDashboardData();
});
