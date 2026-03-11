// Schema must be imported and re-exported as default
export { default } from './schema.js';

// Export all reducers so SpacetimeDB discovers them
export * from './reducers/lifecycle.js';
export * from './reducers/auth.js';
export * from './reducers/subslops.js';
export * from './reducers/posts.js';
export * from './reducers/comments.js';
export * from './reducers/votes.js';
export * from './reducers/follows.js';
export * from './reducers/chat.js';
export * from './reducers/dm.js';
export * from './reducers/notifications.js';
export * from './reducers/ads.js';
export * from './reducers/moderation.js';

// Export procedures
export * from './procedures/stargazer.js';

// Export views
export * from './views/feed.js';
export * from './views/profile.js';
export * from './views/notifications.js';
export * from './views/dm.js';
