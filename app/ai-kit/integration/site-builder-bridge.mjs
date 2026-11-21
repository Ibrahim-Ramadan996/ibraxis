/** Server-side bridge. Wire its methods to existing IBRAXIS owner-authenticated API routes. */
import { createSiteBuilder, stageTextSiteFeature, createAiSitePlanner } from '../site-builder/index.mjs';
export function createSiteBuilderBridge({workspaceRoot, allowedRoots, indexPath, assertOwner, assertCsrf, audit, generateChanges = null, sourcePaths = [], externalProvider = false} = {}) {
  if (typeof indexPath !== 'string' || !indexPath.endsWith('/index.html')) throw new TypeError('Configure the actual HTML entry point under an allowed source root');
  const engine=createSiteBuilder({workspaceRoot,allowedRoots,assertOwner,assertCsrf,audit});
  const planner = typeof generateChanges === 'function'
    ? createAiSitePlanner({builder:engine,generateChanges,sourcePaths,externalProvider}) : null;
  return Object.freeze({
    capabilities:engine.capabilities,
    async preview(context, input) {
      if (!input || typeof input !== 'object') throw new TypeError('Input must be an object');
      if (input.mode === 'ai') {
        if (!planner) throw Object.assign(new Error('Configure a trusted AI provider before requesting general code changes'),{code:'PROVIDER_UNAVAILABLE'});
        return planner.draft(context,{request:input.request,consentExternal:input.consentExternal===true});
      }
      if (input.mode !== undefined && input.mode !== 'template') throw new TypeError('Unrecognized site-builder mode');
      return stageTextSiteFeature(engine,context,{...input,indexPath});
    },
    approve:(context,input)=>engine.approve(context,input),
    reject:(context,input)=>engine.reject(context,input),
    undo:(context,input)=>engine.undo(context,input),
  });
}
