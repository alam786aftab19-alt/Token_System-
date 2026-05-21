const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabaseClient');
const { generateVerificationToken } = require('../utils/tokenGenerator');
const { sendVerificationEmail } = require('../utils/emailService');

// JWT Secrets and parameters
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_jwt_secret';
const JWT_EXPIRES_IN = '24h';

/**
 * Handle user signup
 */
const signup = async (req, res) => {
  try {
    const { email, password, full_name, mobile_number } = req.body;

    // 1. Validate inputs
    if (!email || !password || !full_name || !mobile_number) {
      return res.status(400).json({ error: 'All fields (email, password, full_name, mobile_number) are required.' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = full_name.trim();
    const trimmedMobile = mobile_number.trim();

    // Validate mobile format: 10 to 15 digits (allowing optional leading +)
    const mobileRegex = /^\+?[0-9]{10,15}$/;
    if (!mobileRegex.test(trimmedMobile)) {
      return res.status(400).json({ error: 'Please enter a valid mobile number (10 to 15 digits).' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    // 2. Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('token_system_users')
      .select('id, email')
      .eq('email', trimmedEmail)
      .maybeSingle();

    if (checkError) {
      throw new Error(`Database check failed: ${checkError.message}`);
    }

    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email address already exists.' });
    }

    // 3. Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 4. Generate verification token (expires in 24 hours)
    const verificationToken = generateVerificationToken();
    const verificationExpires = new Date();
    verificationExpires.setHours(verificationExpires.getHours() + 24);

    // 5. Save user in Supabase
    const isFirstUserQuery = await supabase.from('token_system_users').select('id', { count: 'exact', head: true });
    const is_admin = isFirstUserQuery.count === 0; // If first user, make admin

    const { data: newUser, error: insertError } = await supabase
      .from('token_system_users')
      .insert([
        {
          email: trimmedEmail,
          password_hash: passwordHash,
          full_name: trimmedName,
          mobile_number: trimmedMobile,
          is_verified: false,
          verification_token: verificationToken,
          verification_expires: verificationExpires.toISOString(),
          is_admin: is_admin
        }
      ])
      .select('id, email, full_name, mobile_number, is_admin')
      .single();

    if (insertError) {
      throw new Error(`User insertion failed: ${insertError.message}`);
    }

    // 6. Send verification email via EmailJS (non-blocking)
    try {
      await sendVerificationEmail(trimmedEmail, trimmedName, verificationToken);
    } catch (emailErr) {
      console.error(`Email send failed during signup for ${trimmedEmail}:`, emailErr.message);
    }

    return res.status(201).json({
      message: 'Signup successful! Please check your email to verify your account.',
      user: {
        id: newUser.id,
        email: newUser.email,
        full_name: newUser.full_name,
        mobile_number: newUser.mobile_number,
        is_admin: newUser.is_admin
      }
    });

  } catch (error) {
    console.error('Signup Error:', error);
    return res.status(500).json({ error: 'Server error during registration.' });
  }
};

/**
 * Handle user login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Validate inputs
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // 2. Fetch user from Supabase
    const { data: user, error: fetchError } = await supabase
      .from('token_system_users')
      .select('*')
      .eq('email', trimmedEmail)
      .maybeSingle();

    if (fetchError) {
      throw new Error(`Database error fetching user: ${fetchError.message}`);
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // 3. Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // 4. Check if email is verified
    if (!user.is_verified) {
      return res.status(403).json({
        error: 'Email not verified. Please check your inbox for the verification email or link.',
        is_unverified: true,
        verification_token: user.verification_token // Return token so frontend dev can bypass if needed
      });
    }

    // 5. Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        is_admin: user.is_admin
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // 6. Return response
    return res.status(200).json({
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        is_admin: user.is_admin,
        is_verified: user.is_verified
      }
    });

  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({ error: 'Server error during login authentication.' });
  }
};

/**
 * Verify email using verification token
 */
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Verification token is missing.' });
    }

    // Find the user with this verification token
    const { data: user, error: fetchError } = await supabase
      .from('token_system_users')
      .select('id, verification_expires, is_verified')
      .eq('verification_token', token)
      .maybeSingle();

    if (fetchError) {
      throw new Error(`Database error verifying token: ${fetchError.message}`);
    }

    if (!user) {
      return res.status(400).json({ error: 'Invalid verification token.' });
    }

    if (user.is_verified) {
      return res.status(200).json({ message: 'Email has already been verified.' });
    }

    // Check expiration
    const expiry = new Date(user.verification_expires);
    const now = new Date();

    if (expiry < now) {
      return res.status(400).json({ error: 'Verification link has expired. Please sign up again.' });
    }

    // Update user to verified
    const { error: updateError } = await supabase
      .from('token_system_users')
      .update({
        is_verified: true,
        verification_token: null,
        verification_expires: null
      })
      .eq('id', user.id);

    if (updateError) {
      throw new Error(`Database update failed: ${updateError.message}`);
    }

    return res.status(200).json({ message: 'Email verified successfully! You can now log in.' });

  } catch (error) {
    console.error('Email Verification Error:', error);
    return res.status(500).json({ error: 'Server error during email verification.' });
  }
};

/**
 * Logout user
 */
const logout = async (req, res) => {
  // Since JWT is stateless, the backend just returns a message.
  // The client will delete the token.
  return res.status(200).json({ message: 'Logout successful.' });
};

module.exports = {
  signup,
  login,
  verifyEmail,
  logout
};
