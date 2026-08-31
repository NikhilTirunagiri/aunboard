export {
  DEFAULT_STAMP_ATTR,
  ID_MAP_VERSION,
  elementKey,
  emptyIdMap,
  type DiscoveredElement,
  type ElementInfo,
  type IdAssignments,
  type IdMap,
  type IdMapEntry,
  type RematchReport,
  type RematchResult,
} from "./types";

export {
  computeSig,
  discoverElements,
  fallbackComponentName,
  findIdCollisions,
  parseSource,
  type DiscoverOptions,
} from "./discover";

export {
  isCleanReport,
  rematchIds,
  summarizeReport,
  type RematchOptions,
} from "./rematch";

export { transform, type TransformOptions, type TransformResult } from "./transform";

export {
  collectStampIds,
  collectStampRefs,
  collectTourRefs,
  toursFromJson,
  type CollectOptions,
  type LocatorLike,
  type StampRef,
  type TourLike,
  type TourStepLike,
} from "./tours";

export {
  normalizeIdMap,
  readIdMap,
  scanFiles,
  serializeIdMap,
  toMapPath,
  writeIdMapIfChanged,
  type ScanOptions,
} from "./idmap";

export { shortHash } from "./hash";
