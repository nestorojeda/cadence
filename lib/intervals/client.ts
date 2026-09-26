/**
 * Direct TypeScript client for Intervals.icu REST API.
 */

import { upstreamError } from "@/lib/api/upstream";

export interface AthleteProfile {
  id: string;
  name: string;
  firstname: string;
  lastname: string;
  city?: string;
  country?: string;
  weight?: number;
  sport_settings?: Array<{
    types: string[];
    ftp?: number;
    lthr?: number;
    max_hr?: number;
    hr_zones?: number[];
    hr_zone_names?: string[];
  }>;
}

export interface WellnessRecord {
  id: string; // YYYY-MM-DD
  ctl?: number;
  atl?: number;
  tsb?: number;
  rampRate?: number;
  restingHR?: number;
  hrv?: number;
  sleepQuality?: number;
  soreness?: number;
  fatigue?: number;
  stress?: number;
  mood?: number;
  comments?: string;
}

export interface ActivitySummary {
  id: string;
  name: string;
  type: string;
  start_date_local: string;
  distance?: number;
  moving_time?: number;
  elapsed_time?: number;
  total_elevation_gain?: number;
  average_watts?: number;
  normalized_power?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  icu_intensity?: number;
  icu_training_load?: number; // TSS
  /** Planned event this activity was matched to by Intervals.icu. */
  paired_event_id?: number;
}

export interface CalendarEvent {
  id: number;
  name: string;
  start_date_local: string;
  /** Exclusive end; midnight after the last day for all-day events. */
  end_date_local?: string;
  /** WORKOUT, NOTE, RACE_A/B/C, HOLIDAY, SICK, INJURED, … */
  category: string;
  description?: string;
  moving_time?: number;
  /** Meters. */
  distance?: number;
  icu_training_load?: number;
  type?: string;
  /** NORMAL, LIMITED or UNAVAILABLE. */
  training_availability?: string;
  /** Set once a ride has been done against this plan. */
  paired_activity_id?: string | null;
}

export interface FitnessSummary {
  athlete_id: string;
  date: string;
  ctl: number | null;
  atl: number | null;
  tsb: number | null;
  ramp_rate: number | null;
  form_status: "very_fresh" | "recovered" | "optimal" | "fatigued" | "very_fatigued";
  form_description: string;
  resting_hr?: number | null;
  hrv?: number | null;
}

/** Intervals.icu can stall; without a limit a hung request holds the chat turn until the route times out. */
const REQUEST_TIMEOUT_MS = 30_000;

export class IntervalsClient {
  private apiKey: string;
  private defaultAthleteId: string;
  private baseUrl = "https://intervals.icu/api/v1";

  constructor(apiKey?: string, defaultAthleteId?: string) {
    this.apiKey = apiKey || process.env.INTERVALS_ICU_API_KEY || "";
    this.defaultAthleteId = defaultAthleteId || process.env.INTERVALS_ICU_ATHLETE_ID || "";
  }

