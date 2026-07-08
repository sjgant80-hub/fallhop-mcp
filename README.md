# @ai-native-solutions/fallhop-mcp

MCP (stdio) server that exposes [`@ai-native-solutions/fallhop-sdk`](https://github.com/sjgant80-hub/fallhop-sdk) to Claude Code and other MCP clients.

Serialize / deserialize Bitchat wire packets and translate them to and from a neutral `did:key` message envelope, from inside a chat.

MIT · AI-Native Solutions.

## Install & wire

```bash
npm i -g @ai-native-solutions/fallhop-mcp
claude mcp add fallhop -- fallhop-mcp
```

Or per-project in `.mcp.json`:

```json
{
  "mcpServers": {
    "fallhop": { "command": "fallhop-mcp" }
  }
}
```

Restart Claude Code for the tools to become callable.

## Tools

| Tool | Purpose |
|---|---|
| `serialize_packet` | Build a Bitchat wire packet from `{ type, ttl, fromDid, toDid, text | nickname }` → hex |
| `deserialize_packet` | Parse a hex Bitchat packet → structured fields |
| `bitchat_to_envelope` | Translate a wire packet (hex) → neutral envelope |
| `envelope_to_bitchat` | Translate a neutral envelope → wire packet (hex) |
| `did_peer_convert` | Convert between 8-byte peer ID hex and DIDs |
| `inspect_wire` | Byte-annotated inspection (header, peer IDs, payload, flags) |

## Resources

- `fallhop://types` — Bitchat type-code map (9 codes)
- `fallhop://flags` — Bitchat wire flag bits
- `fallhop://fidelity` — Field-by-field lossless / round-trip / opaque table

## Example

```
serialize_packet { "type":"message", "ttl":7, "fromDid":"did:key:z6MkAlice", "toDid":"did:key:z6MkBob", "text":"hi" }
→ { "hex": "0202070100000...", "length": 33 }

bitchat_to_envelope { "hex":"0202070100000..." }
→ { "kind":"message", "fromDid":"did:bitchat:...", "toDid":"did:bitchat:...", "ttl":7, "hopsUsed":0, "body":{"text":"hi"}, ... }
```

## License

MIT
