/**
 * agent.js
 * LLM decision layer — mock for now, drop-in replaceable with OpenAI/Claude.
 *
 * Receives structured page data + user goal.
 * Returns one action: click | type | scroll
 *
 * To connect a real LLM later, replace the `decideAction` body with an API call.
 */

/**
 * Decide the next browser action based on current page state and goal.
 *
 * @param {{ url: string, title: string, elements: object[] }} structuredPage
 * @param {string} userGoal
 * @returns {{ action: "click"|"type"|"scroll", target: string, value?: string } | null}
 */
function decideAction(structuredPage, userGoal) {
  const goal = userGoal.toLowerCase();
  const { elements } = structuredPage;

  console.log(`[Agent] Deciding action for goal: "${userGoal}"`);
  console.log(`[Agent] Page: "${structuredPage.title}" — ${elements.length} elements available`);

  // ── Locate specific element types ─────────────────────────────────────────

  const find = (types, keywords) =>
    elements.find(
      (el) =>
        types.includes(el.type) &&
        keywords.some((kw) => el.text?.toLowerCase().includes(kw))
    );

  // Try to fill an email input
  if (goal.includes("email") || goal.includes("login") || goal.includes("sign in")) {
    const emailInput = find(["input"], ["email", "e-mail", "username", "user name"]);
    if (emailInput && !emailInput.value) {
      return { action: "type", target: emailInput.id, value: "test@example.com" };
    }

    const passwordInput = find(["input"], ["password", "pass"]);
    if (passwordInput && !passwordInput.value) {
      return { action: "type", target: passwordInput.id, value: "password123" };
    }

    const submitBtn = find(["button"], ["login", "sign in", "submit", "continue"]);
    if (submitBtn) {
      return { action: "click", target: submitBtn.id };
    }
  }

  // Try to click a search button or fill a search box
  if (goal.includes("search")) {
    const searchInput = find(["input"], ["search", "query", "find"]);
    if (searchInput) {
      return { action: "type", target: searchInput.id, value: goal.replace("search", "").trim() };
    }
    const searchBtn = find(["button"], ["search", "go", "find"]);
    if (searchBtn) {
      return { action: "click", target: searchBtn.id };
    }
  }

  // Click the first visible button if nothing matches
  const firstButton = elements.find((el) => el.type === "button" && !el.disabled);
  if (firstButton) {
    console.log(`[Agent] Fallback — clicking first available button: "${firstButton.text}"`);
    return { action: "click", target: firstButton.id };
  }

  // Scroll down if nothing actionable found
  console.log("[Agent] No actionable element found — scrolling down");
  return { action: "scroll", target: null, value: "down" };
}

/**
 * Placeholder for real LLM integration.
 * Replace this function body with an OpenAI / Claude API call.
 *
 * @param {{ url: string, title: string, elements: object[] }} structuredPage
 * @param {string} userGoal
 * @returns {Promise<{ action: string, target: string, value?: string } | null>}
 */
async function llmDecide(structuredPage, userGoal) {
  // TODO: Replace with real API call, e.g.:
  // const response = await openai.chat.completions.create({
  //   model: "gpt-4o",
  //   messages: [
  //     { role: "system", content: "You control a browser. Return JSON: { action, target, value }" },
  //     { role: "user", content: JSON.stringify({ goal: userGoal, page: structuredPage }) }
  //   ]
  // });
  // return JSON.parse(response.choices[0].message.content);

  return decideAction(structuredPage, userGoal);
}

export { llmDecide, decideAction };
