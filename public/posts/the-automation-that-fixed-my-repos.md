# The Automation That Fixed My Repos Before It Even Got Built

**Toto Lai · June 22, 2026**

---

The idea was to build something that takes a public document link, fetches whatever is inside it, and hands the content off for processing. Google Docs, Notion pages, GitHub READMEs, whatever is publicly accessible. The goal was to stop doing that manually.

Before any of that got built though, the conversation went somewhere else. The same session turned into a live audit of my GitHub profile. Turns out I had 21 public repositories, not the 10 or so I thought were there. Each one got checked for a proper description, topic tags, and a homepage URL. Most were already in good shape. The ones that were not got updated on the spot.

So this is about both things. The document fetching idea that kicked things off, and the GitHub cleanup that happened before a single line of code was written.

---

## The site and how it actually works

The project showcase at repo.lai.codes pulls data directly from the GitHub public API each time the page loads. It fetches every public repository under the account and displays the name, description, topics, and homepage link for each one. There is no hardcoded list sitting somewhere. Whatever is set on GitHub is what shows up on the site.

That is why the audit mattered. A missing description on GitHub meant a blank card on the site. A wrong homepage URL meant a broken link. The site is only as accurate as the data behind it.

## What the audit found

The earlier count of around 10 public repos was wrong because the search had not filtered out private ones properly. Once filtered to public only, the real number was 21.

Going through all of them, every active public repo already had a description set. The only one without was an archived repo, which made sense since archived work is not maintained. Topics and homepage URLs were also consistent across the board.

The GitHub REST API makes all of this readable and writable through the standard repository endpoint [1]. Reading repo metadata is a GET request. Updating it is a PATCH to the same endpoint. The site reads from the list endpoint that returns all repos at once, but the fields are the same either way.

## The document fetching idea

The original plan was to build a small function that accepts any public URL, works out what kind of source it is, fetches the content in the right way for that platform, and returns clean text ready to be processed further.

Google Docs has a simple trick where changing the end of the URL from `/edit` to `/export?format=txt` returns the full document as plain text, as long as the sharing settings allow public access [2]. For GitHub READMEs the raw file is available by swapping `github.com` with `raw.githubusercontent.com` in the URL. For general web pages, a standard HTTP request followed by HTML parsing to strip the tags down to readable text covers most cases [3].

This is not deployed yet. The plan is a Python function that handles the platform detection and fetching, then passes the result to a language model for whatever extraction step comes after.

## Where things stand

The repository behind repo.lai.codes has been renamed to `my-repo-and-blogs` since it now also hosts posts like this one alongside the project showcase. Both live in the same codebase.

---

## References

[1] GitHub REST API, Repositories — https://docs.github.com/rest/repos/repos  
[2] Google Docs URL parameters — https://www.reddit.com/r/googledocs/comments/1eb27bc/list_of_google_docs_url_parameters/  
[3] BeautifulSoup and Requests — https://pytutorial.com/build-a-web-scraper-with-beautifulsoup-requests/
