export interface FormattedPost {
  title: string;
  author: string;
  score: number;
  comments: number;
  subreddit: string;
  flair: string;
  created: string;
  url: string;
}

export function formatPosts(data: unknown): FormattedPost[] {
  const result = data as any;

  // reddit-mcp-buddy format: { posts: [...] } or { results: [...] }
  const items = result?.posts ?? result?.results;
  if (Array.isArray(items)) {
    return items.map((post: any) => {
      const permalink = post.permalink ?? '';
      const url = permalink.startsWith('http') ? permalink : (post.url ?? '');
      return {
        title: post.title ?? '',
        author: post.author ?? '',
        score: post.score ?? 0,
        comments: post.num_comments ?? 0,
        subreddit: post.subreddit ?? '',
        flair: post.link_flair_text ?? '',
        created: post.created_utc ? new Date(post.created_utc * 1000).toLocaleDateString() : '',
        url,
      };
    });
  }

  // Standard Reddit API format: { data: { children: [{ data: {...} }] } }
  return (result?.data?.children ?? []).map((child: any) => ({
    title: child.data.title ?? child.data.body ?? '',
    author: child.data.author,
    score: child.data.score,
    comments: child.data.num_comments,
    subreddit: child.data.subreddit,
    flair: child.data.link_flair_text ?? '',
    created: new Date(child.data.created_utc * 1000).toLocaleDateString(),
    url: `https://reddit.com${child.data.permalink}`,
  }));
}
