const nodemailer = require('nodemailer');

/**
 * Service to handle email verification using Gmail SMTP (Nodemailer) or EmailJS.
 */
const sendVerificationEmail = async (email, name, verificationToken) => {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_PASS;
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5000';

  const verificationUrl = `${frontendUrl}/verify.html?token=${verificationToken}`;

  // 1. Direct send via Gmail SMTP using Nodemailer (Guarantees OTP displays in message body)
  if (gmailUser && gmailPass) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: gmailUser,
          pass: gmailPass
        }
      });

      const mailOptions = {
        from: `"Smart Queue Service" <${gmailUser}>`,
        to: email,
        subject: 'To authenticate, please use the following One Time Password (OTP)',
        text: `To authenticate, please use the following One Time Password (OTP):

${verificationToken}

This OTP will be valid for 15 minutes till ${new Date(Date.now() + 15 * 60 * 1000).toLocaleTimeString()}.

Do not share this OTP with anyone. If you didn't make this request, you can safely ignore this email.
Smart Queue will never contact you about this email or ask for any login codes or links. Beware of phishing scams.

Thanks for visiting Smart Queue!`,
        html: `<div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; border: 1px solid #ddd; border-radius: 8px; background-color: #fdfdfd;">
          <h2 style="color: #4f46e5; border-bottom: 2px solid #eef2ff; padding-bottom: 10px;">One Time Password (OTP) Verification</h2>
          <p>Hi <strong>${name}</strong>,</p>
          <p>To authenticate, please use the following One Time Password (OTP):</p>
          <div style="background-color: #f3f4f6; padding: 15px; text-align: center; border-radius: 6px; font-size: 2rem; font-weight: bold; letter-spacing: 0.5rem; color: #1f2937; margin: 20px 0;">
            ${verificationToken}
          </div>
          <p>This OTP will be valid for 15 minutes.</p>
          <p style="color: #6b7280; font-size: 0.85rem; margin-top: 25px;">
            Do not share this OTP with anyone. If you didn't make this request, you can safely ignore this email.<br>
            Smart Queue will never contact you about this email or ask for any login codes or links. Beware of phishing scams.
          </p>
          <p style="margin-top: 20px; border-top: 1px solid #eee; padding-top: 15px; font-size: 0.9rem; color: #4b5563;">
            Thanks for visiting Smart Queue!
          </p>
        </div>`
      };

      await transporter.sendMail(mailOptions);
      console.log(`Verification email containing OTP ${verificationToken} successfully sent directly to ${email} via Gmail SMTP.`);
      return true;
    } catch (smtpErr) {
      console.error('Failed to send verification email via Gmail SMTP:', smtpErr.message);
      // Fallback to EmailJS
    }
  }

  // 2. Fallback to EmailJS REST API
  if (serviceId && templateId && publicKey && privateKey) {
    try {
      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          service_id: serviceId,
          template_id: templateId,
          user_id: publicKey,
          accessToken: privateKey,
          template_params: {
            to_name: name,
            to_email: email,
            otp_code: verificationToken,
            otp: verificationToken,
            code: verificationToken,
            verification_link: verificationUrl
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`EmailJS responded with status ${response.status}: ${errorText}`);
      }

      console.log(`Verification email successfully sent to ${email} (OTP: ${verificationToken}) via EmailJS.`);
      return true;
    } catch (error) {
      console.error('Error sending verification email through EmailJS:', error.message);
    }
  }

  // 3. Fallback Developer Log
  console.warn('\n--- [FALLBACK DEVELOPER LOG] ---');
  console.warn(`Verify user: ${name} (${email})`);
  console.warn(`OTP Code: ${verificationToken}`);
  console.warn(`Click this link to verify manually:`);
  console.warn(`${verificationUrl}`);
  console.warn('---------------------------------\n');
  return true;
};

module.exports = {
  sendVerificationEmail
};
