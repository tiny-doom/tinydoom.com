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
| `run_ended` | `hammer`, `outcome`: `finished`, `marbles_earned`, `purchased_upgrade_points`, `upgrade_points`, `available_upgrades`, `cheapest_available_upgrade_cost`, `starting_marble_balance`, `duration_seconds`, `run_duration_seconds`, `good_strikes`, `bad_strikes`, `swords_fixed`, `swords_broken`, `peak_payout_multiplier`, `average_payout_multiplier`, `upgrade_value_earned` |
| `upgrade_purchased` | `upgrade_id` |
| `demo_completed` | none |

`hammer` is one of `pennyroyal`, `crescendo`, `hex`, `wildfire`, `coup_de_grace`, or `singularity`.

A new `run_ended` snapshot also records purchased upgrade points, the available upgrade `{id, cost}` frontier and cheapest cost, starting balance, duration, strikes, swords fixed/broken, peak and average payout multipliers, and `upgrade_value_earned`. The ratio is `marbles_earned / cheapest_available_upgrade_cost`, or `null` when the tree has no available upgrade. Zero earnings produce `0`, never a non-finite value. Legacy `run_ended` events remain accepted.

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

## Weekly report

Vercel posts the previous Monday through Sunday to Discord `#telemetry` every Monday at 09:00 UTC. When at least one consented player was active, the report sends the standard weekly stats. If the week includes completed runs with progression snapshots, it also attaches a branded PNG graph of upgrade value by purchased points. The graph includes the overall average, a shaded 0.5–1.5 target band, colored era markers for Copper, Steel, Gold, Mithril, and Prestige, and a y-axis that expands above its 2.5 baseline when the data requires it. A full playthrough contained inside the report range also records runs and forge minutes to first Prestige. Weeks without active players do not post to Discord.

The authorized report route accepts optional inclusive `start` and exclusive `end` UTC dates, up to 31 days. This lets us graph a playthrough immediately instead of waiting for Monday.
