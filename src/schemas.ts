import { z } from 'zod';

const PostSchema = z.object({
  id: z.string().optional(),
  title: z.string().default(''),
  author: z.string().default(''),
  score: z.number().default(0),
  num_comments: z.number().default(0),
  subreddit: z.string().default(''),
  link_flair_text: z.string().nullable().optional(),
  created_utc: z.number().optional(),
  url: z.string().optional(),
  permalink: z.string().optional(),
  content: z.string().optional(),
  selftext: z.string().optional(),
  upvote_ratio: z.number().optional(),
  is_video: z.boolean().optional(),
  is_text_post: z.boolean().optional(),
  nsfw: z.boolean().optional(),
  stickied: z.boolean().optional(),
}).passthrough();

const CommentSchema = z.object({
  author: z.string().default('unknown'),
  body: z.string().default(''),
  score: z.number().default(0),
  depth: z.number().default(0),
  created_utc: z.number().optional(),
}).passthrough();

const SubredditStatSchema = z.object({
  subreddit: z.string().optional(),
  name: z.string().optional(),
  post_count: z.number().optional(),
  posts: z.number().optional(),
  comment_count: z.number().optional(),
  comments: z.number().optional(),
  karma: z.number().optional(),
}).passthrough();

export const ListingResponseSchema = z.object({
  posts: z.array(PostSchema).optional(),
  results: z.array(PostSchema).optional(),
  data: z.object({
    children: z.array(z.object({
      data: PostSchema,
    })).optional(),
  }).optional(),
  total_posts: z.number().optional(),
  total_results: z.number().optional(),
}).passthrough();

export const PostDetailResponseSchema = z.object({
  post: PostSchema.optional(),
  top_comments: z.array(CommentSchema).optional(),
  title: z.string().optional(),
  author: z.string().optional(),
  score: z.number().optional(),
  num_comments: z.number().optional(),
  selftext: z.string().optional(),
  content: z.string().optional(),
}).passthrough();

export const UserResponseSchema = z.object({
  username: z.string().optional(),
  accountAge: z.string().optional(),
  karma: z.object({
    link: z.number().optional(),
    comment: z.number().optional(),
    total: z.number().optional(),
  }).optional(),
  top_subreddits: z.array(SubredditStatSchema).optional(),
  topSubreddits: z.array(SubredditStatSchema).optional(),
  recentPosts: z.array(PostSchema).optional(),
  posts: z.array(PostSchema).optional(),
}).passthrough();

export const ExplainResponseSchema = z.object({
  definition: z.string().optional(),
  usage: z.string().optional(),
  examples: z.array(z.string()).optional(),
  relatedTerms: z.array(z.string()).optional(),
  origin: z.string().optional(),
}).passthrough();

export type ListingResponse = z.infer<typeof ListingResponseSchema>;
export type PostDetailResponse = z.infer<typeof PostDetailResponseSchema>;
export type UserResponse = z.infer<typeof UserResponseSchema>;
export type ExplainResponse = z.infer<typeof ExplainResponseSchema>;
