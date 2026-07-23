# Cloudflare media setup

## Recommended separation

Use separate resources for development and production.

| Resource | Purpose | Public? |
|---|---|---:|
| Product media R2 bucket | Product images and optional public downloadable assets | Yes through a custom media domain |
| Private documents R2 bucket | Tax certificates, receipts and internal files | No |
| Cloudflare Stream | Product videos requiring encoding/adaptive playback | Playback public or signed based on policy |

## Public product object keys

```text
products/{product_id}/images/{uuid}-{sanitized_filename}
```

The starter never accepts an arbitrary bucket key from the browser. It generates a product-scoped key on the server, signs a five-minute PUT URL and verifies the object with HEAD before inserting `product_media` metadata.

## Example R2 CORS policy

Edit both origins before applying `r2-cors.example.json`. Production should not use `*` for upload origins. The browser upload must send every header returned in `requiredHeaders`—currently `Content-Type` and `Cache-Control`—with exactly the same values used for signing.

## Cache and replacement strategy

Object keys are immutable/unique, so product images can use a long CDN cache. Replacing an image creates a new object key; update database metadata first, then delete the old object asynchronously after references are confirmed.

## Private documents

Do not store tax certificates or receipts under the public media base URL. Keep private object keys in database records and generate short-lived signed download URLs only after a server-side permission check.

## Stream lifecycle

1. Verified manager/admin asks the server for a one-time direct upload URL.
2. Server creates a pending `product_media` row with the Stream UID.
3. Browser uploads directly to Stream.
4. A verified webhook updates status/playback/poster/duration.
5. Storefront shows video only when status is `ready`.

The starter contains steps 1–3. Webhook verification/status synchronization remains production work.
