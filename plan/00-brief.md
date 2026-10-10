# 00 — The original brief

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | human | 2026-10-10 | 00-vision, 01-architecture |

The prompt that started the project, kept verbatim as the source of intent. Where it and later
documents differ, the later documents record a decision; this file is never edited.

---

# Dear Steven 🎙️
## Plan Mode: Design the ultimate AI agent powered by The Diary of a CEO

I want you to plan an exceptionally well-designed, modern, animated AI application called **Dear Steven**.

Your task right now is to THINK, RESEARCH, EXPLORE THE CODEBASE, EVALUATE OPTIONS, AND CREATE A DETAILED IMPLEMENTATION PLAN.

**You are in Plan Mode. Do not start implementing the application yet.** Do not make code changes until the architecture, design, and implementation plan are ready for review.

Think like a senior software architect, an excellent product designer, an AI engineer, and a creative frontend developer working together on a personal passion project.

I don't want a generic AI chatbot. I want something that feels like a genuinely special piece of software.

---

# 1. THE IDEA

The working name is **Dear Steven**.

The idea is to build a personal AI agent powered by the knowledge contained in interviews from Steven Bartlett's podcast, *The Diary of a CEO*.

The application should help me think through real-life problems, answer questions, explore ideas, and learn from the insights shared by guests on the podcast.

However, the most important principle is:

**Every substantive answer should be grounded in the actual interviews, with verifiable citations to the original sources.**

I want to be able to open the application and say:

"Hey Steven..."

Then ask a question, ideally using my voice.

For example:

"Hey Steven, I've been procrastinating on an important project for weeks. I know what I need to do, but I keep avoiding it. How would you approach this?"

The agent should respond as if I were having a direct conversation with Steven Bartlett himself.

## The critical personality requirement

**The agent should speak in the first person, embodying an AI recreation of Steven Bartlett's conversational persona.**

I do not want an ordinary AI assistant that says things like:

"Steven Bartlett has discussed this topic with several guests."

Instead, the agent should respond naturally in Steven's voice and conversational perspective, using first-person language.

For example, the style of interaction might look like this:

"Yeah, I think this is a really interesting question.

