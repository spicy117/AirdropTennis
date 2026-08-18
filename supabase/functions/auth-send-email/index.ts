// Supabase Auth "Send Email" hook → Resend
// Handles signup confirmation, password reset, magic links, invites.
//
// Deploy: supabase functions deploy auth-send-email --no-verify-jwt
// Secrets: RESEND_API_KEY, SEND_EMAIL_HOOK_SECRET, RESEND_FROM_EMAIL (optional)
//
// Dashboard: Authentication → Hooks → Send Email → HTTPS → this function URL

import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, webhook-id, webhook-timestamp, webhook-signature",
};

type EmailActionType =
  | "signup"
  | "recovery"
  | "invite"
  | "magiclink"
  | "email_change"
  | "email_change_new"
  | "reauthentication";

interface HookUser {
  email: string;
  user_metadata?: {
    first_name?: string;
    last_name?: string;
    full_name?: string;
  };
  new_email?: string;
}

interface EmailData {
  token: string;
  token_hash: string;
  redirect_to: string;
  email_action_type: EmailActionType;
  site_url: string;
  token_new?: string;
  token_hash_new?: string;
  old_email?: string;
}

function displayName(user: HookUser): string {
  const meta = user.user_metadata || {};
  return (
    meta.full_name ||
    [meta.first_name, meta.last_name].filter(Boolean).join(" ").trim() ||
    user.email.split("@")[0]
  );
}

function confirmationUrl(supabaseUrl: string, emailData: EmailData): string {
  const params = new URLSearchParams({
    token: emailData.token_hash,
    type: emailData.email_action_type,
    redirect_to: emailData.redirect_to || emailData.site_url,
  });
  return `${supabaseUrl.replace(/\/$/, "")}/auth/v1/verify?${params.toString()}`;
}

function emailContent(
  action: EmailActionType,
  user: HookUser,
  emailData: EmailData,
  confirmUrl: string
): { subject: string; html: string; text: string } {
  const name = displayName(user);

  const wrap = (title: string, body: string, cta: string, ctaUrl: string, footer?: string) => ({
    subject: title,
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr><td style="background:#111111;padding:24px 32px;">
          <span style="color:#E5FF00;font-size:20px;font-weight:700;letter-spacing:-0.5px;">Airdrop Tennis</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:22px;color:#111111;">${title}</h1>
          <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#444444;">Hi ${name},</p>
          ${body}
          <p style="margin:32px 0 0;text-align:center;">
            <a href="${ctaUrl}" style="display:inline-block;background:#E5FF00;color:#111111;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:16px;">${cta}</a>
          </p>
          ${footer ? `<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#888888;">${footer}</p>` : ""}
          <p style="margin:24px 0 0;font-size:12px;color:#aaaaaa;">If the button doesn't work, copy this link:<br><a href="${ctaUrl}" style="color:#666666;word-break:break-all;">${ctaUrl}</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    text: `${title}\n\nHi ${name},\n\n${body.replace(/<[^>]+>/g, "")}\n\n${cta}: ${ctaUrl}\n${footer || ""}`,
  });

  switch (action) {
    case "signup":
      return wrap(
        "Welcome — confirm your email",
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#444444;">Thanks for signing up for Airdrop Tennis! Confirm your email to book lessons, track performance, and manage your schedule.</p>
         <p style="margin:0;font-size:14px;color:#666666;">Your verification code: <strong style="font-size:18px;letter-spacing:2px;">${emailData.token}</strong></p>`,
        "Confirm email address",
        confirmUrl,
        "If you didn't create an account, you can ignore this email."
      );
    case "recovery":
      return wrap(
        "Reset your password",
        `<p style="margin:0;font-size:16px;line-height:1.6;color:#444444;">We received a request to reset your Airdrop Tennis password. Click below to choose a new password.</p>`,
        "Reset password",
        confirmUrl,
        "If you didn't request this, you can safely ignore this email."
      );
    case "invite":
      return wrap(
        "You're invited to Airdrop Tennis",
        `<p style="margin:0;font-size:16px;line-height:1.6;color:#444444;">You've been invited to join Airdrop Tennis. Accept the invitation to create your account.</p>`,
        "Accept invitation",
        confirmUrl
      );
    case "magiclink":
      return wrap(
        "Your sign-in link",
        `<p style="margin:0;font-size:16px;line-height:1.6;color:#444444;">Click below to sign in to Airdrop Tennis. This link expires shortly and can only be used once.</p>`,
        "Sign in",
        confirmUrl
      );
    case "email_change":
    case "email_change_new":
      return wrap(
        "Confirm your new email",
        `<p style="margin:0;font-size:16px;line-height:1.6;color:#444444;">Confirm ${user.new_email || "your new email address"} as your Airdrop Tennis account email.</p>`,
        "Confirm new email",
        confirmUrl,
        "If you didn't request this change, you can ignore this email."
      );
    case "reauthentication":
      return {
        subject: "Your verification code",
        html: `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:24px;"><h2>Verification code</h2><p>Hi ${name}, use this code to verify your identity:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${emailData.token}</p></body></html>`,
        text: `Your verification code: ${emailData.token}`,
      };
    default:
      return wrap(
        "Airdrop Tennis",
        `<p style="margin:0;font-size:16px;line-height:1.6;color:#444444;">Please complete this action for your account.</p>`,
        "Continue",
        confirmUrl
      );
  }
}

async function sendViaResend(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<{ id?: string; error?: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from =
    Deno.env.get("RESEND_FROM_EMAIL") ||
    "Airdrop Tennis <noreply@airdroptennis.com>";

  if (!apiKey) {
    return { error: "RESEND_API_KEY not configured" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Resend error:", body);
    return { error: body?.message || `Resend HTTP ${res.status}` };
  }
  return { id: body?.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const hookSecretRaw = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
  if (!hookSecretRaw) {
    console.error("SEND_EMAIL_HOOK_SECRET not set");
    return new Response(JSON.stringify({ error: { message: "Hook secret not configured" } }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const hookSecret = hookSecretRaw.replace(/^v1,whsec_/, "");
  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  let user: HookUser;
  let email_data: EmailData;

  try {
    const wh = new Webhook(hookSecret);
    const verified = wh.verify(payload, headers) as { user: HookUser; email_data: EmailData };
    user = verified.user;
    email_data = verified.email_data;
  } catch (e) {
    console.error("Webhook verify failed:", e);
    return new Response(
      JSON.stringify({ error: { message: "Invalid webhook signature" } }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const confirmUrl = confirmationUrl(supabaseUrl, email_data);
  const { subject, html, text } = emailContent(
    email_data.email_action_type,
    user,
    email_data,
    confirmUrl
  );

  const result = await sendViaResend(user.email, subject, html, text);
  if (result.error) {
    console.error("Send failed:", result.error);
    return new Response(
      JSON.stringify({ error: { message: result.error } }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  console.log(
    JSON.stringify({
      ok: true,
      resend_id: result.id,
      to: user.email,
      action: email_data.email_action_type,
    })
  );

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
