// Stripe → wallet webhook. Deploy: Edge Functions → stripe-webhook
// Verify JWT: OFF (Stripe cannot send a Supabase JWT)
// Secret: STRIPE_WEBHOOK_SECRET
// Stripe Dashboard → Webhooks → checkout.session.completed
// URL: https://rozxeqqwxpnfqbyvtvch.supabase.co/functions/v1/stripe-webhook

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function hex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function verifyStripeSignature(rawBody: string, header: string, secret: string) {
  const items = Object.fromEntries(
    header.split(",").map((part) => {
      const idx = part.indexOf("=");
      return [part.slice(0, idx), part.slice(idx + 1)];
    })
  );
  const timestamp = items.t;
  const signatures = header
    .split(",")
    .filter((p) => p.startsWith("v1="))
    .map((p) => p.slice(3));
  if (!timestamp || signatures.length === 0) throw new Error("Invalid Stripe signature");

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) throw new Error("Stripe signature too old");

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${timestamp}.${rawBody}`)
  );
  const digest = hex(signed);
  if (!signatures.some((sig) => timingSafeEqual(sig, digest))) {
    throw new Error("Stripe signature mismatch");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const rawBody = await req.text();
    const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const sig = req.headers.get("stripe-signature") || "";
    if (secret) {
      await verifyStripeSignature(rawBody, sig, secret);
    }

    const event = JSON.parse(rawBody);
    if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
      return json({ received: true, ignored: event.type });
    }

    const session = event.data?.object || {};
    const sessionId = session.id as string;
    if (!sessionId) return json({ error: "No session id" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const res = await fetch(`${supabaseUrl}/functions/v1/dynamic-task`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anon}`,
        apikey: anon,
      },
      body: JSON.stringify({ action: "verify-payment", sessionId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("stripe-webhook credit failed", data);
      return json({ error: data.error || "credit failed" }, 500);
    }
    return json({ received: true, ...data });
  } catch (e) {
    console.error("stripe-webhook error:", e);
    return json({ error: e instanceof Error ? e.message : "Webhook error" }, 400);
  }
});
