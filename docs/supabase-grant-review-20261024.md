# Supabase GRANT 변경 검토 — 2026-10-24

검토 기준: `main` 커밋 `1a77c4cd74501ce266492c0a1532d2d130180711`.
`supabase/migrations`의 SQL 15개 전체, SQL 테스트 3개, 브라우저 `backend.js`,
`submit-prayer-request` 및 `manage-admin` Edge Function의 DB 호출을 대조했다.
운영 DB에 접속하거나 권한을 변경하지 않았다. 운영 DB의 실제 ACL 및 수동 변경 여부는 확인되지 않음.

## 결론

기존 테이블의 ACL은 10월 30일 변경으로 소급 철회되지 않는다.
기존 환경이 정상이라면 이 변경만으로 즉시 중단된다고 볼 근거가 없다.
반면 자동 GRANT 없이 전체 마이그레이션을 실행하면, 초기 11개 테이블 중
`prayer_requests`, `admin_profiles`, `admin_audit`에 필요한 `service_role`
명시적 GRANT가 없어 Edge Function이 실패한다. 초대 nonce 테이블까지 총 12개이다.

- 기도 접수: quota RPC는 성공하지만 요청 INSERT / `returning id,status`가 `42501`로 실패 → Edge Function 503.
- 관리자 관리: 최초 호출자 프로필 SELECT가 `42501`로 실패 → 코드가 owner 조회 실패를 403으로 반환한다.
  SELECT만 보완해도 초대 INSERT/보상 DELETE, 활성화 UPDATE, 감사 INSERT가 뒤이어 실패한다.
- `service_role`의 BYPASSRLS는 테이블 GRANT를 대체하지 않는다.

`20260828020000...security_validation.sql`과 기존 security 테스트는 위 누락 상태에서도 통과했다.
RLS 활성화와 일부 민감 권한의 부재는 검증하지만, 전체 필수 권한·객체 존재를 포괄하지 않는다.
이전 마이그레이션을 수정하지 않고 새 보완 마이그레이션을 추가했다.

## 전체 테이블 대조

S/I/U/D = SELECT/INSERT/UPDATE/DELETE. `컬럼 S/U`는 SQL에 열거된 컬럼만 허용한다.
authenticated에는 Supabase Anonymous Auth 참여자도 포함되므로 관리자와 동일하지 않다.
service 열의 `없음`은 **자동 GRANT가 없는 깨끗한 설치에서 명시적 권한 없음**이라는 뜻이다.
기존 프로젝트에서 이미 부여된 service 권한을 철회하자는 의미가 아니다.

| 테이블 | anon | authenticated | RLS 조건 / 쓰기 경로 | service_role: 수정 전 → 후 |
|---|---|---|---|---|
| app_settings | 공개 컬럼 S | 동일 + 설정 4컬럼 U | 읽기 전체, U는 활성 관리자 | 없음 → 유지; 직접 호출 없음 |
| content_revisions | id/revision/updated_at S | 동일 | 읽기 전체; 소유자 권한 트리거 갱신 | 없음 → 유지 |
| admin_profiles | 없음 | S | 자기 자신 또는 활성 owner만 읽기; 서버가 관리 | 없음 → S/I/U/D |
| daily_prayers | 공개 컬럼 S | 동일 + I/U | 공개는 published; 활성 관리자 전체 읽기/I/U | 없음 → 유지 |
| prayer_programs | 없음 | S | 활성 관리자만; I/U 정책은 있지만 직접 GRANT 없음, RPC로 저장 | 없음 → 유지 |
| live_sessions | 공개 컬럼 S | 동일 | 전체 읽기; 제어는 관리자 검사 및 lease/version 검사의 RPC | 없음 → 유지 |
| live_controller_leases | 없음 | 없음 | 정책 없음; 관리자 검사하는 소유자 권한 RPC 전용 | 없음 → 유지 |
| prayer_requests | 공개 7컬럼 S | 동일 + status/approved_at U | approved & 미만료 공개; 활성 관리자는 전체 읽기/U | 없음 → S/I |
| media_assets | 공개 컬럼 S | 동일 + I/U | active 공개; 활성 관리자 전체 읽기/I/U; 삭제는 RPC | 없음 → 유지 |
| admin_audit | 없음 | S | 활성 관리자 읽기; 소유자 권한 트리거/RPC 또는 Edge에서 기록 | 없음 → I |
| submission_rate_limits | 없음 | 없음 | 정책 없음; service 전용 SECURITY DEFINER quota RPC로 접근 | 없음 → 유지 |
| admin_invite_nonces | 없음 | 없음 | 정책 없음; service 직접 접근 및 소유자 권한 Auth hook | S/I/D → 유지 |

