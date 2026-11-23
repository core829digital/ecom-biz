# Deployment

The recommended setup is a single Linux server (or VM) running Docker Compose,
with Caddy in front for automatic HTTPS. It scales vertically well into
thousands of stores; for more, run several `app` containers behind the proxy.
The app is stateless apart from uploads, so use S3/R2 storage when you run
more than one instance.

## 1. DNS

Assuming your platform domain is `example.com`:

| Record | Name | Value |
|---|---|---|
| A | `app.example.com` | your server IP |
| A | `*.example.com` | your server IP (store subdomains) |

Merchants connecting their own domain add a `CNAME` to `CUSTOM_DOMAIN_TARGET`
(defaults to `STOREFRONT_ROOT_DOMAIN`) plus the TXT record shown in their admin.

## 2. Environment

```bash
cp .env.example .env
```

Set at least:

```
PLATFORM_NAME="Your Brand"
APP_URL="https://app.example.com"
STOREFRONT_ROOT_DOMAIN="example.com"
STOREFRONT_PROTOCOL="https"
APP_SECRET="<openssl rand -hex 32>"
POSTGRES_PASSWORD="<strong password>"     # used by docker-compose
SMTP_URL="smtps://user:pass@smtp.provider.com:465"
EMAIL_FROM="no-reply@example.com"
CRON_SECRET="<openssl rand -hex 24>"
ENABLE_TEST_GATEWAY="false"
SEED_ADMIN_EMAIL="you@example.com"
SEED_ADMIN_PASSWORD="<strong password>"
```

Add the Stripe keys when you're ready to accept cards (see README → Stripe setup).

## 3. Start

```bash
docker compose up -d --build
```

The `migrate` service applies database migrations and seeds the default plans
(and your platform admin) before `app` starts. The app listens on port 3000 and
exposes `/api/health` (used by the container healthcheck).

## 4. HTTPS with Caddy

`deploy/Caddyfile` issues certificates automatically for the app host, every
store subdomain and every **verified** custom domain. On-demand TLS asks
`/api/tls/check` before issuing a certificate, so nobody can make your server
request certificates for arbitrary domains.

Add Caddy to the compose file:

```yaml
  caddy:
    image: caddy:2
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    volumes:
      - ./deploy/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
    depends_on: [app]
```

Then add `caddy_data:` under `volumes:` and remove the `ports` mapping from `app`.

## 5. Scheduled jobs

Add these to the server's crontab (or any scheduler):

```
*/5 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://app.example.com/api/cron/webhooks
0 * * * *   curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://app.example.com/api/cron/cleanup
*/20 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://app.example.com/api/cron/recovery
```

## 6. Backups

- Database: `docker compose exec db pg_dump -U commerce commerce | gzip > backup-$(date +%F).sql.gz`
  daily, copied off the server.
- Uploads: back up the `uploads` volume, or use S3/R2 with versioning.

## Updating

```bash
git pull
docker compose up -d --build
```

Migrations run automatically through the `migrate` service.
