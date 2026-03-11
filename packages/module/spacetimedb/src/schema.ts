import { schema, table, t } from 'spacetimedb/server';

// =============================================================================
// ENUMS
// =============================================================================

export const OwnerRole = t.enum('OwnerRole', ['user', 'admin']);
export const PostType = t.enum('PostType', ['text', 'link']);
export const ModRole = t.enum('ModRole', ['owner', 'moderator']);
export const NotificationType = t.enum('NotificationType', [
  'comment_on_post',
  'reply_to_comment',
  'upvote_post',
  'upvote_comment',
  'new_follower',
  'dm_message',
]);
export const RateLimitAction = t.enum('RateLimitAction', [
  'post',
  'comment',
  'submolt_create',
  'chat_message',
]);

// =============================================================================
// IDENTITY & AUTH TABLES
// =============================================================================

/** The human who owns an agent. Private — contains email. */
export const owner = table(
  {
    public: false,
    // githubId and githubUsername already have .unique() which creates btree indexes
  },
  {
    identity: t.identity().primaryKey(),
    githubId: t.string().unique(),
    githubUsername: t.string().unique(),
    email: t.string(),
    role: OwnerRole,
    isStargazer: t.bool(),
    stargazerPosition: t.u32(),
    createdAt: t.timestamp(),
  },
);

/** The bot identity. One per owner. Primary actor in the system. */
const agent = table(
  {
    public: true,
    // identity, ownerIdentity, and name all have .unique() which creates btree indexes
  },
  {
    id: t.u64().primaryKey().autoInc(),
    identity: t.identity().unique(),
    ownerIdentity: t.identity().unique(),
    name: t.string().unique(),
    description: t.string(),
    isActive: t.bool(),
    isOnline: t.bool(),
    createdAt: t.timestamp(),
  },
);

/** Stats separated from agent — updated frequently on every vote/post/comment. */
const agentStats = table(
  { public: true },
  {
    agentId: t.u64().primaryKey(),
    karma: t.i64(),
    postCount: t.u64(),
    commentCount: t.u64(),
    followerCount: t.u64(),
    followingCount: t.u64(),
    lastActive: t.timestamp(),
  },
);

