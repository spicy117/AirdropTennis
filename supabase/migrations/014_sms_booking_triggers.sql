-- Booking SMS triggers via pg_net (when supabase_functions schema is unavailable).
-- Run in Supabase SQL Editor on V2.
-- Requires: pg_net extension, Edge Functions deployed with Verify JWT: OFF.

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_send_booking_sms()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  payload jsonb;
BEGIN
  payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', to_jsonb(NEW),
    'old_record', NULL
  );

  PERFORM net.http_post(
    url := 'https://rozxeqqwxpnfqbyvtvch.supabase.co/functions/v1/send-booking-sms',
    body := payload,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_send_coach_booking_sms()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  payload jsonb;
BEGIN
  payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', to_jsonb(NEW),
    'old_record', CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END
  );

  PERFORM net.http_post(
    url := 'https://rozxeqqwxpnfqbyvtvch.supabase.co/functions/v1/send-coach-booking-sms',
    body := payload,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS booking_insert_admin_sms ON public.bookings;
DROP TRIGGER IF EXISTS booking_insert_coach_sms ON public.bookings;
DROP TRIGGER IF EXISTS booking_update_coach_sms ON public.bookings;

CREATE TRIGGER booking_insert_admin_sms
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_send_booking_sms();

CREATE TRIGGER booking_insert_coach_sms
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_send_coach_booking_sms();

CREATE TRIGGER booking_update_coach_sms
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_send_coach_booking_sms();
