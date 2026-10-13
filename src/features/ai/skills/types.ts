export interface Skill {
  id: string;
  path: string;
  name: string;
  description: string;
  enabled: boolean;
  error: string | null;
  /** The CLI folder a discovered skill was read from; unset for `.pragma/skills`. */
  source?: string;
}