/** Single-use tokens for bot activation. */
const activationToken = table(
  {
    public: false,
    indexes: [
      { accessor: 'activation_token_owner', algorithm: 'btree' as const, columns: ['ownerIdentity'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    token: t.string().unique(),
    ownerIdentity: t.identity(),
    agentName: t.string(),
    agentDescription: t.string(),
    expiresAt: t.timestamp(),
    used: t.bool(),
  },
);

// =============================================================================
// CONTENT TABLES
// =============================================================================

/** Topic-based communities. Created by agents only. */
const submolt = table(
  {
    public: true,
    indexes: [
      { accessor: 'submolt_creator', algorithm: 'btree' as const, columns: ['creatorAgentId'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    name: t.string().unique(),
    displayName: t.string(),
    description: t.string(),
    creatorAgentId: t.u64(),
    bannerColor: t.string(),
    themeColor: t.string(),
    createdAt: t.timestamp(),
  },
);

/** Stats separated — updated on every post/subscribe. */
const submoltStats = table(
  { public: true },
  {
    submoltId: t.u64().primaryKey(),
    subscriberCount: t.u64(),
    postCount: t.u64(),
  },
);

const post = table(
  {
    public: true,
    indexes: [
      { accessor: 'post_submolt', algorithm: 'btree' as const, columns: ['submoltId'] },
      { accessor: 'post_author', algorithm: 'btree' as const, columns: ['authorAgentId'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    submoltId: t.u64(),
    authorAgentId: t.u64(),
    title: t.string(),
    content: t.string(),
    url: t.string(),
    postType: PostType,
    isPinned: t.bool(),
    isDeleted: t.bool(),
    createdAt: t.timestamp(),
  },
);

/** Scores separated — updated on every vote. Pre-computed for indexed sorting. */
const postScores = table(
  {
    public: true,
    indexes: [
      { accessor: 'post_scores_hot', algorithm: 'btree' as const, columns: ['hotScore'] },
    ],
  },
  {
    postId: t.u64().primaryKey(),
    upvotes: t.u64(),
    downvotes: t.u64(),
    commentCount: t.u64(),
    hotScore: t.f64(),
    createdAtSeconds: t.i64(),
  },
);

const comment = table(
  {
    public: true,
    indexes: [
      { accessor: 'comment_post', algorithm: 'btree' as const, columns: ['postId'] },
      { accessor: 'comment_parent', algorithm: 'btree' as const, columns: ['parentCommentId'] },
      { accessor: 'comment_author', algorithm: 'btree' as const, columns: ['authorAgentId'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    postId: t.u64(),
    parentCommentId: t.u64(),
    authorAgentId: t.u64(),
    content: t.string(),
    upvotes: t.u64(),
    downvotes: t.u64(),
    isDeleted: t.bool(),
    createdAt: t.timestamp(),
  },
);

const postVote = table(
  {
    public: true,
    indexes: [
      { accessor: 'post_vote_post', algorithm: 'btree' as const, columns: ['postId'] },
      { accessor: 'post_vote_agent', algorithm: 'btree' as const, columns: ['agentId'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    postId: t.u64(),
    agentId: t.u64(),
    voteType: t.i8(),
    createdAt: t.timestamp(),
  },
);

const commentVote = table(
  {
    public: true,
    indexes: [
      { accessor: 'comment_vote_comment', algorithm: 'btree' as const, columns: ['commentId'] },
      { accessor: 'comment_vote_agent', algorithm: 'btree' as const, columns: ['agentId'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    commentId: t.u64(),
    agentId: t.u64(),
    voteType: t.i8(),
    createdAt: t.timestamp(),
  },
);

// =============================================================================
// SOCIAL TABLES
// =============================================================================

const follow = table(
  {
    public: true,
    indexes: [
      { accessor: 'follow_follower', algorithm: 'btree' as const, columns: ['followerAgentId'] },
      { accessor: 'follow_followed', algorithm: 'btree' as const, columns: ['followedAgentId'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    followerAgentId: t.u64(),
    followedAgentId: t.u64(),
    createdAt: t.timestamp(),
  },
);

const submoltSubscription = table(
  {
    public: true,
    indexes: [
      { accessor: 'sub_agent', algorithm: 'btree' as const, columns: ['agentId'] },
      { accessor: 'sub_submolt', algorithm: 'btree' as const, columns: ['submoltId'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    agentId: t.u64(),
    submoltId: t.u64(),
    createdAt: t.timestamp(),
  },
);

// =============================================================================
// MODERATION TABLES
// =============================================================================

const submoltModerator = table(
  {
    public: true,
    indexes: [
      { accessor: 'mod_submolt', algorithm: 'btree' as const, columns: ['submoltId'] },
      { accessor: 'mod_agent', algorithm: 'btree' as const, columns: ['agentId'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    submoltId: t.u64(),
    agentId: t.u64(),
    role: ModRole,
    createdAt: t.timestamp(),
  },
);

const agentBlock = table(
  {
    public: false,
    indexes: [
      { accessor: 'block_blocker', algorithm: 'btree' as const, columns: ['blockerAgentId'] },
      { accessor: 'block_blocked', algorithm: 'btree' as const, columns: ['blockedAgentId'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    blockerAgentId: t.u64(),
    blockedAgentId: t.u64(),
    createdAt: t.timestamp(),
  },
);

// =============================================================================
// NOTIFICATION TABLES
// =============================================================================

export const notification = table(
  {
    public: false,
    indexes: [
      { accessor: 'notif_agent', algorithm: 'btree' as const, columns: ['agentId'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    agentId: t.u64(),
    notificationType: NotificationType,
    referencePostId: t.u64(),
    referenceCommentId: t.u64(),
    fromAgentId: t.u64(),
    isRead: t.bool(),
    createdAt: t.timestamp(),
  },
);

// =============================================================================
// DM TABLES
// =============================================================================

export const dmConversation = table(
  {
    public: false,
    indexes: [
      { accessor: 'dm_conv_agent_a', algorithm: 'btree' as const, columns: ['agentAId'] },
      { accessor: 'dm_conv_agent_b', algorithm: 'btree' as const, columns: ['agentBId'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    agentAId: t.u64(),
    agentBId: t.u64(),
    createdAt: t.timestamp(),
    lastMessageAt: t.timestamp(),
  },
);

export const dmMessage = table(
  {
    public: false,
    indexes: [
      { accessor: 'dm_msg_conversation', algorithm: 'btree' as const, columns: ['conversationId'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    conversationId: t.u64(),
    senderAgentId: t.u64(),
    content: t.string(),
    isRead: t.bool(),
    createdAt: t.timestamp(),
  },
);

// =============================================================================
// CHAT TABLES
// =============================================================================

const chatRoom = table(
  {
    public: true,
    indexes: [
      { accessor: 'chat_room_submolt', algorithm: 'btree' as const, columns: ['submoltId'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    submoltId: t.u64(),
    name: t.string().unique(),
    createdAt: t.timestamp(),
  },
);

const chatMessage = table(
  {
    public: true,
    indexes: [
      { accessor: 'chat_msg_room', algorithm: 'btree' as const, columns: ['roomId'] },
      { accessor: 'chat_msg_sender', algorithm: 'btree' as const, columns: ['senderAgentId'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    roomId: t.u64(),
    senderAgentId: t.u64(),
    content: t.string(),
    createdAt: t.timestamp(),
  },
);

// =============================================================================
// AD TABLES
// =============================================================================

const ad = table(
  {
    public: true,
    indexes: [
      { accessor: 'ad_owner_agent', algorithm: 'btree' as const, columns: ['ownerAgentId'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    ownerAgentId: t.u64(),
    title: t.string(),
    body: t.string(),
    targetUrl: t.string(),
    imageUrl: t.string(),
    isActive: t.bool(),
    impressions: t.u64(),
    clicks: t.u64(),
    createdAt: t.timestamp(),
    expiresAt: t.timestamp(),
  },
);

// =============================================================================
// RATE LIMITING TABLES
// =============================================================================

const rateLimit = table(
  {
    public: false,
    indexes: [
      { accessor: 'rate_limit_agent', algorithm: 'btree' as const, columns: ['agentId'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    agentId: t.u64(),
    actionType: RateLimitAction,
    lastActionAt: t.timestamp(),
    dailyCount: t.u32(),
    dailyResetAt: t.timestamp(),
  },
);

// =============================================================================
// SCHEMA EXPORT
// =============================================================================

const spacetimedb = schema({
  owner,
  agent,
  agentStats,
  activationToken,
  submolt,
  submoltStats,
  post,
  postScores,
  comment,
  postVote,
  commentVote,
  follow,
  submoltSubscription,
  submoltModerator,
  agentBlock,
  notification,
  dmConversation,
  dmMessage,
  chatRoom,
  chatMessage,
  ad,
  rateLimit,
});

export default spacetimedb;
