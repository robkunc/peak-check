# Email Magic Link Setup Guide

This guide will help you set up email magic link authentication for the Peak Conditions Assistant.

## Option 1: Gmail SMTP (Easiest for Development)

If you have a Gmail account, you can use Gmail's SMTP server:

### Steps:

1. **Enable 2-Factor Authentication** on your Gmail account (required for app passwords)

2. **Generate an App Password:**
   - Go to [Google Account Settings](https://myaccount.google.com/)
   - Security → 2-Step Verification → App passwords
   - Generate a new app password for "Mail"
   - Copy the 16-character password

3. **Add to `.env.local`:**
   ```bash
   EMAIL_SERVER_HOST="smtp.gmail.com"
   EMAIL_SERVER_PORT="587"
   EMAIL_SERVER_USER="your-email@gmail.com"
   EMAIL_SERVER_PASSWORD="your-16-char-app-password"
   EMAIL_FROM="your-email@gmail.com"
   ```

## Option 2: Resend (Recommended for Production)

Resend is a modern email API service with a generous free tier.

### Steps:

1. **Sign up at [resend.com](https://resend.com)**

2. **Get your API key** from the dashboard

3. **Add to `.env.local`:**
   ```bash
   EMAIL_SERVER_HOST="smtp.resend.com"
   EMAIL_SERVER_PORT="465"
   EMAIL_SERVER_USER="resend"
   EMAIL_SERVER_PASSWORD="re_your_api_key_here"
   EMAIL_FROM="onboarding@resend.dev"  # Or your verified domain
   ```

## Option 3: SendGrid

SendGrid offers a free tier with 100 emails/day.

### Steps:

1. **Sign up at [sendgrid.com](https://sendgrid.com)**

2. **Create an API key** in Settings → API Keys

3. **Add to `.env.local`:**
   ```bash
   EMAIL_SERVER_HOST="smtp.sendgrid.net"
   EMAIL_SERVER_PORT="587"
   EMAIL_SERVER_USER="apikey"
   EMAIL_SERVER_PASSWORD="your-sendgrid-api-key"
   EMAIL_FROM="your-verified-sender@example.com"
   ```

## Option 4: Mailtrap (Development/Testing Only)

Mailtrap is great for development - it catches all emails without sending them.

### Steps:

1. **Sign up at [mailtrap.io](https://mailtrap.io)** (free tier available)

2. **Get SMTP credentials** from your inbox settings

3. **Add to `.env.local`:**
   ```bash
   EMAIL_SERVER_HOST="smtp.mailtrap.io"
   EMAIL_SERVER_PORT="2525"
   EMAIL_SERVER_USER="your-mailtrap-username"
   EMAIL_SERVER_PASSWORD="your-mailtrap-password"
   EMAIL_FROM="test@example.com"
   ```

## Testing

After setting up your email configuration:

1. **Restart your dev server:**
   ```bash
   npm run dev
   ```

2. **Visit the sign-in page** and enter your email

3. **Check your email** (or Mailtrap inbox) for the magic link

4. **Click the link** to sign in

## Troubleshooting

### "Connection refused" error
- Check that EMAIL_SERVER_HOST and EMAIL_SERVER_PORT are correct
- Verify your firewall isn't blocking the port
- For Gmail, make sure you're using an App Password, not your regular password

### "Authentication failed" error
- Verify EMAIL_SERVER_USER and EMAIL_SERVER_PASSWORD are correct
- For Gmail, ensure 2FA is enabled and you're using an App Password
- Check that EMAIL_FROM matches your sender address

### Emails not arriving
- Check spam folder
- Verify EMAIL_FROM address is valid
- For production services, ensure your domain/email is verified

## Security Notes

- **Never commit `.env.local` to git** (it's already in `.gitignore`)
- **Use App Passwords** for Gmail, not your main password
- **Rotate API keys** periodically
- **Use different credentials** for development and production

