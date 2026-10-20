// app/api/livekit/voice/route.ts
import { NextResponse } from "next/server";
import {
  AccessToken,
  AgentDispatchClient,
  RoomAgentDispatch,
  RoomConfiguration,
  RoomServiceClient,
} from "livekit-server-sdk";
import { randomUUID } from "node:crypto";

export const dynamic = "force-dynamic";

// Must match agent_name="voice-agent" in your Python agent
const AGENT_NAME = "voice-agent";

// Only needed while running `lk agent dev` (it prints: Using deployment [dev-xxxxxxxx]).
// Put it in .env.local as LIVEKIT_AGENT_DEPLOYMENT=dev-xxxxxxxx and restart `npm run dev`.
// Leave it unset (or empty) for an agent deployed with `lk agent create`.
const AGENT_DEPLOYMENT = process.env.LIVEKIT_AGENT_DEPLOYMENT || "";

const ROOM_PREFIX = "carepulse-";

const toHttpUrl = (wsUrl: string) => wsUrl.replace(/^wss:/, "https:").replace(/^ws:/, "http:");

function getConfig() {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const wsUrl = process.env.LIVEKIT_URL;
  if (!apiKey || !apiSecret || !wsUrl) return null;
  return { apiKey, apiSecret, wsUrl };
}

// ---------------------------------------------------------------------------
// GET: create a room name, issue a token that also requests the agent
// ---------------------------------------------------------------------------
export async function GET() {
  const config = getConfig();
  if (!config) {
    return NextResponse.json({ error: "Server LiveKit config missing" }, { status: 500 });
  }
  const { apiKey, apiSecret, wsUrl } = config;

  const roomName = `${ROOM_PREFIX}${randomUUID()}`;
  const identity = `patient-${randomUUID().slice(0, 8)}`;

  try {
    const at = new AccessToken(apiKey, apiSecret, { identity, ttl: "15m" });
    at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });

    at.roomConfig = new RoomConfiguration({
      agents: [
        new RoomAgentDispatch({
          agentName: AGENT_NAME,
          ...(AGENT_DEPLOYMENT ? { deployment: AGENT_DEPLOYMENT } : {}),
        }),
      ],
    });

    const token = await at.toJwt();

    console.log("[livekit-token] token issued", {
      roomName,
      identity,
      agent: AGENT_NAME,
      deployment: AGENT_DEPLOYMENT || "(none)",
    });

    // Debug helper, remove once everything is stable
    void verifyRoom(wsUrl, apiKey, apiSecret, roomName);

    return NextResponse.json(
      { token, url: wsUrl, room: roomName },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[livekit-token] failed to issue token:", err);
    return NextResponse.json({ error: "Failed to create LiveKit session" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE: called when the user ends the call. Deleting the room disconnects
// everyone, which ends the agent's job and frees the worker immediately.
// ---------------------------------------------------------------------------
export async function DELETE(request: Request) {
  const config = getConfig();
  if (!config) {
    return NextResponse.json({ error: "Server LiveKit config missing" }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const roomName = body?.roomName;

  // Only rooms created by this route can be deleted through it
  if (typeof roomName !== "string" || !roomName.startsWith(ROOM_PREFIX)) {
    return NextResponse.json({ error: "Invalid room" }, { status: 400 });
  }

  try {
    const client = new RoomServiceClient(toHttpUrl(config.wsUrl), config.apiKey, config.apiSecret);
    await client.deleteRoom(roomName);
    console.log("[livekit-token] room deleted:", roomName);
  } catch (err) {
    // Room may already be gone (agent and user both left); that's fine
    console.log("[livekit-token] deleteRoom skipped:", (err as Error)?.message);
  }

  return NextResponse.json({ ok: true });
}

// ---------------------------------------------------------------------------
// Debug: logs participants and dispatch/job status after the call starts
// JobStatus: 0 = pending (no worker accepted yet), 1 = running, 2 = success, 3 = failed
// ---------------------------------------------------------------------------
const JOB_STATUS: Record<number, string> = {
  0: "PENDING (no worker accepted it)",
  1: "RUNNING",
  2: "SUCCESS",
  3: "FAILED",
};

async function verifyRoom(wsUrl: string, key: string, secret: string, roomName: string) {
  const httpUrl = toHttpUrl(wsUrl);
  const roomClient = new RoomServiceClient(httpUrl, key, secret);
  const dispatchClient = new AgentDispatchClient(httpUrl, key, secret);

  let seen = false;

  // Waits are sequential: checks at roughly +3s, +10s and +20s
  for (const delayMs of [3000, 7000, 10000]) {
    await new Promise((r) => setTimeout(r, delayMs));
    try {
      const rooms = await roomClient.listRooms([roomName]);

      if (rooms.length === 0) {
        if (seen) {
          console.log("[livekit-token] room closed (call ended)", roomName);
          return;
        }
        console.log(`[livekit-token] +${delayMs}ms room NOT found yet:`, roomName);
        continue;
      }
      seen = true;

      const participants = await roomClient.listParticipants(roomName);
      console.log(
        `[livekit-token] +${delayMs}ms participants:`,
        participants.map((p) => p.identity)
      );

      const dispatches = await dispatchClient.listDispatch(roomName);
      for (const d of dispatches) {
        console.log(
          `[livekit-token] dispatch ${d.id} (${d.agentName}):`,
          d.state?.jobs?.length
            ? d.state.jobs.map((j) => ({
                job: j.id,
                status: JOB_STATUS[Number(j.state?.status)] ?? j.state?.status,
                worker: j.state?.workerId || "(none)",
                error: j.state?.error || "",
              }))
            : "no jobs yet"
        );
      }

      if (participants.length > 1) {
        console.log("[livekit-token] agent joined");
        return;
      }
    } catch (err) {
      console.error("[livekit-token] verifyRoom failed:", err);
      return;
    }
  }

  console.log("[livekit-token] agent did NOT join after all checks:", roomName);
}
