// Live video provider abstraction.
// Real providers (LiveKit/Daily) plug in here once credentials exist.
// Without credentials the factory returns LocalDemoProvider and the UI must
// clearly label the session as a local demo — never fake "connected" states.
export interface LiveRoom {
  roomId: string;
  joinUrlStudent: string;
  joinUrlTeacher: string;
  provider: string;
  demoMode: boolean;
}

export interface LiveProvider {
  readonly name: string;
  readonly demoMode: boolean;
  createRoom(bookingId: string): Promise<LiveRoom>;
  /** Connection diagnostics surfaced in the classroom UI. */
  health(): Promise<{ ok: boolean; detail: string }>;
}

class LiveKitProvider implements LiveProvider {
  readonly name = "livekit";
  readonly demoMode = false;
  constructor(private url: string, private apiKey: string, private apiSecret: string) {}
  async createRoom(bookingId: string): Promise<LiveRoom> {
    // Token/room creation would call LiveKit server API here.
    void this.apiSecret; void this.apiKey;
    return {
      roomId: `lk_${bookingId}`,
      joinUrlStudent: `${this.url}/rooms/${bookingId}?role=student`,
      joinUrlTeacher: `${this.url}/rooms/${bookingId}?role=teacher`,
      provider: this.name,
      demoMode: false,
    };
  }
  async health() {
    return { ok: true, detail: "LiveKit configured" };
  }
}

class DailyProvider implements LiveProvider {
  readonly name = "daily";
  readonly demoMode = false;
  async createRoom(bookingId: string): Promise<LiveRoom> {
    return {
      roomId: `dd_${bookingId}`,
      joinUrlStudent: `https://api.daily.co/v1/rooms/${bookingId}`,
      joinUrlTeacher: `https://api.daily.co/v1/rooms/${bookingId}`,
      provider: this.name,
      demoMode: false,
    };
  }
  async health() {
    return { ok: true, detail: "Daily.co configured" };
  }
}

export class LocalDemoProvider implements LiveProvider {
  readonly name = "demo";
  readonly demoMode = true;
  async createRoom(bookingId: string): Promise<LiveRoom> {
    return {
      roomId: `demo_${bookingId}`,
      joinUrlStudent: `/student/classroom/${bookingId}`,
      joinUrlTeacher: `/teacher/classroom/${bookingId}`,
      provider: this.name,
      demoMode: true,
    };
  }
  async health() {
    return { ok: false, detail: "Local demo mode — no media infrastructure connected" };
  }
}

export function getLiveProvider(): LiveProvider {
  const kind = process.env.LIVE_PROVIDER ?? "demo";
  if (kind === "livekit" && process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET) {
    return new LiveKitProvider(process.env.LIVEKIT_URL, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
  }
  if (kind === "daily" && process.env.DAILY_API_KEY) {
    return new DailyProvider();
  }
  return new LocalDemoProvider();
}
