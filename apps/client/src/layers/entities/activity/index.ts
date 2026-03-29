/**
 * Activity entity — shared types, display config, and reusable UI primitives
 * for the activity feed.
 *
 * @module entities/activity
 */

// Model — types and display config
export type {
  ActivityItem,
  ActivityCategory,
  ActorType,
  ListActivityQuery,
  ListActivityResponse,
  CategoryConfig,
  ActorConfig,
} from './model/activity-types';
export { CATEGORY_CONFIG, ACTOR_CONFIG } from './model/activity-types';

// UI — reusable activity display primitives
export { ActorBadge } from './ui/ActorBadge';
export type { ActorBadgeProps } from './ui/ActorBadge';
export { CategoryBadge } from './ui/CategoryBadge';
export type { CategoryBadgeProps } from './ui/CategoryBadge';
