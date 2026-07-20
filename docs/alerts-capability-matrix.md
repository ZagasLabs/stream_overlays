# SSN Alerts Capability Matrix

Verified against the official Social Stream Ninja Live Event Reference, background routing, platform adapters, and alert-box source on **2026-07-19**, upstream revision `27eafa3`. “Bridge/WS” means the corresponding platform capture bridge is enabled; DOM-only coverage is explicitly noted. The overlay receives SSN's `alerts`, `dock`, and metadata-only `meta` P2P routes plus channel 4 by default.

| Capability | Twitch | Kick | YouTube | Streamplace |
| --- | --- | --- | --- | --- |
| Follow | Yes: `new_follower`, EventSub/WS | Yes: `new_follower`, bridge | Subscriber-as-follow: `new_follower`; Data API/WS only, owner channel only, 5-minute polling, public subscriptions only, delay up to 4h | No |
| New sub/member | `new_subscriber`, WS | `new_subscriber`, bridge | `sponsorship`, DOM/WS when visible/authorized | No |
| Resub/renewal | `resub`, WS | `resub`, bridge | `resub`, DOM/WS | No |
| Gift sub/member | `subscription_gift`; limited gift lines in DOM | `subscription_gift`; basic `gift` line in DOM | `giftpurchase` / `giftredemption`, DOM/WS | No |
| Raid/host equivalent | `raid`, EventSub/IRC | `raid` from legacy host/socket when Kick supplies it; not guaranteed by every bridge path | `redirect` is a DOM-visible redirect, not a true raid | No |
| Donation/tip | No platform-native cash donation; third-party SSN webhook sources may emit `donation` | `donation` for support/tips/KICKs in bridge | Super Chat/Sticker handled separately | No |
| Bits/cheers | `cheer`, `bits`/`meta.bits`, or `hasDonation` containing bits; WS adds full metadata | No | No | No |
| Super Chat/Sticker | No | No | `donation` / `supersticker`; `hasDonation` contains formatted amount | No |
| Native gifts/hearts | Bits/cheers; not “hearts” | KICKs/support gift events where bridge exposes them | `jeweldonation` for Jewels/Gifts | No confirmed event |
| Member milestone | No canonical member milestone | No canonical member milestone | `membermilestone`, WS | No |
| Viewer milestone | Counts only (`viewer_update`), not milestone events | Counts only | Viewer/sub/view totals, not viewer milestone alerts | `viewer_update` only |
| Other meaningful events | Rewards, Hype Train, stream status; Hype Train is a major alert and reward remains generic | Rewards and stream status; reward can be generic | `thankyou`, stream end, subscriber totals; unsupported values ignored | Chat, replies, badges, links, viewer count |

## Production classification

- `new_follower` → `follow`
- `new_subscriber` → `subscription`
- `sponsorship` → `membership`
- `resub` → `resubscription`
- `subscription_gift`, `giftpurchase`, `giftredemption`, `jeweldonation` → `gift`
- `raid` and YouTube `redirect` → `raid` tier, with redirect documented as an equivalent rather than a true raid
- Twitch `cheer`/bits → `bits`; YouTube `donation`/`supersticker` → `superchat`; other documented `donation` → `donation`
- `membermilestone` → `milestone`; `hype_train` and EventSub phase aliases → `hype-train` major tier; `reward` → restrained `generic-event`

The classifier also accepts current SSN compatibility forms such as `eventType`, documented metadata event fields, `subscriber`, `gifted`, `host`, `sponsor`, `tip`, and `support`; these aliases do not invent capabilities for a platform. Unknown events and periodic counters are ignored in production. Mock fixtures cover unsupported types for UI/queue testing but never claim production support; the Streamplace placeholder is explicitly labeled **MOCK ONLY**.

## Platform limitations

Twitch DOM capture does not provide follows, raids, or full subscription events; enable EventSub/WebSocket mode and re-authorize the Twitch source. Follows require `moderator:read:followers`; real Bits and Hype Train require broadcaster authorization with `bits:read` and `channel:read:hype_train`. An old OAuth token does not acquire newly requested scopes until re-authorization. SSN's global `hideevents` setting currently suppresses all Twitch EventSub events except cheers before relay, so it must remain off for production alerts. Kick DOM capture has basic gift/reward/system lines and viewer counts; enable the Kick bridge for reliable alerts. YouTube Standard/DOM mode can expose memberships, gifts, Jewels, Super Chats, and redirects but cannot emit `new_follower`; that event requires the authenticated Data API/WebSocket source monitoring its own channel. YouTube membership/gift cards may only render for the channel owner or authorized moderators, and subscriber alerts are delayed and limited to subscriptions whose privacy setting is public. Streamplace currently provides chat and viewer count only.
