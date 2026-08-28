-- Today's scripture is editorially optional. A published prayer topic remains
-- valid and participant screens simply omit the scripture block when both
-- scripture fields are empty.

alter table public.daily_prayers
  drop constraint if exists daily_prayers_scripture_reference_check,
  drop constraint if exists daily_prayers_scripture_text_check,
  alter column scripture_reference drop not null,
  alter column scripture_text drop not null;

update public.daily_prayers
set scripture_reference = nullif(trim(scripture_reference), ''),
    scripture_text = nullif(trim(scripture_text), '');

alter table public.daily_prayers
  add constraint daily_prayers_scripture_reference_check
    check (scripture_reference is null or char_length(scripture_reference) between 1 and 80),
  add constraint daily_prayers_scripture_text_check
    check (scripture_text is null or char_length(scripture_text) between 1 and 1200);
