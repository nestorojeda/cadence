import type { ActivitySummary, CalendarEvent } from "@/lib/intervals/client";
import { isStrength } from "@/lib/intervals/metrics";
import type { PendingSession, ReportMetrics } from "./types";

export interface Session {
  activity: ActivitySummary;
  event: CalendarEvent;
}

/** Completed activities paired with a structured, non-gym planned workout. Free rides have no pairing. */
export function eligibleSessions(activities: ActivitySummary[], events: CalendarEvent[]): Session[] {
  const workouts = new Map(
    events
      .filter((e) => e.category === "WORKOUT" && !!e.workout_doc?.steps?.length && !isStrength(e.name, e.type))
      .map((e) => [e.id, e]),
  );
  return activities.flatMap((activity) => {
    const event = activity.paired_event_id ? workouts.get(activity.paired_event_id) : undefined;
    if (!event || isStrength(activity.name, activity.type)) return [];
    return [{ activity, event }];
  });
}

export function sessionMetrics({ activity, event }: Session): ReportMetrics {
  const load = activity.icu_training_load;
  const plannedLoad = event.icu_training_load;
  const movingTime = activity.moving_time;
  const plannedTime = event.moving_time;
  const ratio =
    load && plannedLoad ? load / plannedLoad : movingTime && plannedTime ? movingTime / plannedTime : undefined;
  return {
    movingTime,
    plannedTime,
    load,
    plannedLoad,
    normalizedPower: activity.icu_weighted_avg_watts,
    intensity: activity.icu_intensity ? Math.round(activity.icu_intensity) / 100 : undefined,
    compliance: ratio === undefined ? undefined : Math.round(ratio * 100),
    averageHeartrate: activity.average_heartrate,
  };
}

export function pendingSession(session: Session): PendingSession {
  return {
    activityId: session.activity.id,
    eventId: session.event.id,
    date: session.activity.start_date_local.slice(0, 10),
    name: session.activity.name || session.event.name,
    type: session.activity.type,
    metrics: sessionMetrics(session),
  };
}
