import { MAX_VISIBLE_LANES, railWidth } from "../GraphRail";

export const RAIL_RESERVED_PX = railWidth(MAX_VISIBLE_LANES);

export const PAGE_SIZE = 30;
export const ROW_HEIGHT = 32;
export const TABLE_HEADER_HEIGHT = 32;
export const GRID_COLUMNS = `${RAIL_RESERVED_PX + 4}px 60px minmax(0, 2fr) minmax(0, 1fr) 90px 76px`;
export const NEAR_BOTTOM_PX = 240;
export const MIN_TABLE_WIDTH = 560;
