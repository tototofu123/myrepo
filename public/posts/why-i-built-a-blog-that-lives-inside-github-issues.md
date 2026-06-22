# Why I Built a Blog That Lives Inside GitHub Issues

*Published: June 23, 2026*

I have one Framer student plan. Framer gives you one CMS collection on a free or student plan — one. That's a hard wall. You can have a beautiful site, great design, but the moment you want a second type of content (blog posts *and* project notes, say), you're blocked. I didn't want to pay just to write. And I definitely didn't want to manage a separate CMS tool.

So I went looking for a different way.

---

The idea came from YouTube and Bilibili — a few videos about using GitHub Issues as a lightweight content editor. The pitch made sense immediately: Issues are already Markdown, already have labels and dates, already have a comment system, already live where my code lives. Why reach for a third-party CMS when the whole thing is right there?

The hard part wasn't the idea. It was the conversion: how do you get Markdown written in a GitHub Issue to become a styled HTML/CSS post on your actual site, automatically, without touching it again after you click Submit?

---

That's where GitHub Actions came in — and where it got genuinely tricky.

The first version just grabbed the issue body and dumped it into a template. That worked. But the style wasn't mine. A blog post shouldn't look like a GitHub README. I wanted custom fonts, a dark theme, scroll animations, a short-read summary up top and a collapsible long-read below. Fine-tuning that conversion — the Python script that takes Markdown and outputs exactly the HTML structure I want — took more back-and-forth than I expected.

Agent-assisted fine-tuning helped a lot here. Describing the output I wanted and iterating on the generator script with an AI assistant in the loop was faster than hand-editing templates. The agent could see the rendered output, suggest CSS changes, and update the script in one pass.

---

The queue was the other piece I hadn't thought about upfront.

Early on, if you labelled two issues on the same day, both published immediately. That looked messy — two posts landing at the same time with no rhythm. So I added a scheduling layer: one post per weekday at 12:00 HKT, with a second slot on weekends if there are three or more posts waiting. The oldest issue in the queue always goes first. The workflow checks the queue depth, decides how many slots today allows, picks the right issues, runs the generator, commits the files, and then comments on and closes each issue with the live URL.

Now writing a post is just: open an issue, write Markdown, add the `blog-post` label. The rest is automatic.

---

It's not a CMS. It's better than a CMS, for this use case — everything version-controlled, no third-party accounts, no extra costs, and the editor is GitHub, which I'm already in every day.