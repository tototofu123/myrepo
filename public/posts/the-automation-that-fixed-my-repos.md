# The Automation That Fixed My Repos

*Published: June 21, 2026*

This post covers two things that happened in the same session: a document fetching idea that started the conversation, and a GitHub cleanup that happened before any code was written.

## SHORT READ

The idea was to build something that takes a public document link, fetches whatever is inside it, and hands the content off for processing. Google Docs, Notion pages, GitHub READMEs, whatever is publicly accessible. The goal was to stop doing that manually.

Before any of that got built though, the conversation went somewhere else. The same session turned into a live audit of my GitHub profile. Turns out I had 21 public repositories, not the 10 or so I thought were there. Each one got checked for a proper description, topic tags, and a homepage URL. Most were already in good shape. The ones that were not got updated on the spot.

So this post covers both: the document fetching idea that kicked things off, and the GitHub cleanup that happened before a single line of code was written.

## LONG READ

### How myrepo started

The repo behind repo.lai.codes did not start as a hand-coded project. It started as a pull request.

GitHub Copilot's coding agent was given a prompt describing what the site should do: pull public repos from the GitHub API, display them as cards with name, description, topics, and homepage link, and keep it fast and simple. The agent opened a PR with the full implementation. After review it got merged, and that PR became the foundation of what is now repo.lai.codes.

Once the showcase was working, the same repo became the place to layer more things on top. The blog pipeline came next, also built from within the same codebase. Copilot handled the initial scaffolding, and refinements happened in conversation from there.

### The site and how it actually works

The project showcase at repo.lai.codes pulls data directly from the GitHub public API each time the page loads. It fetches every public repository under the account and displays the name, description, topics, and homepage link for each one. There is no hardcoded list sitting somewhere. Whatever is set on GitHub is what shows up on the site.

That is why the audit mattered. A missing description on GitHub meant a blank card on the site. A wrong homepage URL meant a broken link. The site is only as accurate as the data behind it.

### What the audit found

The earlier count of around 10 public repos was wrong because the search had not filtered out private ones properly. Once filtered to public only, the real number was 21.

Going through all of them, every active public repo already had a description set. The only one without was an archived repo, which made sense since archived work is not maintained. Topics and homepage URLs were also consistent across the board.

The GitHub REST API makes all of this readable and writable through the standard repository endpoint. Reading repo metadata is a GET request. Updating it is a PATCH to the same endpoint. The site reads from the list endpoint that returns all repos at once, but the fields are the same either way.

### The document fetching idea

The original plan was to build a small function that accepts any public URL, works out what kind of source it is, fetches the content in the right way for that platform, and returns clean text ready to be processed further.

Google Docs has a simple trick where changing the end of the URL from /edit to /export?format=txt returns the full document as plain text, as long as the sharing settings allow public access. For GitHub READMEs the raw file is available by swapping github.com with raw.githubusercontent.com in the URL. For general web pages, a standard HTTP request followed by HTML parsing to strip the tags down to readable text covers most cases.

This is not deployed yet. The plan is a Python function that handles the platform detection and fetching, then passes the result to a language model for whatever extraction step comes after.

### Where things stand

The repository behind repo.lai.codes has been renamed to my-repo-and-blogs since it now also hosts posts like this one alongside the project showcase. Both live in the same codebase. The blog pipeline was the next thing built after the showcase, and that story is covered in a separate post.

## References

- GitHub REST API, Repositories: https://docs.github.com/rest/repos/repos
- Google Docs URL parameters: https://www.reddit.com/r/googledocs/comments/1eb27bc/list_of_google_docs_url_parameters/
- BeautifulSoup and Requests: https://pytutorial.com/build-a-web-scraper-with-beautifulsoup-requests/
