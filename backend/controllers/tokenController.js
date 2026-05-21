const supabase = require('../config/supabaseClient');

/**
 * Utility to get ISO string range for the current day (local time)
 */
const getTodayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  return {
    start: start.toISOString(),
    end: end.toISOString()
  };
};

/**
 * Helper to log token status transition in token_history table
 */
const logTokenHistory = async (token) => {
  try {
    await supabase.from('token_system_token_history').insert([
      {
        token_id: token.id,
        token_number: token.token_number,
        user_id: token.user_id,
        status: token.status,
        changed_at: new Date().toISOString()
      }
    ]);
  } catch (err) {
    console.error('Failed to log token history:', err.message);
  }
};

/**
 * Helper to emit real-time updates via Socket.io
 */
const broadcastQueueUpdate = (req) => {
  const io = req.app.get('io');
  if (io) {
    io.emit('queue-updated');
  }
};

/**
 * Generate a new token for the authenticated user
 */
const generateToken = async (req, res) => {
  try {
    const userId = req.user.id;
    const { start, end } = getTodayRange();

    // 1. Check if user already has an active or pending token to prevent duplicates
    const { data: existingActive, error: activeError } = await supabase
      .from('token_system_tokens')
      .select('id, token_number, status')
      .eq('user_id', userId)
      .in('status', ['pending', 'active']);

    if (activeError) {
      throw new Error(`Database check failed: ${activeError.message}`);
    }

    if (existingActive && existingActive.length > 0) {
      return res.status(400).json({
        error: 'Duplicate token prevented. You already have an active or pending token in the queue.',
        token: existingActive[0]
      });
    }

    // 2. Determine next token number for today (self-resetting daily)
    const { data: todayTokens, error: fetchError } = await supabase
      .from('token_system_tokens')
      .select('token_number')
      .gte('created_at', start)
      .lte('created_at', end)
      .order('token_number', { ascending: false })
      .limit(1);

    if (fetchError) {
      throw new Error(`Error fetching today's tokens: ${fetchError.message}`);
    }

    const nextTokenNumber = await (async () => {
      let startingNumber = 1;
      try {
        const { data: settingData } = await supabase
          .from('token_system_settings')
          .select('value')
          .eq('key', 'starting_token_number')
          .maybeSingle();
        if (settingData && settingData.value) {
          startingNumber = parseInt(settingData.value, 10) || 1;
        }
      } catch (err) {
        console.warn('token_system_settings table query failed, defaulting starting number to 1:', err.message);
      }

      const todayMax = todayTokens && todayTokens.length > 0 
        ? todayTokens[0].token_number 
        : 0;

      return Math.max(todayMax + 1, startingNumber);
    })();

    // 3. Create the token
    const { data: newToken, error: insertError } = await supabase
      .from('token_system_tokens')
      .insert([
        {
          token_number: nextTokenNumber,
          user_id: userId,
          status: 'pending'
        }
      ])
      .select('*')
      .single();

    if (insertError) {
      throw new Error(`Failed to generate token: ${insertError.message}`);
    }

    // 4. Log token history
    await logTokenHistory(newToken);

    // 5. Broadcast to Socket.io clients
    broadcastQueueUpdate(req);

    return res.status(201).json({
      message: 'Token generated successfully!',
      token: newToken
    });

  } catch (error) {
    console.error('Generate Token Error:', error);
    return res.status(500).json({ error: 'Server error during token generation.' });
  }
};

/**
 * Get current token state and current user's token status
 */
const getCurrentToken = async (req, res) => {
  try {
    const userId = req.user.id;
    const { start, end } = getTodayRange();

    // 1. Fetch currently active token for today
    const { data: activeToken, error: activeErr } = await supabase
      .from('token_system_tokens')
      .select('*, token_system_users(full_name)')
      .eq('status', 'active')
      .gte('created_at', start)
      .lte('created_at', end)
      .order('updated_at', { ascending: false })
      .maybeSingle();

    if (activeErr) throw activeErr;

    // 2. Fetch user's token (pending or active)
    const { data: userToken, error: userTokenErr } = await supabase
      .from('token_system_tokens')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['pending', 'active'])
      .maybeSingle();

    if (userTokenErr) throw userTokenErr;

    return res.status(200).json({
      activeToken: activeToken || null,
      userToken: userToken || null
    });

  } catch (error) {
    console.error('Get Current Token Error:', error);
    return res.status(500).json({ error: 'Server error fetching token status.' });
  }
};

/**
 * Get full dashboard queue state
 */
