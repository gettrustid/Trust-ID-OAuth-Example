/**
 * TrustID OAuth — Example Server
*/

require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();

app.use(express.json());

// ─── Configuration ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID;
const CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET;
const TOKEN_ENDPOINT = process.env.KEYCLOAK_TOKEN_ENDPOINT;
const AUTH_ENDPOINT = process.env.KEYCLOAK_AUTH_ENDPOINT;
const REDIRECT_URI = process.env.REDIRECT_URI || `http://localhost:${PORT}/auth/callback`;
const IDP_HINT = process.env.IDP_HINT || "";

// Button script: serve from bundled file by default, or use CDN if USE_CDN=true
const USE_CDN = process.env.USE_CDN === "true";
const BUTTON_SCRIPT_URL = USE_CDN
  ? "https://oauth.trustid.life/trustid-oauth.iife.js"
  : "/trustid-oauth.iife.js";

if (!CLIENT_ID || !CLIENT_SECRET || !TOKEN_ENDPOINT || !AUTH_ENDPOINT) {
  console.error("\nMissing required environment variables:");
  console.error("  KEYCLOAK_CLIENT_ID");
  console.error("  KEYCLOAK_CLIENT_SECRET");
  console.error("  KEYCLOAK_TOKEN_ENDPOINT");
  console.error("  KEYCLOAK_AUTH_ENDPOINT\n");
  process.exit(1);
}

// ─── Serve Button Script ─────────────────────────────────────────────────────
if (!USE_CDN) {
  const SCRIPT_PATH = path.join(__dirname, "trustid-oauth.iife.js");
  app.get("/trustid-oauth.iife.js", (req, res) => {
    try {
      const script = fs.readFileSync(SCRIPT_PATH, "utf-8");
      res.type("application/javascript").send(script);
    } catch (err) {
      console.error("Failed to read button script:", err.message);
      res.status(500).send("// Failed to load button script");
    }
  });
}

// ─── Sign-in Page ────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TrustID OAuth Test</title>
  <style>
    body {
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #fafafa;
      color: #333;
    }
    h1 { font-size: 1.2em; margin-bottom: 24px; font-weight: 500; }
  </style>
</head>
<body>
  <h1>Third-Party Test Site</h1>
  <div id="trustid-btn"></div>
  <script
    src="${BUTTON_SCRIPT_URL}"
    data-client-id="${CLIENT_ID}"
    data-redirect-uri="${REDIRECT_URI}"
    data-authorization-endpoint="${AUTH_ENDPOINT}"
    data-container="#trustid-btn"
    data-size="large"
    ${IDP_HINT ? `data-idp-hint="${IDP_HINT}"` : ""}
    defer
  ></script>
</body>
</html>`);
});

// ─── OAuth Callback Page ─────────────────────────────────────────────────────
app.get("/auth/callback", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TrustID OAuth - Callback</title>
  <style>
    body {
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #fafafa;
      color: #333;
    }
    #status { font-size: 1em; margin: 24px; max-width: 600px; }
    pre {
      background: #f0f0f0;
      padding: 16px;
      border-radius: 6px;
      max-width: 600px;
      width: 100%;
      overflow-x: auto;
      font-size: 13px;
    }
    .error { color: #d32f2f; }
    .success { color: #2e7d32; }
  </style>
</head>
<body>
  <h1>OAuth Callback</h1>
  <div id="status">Processing...</div>
  <pre id="result"></pre>
  <script>
    (async () => {
      const statusEl = document.getElementById("status");
      const resultEl = document.getElementById("result");

      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const state = params.get("state");

        if (!code) {
          const error = params.get("error");
          const desc = params.get("error_description");
          throw new Error(error ? error + ": " + (desc || "") : "No authorization code received");
        }

        // Read PKCE params from sessionStorage (stored by the sign-in script before redirect)
        const storedState = sessionStorage.getItem("trustid_oauth_state");
        const codeVerifier = sessionStorage.getItem("trustid_oauth_code_verifier");

        // Validate state (CSRF protection)
        if (state !== storedState) {
          throw new Error("State mismatch — possible CSRF attack");
        }

        statusEl.textContent = "Exchanging code for tokens...";

        // Send code + code_verifier to our backend for the token exchange
        const response = await fetch("/auth/token-exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, code_verifier: codeVerifier }),
        });

        const data = await response.json();

        // Clean up sessionStorage
        sessionStorage.removeItem("trustid_oauth_state");
        sessionStorage.removeItem("trustid_oauth_code_verifier");

        if (!response.ok) {
          throw new Error(data.error || "Token exchange failed");
        }

        statusEl.innerHTML = '<span class="success">Authentication successful</span>';
        resultEl.textContent = JSON.stringify(data, null, 2);
      } catch (err) {
        statusEl.innerHTML = '<span class="error">Error: ' + err.message + '</span>';
        resultEl.textContent = "";
      }
    })();
  </script>
</body>
</html>`);
});

// ─── Token Exchange Endpoint ─────────────────────────────────────────────────
app.post("/auth/token-exchange", async (req, res) => {
  const { code, code_verifier } = req.body;

  if (!code || !code_verifier) {
    return res.status(400).json({ error: "Missing code or code_verifier" });
  }

  try {
    // Exchange the authorization code for tokens (server-to-server)
    const tokenResponse = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET, // Only used server-side
        code_verifier,
      }).toString(),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      return res.status(tokenResponse.status).json({
        error: tokenData.error || "Token exchange failed",
        error_description: tokenData.error_description,
      });
    }

    // Decode the id_token to extract user claims
    const claims = tokenData.id_token ? decodeJwtPayload(tokenData.id_token) : null;

    res.json({
      message: "Token exchange successful",
      claims,
      token_type: tokenData.token_type,
      expires_in: tokenData.expires_in,
      scope: tokenData.scope,
      // In production, you would NOT send raw tokens back to the frontend.
      // You'd create a session/cookie instead.
    });

  } catch (err) {
    console.error("Token exchange error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function decodeJwtPayload(jwt) {
  const payload = jwt.split(".")[1];
  return JSON.parse(Buffer.from(payload, "base64url").toString());
}

// ─── Start Server ────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\nTrustID OAuth Test Server running at http://localhost:${PORT}\n`);
  console.log("Routes:");
  console.log("  GET  /                      → Sign-in page with TrustID button");
  console.log("  GET  /auth/callback         → OAuth callback page");
  console.log("  POST /auth/token-exchange   → Server-side code → token exchange\n");
  console.log("Config:");
  console.log(`  CLIENT_ID:      ${CLIENT_ID}`);
  console.log(`  REDIRECT_URI:   ${REDIRECT_URI}`);
  console.log(`  TOKEN_ENDPOINT: ${TOKEN_ENDPOINT}`);
  console.log(`  BUTTON_SCRIPT:  ${USE_CDN ? BUTTON_SCRIPT_URL : "bundled (local)"}\n`);
});
