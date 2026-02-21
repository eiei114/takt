export interface MatchSettings {
  readonly maxPlayers: number;
  readonly roundSeconds: number;
}

export const DEFAULT_MATCH_SETTINGS: MatchSettings = {
  maxPlayers: 12,
  roundSeconds: 180
};