const getQueue = async (req, res) => {
  try {
    const { start, end } = getTodayRange();

    // 1. Get currently active token
    const { data: activeToken, error: activeErr } = await supabase
      .from('token_system_tokens')
      .select('*, token_system_users(full_name)')
      .eq('status', 'active')
      .gte('created_at', start)
      .lte('created_at', end)
      .maybeSingle();

    if (activeErr) throw activeErr;

    // 2. Get next pending token
    const { data: nextToken, error: nextErr } = await supabase
      .from('token_system_tokens')
      .select('*, token_system_users(full_name)')
      .eq('status', 'pending')
      .gte('created_at', start)
      .lte('created_at', end)
      .order('token_number', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextErr) throw nextErr;

    // 3. Count total pending tokens
    const { count: pendingCount, error: pendingErr } = await supabase
      .from('token_system_tokens')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .gte('created_at', start)
      .lte('created_at', end);

    if (pendingErr) throw pendingErr;

    // 4. Fetch general queue (all active & pending tokens)
    const { data: queueList, error: queueErr } = await supabase
      .from('token_system_tokens')
      .select('*, token_system_users(full_name)')
      .in('status', ['active', 'pending'])
      .gte('created_at', start)
      .lte('created_at', end)
      .order('token_number', { ascending: true });

    if (queueErr) throw queueErr;

    // 5. Fetch user's token if authenticated
    let userToken = null;
    if (req.user) {
      const { data: userTokenData } = await supabase
        .from('token_system_tokens')
        .select('*')
        .eq('user_id', req.user.id)
        .in('status', ['pending', 'active'])
        .maybeSingle();
      userToken = userTokenData;
    }

    return res.status(200).json({
      activeToken: activeToken || null,
      nextToken: nextToken || null,
      pendingCount: pendingCount || 0,
      queueList: queueList || [],
      userToken: userToken
    });

  } catch (error) {
    console.error('Get Queue Error:', error);
    return res.status(500).json({ error: 'Server error loading token queue.' });
  }
};

/**
 * Move queue to next token (Admin only)
 */
const moveToNext = async (req, res) => {
  try {
    // 1. Verify user is admin
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }

    const { start, end } = getTodayRange();

    // 2. Complete the currently active token(s)
    const { data: currentActiveList, error: currentActiveErr } = await supabase
      .from('token_system_tokens')
      .select('*')
      .eq('status', 'active')
      .gte('created_at', start)
      .lte('created_at', end);

    if (currentActiveErr) throw currentActiveErr;

    if (currentActiveList && currentActiveList.length > 0) {
      for (const token of currentActiveList) {
        const { error: completeErr } = await supabase
          .from('token_system_tokens')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', token.id);

        if (completeErr) throw completeErr;

        // Log completion in history
        await logTokenHistory({ ...token, status: 'completed' });
      }
    }

    // 3. Find the next pending token
    const { data: nextToken, error: nextErr } = await supabase
      .from('token_system_tokens')
      .select('*')
      .eq('status', 'pending')
      .gte('created_at', start)
      .lte('created_at', end)
      .order('token_number', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextErr) throw nextErr;

    let activatedToken = null;
    if (nextToken) {
      // Set to active
      const { data: updated, error: activateErr } = await supabase
        .from('token_system_tokens')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', nextToken.id)
        .select('*')
        .single();

      if (activateErr) throw activateErr;
      activatedToken = updated;

      // Log activation in history
      await logTokenHistory(updated);
    }

    // 4. Broadcast queue update
    broadcastQueueUpdate(req);

    return res.status(200).json({
      message: activatedToken ? `Token #${activatedToken.token_number} is now active.` : 'No more tokens in the queue.',
      activeToken: activatedToken
    });

  } catch (error) {
    console.error('Move To Next Error:', error);
    return res.status(500).json({ error: 'Server error moving to next token.' });
  }
};

/**
 * Update the starting token number (Admin only)
 */
const updateStartingNumber = async (req, res) => {
  try {
    // 1. Verify user is admin
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }

    const { starting_number } = req.body;
    const parsedNumber = parseInt(starting_number, 10);

    if (isNaN(parsedNumber) || parsedNumber < 1) {
      return res.status(400).json({ error: 'Please enter a valid starting number (minimum 1).' });
    }

    // 2. Save or update the starting number in settings
    const { error: upsertErr } = await supabase
      .from('token_system_settings')
      .upsert({ key: 'starting_token_number', value: parsedNumber.toString() }, { onConflict: 'key' });

    if (upsertErr) {
      if (upsertErr.message.includes('relation "token_system_settings" does not exist') || upsertErr.code === '42P01') {
        return res.status(400).json({
          error: 'Database table "token_system_settings" is missing. Please run the SQL table creation script in Supabase first.'
        });
      }
      throw new Error(`Failed to update starting number in database: ${upsertErr.message}`);
    }

    return res.status(200).json({
      message: `Starting token number successfully set to ${parsedNumber}.`
    });

  } catch (error) {
    console.error('Update Starting Number Error:', error);
    return res.status(500).json({ error: 'Server error updating starting token number.' });
  }
};

module.exports = {
  generateToken,
  getCurrentToken,
  getQueue,
  moveToNext,
  updateStartingNumber
};
