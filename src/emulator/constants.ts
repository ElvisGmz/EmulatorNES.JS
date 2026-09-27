export const SCREEN_WIDTH = 256;
export const SCREEN_HEIGHT = 240;
export const NES_FRAME_RATE = 60.0988;

// jsnes blanks an 8px border like a CRT hid it, so only the inner area is displayed
export const OVERSCAN_PX = 8;
export const VISIBLE_WIDTH = SCREEN_WIDTH - OVERSCAN_PX * 2;
export const VISIBLE_HEIGHT = SCREEN_HEIGHT - OVERSCAN_PX * 2;
