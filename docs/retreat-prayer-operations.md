# 수련회 공동기도 플랫폼 운영 안내

## 공개 경로와 보안 경계

- 참여자 화면: `/retreat-prayer/`
- 관리자 화면: `/retreat-prayer/admin/`
- 기존 사이트 메뉴, 홈페이지, 사이트맵에는 이 경로를 추가하지 않는다.
- 두 화면 모두 `noindex, nofollow, noarchive` 메타를 사용한다.
- **특정 URL만 아는 방식은 비공개 인증이 아니라 unlisted 공개**다. URL을 전달받은 사람은 참여자 화면에 들어올 수 있다.
- 관리자 화면과 API는 URL 비공개 여부와 무관하게 Supabase Auth, RLS, 대표 관리자 권한으로 보호한다.

운영 Supabase 설정이 없으면 공개 호스트에서 앱은 샘플 데이터로 열리지 않고 “운영 연결이 필요합니다” 상태로 중단된다. 로컬호스트에서만 화면 검수를 위한 미리보기 데이터가 허용된다.

## 1. Supabase 프로젝트 준비

1. 다른 서비스의 `public` 테이블과 이름·권한이 충돌하지 않도록 이 플랫폼 전용 Supabase 프로젝트를 만들고 CLI를 연결한다.
2. `supabase/migrations/20260828010000_retreat_prayer.sql`을 적용한다.
3. Auth 설정에서 Anonymous Sign-ins를 켠다. 일반 사용자는 로그인 UI를 보지 않지만, private Realtime Presence 채널에 들어가기 위한 최소 권한 토큰으로만 사용한다.
4. 이메일 Admin 로그인을 켜고 Site URL과 Redirect URL에 운영 도메인의 `/retreat-prayer/admin/`을 등록한다.
5. Admin 초대 메일이 실제로 도착하도록 운영 SMTP와 발신 도메인을 설정하고 staging 초대를 1회 검증한다.
6. Edge Function 두 개를 배포한다.

```powershell
supabase db push
supabase functions deploy submit-prayer-request
supabase functions deploy manage-admin
```

## 2. Edge Function 환경 변수

`SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`는 Supabase Edge Function 기본 환경에서 제공된다. 아래 값은 별도로 설정한다.

```powershell
supabase secrets set ALLOWED_ORIGINS=https://thelogos.dev,https://www.thelogos.dev
supabase secrets set PRAYER_RATE_LIMIT_SALT=<32자 이상의 무작위 비밀값>
supabase secrets set ADMIN_REDIRECT_URL=https://thelogos.dev/retreat-prayer/admin/
```

`PRAYER_RATE_LIMIT_SALT`는 브라우저 세션과 보조 IP 정보를 원문으로 저장하지 않고 단방향 해시하는 데 사용한다. 이 값과 service-role key를 `static/` 아래에 두면 안 된다.

## 3. 첫 대표 관리자 등록

Supabase Auth Dashboard에서 첫 이메일 사용자를 만든 뒤 SQL Editor에서 해당 사용자를 대표 관리자로 연결한다.

```sql
insert into public.admin_profiles (user_id, display_name, role, active)
select id, '대표 관리자', 'owner', true
from auth.users
where email = 'owner@example.com';
```

이후 Admin 추가는 대표 관리자가 운영 콘솔에서 초대한다. 데이터베이스 트리거가 활성 Admin 5명 제한과 마지막 대표 관리자 비활성화 방지를 최종적으로 강제한다.
초대받은 Admin은 이메일 링크로 `/retreat-prayer/admin/`에 들어와 10자 이상의 첫 비밀번호를 설정한 뒤 콘솔을 사용한다. 초대 메타데이터는 이 안내 화면을 고르는 용도일 뿐이며, 실제 권한은 `admin_profiles`의 활성 상태와 RLS가 판단한다.
첫 로그인 후 **오늘의 콘텐츠 → 기본 일정**에서 공동체 이름, 실제 수련회 날짜, 정기 공동기도 시각을 먼저 저장한다. 초기 migration은 잘못된 D-Day가 공개되지 않도록 수련회 날짜를 비워 둔다.

