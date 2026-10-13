/**
 * What a fake OpenAI answers (P8-02): the route tests (`src/server/free-routes.test.ts`) and the
 * e2e fixture server (`setup-fixtures.ts`) both use it, so a test can run whole live answers and
 * interviews with no network. Fixture text, nobody's words: the answer is a synthesis paragraph
 * with no citations, which the validator accepts as it is.
 */

export const FAKE_USAGE = {
  input_tokens: 400,
  output_tokens: 40,
  total_tokens: 440,
  input_tokens_details: { cached_tokens: 0 },
  output_tokens_details: { reasoning_tokens: 0 },
};

export const FAKE_ANSWER = {
  language: 'en',
  mode: 'conversational',
  blocks: [
    {
      kind: 'paragraph',
      segments: [
        {
          text: 'Fixture answer: start small, then keep going, and let the feeling of being ready follow the action.',
          attribution: 'synthesis',
          citations: [],
        },
      ],
    },
  ],
  evidence: [],
  spoken: 'Fixture answer: start small, then keep going.',
  caveats: [],
};

export const FAKE_QUESTION = {
  question: 'Fixture question: what made you start the studio in the first place?',
  stage: 'opening',
};

/** A streamed answer, as Server-Sent Events the OpenAI SDK reads: the JSON in pieces, then usage. */
export function answerStream(answer: unknown = FAKE_ANSWER): string {
  const text = JSON.stringify(answer);
  const events: unknown[] = [];
  for (let i = 0; i < text.length; i += 40) {
    events.push({
      type: 'response.output_text.delta',
      item_id: 'msg_fixture',
      output_index: 0,
      content_index: 0,
      delta: text.slice(i, i + 40),
    });
  }
  events.push({
    type: 'response.completed',
    response: {
      id: 'resp_fixture',
      object: 'response',
      status: 'completed',
      output: [],
      usage: FAKE_USAGE,
    },
  });
  return events
    .map(
      (e, i) =>
        `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify({ ...(e as object), sequence_number: i })}\n\n`,
    )
    .join('');
}

/** A whole response, as `responses.create` without streaming returns it. */
export function jsonReply(output: unknown) {
  return {
    id: 'resp_fixture',
    object: 'response',
    status: 'completed',
    output: [
      {
        type: 'message',
        id: 'msg_fixture',
        role: 'assistant',
        status: 'completed',
        content: [{ type: 'output_text', text: JSON.stringify(output), annotations: [] }],
      },
    ],
    usage: FAKE_USAGE,
  };
}

export const MODERATION_OK = {
  id: 'modr_fixture',
  model: 'omni-moderation-latest',
  results: [{ flagged: false, categories: {}, category_scores: {} }],
};
