# Authentication and User Data Isolation

## Sign-in and registration

Auth.js provides open social sign-in through configured GitHub and Google providers. The first successful OAuth sign-in
creates the user automatically; there is no administrator role, approval queue, shared admin token, or operator API.
Sessions are opaque, database-backed Auth.js sessions delivered through secure HTTP-only cookies.

### Optional local test login

<!-- contract: AUTH-TEST-001 -->

Auth.js Credentials provider cannot be combined with this application's database-session strategy. For local and test
deployments, setting `AUTH_TEST_CREDENTIALS_ENABLED=true` together with `AUTH_TEST_USERNAME` and `AUTH_TEST_PASSWORD`
enables a small local-login form that creates the same database session and HTTP-only cookie used by Auth.js. With the
flag absent or false, the form is not rendered and the login action refuses access. The repository provides no default
username or password, and production deployments should use social providers instead.

The reverse proxy sends `/api/auth/*` to Dashboard for Auth.js and sends the application `/api/*` routes to Collector.
Collector resolves the same session cookie against PostgreSQL and treats the resulting user ID as the only request scope.

## Village ownership

The application does not verify that a user owns the in-game Clash of Clans village. Application data ownership is still
strict: every village record belongs to the signed-in user, and every export, upgrade, history item, setting, and
notification is reached through that record or another user-owned root.

<!-- contract: AUTH-ISOLATION-001 -->

Two users may register the same normalized player tag. Those registrations are independent records and never share export
history, display settings, upgrade settings, or notifications. One user cannot read, update, or delete another user's
resource by guessing its UUID or numeric ID; such access is reported as not found. A user cannot register the same non-empty
player tag twice within their own account.

## Existing installation migration

Existing villages and database notification channels initially have no user. The first newly created Auth.js user claims
all such legacy records and the previous dashboard group order in one transaction. Later users start empty. This preserves
single-user installations without inventing a permanent administrator account.

## User-owned notification channels

Bark connection details and notification locale are stored per user in PostgreSQL. Notifier only fans out a village event
to channels owned by the same user as that village. There is no global Bark recipient or environment-backed fallback.
