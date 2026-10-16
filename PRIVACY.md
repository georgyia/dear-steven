# Privacy

<!-- Generated from apps/web/src/content/policies.ts by `pnpm policies`. Edit there, not here. -->

## Who is responsible

Dear Steven is software that anyone can run. Whoever runs a copy is responsible for the personal data it handles: the controller, in the words of the GDPR. This copy is run by:

TODO (owner): the name, postal address and email address of whoever runs this copy will be published here.

This notice describes what the software does with your data, as its code does it today.

## What is sent, and why

Every request to this site carries your network (IP) address, your browser’s name and version, and the time, as with any website. The server uses the address to send the reply, to limit how often one network can ask so that no one can run up the bill, and, where this copy gives free questions, to count them. There are no accounts and no sign-in.

When you ask a question, typed or spoken, in Ask or Talk, your browser sends it to the server together with the conversation so far: up to 11 earlier questions and the answers you were given, so that a follow-up makes sense. The server sends the question and the latest part of the conversation (up to six exchanges) on to OpenAI, which turns them into a search of the transcripts, checks the question with its moderation service, and writes the answer from the passages the server found. If you kept what Dear Steven learned about you after an interview, that text goes along with every question, exactly as shown to you, and on to OpenAI, so the answer can fit you.

If you ask to be interviewed, the name and the line about yourself you may give at the start (both optional) and your answers so far go to the server with each step, and on to OpenAI. OpenAI checks them with its moderation service and writes the next question and, at the end, the “What I learned about you” lines (or, when you practise, the debrief), which quote only your own words. The interview itself lives in this tab, and is gone when you start again or close it.

Voice input uses your browser’s own speech recognition where it has one; in some browsers that sends the audio to the browser maker (Google, in Chrome), unless on-device recognition is switched on in Voice settings. In browsers without it, the recording goes to the server and on to OpenAI to be transcribed, and the words come back to you.

Spoken replies send the answer’s text, not your question, to OpenAI to be read aloud in a stock voice. When your browser’s own voice reads instead, some browsers use their maker’s online voices for it.

If you paste your own OpenAI key, it goes only to this site, in a header with each of your requests, and the server uses it for that request alone; it never stores or logs it. Checking the key asks OpenAI once whether it works. Your requests then run on your own OpenAI account.

If you share an answer, the link itself carries your question and the answer, signed by this server; whoever you give it to can read both. Opening a link sends it to the server once, to check that this copy wrote that answer and that its sources are still there.

Opening a source, the list of conversations or a summary asks the server for that passage or page, and sends nothing about you beyond what every request carries.

## Legal bases

Answering your questions, interviewing you, transcribing what you say, reading answers aloud, checking your own key and opening share links: Art. 6(1)(b) GDPR. They are the service you ask for, under the [terms of use](TERMS.md).

Handling each request with its network address, the rate limits, the daily spend limit, counting free questions, the server’s error log and the hosting provider’s access logs: Art. 6(1)(f) GDPR. The legitimate interest is keeping the site working, secure and within a budget whoever runs it can pay. The answer log, if it is switched on, rests on Art. 6(1)(f) as well: checking that answers are accurate and correctly sourced.

What is kept in your browser, and the rule that covers it, is under “Cookies and storage in your browser” below.

Questions can reveal a lot, including about your health. Send only what you are comfortable sending to OpenAI, and leave out names and details that identify you or anyone else.

## Who receives it

