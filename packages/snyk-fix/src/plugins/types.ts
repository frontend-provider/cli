import {
  EntityToFix,
  WithError,
  WithFixChangesApplied,
  WithUserMessage,
} from '../types';

export type FixHandler = (
  entities: EntityToFix[],
) => Promise<FixHandlerResultByPlugin>;

export interface PluginFixResponse {
  succeeded: Array<WithFixChangesApplied<EntityToFix>>;
  failed: Array<WithError<EntityToFix>>;
  skipped: Array<WithUserMessage<EntityToFix>>;
}
export interface FixHandlerResultByPlugin {
  [pluginId: string]: PluginFixResponse;
}
// ecosystem is the plugin
export type Ecosystem = 'python';
