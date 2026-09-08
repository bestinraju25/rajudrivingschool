-- RAJU DRIVING SCHOOL - LEGACY BOOKING COLUMN REPAIR
-- Fixes older bookings tables that still have NOT NULL legacy columns
-- such as start_at/end_at/instructor_id while the new calendar uses
-- requested_start/requested_end/assigned_instructor_id.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='start_at') THEN
    ALTER TABLE public.bookings ALTER COLUMN start_at DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='end_at') THEN
    ALTER TABLE public.bookings ALTER COLUMN end_at DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='instructor_id') THEN
    ALTER TABLE public.bookings ALTER COLUMN instructor_id DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='fee_amount') THEN
    ALTER TABLE public.bookings ALTER COLUMN fee_amount DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='notes') THEN
    ALTER TABLE public.bookings ALTER COLUMN notes DROP NOT NULL;
  END IF;
END $$;

-- Keep legacy columns synchronised when they exist, so older admin/reporting
-- queries continue to see the same booking date, instructor, fee and notes.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='start_at')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='requested_start') THEN
    EXECUTE $fn$
      create or replace function public.sync_legacy_booking_columns()
      returns trigger
      language plpgsql
      security definer
      set search_path = public
      as $body$
      begin
        new.start_at := new.requested_start;
        if new.requested_end is not null then new.end_at := new.requested_end; end if;
        if new.assigned_instructor_id is not null then new.instructor_id := new.assigned_instructor_id; end if;
        if new.class_fee is not null then new.fee_amount := new.class_fee; end if;
        new.notes := coalesce(new.student_note,new.admin_note,new.notes);
        return new;
      end;
      $body$;
    $fn$;

    drop trigger if exists sync_legacy_booking_columns on public.bookings;
    create trigger sync_legacy_booking_columns
      before insert or update on public.bookings
      for each row execute function public.sync_legacy_booking_columns();
  END IF;
END $$;

notify pgrst, 'reload schema';
select 'Raju Driving School legacy booking column repair completed successfully.' as message;