## 4. 정적 앱 연결

`static/retreat-prayer/config.example.js`를 참고해 `static/retreat-prayer/config.js`의 공개 설정만 채운다.

```js
supabaseUrl: "https://PROJECT_REF.supabase.co",
supabasePublishableKey: "sb_publishable_...",
```

publishable key는 브라우저에 노출되는 공개 키이며, 실제 데이터 접근 권한은 RLS가 결정한다. service-role key는 절대 이 파일에 넣지 않는다.

## 5. 공개 전 검수

- `npm run test:retreat-prayer`
- `bin\\hugo.exe --gc --minify`
- disposable 또는 staging DB에서 `supabase/tests/retreat_prayer_security.test.sql` 실행
- 참여자 화면에서 Presence 동기화 전 숫자가 표시되지 않는지 확인
- 브라우저 두 개와 여러 탭에서 같은 session id가 중복 집계되지 않는지 확인
- 기도제목이 제출 직후 공개되지 않고 승인 대기열에만 나타나는지 확인
- 두 브라우저에서 승인한 제목이 즉시 나타나고, 숨김·삭제한 제목은 열린 목록과 집중 기도 화면에서도 즉시 제거되는지 확인
- 네트워크를 끊은 동안 기도제목 공개 상태를 바꾼 뒤 재연결했을 때 RLS를 거친 최신 목록으로 복구되는지 확인
- 일반 사용자가 Admin 테이블, 대기 기도제목, 음원 업로드에 접근할 수 없는지 확인
- 두 Admin의 동시 제어 요청에서 한 명만 lease를 얻는지 확인
- NEXT 중복 클릭은 version mismatch로 거부되는지 확인
- 운영 Supabase 설정을 제거한 공개 호스트에서 샘플 데이터 대신 구성 오류 화면이 나오는지 확인
- WebGL, JavaScript 오류, 네트워크 끊김, 음악 실패가 기도 콘텐츠 자체를 가리지 않는지 확인

## 6. 운영 중 대응

- 관리자 제어권 lease는 30초이며 콘솔이 20초마다 갱신한다. 제어 Admin이 이탈하면 다른 Admin이 만료 후 제어권을 요청할 수 있다.
- Presence 숫자는 로그인된 인원이나 실제 사람 수가 아니라 heartbeat로 동기화된 **고유 활성 브라우저 세션 수**다.
- 기도제목 원문은 승인 전에 관리자만 볼 수 있고, 기본 공개 만료 시점은 제출 후 180일이다. 만료된 행은 공개 RLS에서 즉시 제외된다. `purge_expired_prayer_requests()`를 service-role 일일 일정 작업으로 등록하면 만료 기도제목과 수명이 지난 제출 제한 해시를 함께 물리 삭제한다. 이 일정 작업 등록은 공개 전 필수 검수 항목이며, 교회 개인정보 정책에 맞게 기도제목 보관 기간을 더 짧게 조정할 수 있다.
- YouTube 또는 음원이 실패해도 기도 진행은 계속한다. 참여자의 로컬 음량과 음소거 선택은 Admin이 강제로 바꾸지 않는다.
- 긴급 종료, 승인, Admin 변경 등의 주요 작업은 `admin_audit`에 남긴다.
- 공개 콘텐츠 변경은 본문이 없는 `content_revisions` 숫자만 Realtime으로 알린다. 참여자 브라우저는 이 신호나 재연결을 받으면 승인된 기도제목과 오늘의 말씀을 RLS를 통해 다시 조회한다.

## MVP 이후 후보

수련회 이후 감사 내용이나 “기도 이후 이야기”는 별도 동의·보관 정책을 정한 뒤 추가한다. 현재 화면에는 미래 기능을 비활성 메뉴로 노출하지 않는다.