기도 요청 공개 컬럼은 `id,display_name,is_anonymous,body,status,approved_at,created_at`이다.
`submitted_session_hash`, `submitted_ip_hash`, `public_consent`, `approved_by`, `expires_at`,
`updated_at`의 브라우저 SELECT를 늘리지 않는다. 관리자도 해시를 직접 읽을 필요가 없다.
`prayer_programs`의 직접 I/U, lease/rate-limit 테이블의 service GRANT는 추가하지 않는다.
관련 SECURITY DEFINER 함수는 테이블 소유자 권한으로 실행되며 브라우저/RPC 호출자의
테이블 GRANT를 필요로 하지 않는다. Storage/Auth/Realtime 스키마는 이번 기본 권한 변경 범위 밖이다.

## 최소 수정 SQL

파일: `supabase/migrations/20261024010000_retreat_prayer_explicit_service_grants.sql`

```sql
grant select, insert on public.prayer_requests to service_role;
grant select, insert, update, delete on public.admin_profiles to service_role;
grant insert on public.admin_audit to service_role;
```

테이블별 실제 작업에 필요한 권한만 추가한다. 브라우저 권한·RLS·기본 권한은 변경하지 않는다.
`admin_audit.id`는 `GENERATED ALWAYS AS IDENTITY`이므로 이 INSERT에는 별도 sequence USAGE
추가가 필요하지 않다. 자동 sequence 권한이 없는 재생성 테스트에서 감사 INSERT를 직접 검증했다.
기존 프로젝트의 넓은 service 권한이 존재하면 위 GRANT는 ACL을 바꾸지 않는다.

## 재현 및 검증

```bash
npm ci --prefix tests/db --ignore-scripts
npm test --prefix tests/db
npm run test:retreat-prayer
```

| 시나리오 | 설정 | 수정 전 | 수정 후 |
|---|---|---|---|
| 신규 배포 | 자동 테이블/sequence 권한 없는 새 DB에 전체 마이그레이션 | 서비스 SQL 7개에서 42501 재현, 기존 security 테스트는 통과 | 전체 마이그레이션 및 SQL 테스트 통과 |
| DB 재생성 | 옛 기본 권한과 probe 테이블 생성 후 public 삭제·재생성, 기본 권한 철회 후 전체 재실행 | 동일 7개 실패 재현 | 통과; 불필요한 service 테이블 권한 없음 |
| 기존 DB 업그레이드 | 기존 자동 GRANT 환경에 과거 마이그레이션 적용, 미래 객체 기본 권한만 철회 | 기존 ACL 유지 확인 | 추가 마이그레이션 전후 전체 ACL 동일; 동작 통과 |

신규 테스트 `supabase/tests/retreat_prayer_grants.test.sql`:

- 모든 public 테이블의 존재 목록 및 RLS 활성화 검사. 이후 신규 테이블 추가 시 접근 계약 업데이트 필요.
- 12개 테이블의 모든 컬럼 × anon/authenticated × S/I/U/REFERENCES 유효 권한 대조.
  테이블 DELETE/TRUNCATE/REFERENCES/TRIGGER 금지도 검사. 상속된 테이블 GRANT까지 포함한다.
