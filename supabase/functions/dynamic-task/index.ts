// Stripe Checkout + payment verify for wallet top-up and lesson bookings.
// Deploy: Edge Functions → dynamic-task
// Verify JWT: OFF
// Secrets: STRIPE_SECRET_KEY, APP_URL

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const APP_URL = Deno.env.get("APP_URL") || "https://app.airdroptennis.com";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function redirectHome(params: Record<string, string>) {
  const url = new URL("/home", APP_URL);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      Location: url.toString(),
      "Cache-Control": "no-store",
    },
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
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function creditPaidSession(sessionId: string, fallbackUserId?: string) {
  const session = await stripeGet(`checkout/sessions/${sessionId}`);
  if (session.payment_status !== "paid" && session.status !== "complete") {
    throw new Error("Payment not completed");
  }

  const meta = session.metadata || {};
  const type = String(meta.type || "topup");
  const userId = String(meta.userId || session.client_reference_id || fallbackUserId || "");
  if (!userId) throw new Error("No user on Stripe session");

  const amountDollars = Number(session.amount_total || 0) / 100;
  const creditAmount = type === "topup" ? amountDollars : 0;
  const admin = serviceClient();

  const { data, error } = await admin.rpc("credit_stripe_session", {
    p_session_id: sessionId,
    p_user_id: userId,
    p_amount: creditAmount,
    p_type: type,
  });

  if (!error) {
    return {
      success: true,
      type,
      newBalance: parseFloat(data || 0),
      userId,
    };
  }

  const missingFn = /could not find|does not exist|schema cache/i.test(error.message || "");
  if (!missingFn) throw error;

  // Fallback if 013 SQL has not been run yet
  if (type === "topup" && amountDollars > 0) {
    const { data: existing } = await admin
      .from("stripe_processed_sessions")
      .select("session_id")
      .eq("session_id", sessionId)
      .maybeSingle();
    if (!existing) {
      const { error: rpcErr } = await admin.rpc("add_wallet_balance", {
        user_id: userId,
        amount: amountDollars,
      });
      if (rpcErr) {
        const { data: row } = await admin
          .from("profiles")
          .select("wallet_balance")
          .eq("id", userId)
          .maybeSingle();
        const next = parseFloat(row?.wallet_balance || 0) + amountDollars;
        const { error: updErr, data: updated } = await admin
          .from("profiles")
          .update({ wallet_balance: next })
          .eq("id", userId)
          .select("wallet_balance")
          .maybeSingle();
        if (updErr || updated == null) {
          throw new Error(rpcErr.message || updErr?.message || "Failed to credit wallet");
        }
      }
      await admin.from("stripe_processed_sessions").insert({
        session_id: sessionId,
        user_id: userId,
        amount: amountDollars,
        type,
      });
    }
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("wallet_balance")
    .eq("id", userId)
    .maybeSingle();
  return {
    success: true,
    type,
    newBalance: parseFloat(profile?.wallet_balance || 0),
    userId,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const reqUrl = new URL(req.url);
  const actionFromQuery = reqUrl.searchParams.get("action");
  const sessionFromQuery = reqUrl.searchParams.get("session_id");

  // Stripe success_url hits this GET so the wallet is credited before the SPA loads.
  if (req.method === "GET" && (actionFromQuery === "credit" || sessionFromQuery)) {
    try {
      if (!sessionFromQuery) return redirectHome({ topup_error: "missing_session" });
      const result = await creditPaidSession(sessionFromQuery);
      return redirectHome({
        credited: "1",
        type: result.type,
        balance: String(result.newBalance ?? ""),
      });
    } catch (e) {
      console.error("dynamic-task GET credit error:", e);
      return redirectHome({
        session_id: sessionFromQuery || "",
        topup_error: "1",
      });
    }
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const payload = await req.json();
    const action = payload?.action;

    async function getAuthUser() {
      const authHeader = req.headers.get("Authorization") || "";
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: authData, error: authError } = await userClient.auth.getUser();
      if (authError || !authData?.user) return null;
      return authData.user;
    }

    if (action === "verify-payment") {
      const sessionId = payload.sessionId as string;
      if (!sessionId) return json({ error: "sessionId required" }, 400);
      const result = await creditPaidSession(sessionId, payload.userId);
      return json(result);
    }

    const user = await getAuthUser();
    if (!user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const userId = (payload.userId as string) || user.id;
    if (userId !== user.id) return json({ error: "user mismatch" }, 403);

    const amountCents = Number(payload.amount);
    if (!amountCents || amountCents < 500) {
      return json({ error: "Amount must be at least $5" }, 400);
    }

    const metadata = payload.metadata || {};
    const type = metadata.type || (payload.bookingData ? "booking" : "topup");
    const label =
      type === "booking" ? "Airdrop Tennis lesson" : "Airdrop Tennis wallet top-up";

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const successUrl =
      `${supabaseUrl}/functions/v1/dynamic-task?action=credit&session_id={CHECKOUT_SESSION_ID}&apikey=${encodeURIComponent(anon)}`;

    const session = await stripeForm("checkout/sessions", {
      mode: "payment",
      success_url: successUrl,
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
