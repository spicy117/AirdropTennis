// Supabase Edge Function: send SMS to admin when a student creates a booking.
// Triggered by a Database Webhook on `bookings` INSERT.
// Requires: Twilio account, env secrets ADMIN_PHONE, TWILLIO_ACCOUNT_SID, TWILLIO_AUTH_TOKEN, TWILLIO_PHONE.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: Record<string, unknown>;
  old_record: Record<string, unknown> | null;
}

interface BookingRecord {
  id?: string;
  user_id?: string;
  location_id?: string;
  start_time?: string;
  end_time?: string;
  service_name?: string | null;
}

function formatSydneyTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-AU", {
      timeZone: "Australia/Sydney",
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as WebhookPayload;
    if (payload.table !== "bookings" || payload.type !== "INSERT") {
      return new Response(JSON.stringify({ ok: true, skipped: "not a booking insert" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const record = payload.record as BookingRecord;
    const userId = record.user_id;
    const locationId = record.location_id;
    const startTime = record.start_time;
    const serviceName = record.service_name;

    if (!userId || !locationId || !startTime) {
      return new Response(JSON.stringify({ ok: false, error: "missing booking fields" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminPhone = Deno.env.get("ADMIN_PHONE");
    const twilioSid = Deno.env.get("TWILLIO_ACCOUNT_SID");
    const twilioToken = Deno.env.get("TWILLIO_AUTH_TOKEN");
    const twilioPhone = Deno.env.get("TWILLIO_PHONE");

    if (!adminPhone || !twilioSid || !twilioToken || !twilioPhone) {
      console.error("Missing env: ADMIN_PHONE, TWILLIO_ACCOUNT_SID, TWILLIO_AUTH_TOKEN, or TWILLIO_PHONE");
      return new Response(
        JSON.stringify({ ok: false, error: "SMS not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const [profileRes, locationRes] = await Promise.all([
      supabase.from("profiles").select("first_name, last_name, email").eq("id", userId).single(),
      supabase.from("locations").select("name").eq("id", locationId).single(),
    ]);

    const studentName =
      profileRes.data?.first_name || profileRes.data?.last_name
        ? [profileRes.data.first_name, profileRes.data.last_name].filter(Boolean).join(" ")
        : profileRes.data?.email ?? "A student";
    const locationName = locationRes.data?.name ?? "Unknown location";
    const when = formatSydneyTime(startTime);
    const service = serviceName ? ` (${serviceName})` : "";

    const body = `New booking: ${studentName} at ${locationName} on ${when}${service}. Please assign a coach.`;

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
    const basicAuth = btoa(`${twilioSid}:${twilioToken}`);
    const form = new URLSearchParams({
      To: adminPhone,
      From: twilioPhone,
      Body: body,
    });

    const twilioRes = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    if (!twilioRes.ok) {
      const errText = await twilioRes.text();
      console.error("Twilio error:", twilioRes.status, errText);
      return new Response(
        JSON.stringify({ ok: false, error: "Twilio send failed", detail: errText }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 502 }
      );
    }

    const twilioData = await twilioRes.json();
    return new Response(
      JSON.stringify({ ok: true, sid: twilioData.sid }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e) {
    console.error("send-booking-sms error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
