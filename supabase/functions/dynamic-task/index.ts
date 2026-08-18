// Stripe Checkout + payment verify for wallet top-up and lesson bookings.
// Deploy: Edge Functions → dynamic-task (JWT verification ON)
// Secrets: STRIPE_SECRET_KEY, APP_URL (optional, default app.airdroptennis.com)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const APP_URL = Deno.env.get("APP_URL") || "https://app.airdroptennis.com";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function stripeForm(path: string, params: Record<string, string>) {
  const secret = Deno.env.get("STRIPE_SECRET_KEY");
  if (!secret) throw new Error("STRIPE_SECRET_KEY is not set");
  const body = new URLSearchParams(params);
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `Stripe ${res.status}`);
  }
  return data;
}

async function stripeGet(path: string) {
  const secret = Deno.env.get("STRIPE_SECRET_KEY");
  if (!secret) throw new Error("STRIPE_SECRET_KEY is not set");
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `Stripe ${res.status}`);
  }
  return data;
}

function serviceClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const payload = await req.json();
    const action = payload?.action;

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: authData, error: authError } = await userClient.auth.getUser();
    const user = authData?.user;
    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    if (action === "verify-payment") {
      const sessionId = payload.sessionId as string;
      const userId = (payload.userId as string) || user.id;
      if (!sessionId) return json({ error: "sessionId required" }, 400);
      if (userId !== user.id) return json({ error: "user mismatch" }, 403);

      const session = await stripeGet(`checkout/sessions/${sessionId}`);
      if (session.payment_status !== "paid" && session.status !== "complete") {
        return json({ success: false, error: "Payment not completed" }, 400);
      }

      const meta = session.metadata || {};
      const type = meta.type || "topup";
      const amountCents = Number(session.amount_total || 0);
      const amountDollars = amountCents / 100;
      const admin = serviceClient();

      let already = false;
      const { data: existing, error: existingErr } = await admin
        .from("stripe_processed_sessions")
        .select("session_id")
        .eq("session_id", sessionId)
        .maybeSingle();
      if (!existingErr && existing) already = true;

      if (!already && type === "topup" && amountDollars > 0) {
        const { error: creditErr } = await admin.rpc("add_wallet_balance", {
          user_id: userId,
          amount: amountDollars,
        });
        if (creditErr) {
          const { data: row, error: readErr } = await admin
            .from("profiles")
            .select("wallet_balance")
            .eq("id", userId)
            .maybeSingle();
          if (readErr) throw creditErr;
          const next = parseFloat(row?.wallet_balance || 0) + amountDollars;
          const { error: updErr } = await admin
            .from("profiles")
            .update({ wallet_balance: next })
            .eq("id", userId);
          if (updErr) throw creditErr;
        }
        await admin.from("stripe_processed_sessions").insert({
          session_id: sessionId,
          user_id: userId,
          amount: amountDollars,
          type,
        });
      } else if (!already) {
        await admin.from("stripe_processed_sessions").insert({
          session_id: sessionId,
          user_id: userId,
          amount: amountDollars,
          type,
        });
      }

      const { data: profile } = await admin
        .from("profiles")
        .select("wallet_balance")
        .eq("id", userId)
        .single();

      return json({
        success: true,
        type,
        newBalance: parseFloat(profile?.wallet_balance || 0),
      });
    }

    // Create Checkout Session (top-up or booking)
    const userId = (payload.userId as string) || user.id;
    if (userId !== user.id) return json({ error: "user mismatch" }, 403);

    const amountCents = Number(payload.amount);
    if (!amountCents || amountCents < 500) {
      return json({ error: "Amount must be at least $5" }, 400);
    }

    const metadata = payload.metadata || {};
    const type = metadata.type || (payload.bookingData ? "booking" : "topup");
    const label = type === "booking" ? "Airdrop Tennis lesson" : "Airdrop Tennis wallet top-up";

    const session = await stripeForm("checkout/sessions", {
      mode: "payment",
      success_url: `${APP_URL}/home?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/home`,
      client_reference_id: userId,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "aud",
      "line_items[0][price_data][unit_amount]": String(Math.round(amountCents)),
      "line_items[0][price_data][product_data][name]": label,
      "metadata[userId]": userId,
      "metadata[type]": type,
    });

    return json({
      sessionId: session.id,
      id: session.id,
      url: session.url,
    });
  } catch (e) {
    console.error("dynamic-task error:", e);
    return json({ error: e instanceof Error ? e.message : "Server error" }, 500);
  }
});
