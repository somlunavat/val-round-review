/** What the UI needs to show a player: never their Riot name. */
export type PlayerInfo = {
  label: string;
  ally: boolean;
  isSelf: boolean;
  agentIcon?: string;
  agentName?: string;
};
