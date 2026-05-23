# Skill: create-blog

## Trigger phrases
Any of the following (case-insensitive) means the user wants to create a new blog post:
- "create a blog"
- "new blog post"
- "write a blog"
- "add a blog"
- "post a blog"
- "create blog post"

## What to do
When you detect a trigger phrase, ask the user for:
1. **Title** – the blog post title (required)
2. **Slug** – URL-friendly slug, e.g. `my-first-post` (auto-derive from title if not given)
3. **Summary** – one-sentence description (optional)
4. **Tags** – comma-separated list (optional)
5. **Content** – the full Markdown body of the post (required)

Then create a GitHub Issue in `tototofu123/myrepo` with:
- **Title**: `[blog] <post title>`
- **Body** formatted exactly as the template below
- **Label**: `blog`

## Issue body template
```
---
title: "<TITLE>"
slug: "<SLUG>"
date: "<YYYY-MM-DD>"
summary: "<SUMMARY>"
tags: [<TAGS>]
---

<MARKDOWN CONTENT>
```

## Notes
- The slug must be lowercase, hyphen-separated, no spaces or special chars.
- Date should be today's date in YYYY-MM-DD format.
- The GitHub Actions workflow will pick up the issue, convert the body to an HTML page at `/blogs/<slug>/index.html`, rebuild the site, and deploy.
