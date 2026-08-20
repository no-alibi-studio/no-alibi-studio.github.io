-- ══════════════════════════════════════════════════════════════
--  no-alibi 회원 + cin 포인트 스키마  (Supabase / Postgres)
--  · 계정 = no-alibi 통합 회원(웹 + 향후 Electron ai_hub 공유)
--  · cin = 내부 포인트(비금전). 적립: 가입·피드백·채택·좋아요받음
--  · 좋아요는 계정당 1개(중복 방지), 피드백은 로그인 필요
--  · cin 값 조정 지점 = public.cin_amount() 함수
-- ══════════════════════════════════════════════════════════════

-- ── works: 작품 카탈로그 ──
create table if not exists public.works (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  created_at timestamptz default now()
);
insert into public.works (slug, title)
  values ('the-limits-of-my-world', '내 세계의 한계')
  on conflict (slug) do nothing;

-- ── profiles: auth 유저별 프로필 + cin 잔액 캐시 ──
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  insta text,
  credit_pref text default 'name' check (credit_pref in ('name','email','insta')),
  cin_balance int not null default 0,          -- 캐시(원장 합계). 표시용
  is_admin boolean not null default false,
  created_at timestamptz default now()
);

-- ── cin_ledger: 모든 cin 거래(원장, append-only) ──
create table if not exists public.cin_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount int not null,                          -- +적립 / -차감
  reason text not null,                         -- signup|feedback|adopted|like_received|spend...
  ref_type text,                                -- feedback|like|...
  ref_id text,                                  -- 참조 대상 식별자
  work_id uuid references public.works(id),
  created_at timestamptz default now()
);
-- 같은 사건 1회만 적립 (가입 1회 / 피드백 1건당 1회 / 채택 1건당 1회)
create unique index if not exists cin_ledger_unique_event
  on public.cin_ledger (user_id, reason, ref_id) where ref_id is not null;
create unique index if not exists cin_ledger_unique_signup
  on public.cin_ledger (user_id, reason) where reason = 'signup';

-- ── feedback: 피드백/방명록 (계정 연결) ──
create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  work_id uuid references public.works(id),
  node text,                                    -- 'NODE 1' | '스토리 전체' | '방명록' 등
  body text not null,
  passages jsonb,                               -- 담은 아이디어 구절 [{quote,node}]
  adopted boolean not null default false,       -- 관리자가 채택 → +50
  approved boolean not null default true,       -- 숨김 처리용
  created_at timestamptz default now()
);

-- ── likes: 계정당 1 좋아요 (PK가 중복 방지) ──
create table if not exists public.likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  feedback_id bigint not null references public.feedback(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, feedback_id)
);

-- ══════════════ cin 적립 로직 ══════════════

-- cin 값 (여기만 바꾸면 됨)
create or replace function public.cin_amount(_reason text) returns int
language sql immutable set search_path = '' as $$
  select case _reason
    when 'signup'        then 5
    when 'feedback'      then 10
    when 'adopted'       then 50
    when 'like_received' then 1
    else 0 end;
$$;

-- 원장 적립 + 잔액 갱신 (중복이면 조용히 무시)
create or replace function public.grant_cin(_user uuid, _amount int, _reason text,
  _ref_type text, _ref_id text, _work uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into cin_ledger(user_id, amount, reason, ref_type, ref_id, work_id)
    values (_user, _amount, _reason, _ref_type, _ref_id, _work);
  update profiles set cin_balance = cin_balance + _amount where id = _user;
exception when unique_violation then
  null;  -- 이미 적립된 사건 → 스킵
end;$$;

-- auth 유저 생성 → profiles 자동 생성
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, display_name)
    values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end;$$;
drop trigger if exists trg_auth_user_created on auth.users;
create trigger trg_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- profiles 생성 → 가입 환영 cin
create or replace function public.on_profile_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.grant_cin(new.id, cin_amount('signup'), 'signup', null, null, null);
  return new;
end;$$;
drop trigger if exists trg_profile_signup on public.profiles;
create trigger trg_profile_signup after insert on public.profiles
  for each row execute function public.on_profile_created();

-- 피드백 작성 → +10 (로그인 사용자만)
create or replace function public.on_feedback_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is not null then
    perform public.grant_cin(new.user_id, cin_amount('feedback'), 'feedback',
                             'feedback', new.id::text, new.work_id);
  end if;
  return new;
