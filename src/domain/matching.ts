// Teacher ↔ lesson matching: a teacher may only teach levels at or below
// their rank ceiling (Junior A1–A2 … Expert A1–C2).
import { TEACHER_RANKS, CEFR_LEVELS, type CefrCode, type TeacherRankKey } from "@/config/domain";

export function rankCeiling(rank: TeacherRankKey): CefrCode {
  return TEACHER_RANKS[rank].maxLevel;
}

export function isQualifiedForLevel(rank: TeacherRankKey, level: CefrCode): boolean {
  const order = (l: CefrCode) => CEFR_LEVELS.indexOf(l);
  return order(level) <= order(rankCeiling(rank));
}

export interface MatchCandidate {
  teacherId: string;
  userId: string;
  name: string;
  rank: TeacherRankKey;
  isOnline: boolean;
  qualityScore: number;
  qualityState: string;
  avgRating: number;
  ratingCount: number;
  completedLessons: number;
  responseTimeMinutes: number;
  hourlyRateCents: number;
  languages: string[];
  specialties: string[];
  certification: string;
  headline: string;
  bio: string;
  avatarColor: string;
  isFavorite?: boolean;
}

export interface MatchFilters {
  level: CefrCode; // student's current level — always enforced
  query?: string;
  minRating?: number;
  language?: string;
  specialty?: string;
  onlineOnly?: boolean;
  favoritesFirst?: boolean;
  ranks?: TeacherRankKey[];
}

/**
 * Filter + rank candidates. Hard rule: qualification for the student's level.
 * Soft ordering: favorites online → online → rating → quality → response time.
 */
export function matchTeachers<T extends MatchCandidate>(
  candidates: T[],
  filters: MatchFilters
): { qualified: T[]; unqualifiedOnline: number } {
  let unqualifiedOnline = 0;

  const eligible = candidates.filter((c) => {
    if (!isQualifiedForLevel(c.rank, filters.level)) {
      if (c.isOnline) unqualifiedOnline += 1;
      return false;
    }
    if (filters.ranks?.length && !filters.ranks.includes(c.rank)) return false;
    if (filters.onlineOnly && !c.isOnline) return false;
    if (filters.minRating && c.avgRating < filters.minRating) return false;
    if (filters.language && !c.languages.includes(filters.language)) return false;
    if (filters.specialty && !c.specialties.includes(filters.specialty)) return false;
    if (filters.query) {
      const q = filters.query.toLowerCase();
      const hay = `${c.name} ${c.headline} ${c.specialties.join(" ")} ${c.languages.join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const sorted = [...eligible].sort((a, b) => score(b, filters) - score(a, filters));
  return { qualified: sorted, unqualifiedOnline };

  function score(c: T, f: MatchFilters): number {
    let s = 0;
    if (f.favoritesFirst && c.isFavorite) s += 1000;
    if (c.isOnline) s += 500;
    s += c.avgRating * 40 + c.qualityScore * 0.5 - c.responseTimeMinutes * 0.05;
    return s;
  }
}
