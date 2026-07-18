import { listAccounts } from "@multi-coc/database";
import type { Account } from "@multi-coc/shared";
import type { PlayerProfile } from "./clash-api.ts";
import { fetchPlayerProfile } from "./clash-api.ts";

export type OfficialState = {
  configured: boolean;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
};

export class CollectorState {
  accounts: Account[] = [];
  readonly officialStates = new Map<string, OfficialState>();
  readonly officialProfiles = new Map<string, PlayerProfile>();
  private readonly env: NodeJS.ProcessEnv;
  private readonly logger: Pick<Console, "error">;

  constructor(env: NodeJS.ProcessEnv = process.env, logger: Pick<Console, "error"> = console) {
    this.env = env;
    this.logger = logger;
  }

  async refreshAccounts(): Promise<void> {
    this.accounts = await listAccounts();
    const currentIds = new Set(this.accounts.map((account) => account.id));
    for (const id of this.officialStates.keys()) if (!currentIds.has(id)) this.officialStates.delete(id);
    for (const id of this.officialProfiles.keys()) if (!currentIds.has(id)) this.officialProfiles.delete(id);
    for (const account of this.accounts) {
      const configured = Boolean(account.playerTag && this.env.CLASH_OF_CLANS_API_TOKEN);
      const state = this.officialStates.get(account.id);
      if (state) state.configured = configured;
      else
        this.officialStates.set(account.id, {
          configured,
          lastAttemptAt: null,
          lastSuccessAt: null,
          lastError: null,
        });
    }
  }

  async refreshOfficialProfile(account: Account): Promise<void> {
    const state = this.officialStates.get(account.id);
    if (!state?.configured) return;
    state.lastAttemptAt = new Date().toISOString();
    try {
      const profile = await fetchPlayerProfile(account, { env: this.env });
      if (profile) this.officialProfiles.set(account.id, profile);
      Object.assign(state, { lastSuccessAt: new Date().toISOString(), lastError: null });
    } catch (error) {
      state.lastError = (error as Error).message;
      this.logger.error(`[collector] ${account.id} official API: ${(error as Error).message}`);
    }
  }

  async refreshAllOfficialProfiles(): Promise<void> {
    await Promise.all(this.accounts.map((account) => this.refreshOfficialProfile(account)));
  }
}
