// Supabase Edge Function: send SMS to admin AND coach when a user cancels their booking.
// Called from the app after inserting into user_cancellation_history.
// - Admin receives: "A booking has been cancelled by the user. [Time] at [Location]. [Student name]."
// - Coach receives: same message (if coach was assigned and has phone in profiles).
// Requires: ADMIN_PHONE, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CancellationItem {
  user_id?: string;
  student_name?: string;
  location_name: string;
  start_time: string;
  coach_id?: string | null;
}

const sydneyOpts = { timeZone: "Australia/Sydney" as const };

function formatSydneyDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString("en-AU", {
      ...sydneyOpts,
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const time = d.toLocaleTimeString("en-AU", {
      ...sydneyOpts,
      hour: "numeric",
      minute: "2-digit",
    });
    return `${date}, ${time}`;
  } catch {
    return iso;
  }
}

async function sendSms(
  twilioUrl: string,
  basicAuth: string,
  twilioPhone: string,
  to: string,
  body: string
): Promise<boolean> {
  const form = new URLSearchParams({
    To: to,
    From: twilioPhone,
    Body: body,
  });
  const res = await fetch(twilioUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  if (res.ok) return true;
  console.error("Twilio error:", res.status, await res.text());
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("send-user-cancellation-sms invoked, method:", req.method);

  try {
    const body = await req.json();
    const item = body?.item as CancellationItem | null;
    console.log("send-user-cancellation-sms received:", JSON.stringify({ hasItem: !!item, location_name: item?.location_name, start_time: item?.start_time, coach_id: item?.coach_id }));

    if (!item?.location_name || !item?.start_time) {
      console.warn("send-user-cancellation-sms skipped: missing required fields");
      return new Response(
        JSON.stringify({ ok: true, sent: 0, skipped: "missing item fields" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhone = Deno.env.get("TWILIO_PHONE");
    const adminPhone = Deno.env.get("ADMIN_PHONE");

    if (!twilioSid || !twilioToken || !twilioPhone) {
      console.error("Missing env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_PHONE");
      return new Response(
        JSON.stringify({ ok: false, error: "SMS not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let studentName = item.student_name?.trim();
    if (!studentName && item.user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("id", item.user_id)
        .single();
      studentName = profile?.first_name || profile?.last_name
        ? [profile.first_name, profile.last_name].filter(Boolean).join(" ")
        : profile?.email ?? "A student";
    }
    studentName = studentName || "A student";
    const locationName = item.location_name?.trim() || "Unknown location";
    const dateTime = formatSydneyDateTime(item.start_time);
    const message = [
      `A booking has been cancelled by the user.`,
      ``,
      `${dateTime} at ${locationName}`,
      `Student: ${studentName}`,
      ``,
      "app.airdroptennis.com",
    ].join("\n");

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
    const basicAuth = btoa(`${twilioSid}:${twilioToken}`);

    let adminSent = false;
    let coachSent = false;

    // 1. Send to admin
    if (adminPhone?.trim()) {
      adminSent = await sendSms(twilioUrl, basicAuth, twilioPhone, adminPhone.trim(), message);
      console.log("User cancellation SMS to admin:", adminSent ? "sent" : "failed");
    } else {
      console.warn("ADMIN_PHONE not set, skipping admin SMS");
    }

    // 2. Send to coach (if assigned and has phone)
    if (item.coach_id) {
      const { data: coachProfile } = await supabase
        .from("profiles")
        .select("phone")
        .eq("id", item.coach_id)
        .single();

      const coachPhone = coachProfile?.phone?.trim();
      if (coachPhone) {
        coachSent = await sendSms(twilioUrl, basicAuth, twilioPhone, coachPhone, message);
        console.log("User cancellation SMS to coach:", coachSent ? "sent" : "failed");
      } else {
        console.warn("Coach has no phone in profiles, skipping coach SMS:", item.coach_id);
      }
    }

    const sentCount = (adminSent ? 1 : 0) + (coachSent ? 1 : 0);
    return new Response(
      JSON.stringify({
        ok: true,
        sent: sentCount,
        admin_sent: adminSent,
        coach_sent: coachSent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e) {
    console.error("send-user-cancellation-sms error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
