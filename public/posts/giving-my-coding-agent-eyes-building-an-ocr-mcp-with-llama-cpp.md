# Giving My Coding Agent Eyes: Building an OCR MCP with llama.cpp

*Published: June 23, 2026*

Free LLMs don't do vision. That's the short version of why this project exists.

I use [opencode](https://github.com/sst/opencode) — a terminal-based coding agent — as my main development environment. It's good. But the moment a task involved anything visual — a screenshot of a frontend bug, an error dialog I couldn't copy text from, an HTML structure I was inspecting in DevTools — the agent went blind. I couldn't paste an image into the conversation. The free models I was using had no vision endpoint.

The fix I landed on: an MCP server that runs OCR locally via llama.cpp, and hands the text back to the agent.

---

The setup is: you give the agent a file path. The agent calls the OCR MCP tool. The MCP spins up the right model via llama.cpp, runs inference, and returns the extracted text. The agent then continues reasoning with that text in context. No image is ever sent to an external API. Everything runs on local hardware.

Because llama.cpp can run multiple inference processes in parallel, the MCP can invoke several models at once and return whichever completes first — or let the agent pick based on confidence.

---

The model selection problem was the most interesting part.

I looked at benchmarks on Hugging Face and tested several models myself across 50 random images. The models I evaluated were: **LightOnOCR-2 (1B)**, **Chandra OCR v2 (2B)**, **Dots MOCR (1.8B)**, **Chandra v1 (8B)**, **olmOCR-2 (7B)**, **Infinity Parser (7B)**, and **PaddleOCR-VL (1.6B)**.

Each was scored on text similarity, character accuracy, word error rate, and hallucination ratio across the test set. The results were not what I expected.

The benchmark winner on paper didn't win in practice — at least not for me. Several of the larger models hit RAM limits or timed out on my machine. Some models were highly specialised: PaddleOCR-VL and Chandra v2 handled Traditional Chinese well; olmOCR and Infinity Parser performed better on code and technical content (Python, Pascal, RSA key blocks). The 1B models were fast but missed detail on dense text.

The honest result: no single model wins everything. The practical answer was a routing layer.

---

The routing logic picks the right model based on what the agent says it's looking at:

- **Chinese/CJK text** → PaddleOCR-VL or Chandra v2
- **Code / technical content** → olmOCR-2 or Infinity Parser
- **General text / numbers / forms** → LightOnOCR-2 (fast, low RAM)
- **High accuracy required** → Chandra v1 or olmOCR-2 (slower, larger)

The agent passes a `task_hint` alongside the image path. The MCP maps the hint to a ranked model list, runs the top candidate, and falls back down the list on timeout or failure.

---

The practical outcome is what matters: I can now point the agent at a screenshot of a broken UI, a DevTools panel, or a scanned document, and it reads it. Not perfectly — dense layouts and handwriting still struggle — but well enough that the agent can continue working without needing me to manually transcribe anything.

The code is at [github.com/tototofu123/ocr-mcp](https://github.com/tototofu123/ocr-mcp). The benchmark scripts and test set are included if you want to run your own evaluation.