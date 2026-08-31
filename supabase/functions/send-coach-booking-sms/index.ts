// Supabase Edge Function: when a booking is assigned to a coach, send SMS to the coach and to the student.
// Triggered by a Database Webhook on `bookings` INSERT (with coach_id) or UPDATE (when coach_id is set).
// - Coach receives: "You've been assigned: [student] at [location] on [when]."
// - Student receives: "Booking confirmed."
// Requires: Twilio env secrets TWILLIO_ACCOUNT_SID, TWILLIO_AUTH_TOKEN, TWILLIO_PHONE.
// Coach and student must have `phone` set in `profiles` (E.164) to receive SMS.

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
  coach_id?: string | null;
  location_id?: string;
  start_time?: string;
  end_time?: string;
  service_name?: string | null;
}

const sydneyOpts = { timeZone: "Australia/Sydney" as const };

function formatSydneyTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-AU", { ...sydneyOpts, dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function formatSydneyDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-AU", { ...sydneyOpts, dateStyle: "medium" });
  } catch {
    return iso;
  }
}

function formatSydneyTimeOnly(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-AU", { ...sydneyOpts, hour: "numeric", minute: "2-digit" });
  } catch {
    return iso;
  }
}

/** Single line date + time for calendar (e.g. "15 Jan 2026, 8:00 am") */
function formatSydneyDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString("en-AU", { ...sydneyOpts, day: "numeric", month: "short", year: "numeric" });
    const time = d.toLocaleTimeString("en-AU", { ...sydneyOpts, hour: "numeric", minute: "2-digit" });
    return `${date}, ${time}`;
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
    if (payload.table !== "bookings" || (payload.type !== "INSERT" && payload.type !== "UPDATE")) {
      return new Response(JSON.stringify({ ok: true, skipped: "not a booking insert/update" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const record = payload.record as BookingRecord;
    const oldRecord = payload.old_record as BookingRecord | null;

    const coachId = record.coach_id ?? null;
    if (!coachId) {
      return new Response(JSON.stringify({ ok: true, skipped: "no coach_id on booking" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (payload.type === "UPDATE" && oldRecord?.coach_id === coachId) {
      return new Response(JSON.stringify({ ok: true, skipped: "coach_id unchanged" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

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
    const twilioSid = Deno.env.get("TWILLIO_ACCOUNT_SID");
    const twilioToken = Deno.env.get("TWILLIO_AUTH_TOKEN");
    const twilioPhone = Deno.env.get("TWILLIO_PHONE");

    if (!twilioSid || !twilioToken || !twilioPhone) {
      console.error("Missing env: TWILLIO_ACCOUNT_SID, TWILLIO_AUTH_TOKEN, or TWILLIO_PHONE");
      return new Response(
        JSON.stringify({ ok: false, error: "SMS not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const [coachRes, studentRes, locationRes] = await Promise.all([
      supabase.from("profiles").select("phone, first_name, last_name").eq("id", coachId).single(),
      supabase.from("profiles").select("phone, first_name, last_name, email").eq("id", userId).single(),
      supabase.from("locations").select("name").eq("id", locationId).single(),
    ]);

    const coachPhone = coachRes.data?.phone?.trim();
    if (!coachPhone) {
      console.warn("Coach has no phone in profiles, skipping SMS:", coachId);
      return new Response(JSON.stringify({ ok: true, skipped: "coach has no phone" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const studentName =
      studentRes.data?.first_name || studentRes.data?.last_name
        ? [studentRes.data.first_name, studentRes.data.last_name].filter(Boolean).join(" ")
        : studentRes.data?.email ?? "A student";
    const locationName = locationRes.data?.name ?? "Unknown location";
    const when = formatSydneyTime(startTime);
    const service = serviceName ? ` (${serviceName})` : "";

    const body = [
      `You've been assigned: ${studentName} at ${locationName} on ${when}${service}.`,
      "",
      "To view your upcoming bookings: app.airdroptennis.com",
    ].join("\n");

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
    const basicAuth = btoa(`${twilioSid}:${twilioToken}`);
    const form = new URLSearchParams({
      To: coachPhone,
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
      console.error("Twilio error (coach):", twilioRes.status, errText);
      return new Response(
        JSON.stringify({ ok: false, error: "Twilio send failed", detail: errText }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 502 }
      );
    }

    const twilioData = await twilioRes.json();
    const result: { ok: boolean; coachSid?: string; studentSid?: string; studentSkipped?: boolean } = {
      ok: true,
      coachSid: twilioData.sid,
    };

    // Send booking confirmation to the student (after coach is assigned)
    const studentPhone = studentRes.data?.phone?.trim();
    if (studentPhone) {
      const firstName = studentRes.data?.first_name?.trim() || "there";
      const serviceLabel = serviceName && serviceName.trim() ? serviceName.trim() : "lesson";
      const dateTimeStr = formatSydneyDateTime(startTime);
      const studentBody = [
        "🎾 Booking Confirmed: Airdrop Tennis",
        "",
        `Hi ${firstName}, you're all set for your ${serviceLabel}!`,
        "",
        `📅 ${dateTimeStr}`,
        `📍 ${locationName}`,
        "",
        "To view your upcoming bookings: app.airdroptennis.com",
        "",
        "See you on the court!",
      ].join("\n");
      const studentForm = new URLSearchParams({
        To: studentPhone,
        From: twilioPhone,
        Body: studentBody,
      });
      const studentTwilioRes = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: studentForm.toString(),
      });
      if (studentTwilioRes.ok) {
        const studentData = await studentTwilioRes.json();
        result.studentSid = studentData.sid;
      } else {
        console.error("Twilio error (student):", studentTwilioRes.status, await studentTwilioRes.text());
        // Coach SMS already sent; still return success
      }
    } else {
      result.studentSkipped = true;
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e) {
    console.error("send-coach-booking-sms error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
