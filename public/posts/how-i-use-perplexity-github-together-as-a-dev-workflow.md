# How I Use Perplexity and GitHub Together as a Dev Workflow

*Published: June 22, 2026*

This is not a tools review. It is a description of how two tools ended up splitting a job that used to be one messy thing.

## Where it started

The original use case was STM32 firmware. Large codebases, lots of context, questions that needed answers faster than a documentation search could provide. Perplexity handled that role well. It reads code, answers questions about it, and does not require a specific IDE or environment to be useful.

From there the workflow expanded. GitHub Copilot came in for the implementation side, specifically the coding agent that can open pull requests from a prompt. Perplexity stayed on the research and review side. The two tools ended up doing different things without much overlap.

## How the split actually works

Perplexity is where questions go. It reads the repo.lai.codes codebase, explains what workflows do, catches issues in logic, and answers questions about structure without needing local access to the files. It also handles writing: post drafts, README updates, anything that benefits from iteration in conversation.

GitHub Copilot is where implementation goes. The coding agent takes a problem statement and opens a pull request. The initial myrepo showcase site was built this way. The blog pipeline scaffolding was also started this way. The agent writes the code, opens the PR, and the review happens after.

The line between them is roughly: if it requires generating or modifying files in the repo, it goes to Copilot. If it requires reading, understanding, explaining, or drafting, it goes to Perplexity.

## The credit wall problem

The reason the split matters is credits. GitHub Copilot's coding agent costs premium request credits. Using it for every small question or every draft iteration would burn through the allowance fast. Perplexity handles the tasks that do not need code generation at no per-request cost, which means Copilot credits go toward the tasks that actually require them.

This is not a budget hack. It is closer to the tools being genuinely better suited to different parts of the work.

## What this repo is

The myrepo codebase is a Vite and React single page app deployed on GitHub Pages at repo.lai.codes. It has three main parts now: the project showcase that pulls live from the GitHub API, the blog section that reads from a generated index.json, and the GitHub Actions pipeline that converts issues into published posts.

All three parts were built in stages using the same workflow described above. The showcase came from a Copilot PR. The blog pipeline was built in conversation and pushed directly. The posts themselves are written as GitHub issues and converted to HTML by Actions on a schedule.

## Tool split reference

| Task | Tool |
|---|---|
| Read and explain code | Perplexity |
| Answer questions about structure | Perplexity |
| Write and iterate on drafts | Perplexity |
| Generate files or open PRs | Copilot agent |
| Fix specific bugs in the repo | Copilot agent |
| Push small updates directly | Perplexity via MCP |

## References

- repo.lai.codes: https://repo.lai.codes
- GitHub Copilot coding agent: https://docs.github.com/en/copilot/using-github-copilot/using-copilot-coding-agent-to-work-on-tasks/about-assigning-tasks-to-copilot
