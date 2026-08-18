// Supabase Edge Function: send SMS to students when a rain check is submitted.
// Called from the app after cancelling bookings and refunding; one SMS per student.
// Message: "Due to rain, your upcoming tennis lesson at {location}, {time} has been cancelled..."
// Requires: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RainCheckItem {
  user_id: string;
  location_name: string;
  start_time: string;
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const items = (body?.items ?? []) as RainCheckItem[];
    console.log("send-rain-check-sms called with", items?.length ?? 0, "items");
    if (!Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, skipped: "no items" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhone = Deno.env.get("TWILIO_PHONE");
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

    // Dedupe by user_id so one SMS per student
    const seen = new Set<string>();
    const toSend: RainCheckItem[] = [];
    for (const item of items) {
      if (item?.user_id && !seen.has(item.user_id)) {
        seen.add(item.user_id);
        toSend.push({
          user_id: item.user_id,
          location_name: item.location_name ?? "Unknown location",
          start_time: item.start_time ?? "",
        });
      }
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
    const basicAuth = btoa(`${twilioSid}:${twilioToken}`);
    const userIds = toSend.map((i) => i.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, phone")
      .in("id", userIds);

    const profileByUserId = new Map((profiles ?? []).map((p) => [p.id, p]));
    const withPhone = toSend.filter((i) => profileByUserId.get(i.user_id)?.phone?.trim());
    console.log("profiles with phone:", withPhone.length, "of", toSend.length);
    let sentCount = 0;
    for (const item of toSend) {
      const phone = profileByUserId.get(item.user_id)?.phone?.trim();
      if (!phone) {
        console.log("Skipping user (no phone in profiles):", item.user_id);
        continue;
      }
      console.log("Sending rain check SMS to", phone);
      const dateTime = formatSydneyDateTime(item.start_time);
      const message = [
        `Due to rain, your upcoming tennis lesson at ${item.location_name}, ${dateTime} has been cancelled. You have been refunded for this session.`,
        "",
        "Please re-book your lesson: app.airdroptennis.com",
        "",
        "We apologise for any inconvenience",
      ].join("\n");
      const form = new URLSearchParams({
        To: phone,
        From: twilioPhone,
        Body: message,
      });
      const res = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      });
      if (res.ok) sentCount++;
      else console.error("Twilio error (rain check):", res.status, await res.text());
    }

    const resBody: { ok: boolean; sent: number; total: number; no_phones?: boolean } = {
      ok: true,
      sent: sentCount,
      total: toSend.length,
    };
    if (sentCount === 0 && toSend.length > 0) resBody.no_phones = true;
    console.log("send-rain-check-sms result:", resBody);
    return new Response(
      JSON.stringify(resBody),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e) {
    console.error("send-rain-check-sms error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
