// Stripe success_url fallback. Credits the wallet server-side, then sends the
// browser home. Vercel deploys this automatically on push.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://rozxeqqwxpnfqbyvtvch.supabase.co";
const ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvenhlcXF3eHBuZnFieXZ0dmNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MDMyMjAsImV4cCI6MjA5NTI3OTIyMH0.B3yitpbI_JWRiBpkYfZG2D4CIH5AGrjgn_lgIBjjK-4";
const APP_URL = process.env.APP_URL || "https://app.airdroptennis.com";

module.exports = async function handler(req, res) {
  const sessionId = typeof req.query?.session_id === "string" ? req.query.session_id : "";
  const home = `${APP_URL.replace(/\/$/, "")}/home`;

  if (!sessionId) {
    res.redirect(302, `${home}?topup_error=missing_session`);
    return;
  }

  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/dynamic-task`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ANON_KEY}`,
        apikey: ANON_KEY,
      },
      body: JSON.stringify({ action: "verify-payment", sessionId }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.success) {
      res.redirect(
        302,
        `${home}?session_id=${encodeURIComponent(sessionId)}&topup_error=1`
      );
      return;
    }
    const balance = data.newBalance != null ? String(data.newBalance) : "";
    res.redirect(
      302,
      `${home}?credited=1&type=${encodeURIComponent(data.type || "topup")}&balance=${encodeURIComponent(balance)}`
    );
  } catch {
    res.redirect(
      302,
      `${home}?session_id=${encodeURIComponent(sessionId)}&topup_error=1`
    );
  }
};
