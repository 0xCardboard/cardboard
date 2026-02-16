export type ReputationBadge = "bronze" | "silver" | "gold" | "platinum" | "diamond";

export function getReputationBadge(score: number): ReputationBadge {
  if (score >= 95) return "diamond";
  if (score >= 81) return "platinum";
  if (score >= 61) return "gold";
  if (score >= 41) return "silver";
  return "bronze";
}