OpenAI receives what is described above, to write answers, interview questions, transcriptions and speech and to check for harmful content, acting for whoever runs this copy. Answers are requested with OpenAI’s response storage switched off. Even so, OpenAI may keep what it receives for a limited time to detect abuse, under its own terms; its [data controls](https://developers.openai.com/api/docs/guides/your-data) say for how long and when. On your own key, your requests reach OpenAI under your own account and your own agreement with it. In demo mode, nothing is sent to OpenAI until you add a key of your own.

The hosting provider this copy runs on carries every request, acting for whoever runs this copy, and may keep standard access logs (network address, the page or address asked for, the time) under its own terms.

The video player in the source drawer is YouTube’s privacy-enhanced player, and nothing is requested from YouTube until you press play. Then your browser connects to Google, which receives your network address and browser details, and Google’s own privacy policy applies from then on, including to whatever its player keeps in your browser. “Watch on YouTube” links take you to YouTube itself.

The podcast audio is the episode file listed in the publisher’s own podcast feed, and nothing is requested until you press play. Then your browser fetches it from the address in the feed, which passes through the publisher’s ad-measurement services before it reaches the podcast host: at the time of writing pdst.fm, pscrb.fm, mgln.ai, claritaspod.com and podderapp.com, then flightcast.com. Each of them receives your network address and browser details, as with any download, and may record that the episode was played, under its own terms. They can tell the request came from this site, but not from which page or what you asked. This site doesn’t choose those services and can’t take them out of the publisher’s links; if you would rather not reach them, don’t press play on the audio.

OpenAI and Google are US companies, and what they receive may be processed in the United States; so may what the ad-measurement services receive. That is a transfer outside the EU. You can ask whoever runs this copy which safeguard covers the transfer to OpenAI (an adequacy decision or standard contractual clauses, Art. 45 and 46 GDPR), and for a copy of it.

## How long it is kept

On this server, your questions, the conversation so far, the text about you, interview answers, recordings and the text read aloud exist only while your request is handled. None of it is written to disk, and the server’s log records only that something failed and how (for example “openai 429”), never what you asked.

If whoever runs this copy switches on the answer log for evaluation (`DEAR_STEVEN_LOG_ANSWERS`, off unless they turn it on), each question is kept on their server with the time, the search made for it (for a follow-up, the question rewritten with what came before, so it can echo the conversation), the passages found, the answer, and how the safety checks routed it, until they delete it. The conversation itself, the text about you and your network address are not in it.

If this copy gives a few free questions on its own key, a cookie holding only a random number counts how many you have used, and the network you ask from is counted too. The server keeps both only as one-way keyed hashes, each with a count and the time of the first question, in a file beside the knowledge base, never linked to what you asked. A count stops applying 30 days after its first question, and is deleted when the server next tidies the file, which it does as free questions are asked. An interview on free questions carries a signed ticket that is good for two hours.

To limit how often one network can ask, the server keeps a counter under each network address in memory, never on disk, until it restarts or needs the room.

The daily spend record holds only today’s estimated cost in dollars, which says nothing about who asked what.

OpenAI and the hosting provider keep what they receive for as long as their own terms say. What is kept in your browser stays until you remove it.

## Your rights

You have the right to access the personal data held about you (Art. 15 GDPR), to have it corrected (Art. 16) or erased (Art. 17), to restrict how it is processed (Art. 18), to receive it in a portable form (Art. 20), and to object, on grounds relating to your situation, to processing based on legitimate interests (Art. 21).

The server keeps very little, and nothing under your name, so whoever runs it may need your help to find what is yours: for example, when you asked a question, if the answer log is on. What your browser keeps, you can see and remove yourself: with Forget, by switching conversation memory off, or by clearing this site’s data.

You also have the right to complain to a data protection supervisory authority (Art. 77 GDPR), in particular in the EU country where you live or work, or where you think the infringement took place.

TODO (owner): a contact address for takedown and privacy requests will be published here.

You don’t have to give any personal data beyond what every web request carries: without a question, there is simply no answer. No decision with legal or similarly significant effects is made about you by automated means.

## Cookies and storage in your browser

This site sets no tracking or advertising cookies and has no analytics. Everything it keeps in your browser is there because a feature you use needs it: storage that is strictly necessary for a service you asked for, which § 25(2) no. 2 TDDDG allows without asking for consent. It is:

Whether you have seen the first-visit notice, and your voice settings: in this browser’s local storage, until you clear it.

The mode you chose (Ask, Talk or Interview): in this tab’s session storage, until you close the tab.

The interface language, if you choose one: a cookie (`dear-steven-locale`) for a year, so the page opens in that language.

Conversation memory, only if you switch it on: your finished questions and answers, in this browser’s storage on this device, until you press Forget or switch it off.

What Dear Steven learned about you, only if you choose to keep it after an interview: at most 600 characters, shown to you exactly, in this browser’s storage on this device, until you edit it or press Forget. It goes with your questions as described above, and is never kept on the server.

Your own OpenAI key, only if you paste one and it works: encrypted, in this tab until you close it, or on this device for 30 days if you ask, until you press Forget. The key that encrypts it stays in this browser and can’t be read out of it.

If this copy has an access code: a cookie (`ds_access`) for 30 days, showing that you entered it.

If this copy gives free questions: a cookie (`ds_visitor`) for 30 days, holding only a random number, as described above.

Last updated 2026-10-16. This is plain-language text, not legal advice; it has not yet been reviewed by a lawyer.
