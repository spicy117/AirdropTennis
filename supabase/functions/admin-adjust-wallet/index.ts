// Admin manual credit adjustment. Verifies admin JWT, then runs admin_adjust_wallet via service role.
// Deploy: Edge Functions → admin-adjust-wallet (JWT verification ON)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AdjustBody = {
  userId?: string;
  amount?: number;
  direction?: string;
  reason?: string;
  note?: string | null;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function mapRpcError(message: string): { code: string; status: number } {
  const m = message.toLowerCase();
  if (m.includes("not_authenticated")) return { code: "not_authenticated", status: 401 };
  if (m.includes("permission_denied")) return { code: "permission_denied", status: 403 };
  if (m.includes("invalid_amount")) return { code: "invalid_amount", status: 400 };
  if (m.includes("invalid_direction")) return { code: "invalid_direction", status: 400 };
  if (m.includes("reason_required")) return { code: "reason_required", status: 400 };
  if (m.includes("note_required_for_other")) return { code: "note_required_for_other", status: 400 };
  if (m.includes("user_not_found")) return { code: "user_not_found", status: 404 };
  if (m.includes("insufficient_balance")) return { code: "insufficient_balance", status: 400 };
  if (m.includes("could not find the function") || m.includes("admin_adjust_wallet")) {
    return { code: "rpc_not_deployed", status: 503 };
  }
  return { code: "adjust_failed", status: 500 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) {
      return jsonResponse({ error: "not_authenticated", code: "not_authenticated" }, 401);
    }

    const body = (await req.json()) as AdjustBody;
    const { userId, amount, direction, reason, note } = body;

    if (!userId || amount == null || !direction || !reason) {
      return jsonResponse({ error: "invalid_amount", code: "invalid_amount" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData?.user) {
      return jsonResponse({ error: "not_authenticated", code: "not_authenticated" }, 401);
    }

    const adminId = authData.user.id;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: adminProfile, error: adminProfileError } = await admin
      .from("profiles")
      .select("role, academy_id")
      .eq("id", adminId)
      .single();

    if (adminProfileError || !adminProfile || adminProfile.role !== "admin") {
      return jsonResponse({ error: "permission_denied", code: "permission_denied" }, 403);
    }

    // Run RPC as service role but pass admin JWT context for auth.uid() inside the function.
    const rpcClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data, error } = await rpcClient.rpc("admin_adjust_wallet", {
      p_user_id: userId,
      p_amount: amount,
      p_direction: direction,
      p_reason: reason,
      p_note: note ?? null,
    });

    if (error) {
      console.error("admin_adjust_wallet RPC failed:", error);
      const mapped = mapRpcError(error.message || "");
      return jsonResponse(
        {
          error: mapped.code === "rpc_not_deployed"
            ? "Admin credit adjustment is not set up. Run migration 018 in Supabase SQL Editor."
            : error.message || mapped.code,
          code: mapped.code,
        },
        mapped.status
      );
    }

    const row = Array.isArray(data) ? data[0] : data;
    return jsonResponse({
      transaction_id: row?.transaction_id,
      balance_before: row?.balance_before,
      balance_after: row?.balance_after,
      delta: row?.delta,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "adjust_failed";
    console.error("admin-adjust-wallet error:", message);
    const mapped = mapRpcError(message);
    return jsonResponse({ error: message, code: mapped.code }, mapped.status);
  }
});