end;$$;
drop trigger if exists trg_feedback_award on public.feedback;
create trigger trg_feedback_award after insert on public.feedback
  for each row execute function public.on_feedback_insert();

-- 채택(false→true) → +50 (1회)
create or replace function public.on_feedback_adopted() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.adopted and not old.adopted and new.user_id is not null then
    perform public.grant_cin(new.user_id, cin_amount('adopted'), 'adopted',
                             'feedback', new.id::text, new.work_id);
  end if;
  return new;
end;$$;
drop trigger if exists trg_feedback_adopted on public.feedback;
create trigger trg_feedback_adopted after update of adopted on public.feedback
  for each row execute function public.on_feedback_adopted();

-- 좋아요 추가 → 글쓴이에게 +1 (자기 글 제외)
create or replace function public.on_like_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare _author uuid;
begin
  select user_id into _author from feedback where id = new.feedback_id;
  if _author is not null and _author <> new.user_id then
    insert into cin_ledger(user_id, amount, reason, ref_type, ref_id)
      values (_author, 1, 'like_received', 'like', new.user_id::text||':'||new.feedback_id::text);
    update profiles set cin_balance = cin_balance + 1 where id = _author;
  end if;
  return new;
end;$$;
drop trigger if exists trg_like_award on public.likes;
create trigger trg_like_award after insert on public.likes
  for each row execute function public.on_like_insert();

-- 좋아요 취소 → 글쓴이 -1 (해당 적립만 회수)
create or replace function public.on_like_delete() returns trigger
language plpgsql security definer set search_path = public as $$
declare _author uuid; _rid text;
begin
  select user_id into _author from feedback where id = old.feedback_id;
  _rid := old.user_id::text||':'||old.feedback_id::text;
  if _author is not null then
    delete from cin_ledger where reason = 'like_received' and ref_id = _rid;
    update profiles set cin_balance = cin_balance - 1 where id = _author;
  end if;
  return old;
end;$$;
drop trigger if exists trg_like_revoke on public.likes;
create trigger trg_like_revoke after delete on public.likes
  for each row execute function public.on_like_delete();

-- ══════════════ RLS (행 수준 보안) ══════════════
alter table public.works      enable row level security;
alter table public.profiles   enable row level security;
alter table public.cin_ledger enable row level security;
alter table public.feedback   enable row level security;
alter table public.likes      enable row level security;

-- works: 누구나 읽기
create policy works_read on public.works for select using (true);

-- profiles: 누구나 읽기(공개 이름·기여도), 본인만 수정
create policy profiles_read       on public.profiles for select using (true);
create policy profiles_update_self on public.profiles for update using (auth.uid() = id);

-- cin_ledger: 본인 내역만 열람 (적립/차감은 트리거만 — 클라 insert 불가)
create policy ledger_read_self on public.cin_ledger for select using (auth.uid() = user_id);

-- feedback: 공개글 읽기 / 로그인 사용자가 본인 글 작성 / 관리자만 수정(채택·숨김)
create policy feedback_read        on public.feedback for select using (approved);
create policy feedback_insert_auth on public.feedback for insert with check (auth.uid() = user_id);
create policy feedback_admin_update on public.feedback for update using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- likes: 집계는 누구나 읽기 / 로그인 본인 좋아요만 추가·삭제
create policy likes_read        on public.likes for select using (true);
create policy likes_insert_self on public.likes for insert with check (auth.uid() = user_id);
create policy likes_delete_self on public.likes for delete using (auth.uid() = user_id);

-- ══════════════ 보안 하드닝 ══════════════
-- SECURITY DEFINER 함수는 트리거로만 실행 → REST RPC 노출 차단.
-- (안 하면 anon이 /rest/v1/rpc/grant_cin 으로 cin 무한 적립 가능)
revoke execute on function public.grant_cin(uuid, integer, text, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.on_profile_created() from public, anon, authenticated;
revoke execute on function public.on_feedback_insert() from public, anon, authenticated;
revoke execute on function public.on_feedback_adopted() from public, anon, authenticated;
revoke execute on function public.on_like_insert() from public, anon, authenticated;
revoke execute on function public.on_like_delete() from public, anon, authenticated;