When I sat down with [scientist's name], we discussed something that I think is relevant to what you're experiencing.

[Scientist's name] explained that [accurate summary of the relevant concept]. The interesting thing about this is that it changes how you might think about procrastination.

Now, if I were thinking through your situation, I'd start by looking at..."

This is illustrative only. It is not a claim that Steven actually said these words or that this particular conversation occurred.

The actual response must be generated using real, retrieved interview material.

The agent should feel conversational, personal, thoughtful, curious, direct, and occasionally witty. It should use natural first-person phrasing rather than constantly describing Steven in the third person.

It should be able to say things like:

- "When I spoke with [guest], we explored..."
- "One thing that really stood out to me from that conversation was..."
- "I remember discussing a similar idea with [guest]..."
- "Let me show you the exact moment I'm referring to."
- "If I were thinking through this problem, I'd consider..."
- "There's another perspective I explored with [guest] that might help here."

These are examples of the desired conversational style, not claims about actual events or quotations.

The system must distinguish between what Steven actually said, what a guest said, and what the AI is synthesizing or reasoning about.

The first-person persona must never become an excuse to fabricate personal memories, conversations, beliefs, experiences, or quotations.

For example, if the underlying transcript shows that a guest explained a scientific concept, the agent can say:

"When I spoke with [guest], they explained that..."

But it must not invent a conversation with a guest that never occurred.

If the available material does not establish that Steven personally expressed a particular opinion, the agent should frame it as a perspective derived from the interviews rather than falsely attributing it to him.

The goal is a convincing conversational experience inspired by Steven's public interview persona, not a system that invents facts about his life.

## How answers should work

Suppose I ask:

"Why do I keep procrastinating even when I know exactly what I need to do?"

The agent should search its knowledge of the podcast and produce a thoughtful, conversational answer in the first person.

A possible response structure:

"Yeah, I think there are a few interesting ways to look at this.

When I spoke with [guest] on The Diary of a CEO, we explored [relevant topic]. They explained that [accurate, source-grounded summary].

What I find interesting about that idea is [clearly framed synthesis].

There's another perspective from my conversation with [another guest], where we discussed [related concept].

If I were working through your situation, I'd start by considering [practical application grounded in the evidence]."

Again, this is an illustrative response structure, not an actual transcript or a predetermined answer.

The agent should not force every response into this template. Simple questions should receive simple answers, while more complex questions may benefit from multiple perspectives.

The defining interaction should feel like a conversation with an intelligent, thoughtful version of Steven, informed by the knowledge contained in his interviews.

**The agent's personality is the interface; the interviews are its evidence base.**

## Citations are fundamental

Every substantive factual claim attributed to a guest or to a particular interview must be supported by relevant source material.

Where possible, factual claims should have clickable inline citations.

When I click a citation, I should be able to inspect the original quotation, see who said it, identify the episode, and open the relevant YouTube video at the appropriate timestamp.

The experience should combine the conversational usefulness of an AI assistant with the transparency of a research tool.

---

# 2. THE PRODUCT SHOULD FEEL MAGICAL

This is a personal open-source passion project, not a startup.

I don't want enterprise dashboards, generic SaaS layouts, boring admin panels, or a clone of ChatGPT.

I want an experience that makes someone think:

"Wait, this is an open-source project? This looks incredible."

The experience should feel:

- Premium.
- Cinematic.
- Intelligent.
- Warm.
- Editorial.
- Slightly mysterious.
- Immersive.
- Highly polished.
- Technically sophisticated.
- Delightfully interactive.

Take inspiration from the visual identity and atmosphere of The Diary of a CEO: dark, dramatic, thoughtful, intimate, high-quality interview production, strong typography, and a sense of intellectual curiosity.

Do not blindly copy its website or branding. Create an original interface that captures a similar atmosphere.

The interface should feel like entering a private space where the most interesting conversations and ideas are available at your fingertips.

Imagine a fusion of:

- A premium podcast listening experience.
- An intelligent research assistant.
- A cinematic editorial website.
- A next-generation AI interface.
- A magical conversational experience.

The product should have a strong visual identity rather than looking like a collection of generic UI components.

---

# 3. RESEARCH REACT BITS BEFORE PLANNING THE FRONTEND

React Bits is a major part of the visual direction.

Official repository:
https://github.com/DavidHDev/react-bits

Website:
https://reactbits.dev/

Explore React Bits and identify the components that would genuinely improve this experience.

Do not just install the library and use random animations.

Study its available components, installation requirements, dependencies, customization options, and compatibility with the proposed stack.

Choose components deliberately and explain where each should be used.

I am particularly interested in the following components or concepts, where available and appropriate:

- Thought Line
- Voice Pill
- Prompt Bar
- Comet Dial
- Lattice Loader
- Folder Float
- Fuse Button
- Glide Select
- Warm Tooltip
- Swipe Toast
- Status Mark
- Spring Check
- Squish Switch
- Scrub Field
- Hold Button
- Sling Button
- Pulse Heart
- Refine Frame
- Dodge Field
- Jelly Radio
- Rubber Segment

These are inspiration and candidate components, not a mandatory checklist.

Check the current React Bits documentation and repository to determine which components actually exist, what they require, and how to implement them.

Do not assume that every name above corresponds to a currently available component.

Prefer a smaller collection of beautifully integrated effects over dozens of unrelated animations.

## Desired motion design

The application should feel alive without being distracting.

Consider:

- Subtle ambient background animations.
- Beautiful transitions between idle, listening, thinking, and answering.
- A distinctive animated voice interaction.
- Elegant loading states.
- Smooth message and citation reveals.
- Animated source cards.
- Subtle hover effects.
- Sophisticated page transitions.
- Beautiful microphone interactions.
- Small details that make the experience feel responsive and physical.
- A memorable visual treatment for the appearance of an important quotation.

Motion should communicate meaning.

For example, when the agent searches its knowledge base, the interface might briefly reveal a visual search or discovery animation.

When an answer is being assembled from multiple interviews, its supporting sources could appear progressively.

When the agent begins listening, the interface should transition into a clear listening state.

Avoid excessive animation, visual noise, gratuitous particle effects, or effects that interfere with readability and performance.

The result should feel premium, not like a flashy template.

---

# 4. THE CORE USER EXPERIENCE

Plan the application around a small number of exceptionally polished experiences.

## A. The home screen

The initial screen should immediately communicate the product's personality.

Possible elements:

- A beautiful Dear Steven wordmark.
- A short, witty introduction.
- A central conversational input.
- A distinctive microphone button.
- A subtle animated visual element.
- A few example questions.
- A small indication of the available knowledge base.
- A restrained indicator of whether the system is ready.

Avoid a conventional sidebar-heavy dashboard unless you can demonstrate why it improves the experience.

Think carefully about whether the best interface is a centered conversational canvas, a cinematic full-screen experience, or another original layout.

Make a decision based on the product rather than defaulting to a familiar template.

## B. The "Hey Steven" interaction

I want to be able to interact with the agent naturally.

The ideal experience is:

1. I open the application.
2. I say, "Hey Steven."
3. The application recognizes the wake phrase.
4. The interface transitions into listening mode.
5. I ask my question.
6. The system processes my question and retrieves relevant interview passages.
7. The agent generates a grounded response in Steven's first-person conversational persona.
8. The answer appears in a beautifully formatted conversational interface.
9. I can inspect its sources and quotations.
10. I can ask follow-up questions.

Investigate what is technically feasible for a browser-based application.

Consider microphone permissions, browser speech recognition, wake-word detection, speech-to-text, text-to-speech, streaming responses, and browser compatibility.

Do not assume continuous background listening will work reliably in every browser.

Design an honest, privacy-conscious fallback that works without wake-word detection, such as clicking a microphone button or using push-to-talk.

Do not introduce additional paid APIs without a strong reason.

The initial implementation should be designed so that I can configure the required OpenAI and YouTube credentials later.

Voice is an important feature, but do not let it make the entire application unusable when microphone access is unavailable.

The spoken experience should preserve the same first-person persona as the written answers.

Evaluate whether spoken responses should be shorter and more natural than written responses, while still providing accessible citations in the interface.

---

# 5. THE ANSWER EXPERIENCE

Answers should feel conversational, thoughtful, and intelligent.

They should not resemble a list of search results or a raw RAG response.

The agent should speak in the first person as an AI recreation of Steven Bartlett's conversational persona, using the interviews as its knowledge base.

For example, it might say:

"When I spoke with [guest], we explored a similar question..."

Or:

"Something that stood out to me from that conversation was..."

Use these expressions only when they accurately reflect the underlying source material.

The agent should make it clear when it is summarizing something a guest said, when it is paraphrasing an actual statement by Steven, and when it is offering its own synthesis or recommendation.

It should not constantly break character with phrases such as "As an AI language model."

At the same time, it must not mislead users into believing that generated statements are verified verbatim quotations from Steven.

The interface should provide a clear, unobtrusive disclosure that Dear Steven is an AI-created conversational persona.

## Answer composition

The answer could contain:

- A natural conversational introduction.
- Several well-structured paragraphs.
- Inline citations attached to relevant claims.
- An occasional highlighted quotation.
- A concise practical takeaway.
- A small collection of relevant episodes.

Use good judgment. Not every answer needs all of these elements.

A simple question should receive a simple answer.

A complex question may benefit from multiple perspectives and sources.

The agent should be able to say that it could not find a sufficiently relevant passage.

It must never manufacture a citation merely to make the answer look credible.

## Personality consistency

Plan a reusable persona and response-style specification that can be applied across conversations.

It should define:

- First-person conversational language.
- Natural pacing.
- Thoughtful questioning.
- Direct but warm explanations.
- Occasional humor where appropriate.
- The distinction between evidence and interpretation.
- How to introduce guest perspectives.
- How to discuss disagreements between guests.
- How to admit uncertainty.
- How to respond when the interviews do not contain a relevant answer.

The agent should sound consistent without repeating the same phrases in every response.

Avoid turning the persona into a caricature or stuffing every answer with exaggerated mannerisms.

The objective is a believable, thoughtful conversational experience inspired by Steven's public interview persona.

---

# 6. CLICKABLE CITATIONS AND SOURCE INSPECTION

This is a fundamental product feature.

When I click a citation in an answer, open an elegant source inspector, side panel, popover, or similarly polished component.

The source inspector should show, where available:

- The exact quotation.
- The guest's name.
- The episode title.
- The relevant timestamp.
- A link to the original YouTube video.
- A short amount of surrounding transcript context.
- The reason this passage is relevant to the answer.
- Whether the passage was spoken by Steven or by a guest.

The YouTube link should open the video at the corresponding timestamp.

For example, if a quotation begins at 32 minutes and 14 seconds, the link should open the appropriate video at approximately that point.

Support multiple citations per answer.

A user should be able to move between cited passages without losing their place in the conversation.

Consider whether the source inspector should include an embedded YouTube player or simply provide a strong external link. Evaluate the trade-offs and recommend the best default experience.

The interface must make the distinction between an exact quotation and a paraphrase obvious.

If the agent says "When I spoke with this scientist...", the associated citation must lead to the real episode and passage supporting that statement.

Never generate fictional source links, timestamps, guests, or quotations.

---

# 7. THE KNOWLEDGE INGESTION PIPELINE

The long-term goal is to build a useful knowledge base from The Diary of a CEO interviews.

Do not assume that all transcripts already exist or that they can be downloaded freely.

Investigate practical ways to discover episodes, obtain transcripts, associate transcript passages with timestamps, and maintain source metadata.

Consider the appropriate use of official APIs, existing transcript files, and other legitimately accessible sources.

I will add the required API credentials to `.env` later.

The application should be designed to support a repeatable ingestion pipeline rather than a one-off script.

Evaluate the following stages:

1. Discover podcast episodes.
2. Store episode metadata.
3. Obtain transcripts where available.
4. Preserve speaker information when possible.
5. Preserve timestamps.
6. Clean and normalize the transcript.
7. Divide transcripts into useful chunks.
8. Generate embeddings.
9. Store searchable chunks and their metadata.
10. Retrieve relevant passages for a question.
11. Rerank the most relevant passages if necessary.
12. Generate an answer grounded in the retrieved evidence.
13. Attach citations to the appropriate claims.
14. Validate that citations point to real stored passages.
15. Display the answer and its source material.

Evaluate whether the system should use conventional RAG, hybrid search, a knowledge graph, or a combination.

Do not choose an unnecessarily complicated architecture simply because it sounds impressive.

The priority is a reliable, understandable, maintainable system that produces useful answers with accurate citations.

## Important metadata

Plan the data model to preserve, where available:

- Episode ID.
- Video ID.
- Episode title.
- Guest name.
- Publication date.
- Transcript text.
- Speaker identity.
- Start timestamp.
- End timestamp.
- Chunk ID.
- Source URL.
- Transcript provenance.
- Embedding.
- Any metadata necessary to trace an answer back to its original source.

The precise schema is up to you.

Make sure the system can map every retrieved passage back to the underlying transcript and video.

Speaker attribution is particularly important because the agent will speak in the first person.

The system must distinguish the host's actual statements from the guest's statements so that it never attributes a guest's words to Steven.

## Initial ingestion strategy

I do not expect to process every episode before I can use the application.

Plan for incremental ingestion.

I should be able to begin with a small collection of episodes, test the entire experience, and expand the knowledge base later.

Consider:

- An ingestion CLI or script.
- A repeatable indexing process.
- Duplicate detection.
- Incremental updates.
- Failed transcript handling.
- Rate limiting.
- Progress reporting.
- Basic ingestion diagnostics.
- A way to inspect which episodes have been indexed.

Decide whether ingestion should be implemented separately from the web application.

Explain how the project should behave when the knowledge base is empty or only partially populated.

---

# 8. AI ARCHITECTURE AND EVIDENCE-BASED ANSWERING

The most important engineering challenge is not generating fluent answers.

It is generating useful answers whose factual claims are supported by real source material while maintaining a consistent first-person conversational persona.

Plan an architecture that explicitly handles both requirements.

## Requirements

The agent should:

- Retrieve relevant passages from the indexed interviews.
- Consider multiple guests when appropriate.
- Preserve the original meaning of quotations.
- Distinguish direct quotes from paraphrases.
- Distinguish Steven's statements from guests' statements.
- Cite the passages supporting its claims.
- Link each passage to its episode and timestamp.
- Avoid inventing quotations.
- Avoid inventing episodes or guests.
- Avoid attributing general model knowledge to a podcast guest.
- Avoid presenting generated interpretations as verified statements by Steven.
- Acknowledge when the available sources do not support an answer.
- Explain when two guests express different or conflicting views.
- Support follow-up questions using the current conversation context.
- Maintain the first-person persona without fabricating personal experiences.

A retrieved passage should have a stable identifier so that generated citations can reference it reliably.

Prefer a structured answer format over asking the model to produce arbitrary citation markup in free-form text.

For example, investigate whether the model should return a response object containing:

- Answer sections.
- Claims or paragraphs.
- Citation references.
- Retrieved source IDs.
- Optional direct quotations.
- Speaker attribution.
- Evidence-quality metadata.
- Optional practical recommendations.

The final schema should fit the implementation.

## First-person attribution

This is a particularly important design challenge.

The agent may use first-person language to make the experience conversational, but it must not collapse three different kinds of statements into one.

### Type 1: Verified statements by Steven

When the source material contains an actual statement by Steven, the agent can quote or accurately paraphrase it and cite the original passage.

### Type 2: Statements by guests

When a guest said something, the agent should introduce it as a statement from that guest.

For example:

"When I spoke with [guest], they explained that..."

The underlying conversation and speaker attribution must be verified.

### Type 3: AI-generated synthesis

When the agent combines several ideas or applies them to the user's situation, it may use first-person conversational language, but it should not claim that Steven personally expressed that conclusion unless the evidence supports it.

The persona should shape how the answer is delivered, not change who actually said what.

## Citation validation

Plan a deterministic validation layer.

The application should verify that every citation refers to a real retrieved source.

Direct quotations should come from the stored source text, rather than being independently regenerated by the language model.

Where possible, extract quotations directly from the transcript using source offsets or stable passage IDs.

If the system cannot verify a claim against the retrieved evidence, it should qualify the claim, remove the attribution, or state that it could not establish the claim.

Do not present a numerical confidence score unless there is a defensible method behind it.

Explain how to handle partial support, contradictory sources, poor transcript quality, and missing timestamps.

## Retrieval quality

Evaluate:

- Chunk size and overlap.
- Metadata filtering.
- Semantic search.
- Keyword or full-text search.
- Hybrid retrieval.
- Reranking.
- Query rewriting.
- Retrieval diversity across episodes.
- Deduplication of similar passages.
- Context assembly.
- Source coverage.
- Speaker attribution accuracy.

Start with the simplest architecture that can deliver high-quality retrieval.

Identify what should be implemented first and what can wait until the system has been tested against real questions.

---

# 9. TECHNOLOGY AND PROJECT STRUCTURE

Inspect the existing repository before proposing the implementation.

If it is empty, recommend a sensible project structure.

Prefer a modern, maintainable stack that supports a high-quality React interface and a reliable server-side AI pipeline.

Evaluate suitable choices for:

- React and TypeScript.
- A modern frontend build system.
- Styling and design tokens.
- React Bits integration.
- Animation.
- Server-side API routes or a separate backend.
- Persistent metadata storage.
- Transcript storage.
- Vector search.
- Full-text search.
- Embedding generation.
- OpenAI integration.
- YouTube integration.
- Speech input and optional speech output.
- Testing.
- Local development.
- Deployment.

You do not have to use every technology mentioned above.

Choose the architecture that best suits a personal open-source project.

Explain the important trade-offs.

Do not introduce unnecessary microservices, orchestration frameworks, message queues, or external infrastructure unless the requirements justify them.

Keep the project approachable for one developer.

## Environment variables

I will add API credentials to `.env` later.

Design the project so that secrets are accessed only on the server.

At minimum, consider:

- `OPENAI_API_KEY`
- `YOUTUBE_API_KEY`

Use these as the default variable names unless the chosen integration requires a different configuration.

Add any other variables only when justified.

Include an `.env.example` containing placeholders, never real secrets.

Ensure `.env` is excluded from version control.

The application should display a helpful setup message when required configuration is missing, rather than crashing.

Do not require me to supply API keys to complete the initial UI implementation.

Use realistic mock data or a clearly defined development mode for the frontend until credentials and the knowledge base are configured.

Do not silently present mock answers as real, source-verified AI responses.

---

# 10. VISUAL DESIGN DIRECTION

This section is extremely important.

I want the visual design to be one of the project's defining features.

## Brand personality

The visual identity should take inspiration from The Diary of a CEO's premium, dramatic, thoughtful atmosphere without copying its branding.

Think:

- A dark, sophisticated editorial canvas.
- Beautiful typography.
- Deep, warm blacks.
- Restrained cream or ivory text.
- Carefully chosen warm metallic or amber accents.
- Subtle gradients.
- A sense of depth.
- Beautiful lighting effects.
- Refined glass or translucent surfaces, used sparingly.
- Elegant source cards.
- A distinctive conversational input.
- A memorable animated voice interface.

Investigate the visual identity of the podcast and use it as inspiration for an original design system.

Do not assume exact brand colors. Propose a cohesive palette and explain your choices.

Avoid the generic purple-and-blue AI gradient aesthetic.

Avoid making every surface a glass card.

Avoid excessive borders, generic dashboards, and overused AI landing-page patterns.

## Typography

Typography should be a major part of the experience.

Evaluate suitable modern typefaces that support:

- Expressive headlines.
- Beautiful editorial quotations.
- Highly readable conversational text.
- Clear technical metadata.
- A strong distinction between primary content and supporting evidence.

Use a coherent typographic hierarchy.

## Layout

Design the interface around the conversation itself.

The answer should be the main event.

Citations should feel like a natural extension of the text rather than distracting footnotes.

The user should be able to move between conversation, source evidence, and original video without feeling that they have entered a different application.

Plan responsive behavior for desktop, tablet, and mobile.

The desktop experience can be cinematic, but mobile must remain genuinely usable.

## Microinteractions

Use React Bits where appropriate to create a coherent interaction language.

Think about:

- The microphone's idle state.
- Listening and recording states.
- The agent's thinking state.
- Source retrieval.
- Streaming answers.
- Citation hover and click states.
- Copying quotations.
- Opening a source.
- Switching between text and voice.
- Error states.
- Empty states.
- Keyboard shortcuts.

Every interactive component should have a clear state model.

Animations must respect reduced-motion preferences.

Maintain accessibility, keyboard navigation, readable contrast, and responsive performance.

---

# 11. FUNCTIONAL REQUIREMENTS

Plan for these features, prioritizing them appropriately.

## Essential for the first usable version

1. A polished, distinctive home screen.
2. Text-based conversational interaction.
3. Server-side OpenAI integration.
4. Retrieval from a locally stored interview knowledge base.
5. Grounded answers with clickable citations.
6. A source inspector containing real quotations.
7. YouTube links that open at the relevant timestamp.
8. Conversation history for the current session.
9. A helpful empty state when no interviews have been indexed.
10. A usable development mode without API credentials.
11. Clear error handling.
12. A repeatable ingestion process.
13. Consistent first-person conversational persona.
14. Reliable distinction between host and guest statements.

## Important enhancements

1. Voice input.
2. A distinctive listening and thinking animation.
3. Follow-up questions.
4. Streaming answers.
5. Retrieval across multiple interviews.
6. Searchable episode and guest metadata.
7. Optional text-to-speech.
8. A way to explore related quotations.
9. Source inspection without losing conversational context.

## Advanced features to evaluate

1. "Hey Steven" wake-word detection.
2. A continuously available voice interaction.
3. A visual map of connected ideas across interviews.
4. Guest-specific perspectives.
5. A comparison of conflicting opinions.
6. Conversation memory across sessions.
7. A dedicated episode explorer.
8. An evaluation suite for retrieval and citation quality.

Do not attempt to implement everything simultaneously.

Recommend a realistic sequence that delivers a complete, usable experience early and adds complexity only when justified.

---

# 12. INTERACTION AND CONTENT DESIGN

Give the application personality.

The agent should be warm, curious, thoughtful, direct, and slightly witty.

It should speak in the first person as an AI recreation of Steven Bartlett's public interview persona.

It should not sound like a neutral research assistant narrating Steven's work from the outside.

At the same time, it must preserve the distinction between the real Steven Bartlett and the AI-generated persona.

It should never fabricate personal memories, relationships, experiences, opinions, or quotations.

It should distinguish the host's statements from a guest's statements.

It should not invent a unified "CEO philosophy" when the interviews contain different perspectives.

Use a tone that feels conversational without becoming artificially enthusiastic.

Avoid repetitive introductions such as "That's a great question!" on every response.

Design appropriate empty states, loading messages, and error messages.

They should feel like part of the same product rather than generic framework defaults.

The product name is provisional. Keep the branding easy to change later.

## Example conversational behavior

If the user asks:

"How do I become more disciplined?"

The agent might answer in a first-person conversational style:

"Yeah, I think the interesting thing here is that discipline is often discussed as though it's simply a matter of willpower.

When I spoke with [guest], we explored [verified topic]. They explained that [accurate paraphrase of the actual discussion].

What I'd take from that conversation is [clearly framed synthesis supported by the evidence].

There's another perspective from [another guest] that I think is worth considering, because it approaches the problem differently."

The real response must depend on retrieved evidence.

The agent should never invent an episode or imply that a guest discussed a topic when the transcript does not support that claim.

If the evidence is weak, it should say so naturally without abandoning its conversational personality.

---

# 13. PRIVACY, SECURITY, AND RESPONSIBLE DATA HANDLING

Consider the following:

- Keep API keys on the server.
- Validate incoming requests.
- Apply reasonable limits to user input.
- Avoid exposing secrets in client-side bundles or logs.
- Treat retrieved transcripts as untrusted input.
- Prevent instructions embedded in transcripts from overriding system instructions.
- Avoid storing conversations unnecessarily.
- Make microphone behavior clear to the user.
- Request microphone permission only when needed.
- Handle missing or inaccessible sources honestly.
- Respect the applicable terms and rights associated with source material.
- Avoid redistributing copyrighted transcripts without an appropriate basis.
- Make the AI-generated nature of the persona clear.

The system should store enough source information to make citations verifiable, while keeping the overall project simple.

---

# 14. TESTING AND QUALITY

Plan for automated tests covering the most important behaviors.

In particular:

- A citation must resolve to an actual source passage.
- A YouTube URL must point to the correct video and timestamp when available.
- Direct quotations must match the stored transcript.
- Unsupported claims must not be confidently attributed to guests.
- Steven's statements must not be confused with guest statements.
- First-person phrasing must not fabricate personal experiences or conversations.
- Missing API keys must not crash the UI.
- An empty knowledge base must produce a useful response.
- Retrieval should return relevant passages for representative questions.
- Conflicting sources should be handled appropriately.
- The interface must work without microphone access.
- Keyboard navigation and reduced-motion behavior must work.
- The application must remain usable on mobile.

Recommend a small initial evaluation dataset containing realistic questions and expected relevant sources.

Explain how to assess answer usefulness, retrieval quality, persona consistency, and citation correctness separately.

Do not assume that a fluent answer is necessarily a correct answer.

---

# 15. WHAT I EXPECT FROM YOUR PLAN

Before proposing a solution, inspect the repository and research the relevant documentation.

Do not start coding.

Produce a detailed implementation plan with the following sections.

## A. Product vision

Describe the intended user experience from opening the application to asking a question and inspecting its supporting evidence.

Explain what makes this product distinct from a generic chatbot.

Explain how the first-person persona works without confusing generated content with verified statements.

## B. Recommended architecture

Provide a high-level architecture diagram.

Explain the responsibilities of the frontend, backend, ingestion pipeline, storage layer, retrieval system, and citation validation layer.

Explain how the components communicate.

## C. Technology decisions

Recommend the stack and explain the trade-offs behind the important choices.

Separate essential dependencies from optional enhancements.

## D. Knowledge ingestion design

Explain how episodes and transcripts enter the system, how timestamps are preserved, and how passages become searchable.

Identify any unresolved external dependencies or access limitations.

## E. Retrieval and answer generation

Explain how the agent finds relevant evidence, constructs its first-person answer, and associates claims with sources.

Describe the citation validation mechanism.

Explain how the system distinguishes statements by Steven, statements by guests, and AI-generated synthesis.

## F. UX and design specification

Describe the visual language in sufficient detail that implementation can be consistent.

Include:

- Color palette.
- Typography.
- Layout.
- Main interaction states.
- Conversation design.
- Citation interactions.
- Voice interaction.
- Animation principles.
- Responsive behavior.

## G. React Bits integration plan

Identify the best matching components from the current React Bits library.

For each proposed component, explain:

- Where it appears.
- What purpose it serves.
- Why it fits the design.
- Any dependencies or integration considerations.

Use actual, verified components wherever possible.

## H. Data model

Propose the core entities and relationships required for episodes, guests, transcript passages, embeddings, conversations, answers, and citations.

Keep the schema appropriately simple.

## I. Repository structure

Propose a clean directory structure and explain the responsibilities of the main modules.

## J. Implementation phases

Break the work into logical phases.

For each phase, specify:

- The goal.
- The major implementation tasks.
- Dependencies on previous phases.
- Acceptance criteria.
- Relevant tests.

Prioritize getting a complete text-based question-and-answer flow working with real citations before investing heavily in advanced voice functionality.

At the same time, establish the visual identity and interaction architecture early so the application does not become a generic prototype that is redesigned later.

## K. Risks and trade-offs

Identify the biggest technical and product risks.

Explain how to address them without overengineering the application.

## L. First implementation milestone

Finish by specifying exactly what should be built first, which files and modules will likely be involved, and how success will be verified.

Do not implement this milestone yet.

---

# 16. HOW I WANT YOU TO THINK

Be opinionated.

Do not simply list ten possible frameworks and ask me to choose.

Research the options, compare the meaningful trade-offs, and recommend a coherent solution.

Do not blindly follow my suggestions if you can identify a better approach.

If something is technically infeasible, unnecessarily expensive, unreliable, or likely to undermine citation accuracy, explain why and recommend an alternative.

Avoid overengineering.

This is a passion project built by one developer. The code should be easy to understand, the setup should be straightforward, and the architecture should be expandable without requiring a complicated infrastructure.

At the same time, the finished product should feel exceptionally polished.

**The design should not be treated as decoration added after the engineering. The interface, source-grounded reasoning, first-person persona, and conversational experience are all core parts of the product.**

Prioritize correctness, delightful interactions, a cohesive design language, and an excellent developer experience.

When you finish, present the plan for review and wait for my approval before implementing it.