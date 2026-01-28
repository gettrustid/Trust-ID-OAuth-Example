# TrustID OAuth Example

A complete working example for adding "Sign in with TrustID" to your website.

## How It Works

```
Your Website → Your Keycloak → TrustID Keycloak → User verifies with OTP → Claims returned
```

Your Keycloak acts as a broker to TrustID's Keycloak (the Identity Provider). When a user clicks "Sign in with TrustID", they're redirected through your Keycloak to TrustID, where they verify their email/phone via OTP. After verification, the user's claims (email, phone) are returned to your application.

## Setup

### 1. Configure Your Keycloak

Your Keycloak instance needs TrustID configured as a **brokered Identity Provider**:

1. In your Keycloak admin console, go to **Identity Providers**
2. Add TrustID's Keycloak as an OIDC Identity Provider
3. Configure the broker with credentials provided by TrustID

Contact your TrustID representative for the IdP configuration details.

### 2. Create an OAuth Client

In your Keycloak, create a client for your application:

1. Go to **Clients** → **Create**
2. Note the `client_id` and `client_secret`
3. Add `http://localhost:3000/auth/callback` as a valid **Redirect URI**
4. Enable **PKCE (S256)** under client settings

### 3. Run the Example

```bash
# Install dependencies
npm install

# Copy the example env file and fill in your values
cp .env.example .env

# Edit .env with your Keycloak credentials
# KEYCLOAK_CLIENT_ID=your-client-id
# KEYCLOAK_CLIENT_SECRET=your-client-secret
# KEYCLOAK_TOKEN_ENDPOINT=https://your-keycloak.com/realms/your-realm/protocol/openid-connect/token
# KEYCLOAK_AUTH_ENDPOINT=https://your-keycloak.com/realms/your-realm/protocol/openid-connect/auth

# Run the server
npm start
```

### 4. Test

1. Open http://localhost:3000
2. Click "Sign in with TrustID"
3. You'll be redirected to your Keycloak → TrustID
4. Enter your email/phone and verify with OTP
5. On success, you'll see the returned user claims

## Files

| File | Description |
|------|-------------|
| `server.js` | Express server with OAuth endpoints |
| `button-test.html` | Static page to test button rendering (open directly in browser) |
| `trustid-oauth.iife.js` | Bundled TrustID button script |
| `.env.example` | Example environment variables (copy to `.env`) |

> **Note:** The button script is temporarily bundled here for local verification. It will soon be hosted via CDN at `https://oauth.trustid.life/trustid-oauth.iife.js`. Once available, you can load it directly from the CDN instead of using the bundled file.

## Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `KEYCLOAK_CLIENT_ID` | Your OAuth client ID |
| `KEYCLOAK_CLIENT_SECRET` | Your OAuth client secret |
| `KEYCLOAK_TOKEN_ENDPOINT` | `https://<your-keycloak>/realms/<realm>/protocol/openid-connect/token` |
| `KEYCLOAK_AUTH_ENDPOINT` | `https://<your-keycloak>/realms/<realm>/protocol/openid-connect/auth` |
| `REDIRECT_URI` | Callback URL (default: `http://localhost:3000/auth/callback`) |
| `PORT` | Server port (default: `3000`) |

### Button Attributes

When adding the button to your own pages:

```html
<div id="trustid-btn"></div>

<script
  src="./trustid-oauth.iife.js"
  data-client-id="YOUR_CLIENT_ID"
  data-redirect-uri="https://yoursite.com/auth/callback"
  data-authorization-endpoint="https://YOUR_KEYCLOAK/realms/REALM/protocol/openid-connect/auth"
  data-container="#trustid-btn"
></script>
```

| Attribute | Required | Description |
|-----------|----------|-------------|
| `data-client-id` | Yes | Your Keycloak client ID |
| `data-redirect-uri` | Yes | Your callback URL |
| `data-idp-hint` | Your hint for TrustID provider in your keycloak
| `data-authorization-endpoint` | Yes | Your Keycloak auth endpoint |
| `data-container` | No | CSS selector for button container |
| `data-size` | No | `standard` (default) or `large` |
| `data-theme` | No | `filled` (default) or `outline` |

## User Claims

After successful authentication, you receive:

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "email_verified": true,
  "phone_number": "+1234567890",
  "phone_number_verified": true
}
```

## Production

For production deployment:

1. Use HTTPS for your redirect URI
2. Update the redirect URI in your Keycloak client settings
3. Set `USE_CDN=true` to load the button from `https://oauth.trustid.life/trustid-oauth.iife.js`

## License

MIT
