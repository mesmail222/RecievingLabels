export const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3010',
  'http://127.0.0.1:3010',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8084',
  'http://shock:8084',
  'http://shock.lms.shimano.com:8084',
];

export const BODY_SIZE_LIMIT = '10mb';

/** Terren's Receiving bag label filter */
export const LABEL_COMPONENT_TYPE = 'N';
export const LABEL_POINT_USE = '5HDL';
/** Finished RT TIP parent items do not receive Receiving kit labels. */
export const EXCLUDED_PARENT_ITEM_SUFFIX = '-02';

/** Parent items beginning with 4 do not receive Receiving kit labels. */
export const EXCLUDED_PARENT_ITEM_PREFIX = '4';
