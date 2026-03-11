// Feed views are handled client-side via subscriptions to public tables.
// The post, postScores, agent, and subslop tables are all public.
// Clients subscribe to these tables and sort/filter locally.
//
// For now, no server-side views are needed for feeds because:
// 1. Post data is public
// 2. Sorting by hot_score is done client-side using the pre-computed column
// 3. SpacetimeDB views can't do ORDER BY or LIMIT
//
// If we need server-side feed filtering in the future, we can add views here.

// Empty export to make this a module
export {};
