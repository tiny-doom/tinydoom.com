# Hammerbound telemetry contract

`POST /api/telemetry` accepts JSON batches of one to twenty events. The whole batch is rejected when any field is invalid.

```json
{
  "game": "Hammerbound",
  "version": "0.1.0-beta",
  "platform": "Windows",
  "install_id": "0123456789abcdef0123456789abcdef",
  "events": [
    { "name": "session_started", "properties": {} }
  ]
}
```

The anonymous decline is the only request without `install_id`. It must contain exactly one event:

```json
{
  "game": "Hammerbound",
  "version": "0.1.0-beta",
  "platform": "Windows",
  "events": [
    {
      "name": "telemetry_consent",
      "properties": { "choice": "declined" }
    }
  ]
}
```

## Events

| Name | Properties |
| --- | --- |
| `telemetry_consent` | `choice`: `accepted` or `declined` |
| `session_started` | none |
| `session_heartbeat` | none |
| `session_ended` | none |
| `hammer_selected` | `hammer` |
| `run_started` | `hammer` |
| `run_ended` | `hammer`, `outcome`: `finished`, `marbles_earned` |
| `upgrade_purchased` | `upgrade_id` |
| `demo_completed` | none |

`hammer` is one of `pennyroyal`, `crescendo`, `hex`, `wildfire`, `coup_de_grace`, or `singularity`.

## Limits

- body: 16 KiB
- events per batch: 1 to 20
- `game`: `Hammerbound`
- `platform`: `Windows`, `macOS`, or `Linux`
- `version`: 1 to 32 ASCII letters, digits, `.`, `+`, or `-`
- `install_id`: 32 lowercase hexadecimal characters
- `marbles_earned`: integer from zero through `Number.MAX_SAFE_INTEGER`
- `upgrade_id`: 1 to 64 lowercase letters, digits, or underscores, starting with a letter

Fields and properties not listed above are rejected. The server stores its receipt timestamp and does not store the request IP or headers.

## Responses

- `202`: batch accepted
- `400`: invalid JSON
- `413`: body too large
- `415`: content type is not JSON
- `422`: JSON does not match the contract
- `429`: request blocked by the endpoint's WAF rule
- `503`: temporary storage failure

Clients retry transport failures and `5xx` responses. They do not retry `4xx` responses.
