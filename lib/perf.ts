/**
 * Performance constants for Floatup
 * 
 * DEBOUNCE_MS: how long to wait after last keystroke before saving
 * MAX_PAGE_SIZE: max tasks per page fetch
 * SUBTASK_LAZY: subtasks only load on explicit expand (not auto)
 */

export const DEBOUNCE_MS    = 600   // save after 600ms of no typing
export const MAX_PAGE_SIZE  = 100   // max tasks fetched per page
export const SUBTASK_LAZY   = true  // subtasks load on click only
export const REFRESH_DELAY  = 300   // ms before background refresh fires