  private getHeaders(): Record<string, string> {
    const auth = Buffer.from(`API_KEY:${this.apiKey}`).toString("base64");
    return {
      Authorization: `Basic ${auth}`,
      "User-Agent": "CadenceCoach/1.0",
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  /** `/athlete/{id}` for the given athlete, else the client's own; the ID is encoded so it can't change the path. */
  private athletePath(athleteId?: string): string {
    return `/athlete/${encodeURIComponent(athleteId || this.defaultAthleteId)}`;
  }

  private async request<T>(path: string, what: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: this.getHeaders(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw await upstreamError(res, what);
    return res.json() as Promise<T>;
  }

  async getAthlete(athleteId?: string): Promise<AthleteProfile> {
    return this.request(this.athletePath(athleteId), "fetch athlete profile");
  }

  async getWellness(athleteId?: string, oldest?: string, newest?: string): Promise<WellnessRecord[]> {
    const params = new URLSearchParams();
    if (oldest) params.set("oldest", oldest);
    if (newest) params.set("newest", newest);

    const qs = params.toString() ? `?${params.toString()}` : "";
    return this.request(`${this.athletePath(athleteId)}/wellness${qs}`, "fetch wellness data");
  }

  async getFitnessSummary(athleteId?: string): Promise<FitnessSummary> {
    const id = athleteId || this.defaultAthleteId;
    const today = new Date();
    // Fetch last 14 days of wellness to get recent CTL/ATL/TSB trends
    const fourteenDaysAgo = new Date(today);
    fourteenDaysAgo.setDate(today.getDate() - 14);
    const oldest = fourteenDaysAgo.toISOString().split("T")[0];

    const records = await this.getWellness(id, oldest);
    const latest = records.length > 0 ? records[records.length - 1] : null;

    const ctl = latest?.ctl != null ? Math.round(latest.ctl * 10) / 10 : null;
    const atl = latest?.atl != null ? Math.round(latest.atl * 10) / 10 : null;
    let tsb = latest?.tsb != null ? Math.round(latest.tsb * 10) / 10 : null;
    if (tsb == null && ctl != null && atl != null) {
      tsb = Math.round((ctl - atl) * 10) / 10;
    }
    const rampRate = latest?.rampRate != null ? Math.round(latest.rampRate * 10) / 10 : null;

    let form_status: FitnessSummary["form_status"] = "optimal";
    let form_description = "Optimal training zone - productive training load";

    if (tsb != null) {
      if (tsb > 20) {
        form_status = "very_fresh";
        form_description = "Very fresh - ready for race effort";
      } else if (tsb > 5) {
        form_status = "recovered";
        form_description = "Recovered - ready for hard quality workouts";
      } else if (tsb > -10) {
        form_status = "optimal";
        form_description = "Optimal zone - maintaining strong training stimulus";
      } else if (tsb > -30) {
        form_status = "fatigued";
        form_description = "Fatigued - monitor recovery and fuel well";
      } else {
        form_status = "very_fatigued";
        form_description = "Overreached / high fatigue - prioritize rest and recovery";
      }
    }

    return {
      athlete_id: id,
      date: latest?.id || today.toISOString().split("T")[0],
      ctl,
      atl,
      tsb,
      ramp_rate: rampRate,
      form_status,
      form_description,
      resting_hr: latest?.restingHR ?? null,
      hrv: latest?.hrv ?? null,
    };
  }

  async getActivities(
    athleteId?: string,
    limit: number = 10,
    oldest?: string,
    newest?: string
  ): Promise<ActivitySummary[]> {
    const params = new URLSearchParams();
    params.set("limit", limit.toString());

    // Default oldest to 30 days ago if not provided
    if (!oldest) {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      oldest = d.toISOString().split("T")[0];
    }
    params.set("oldest", oldest);
    if (newest) params.set("newest", newest);

    return this.request(`${this.athletePath(athleteId)}/activities?${params.toString()}`, "fetch activities");
  }

  async getActivity(activityId: string): Promise<Record<string, unknown>> {
    return this.request(`/activity/${encodeURIComponent(activityId)}`, `fetch activity ${activityId}`);
  }

  async getEvents(athleteId?: string, oldest?: string, newest?: string): Promise<CalendarEvent[]> {
    const params = new URLSearchParams();
    if (!oldest) {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      oldest = d.toISOString().split("T")[0];
    }
    params.set("oldest", oldest);
    if (newest) params.set("newest", newest);

    return this.request(`${this.athletePath(athleteId)}/events?${params.toString()}`, "fetch calendar events");
  }

  async createEvent(eventData: Record<string, unknown>): Promise<CalendarEvent> {
    return this.request(`${this.athletePath()}/events`, "create calendar event", {
      method: "POST",
      body: JSON.stringify(eventData),
    });
  }

  async getEvent(eventId: string): Promise<CalendarEvent> {
    return this.request(`${this.athletePath()}/events/${encodeURIComponent(eventId)}`, `fetch calendar event ${eventId}`);
  }

  /** Partial update: fields left out of `changes` keep their current values. */
  async updateEvent(eventId: string, changes: Record<string, unknown>): Promise<CalendarEvent> {
    return this.request(`${this.athletePath()}/events/${encodeURIComponent(eventId)}`, `update calendar event ${eventId}`, {
      method: "PUT",
      body: JSON.stringify(changes),
    });
  }

  /** Deletes this one event only (not other events of the same plan). The response body isn't used. */
  async deleteEvent(eventId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}${this.athletePath()}/events/${encodeURIComponent(eventId)}`, {
      method: "DELETE",
      headers: this.getHeaders(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw await upstreamError(res, `delete calendar event ${eventId}`);
  }
}
