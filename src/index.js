#!/usr/bin/env node
// fallhop-mcp — MCP (stdio) wrapping @ai-native-solutions/fallhop-sdk
// MIT · AI-Native Solutions

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

import {
  BITCHAT,
  serialize, deserialize,
  bitchatToEnvelope, envelopeToBitchat,
  encodePublicMessage, encodeAnnouncement,
  hex, unhex, peerIdToDid, didToPeerId
} from '@ai-native-solutions/fallhop-sdk';

const server = new Server(
  { name: 'fallhop-mcp', version: '1.0.0' },
  { capabilities: { tools: {}, resources: {} } }
);

const TOOLS = [
  {
    name: 'serialize_packet',
    description: 'Serialize a Bitchat wire packet. Returns hex bytes ready to broadcast on the mesh.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: Object.keys(BITCHAT.TYPE_CODES), default: 'message' },
        ttl: { type: 'number', minimum: 1, maximum: 7, default: 7 },
        fromDid: { type: 'string', description: 'sender did:key or did:bitchat' },
        toDid: { type: 'string', description: 'recipient DID (optional)' },
        text: { type: 'string', description: 'text body for message type' },
        nickname: { type: 'string', description: 'nickname for announce type' }
      },
      required: ['fromDid']
    }
  },
  {
    name: 'deserialize_packet',
    description: 'Deserialize a Bitchat wire packet from hex. Returns parsed packet + neutral envelope.',
    inputSchema: {
      type: 'object',
      properties: { hex: { type: 'string', description: 'hex-encoded Bitchat bytes' } },
      required: ['hex']
    }
  },
  {
    name: 'bitchat_to_envelope',
    description: 'Translate a Bitchat wire packet (hex) into a neutral did:key envelope.',
    inputSchema: {
      type: 'object',
      properties: { hex: { type: 'string' } },
      required: ['hex']
    }
  },
  {
    name: 'envelope_to_bitchat',
    description: 'Translate a neutral envelope into a Bitchat wire packet (hex).',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: Object.keys(BITCHAT.TYPE_CODES), default: 'message' },
        fromDid: { type: 'string' },
        toDid: { type: 'string' },
        body: { type: 'object', description: 'e.g. { text } or { nickname }' },
        ttl: { type: 'number', minimum: 1, maximum: 7, default: 7 }
      },
      required: ['fromDid', 'body']
    }
  },
  {
    name: 'did_peer_convert',
    description: 'Convert between an 8-byte Bitchat peer ID (hex) and a DID.',
    inputSchema: {
      type: 'object',
      properties: {
        direction: { type: 'string', enum: ['peerToDid', 'didToPeer'] },
        value: { type: 'string' }
      },
      required: ['direction', 'value']
    }
  },
  {
    name: 'inspect_wire',
    description: 'Return a byte-annotated inspection of a Bitchat packet: header, peer IDs, payload, flags.',
    inputSchema: {
      type: 'object',
      properties: { hex: { type: 'string' } },
      required: ['hex']
    }
  }
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    switch (name) {
      case 'serialize_packet': {
        const type = args.type || 'message';
        let payload;
        if (type === 'announce') payload = encodeAnnouncement({ nickname: args.nickname || '' });
        else if (type === 'message') payload = encodePublicMessage(args.text || '');
        else payload = new TextEncoder().encode(args.text || '');
        const bytes = serialize({
          type, ttl: args.ttl ?? 7,
          senderID: args.fromDid,
          recipientID: args.toDid || null,
          payload
        });
        return { content: [{ type: 'text', text: JSON.stringify({ hex: hex(bytes), length: bytes.length }, null, 2) }] };
      }
      case 'deserialize_packet': {
        const pkt = deserialize(unhex(args.hex));
        if (!pkt) return { content: [{ type: 'text', text: JSON.stringify({ error: 'invalid packet' }) }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify({
          version: pkt.version, type: pkt.type, typeName: pkt.typeName, ttl: pkt.ttl,
          flags: pkt.flags, isCompressed: pkt.isCompressed, hasRoute: pkt.hasRoute, isRSR: pkt.isRSR,
          timestamp: pkt.timestamp,
          senderID: hex(pkt.senderID), recipientID: pkt.recipientID ? hex(pkt.recipientID) : null,
          payload: hex(pkt.payload), payloadLen: pkt.payload.length,
          signature: pkt.signature ? hex(pkt.signature) : null
        }, null, 2) }] };
      }
      case 'bitchat_to_envelope': {
        const pkt = deserialize(unhex(args.hex));
        if (!pkt) return { content: [{ type: 'text', text: JSON.stringify({ error: 'invalid packet' }) }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify(bitchatToEnvelope(pkt), null, 2) }] };
      }
      case 'envelope_to_bitchat': {
        const bytes = envelopeToBitchat({
          kind: args.kind || 'message',
          fromDid: args.fromDid,
          toDid: args.toDid || null,
          body: args.body || {}
        }, { ttl: args.ttl ?? 7 });
        return { content: [{ type: 'text', text: JSON.stringify({ hex: hex(bytes), length: bytes.length }, null, 2) }] };
      }
      case 'did_peer_convert': {
        if (args.direction === 'peerToDid') {
          return { content: [{ type: 'text', text: peerIdToDid(unhex(args.value)) }] };
        } else {
          return { content: [{ type: 'text', text: hex(didToPeerId(args.value)) }] };
        }
      }
      case 'inspect_wire': {
        const bytes = unhex(args.hex);
        const pkt = deserialize(bytes);
        if (!pkt) return { content: [{ type: 'text', text: JSON.stringify({ error: 'invalid' }) }], isError: true };
        const headerSize = pkt.version === 2 ? 16 : 14;
        const hasRcpt = !!(pkt.flags & BITCHAT.FLAGS.HAS_RECIPIENT);
        return { content: [{ type: 'text', text: JSON.stringify({
          totalBytes: bytes.length,
          headerBytes: [0, headerSize - 1],
          senderBytes: [headerSize, headerSize + 7],
          recipientBytes: hasRcpt ? [headerSize + 8, headerSize + 15] : null,
          payloadStart: headerSize + 8 + (hasRcpt ? 8 : 0),
          payloadBytes: pkt.payload.length,
          hasSignature: !!pkt.signature,
          flags: {
            hasRecipient: hasRcpt,
            isCompressed: pkt.isCompressed,
            hasRoute: pkt.hasRoute,
            isRSR: pkt.isRSR
          }
        }, null, 2) }] };
      }
      default:
        return { content: [{ type: 'text', text: `unknown tool: ${name}` }], isError: true };
    }
  } catch (e) {
    return { content: [{ type: 'text', text: `error: ${e.message}` }], isError: true };
  }
});

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    { uri: 'fallhop://types', name: 'Bitchat type codes', mimeType: 'application/json' },
    { uri: 'fallhop://flags', name: 'Bitchat wire flags', mimeType: 'application/json' },
    { uri: 'fallhop://fidelity', name: 'Field-by-field fidelity table', mimeType: 'application/json' }
  ]
}));

server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
  const uri = req.params.uri;
  if (uri === 'fallhop://types') {
    return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(BITCHAT.TYPES, null, 2) }] };
  }
  if (uri === 'fallhop://flags') {
    return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(BITCHAT.FLAGS, null, 2) }] };
  }
  if (uri === 'fallhop://fidelity') {
    return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify({
      lossless: ['senderID', 'recipientID', 'ttl', 'type', 'timestamp'],
      round_trip_only: ['flags', 'signature', 'isCompressed', 'hasRoute', 'isRSR'],
      opaque_passthrough: ['noiseHandshake', 'noiseEncrypted', 'noiseIdentityAnnounce']
    }, null, 2) }] };
  }
  return { contents: [] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('fallhop-mcp v1.0.0 · stdio · ready');
