import type { WordpressPostType } from "@/types/aio";

// Shared by the server and the screen (no server-only imports here).

// The standard 投稿 (post) type, posted exactly as before post types could be chosen.
export const STANDARD_WORDPRESS_POST_TYPE: WordpressPostType = {
  slug: "post",
  name: "投稿",
  restBase: "posts",
  restNamespace: "wp/v2",
  categories: true,
  tags: true,
  featuredImage: true,
  excerpt: true,
};

// WordPress post type keys: at most 20 lowercase letters, digits, dashes or underscores.
export const WORDPRESS_POST_TYPE_SLUG_PATTERN = /^[a-z0-9_-]{1,20}$/;
