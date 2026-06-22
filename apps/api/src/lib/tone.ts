// emotion_score is internal machinery — these helpers convert to safe public labels.
// emotion_score NEVER leaves the server (Rule #8).

export function scoreToTone(score: number | null): "positive" | "neutral" | "negative" {
  if (score === null || score === undefined) return "neutral";
  if (score >= 0.3) return "positive";
  if (score <= -0.3) return "negative";
  return "neutral";
}

export function scoreToMoodTone(score: number | null): "lighter" | "steady" | "heavier" | null {
  if (score === null || score === undefined) return null;
  if (score >= 0.2) return "lighter";
  if (score <= -0.2) return "heavier";
  return "steady";
}
