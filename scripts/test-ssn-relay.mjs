import { randomBytes } from "node:crypto";
import { SocialStreamClient } from "../shared/ssn/client.js";

const timeoutMs = 20_000;
const room = `overlay-relay-check-${randomBytes(12).toString("hex")}`;
const marker = randomBytes(12).toString("hex");
const sender = new WebSocket("wss://io.socialstream.ninja/dock");
const originalWindow = globalThis.window;
globalThis.window = {
  setTimeout,
  clearTimeout,
  addEventListener() {},
  removeEventListener() {}
};
const client = new SocialStreamClient({ session: room, debug: true, server: true });

try {
  const clientConnected = waitForClientConnection(client);
  client.running = true;
  client.startSocket();
  await Promise.all([clientConnected, opened(sender, "sender")]);
  sender.send(JSON.stringify({ join: room, out: 4, in: 3 }));
  await delay(1_200);

  const received = waitForPayload(client, marker);
  sender.send(JSON.stringify({
    id: marker,
    type: "twitch",
    chatname: "Synthetic transport check",
    chatmessage: "SSN channel 4 relay check",
    textonly: true,
    timestamp: Date.now()
  }));
  await received;
  console.log("SSN live transport check passed: channel 4 relayed a synthetic payload.");
} finally {
  client.stop();
  close(sender);
  globalThis.window = originalWindow;
}

function opened(socket, role) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${role} connection timed out`)), timeoutMs);
    socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error(`${role} connection failed`)); }, { once: true });
  });
}

function waitForClientConnection(target) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("receiver connection timed out")), timeoutMs);
    target.addEventListener("status", (event) => {
      if (event.detail.transport !== "server" || event.detail.state !== "connected") return;
      clearTimeout(timer);
      resolve();
    });
  });
}

function waitForPayload(target, id) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("channel 4 payload timed out"));
    }, timeoutMs);
    const onMessage = (event) => {
      if (event.detail.transport !== "server" || event.detail.payload?.id !== id) return;
      cleanup();
      resolve();
    };
    const cleanup = () => {
      clearTimeout(timer);
      target.removeEventListener("payload", onMessage);
    };
    target.addEventListener("payload", onMessage);
  });
}

function close(socket) {
  try { socket.close(); } catch { /* already closed */ }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
