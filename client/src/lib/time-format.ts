/**
 * Time formatting re-exported from shared/dates.
 *
 * All date/time handling in this app MUST go through @shared/dates so
 * everything is anchored to Asia/Dubai (UTC+4, no DST). Never use
 * `new Date()` or `date-fns` directly for business logic — they follow
 * the browser/device timezone.
 */

export { formatTime12, formatTimeDual, formatTimeDualParts } from "@shared/dates";