- 각 필요한 service 작업 권한 검사 및 역할 전환 후 실제 INSERT/SELECT/UPDATE/DELETE 실행.
- anon/익명 인증 참여자는 미승인·숨김·만료 기도 요청, 비공개 일일기도, 비활성 미디어 접근 불가.
- 일반 참여자는 관리자 프로필/감사/프로그램 비공개, 초대 nonce·제출 해시·제어 lease·rate limit 접근 차단.
- 일반 참여자의 승인 UPDATE는 0행, 관리자 승인 및 감사 트리거는 성공. 관리자 자기 프로필 / owner의 관리자 목록 RLS 검사.
- 관리자 template RPC가 직접 INSERT GRANT 없이 성공하는지 검사.
- 기존 security 및 quota SQL 테스트도 각 시나리오에서 실행.
- 브라우저 ACL 및 모든 RLS 정책의 수정 전후 동일성, 보완 migration 재실행의 멱등성 검사.
- 신규 설치/재생성에서 service CRUD는 위 세 테이블 및 기존 nonce 권한에만 존재하는지 정확 대조.
- JavaScript 기존 테스트 95개 통과.

회귀 runner는 PGlite 0.5.11의 실제 PostgreSQL 18.6 엔진에서 실행했다.
Supabase의 Auth/Storage/Realtime/Cron 카탈로그는 `tests/db/platform-fixture.sql`의 최소 fixture다.
`pgcrypto`는 실제 확장이며 `pg_cron` 확장 생성문 1개만 fixture로 대체한다.
권한·RLS·함수·트리거는 SQL 실행으로 검증했지만, Supabase CLI `db reset` 자체나
PostgREST HTTP 응답, JWT 검증, Auth 메일/훅, Realtime 전달, Cron 실행은 검증하지 않았다.
저장소 설정은 PostgreSQL 17이므로 **운영 버전·통합 환경까지 검증 완료로 판단할 수 없다**.
GitHub Actions에 독립적인 DB 권한 회귀 workflow를 추가했다.

## 배포 전 남은 확인

기존 정상 프로젝트에서는 대량 GRANT나 REVOKE, public 전체 기본 권한 복구를 실행할 이유가 없다.
새 보완 마이그레이션은 기존 권한이 이미 있으면 실질적으로 변경하지 않는다.
운영과 같은 PostgreSQL 17의 일회용 Supabase 환경에서 아래 순서로 최종 확인한다.
운영 DB를 reset하지 않는다.

1. **신규 프로젝트**: 자동 GRANT를 끈 일회용 프로젝트에서 전체 migration을 적용한다.
2. **재생성**: 저장소의 임시 복사본에만 모든 migration보다 앞선 시험용 SQL을 추가한다.
   아래 SQL이 테이블 생성 **전에** 실행되도록 하고 `supabase db reset --local`을 실행한다.
   reset 직전에만 DB 설정을 변경하면 reset으로 그 설정이 사라질 수 있으므로 이 순서가 중요하다.

```sql
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;
```

3. PostgreSQL 소유자 연결로 `psql -v ON_ERROR_STOP=1 -f supabase/tests/retreat_prayer_grants.test.sql`
   및 기존 두 SQL 테스트를 실행한다. 시험용 DB는 데이터/관리자가 비어 있는 상태로 사용한다.
4. 테스트용 Edge Function과 브라우저에서 기도 접수 → 관리자 승인 → 공개 목록 반영,
   owner의 관리자 목록/초대/비활성화/활성화 및 감사 기록을 확인한다.
5. 승인 전 본문·제출 해시·관리자 감사가 참여자 REST 응답과 Realtime으로 노출되지 않는지 확인한다.
   실제 이메일 초대는 테스트 수신자에게만 실행한다.

## 출처

확인일 2026-10-24. 이메일 원문은 별도로 열람하지 않았으며 정책 내용은 공식 공지로 확인했다.

- Supabase 공식 변경 공지(게시 2026-04-28, 기존 프로젝트 적용 2026-10-30):
  https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
- 검토 기준 전체 마이그레이션:
  https://github.com/kimdaeyoung12/TheLogos/tree/1a77c4cd74501ce266492c0a1532d2d130180711/supabase/migrations
- 기도 요청 접수의 service 호출:
  https://github.com/kimdaeyoung12/TheLogos/blob/1a77c4cd74501ce266492c0a1532d2d130180711/supabase/functions/submit-prayer-request/index.ts
- 관리자 관리의 service 호출:
  https://github.com/kimdaeyoung12/TheLogos/blob/1a77c4cd74501ce266492c0a1532d2d130180711/supabase/functions/manage-admin/index.ts
