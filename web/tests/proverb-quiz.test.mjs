import assert from "node:assert/strict";
import test from "node:test";
import {
  createProverbRound,
  proverbQuestions,
} from "../src/lib/proverb-quiz.ts";

function seededRandom(seed) {
  let state = seed;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

test("question bank has thirty distinct sayings, ten questions of each kind", () => {
  assert.equal(proverbQuestions.length, 30);
  assert.equal(new Set(proverbQuestions.map((question) => question.id)).size, 30);
  assert.equal(new Set(proverbQuestions.map((question) => question.saying)).size, 30);
  for (const kind of ["missing", "meaning", "situation"]) {
    assert.equal(proverbQuestions.filter((question) => question.kind === kind).length, 10);
  }
  for (const question of proverbQuestions) {
    assert.equal(question.options.length, 4, question.id);
    assert.equal(new Set(question.options).size, 4, question.id);
    assert.ok(Number.isInteger(question.correctIndex), question.id);
    assert.ok(question.correctIndex >= 0 && question.correctIndex < 4, question.id);
    assert.ok(question.prompt.trim() && question.saying.trim() && question.topic.trim(), question.id);
    assert.equal(question.explanation.match(/\./g)?.length, 2, question.id);
    if (question.kind === "missing") {
      assert.match(question.prompt, /____/, question.id);
      assert.ok(
        question.saying.toLocaleLowerCase("vi").includes(
          question.options[question.correctIndex].toLocaleLowerCase("vi"),
        ),
        question.id,
      );
    }
  }
});

test("a default round has five unique questions", () => {
  const round = createProverbRound({ random: seededRandom(42) });
  assert.equal(round.length, 5);
  assert.equal(new Set(round.map((question) => question.id)).size, 5);
});

test("question-kind filters are applied before sampling and bound large rounds", () => {
  for (const kind of ["missing", "meaning", "situation"]) {
    const round = createProverbRound({ kind, size: 100, random: seededRandom(9) });
    assert.equal(round.length, 10);
    assert.ok(round.every((question) => question.kind === kind));
    assert.equal(new Set(round.map((question) => question.id)).size, 10);
  }
  assert.equal(createProverbRound({ size: 100, random: seededRandom(9) }).length, 30);
});

test("shuffling preserves the correct answer text for every question", () => {
  const originals = new Map(proverbQuestions.map((question) => [question.id, question]));
  for (const seed of [0, 1, 42, 2026]) {
    const round = createProverbRound({ size: 30, random: seededRandom(seed) });
    for (const question of round) {
      const original = originals.get(question.id);
      assert.equal(
        question.options[question.correctIndex],
        original.options[original.correctIndex],
        question.id,
      );
      assert.deepEqual([...question.options].sort(), [...original.options].sort());
      assert.equal(question.explanation, original.explanation);
      assert.equal(question.saying, original.saying);
    }
  }
});

test("deterministic randomness shuffles both question and answer order", () => {
  const round = createProverbRound({ size: 30, random: () => 0 });
  assert.notDeepEqual(
    round.map((question) => question.id),
    proverbQuestions.map((question) => question.id),
  );
  for (const question of round) {
    const original = proverbQuestions.find((candidate) => candidate.id === question.id);
    assert.notDeepEqual(question.options, original.options);
  }
  assert.deepEqual(
    createProverbRound({ random: seededRandom(17) }),
    createProverbRound({ random: seededRandom(17) }),
  );
});

test("creating and changing a returned round never changes the bank", () => {
  const before = JSON.stringify(proverbQuestions);
  const round = createProverbRound({ random: seededRandom(11) });
  round[0].options[0] = "A changed answer in a caller's local copy";
  round[0].prompt = "A changed prompt";
  assert.equal(JSON.stringify(proverbQuestions), before);
  assert.ok(Object.isFrozen(proverbQuestions));
  assert.ok(proverbQuestions.every((question) => Object.isFrozen(question) && Object.isFrozen(question.options)));
});

test("a zero-size round does not call randomness", () => {
  assert.deepEqual(
    createProverbRound({ size: 0, random: () => { throw new Error("must not be called"); } }),
    [],
  );
});

test("invalid round options fail instead of creating partial or ambiguous rounds", () => {
  assert.throws(() => createProverbRound({ kind: "unknown" }), RangeError);
  for (const size of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "5", null]) {
    assert.throws(() => createProverbRound({ size }), RangeError);
  }
  for (const random of [null, 1, "random"]) {
    assert.throws(() => createProverbRound({ random }), TypeError);
  }
  for (const value of [-0.01, 1, NaN, Infinity, "0.5"]) {
    assert.throws(() => createProverbRound({ random: () => value }), RangeError);
  }
});

test("valid random boundary values preserve a complete, unique round", () => {
  for (const random of [() => 0, () => 1 - Number.EPSILON]) {
    const round = createProverbRound({ size: 30, random });
    assert.equal(round.length, 30);
    assert.equal(new Set(round.map((question) => question.id)).size, 30);
    assert.ok(round.every((question) => question.correctIndex >= 0 && question.correctIndex < 4));
  }
});
