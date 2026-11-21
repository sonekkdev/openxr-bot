import { commands, ERROR } from "./commands.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const commandHandlers = new Map(
  commands.map(({ definition, execute }) => [definition.name, execute]),
);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function hexToBytes(hex) {
  if (typeof hex !== "string" || hex.length % 2 !== 0) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    const byte = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
    if (Number.isNaN(byte)) return null;
    bytes[index] = byte;
  }
  return bytes;
}

export async function verifySignature(request, body, publicKeyHex) {
  const signatureHex = request.headers.get("X-Signature-Ed25519");
  const timestamp = request.headers.get("X-Signature-Timestamp");
  if (!signatureHex || !timestamp || !publicKeyHex) return false;

  const signature = hexToBytes(signatureHex);
  const publicKey = hexToBytes(publicKeyHex);
  if (!signature || !publicKey) return false;
  if (signature.length !== 64 || publicKey.length !== 32) return false;

  const timestampBytes = encoder.encode(timestamp);
  const bodyBytes = new Uint8Array(body);
  const message = new Uint8Array(timestampBytes.length + bodyBytes.length);
  message.set(timestampBytes, 0);
  message.set(bodyBytes, timestampBytes.length);

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      publicKey,
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify({ name: "Ed25519" }, key, signature, message);
  } catch {
    return false;
  }
}

function errorEmbed(title, description) {
  return {
    embeds: [{ title, description, color: ERROR }],
    flags: 64,
  };
}

export default {
  async fetch(request, env) {
    if (request.method === "GET") {
      return new Response("openXR bot is running");
    }
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "GET, POST" },
      });
    }

    const startedAt = performance.now();
    const body = await request.arrayBuffer();
    const valid = await verifySignature(request, body, env.DISCORD_PUBLIC_KEY);
    if (!valid) {
      return new Response("Invalid request signature", { status: 401 });
    }

    let interaction;
    try {
      interaction = JSON.parse(decoder.decode(body));
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    if (interaction.type === 1) {
      return json({ type: 1 });
    }

    if (interaction.type === 2) {
      const name = interaction.data?.name;
      const execute = commandHandlers.get(name);
      if (!execute) {
        return json({ type: 4, data: errorEmbed("Unknown command", "This command is not registered.") });
      }
      try {
        return json({ type: 4, data: execute({ interaction, startedAt }) });
      } catch (error) {
        console.error(`command /${name} failed`, error);
        return json({
          type: 4,
          data: errorEmbed("Command failed", "Something went wrong. Try again."),
        });
      }
    }

    return json({
      type: 4,
      data: errorEmbed("Unsupported interaction", "This bot only handles slash commands."),
    });
  },
};
