import type { FastifyPluginAsync } from "fastify";
import { pool } from "../lib/db.js";

function avgScoreToTone(avg: number | null): "lighter" | "steady" | "heavier" | null {
  if (avg === null || avg === undefined) return null;
  if (avg >= 0.2) return "lighter";
  if (avg <= -0.2) return "heavier";
  return "steady";
}

const moodRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { from?: string; to?: string } }>("/mood", async (request) => {
    const userId = request.user.id;
    const from = request.query.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const to = request.query.to ?? new Date().toISOString();

    // Daily average emotion_score → bucketed tone (score never leaves server)
    const { rows } = await pool.query(
      `SELECT
         DATE(n.created_at) AS date,
         AVG(n.emotion_score) AS avg_score,
         COUNT(*) AS note_count
       FROM notes n
       WHERE n.user_id = $1
         AND n.created_at >= $2
         AND n.created_at <= $3
         AND n.emotion_score IS NOT NULL
       GROUP BY DATE(n.created_at)
       ORDER BY date ASC`,
      [userId, from, to]
    );

    const daily = rows.map((row) => ({
      date: row.date,
      tone: avgScoreToTone(parseFloat(row.avg_score)),
    }));

    // Week-over-week comparison
    const { rows: weekRows } = await pool.query(
      `SELECT
         CASE WHEN created_at >= now() - interval '7 days' THEN 'this_week' ELSE 'last_week' END AS week,
         AVG(emotion_score) AS avg_score
       FROM notes
       WHERE user_id = $1
         AND emotion_score IS NOT NULL
         AND created_at >= now() - interval '14 days'
       GROUP BY week`,
      [userId]
    );
    const weekMap: Record<string, number | undefined> = {};
    for (const r of weekRows) weekMap[r.week] = parseFloat(r.avg_score);

    let weekOverWeek = "Not enough data to compare weeks yet.";
    if (weekMap.this_week !== undefined && weekMap.last_week !== undefined) {
      const diff = (weekMap.this_week ?? 0) - (weekMap.last_week ?? 0);
      if (diff > 0.15) weekOverWeek = "This week felt lighter than last.";
      else if (diff < -0.15) weekOverWeek = "This week felt heavier than last.";
      else weekOverWeek = "This week felt about the same as last.";
    }

    // Observations: patterns with >=3 data points only (Rule #3)
    const { rows: patternRows } = await pool.query(
      `SELECT description FROM patterns
       WHERE user_id = $1 AND is_active = true AND data_points >= 3
       ORDER BY last_confirmed_at DESC LIMIT 3`,
      [userId]
    );
    const observations = patternRows.map((r) => r.description);

    return {
      range: { from, to },
      daily,
      observations,
      week_over_week: weekOverWeek,
    };
  });
};

export default moodRoutes;
