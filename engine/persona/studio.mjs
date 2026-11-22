// The studio: one world opened for a front end (the console's Cast & places and its strand graph; the user, 2026-11-21:
// "selecting on the strand view canvas and add fork to enable a character simulation chat, a character and building
// library"). Everything a front end shows of the world's people and places, across every book read, and calls forked from
// any scene: the chosen person as they are at that scene, knowing only what they lived up to it (session.mjs openWorld),
// each call on its own branch, the canon never changed.
//
//   const studio = await openStudio(library, { mock })
//   studio.library()                  people and places, with counts (no model call)
//   studio.person(id)                 one person: books, scenes, places, what they lived (no model call)
//   studio.place(id)                  one place: its chain, scenes, who goes there, its box where the world engine built it
//   await studio.fork({ book, scene, person })   a call at a scene: { call, name, card, present, at, world } (writes the
//                                     person's two cards for that point once, with the work model, unless mock)
//   await studio.turn(call, text)     one turn of a forked call (text null: time passes)
//   await studio.ask(call, question)  the world agent, for that call
// Nothing here is about any one book.
import { randomBytes } from 'node:crypto';
import { openUniverse, openWorld } from './session.mjs';
import { clockText } from './world.mjs';

const CALLS_KEPT = 50;

export async function openStudio(folder, { mock = false } = {}) {
  const shared = await openUniverse({ library: folder, mock }), { u, world } = shared;
  const personOf = new Map(u.cast.persons.flatMap((p) => p.members.map((m) => [`${m.book}/${m.entity}`, p.id])));
  const memoriesOf = new Map();
  for (const m of u.memories) (memoriesOf.get(m.holderId) ?? memoriesOf.set(m.holderId, []).get(m.holderId)).push(m);
  const scenesOf = new Map(), placeScenes = new Map();
  for (const s of world.scenes) {
    for (const p of s.people) (scenesOf.get(p.person) ?? scenesOf.set(p.person, []).get(p.person)).push(s);
    if (s.place) (placeScenes.get(s.place) ?? placeScenes.set(s.place, []).get(s.place)).push(s);
  }
  const point = (s) => ({ book: s.book, scene: s.id, order: s.order, when: clockText(s.clock) });
  const chainOf = (placeId) => world.chain(placeId).map((p) => p.label);
  // A place's id in the world (book/loc) back from its record.
  const placeIds = new Map([...world.places.entries()].map(([id, p]) => [p, id]));

  function library() {
    const people = u.people.map((p) => {
      const scenes = scenesOf.get(p.id) ?? [], memories = memoriesOf.get(p.id) ?? [];
      const books = [...new Set(scenes.map((s) => s.book))];
      return { id: p.id, name: p.name, forms: p.forms.slice(0, 6), books, scenes: scenes.length, memories: memories.length, first: scenes[0] ? point(scenes[0]) : null, last: scenes.at(-1) ? point(scenes.at(-1)) : null };
    }).filter((p) => p.scenes || p.memories).sort((a, b) => b.memories - a.memories || b.scenes - a.scenes);
    // A place each book names again is one entry: the same name at the same scale in the same city.
    const merged = new Map();
    for (const id of world.places.keys()) {
      const key = placeKey(id), entry = merged.get(key) ?? merged.set(key, { id: key, ids: [] }).get(key);
      entry.ids.push(id);
    }
    const places = [...merged.values()].map(({ id, ids }) => {
      const p = world.places.get(ids[0]), scenes = ids.flatMap((x) => placeScenes.get(x) ?? []);
      return { id, label: p.label, scale: p.scale ?? null, chain: chainOf(ids[0]).slice(1, 4), books: [...new Set(ids.map((x) => x.split('/')[0]))], scenes: scenes.length, people: new Set(scenes.flatMap((s) => s.people.map((x) => x.person))).size, built: scenes.some((s) => s.box), box: scenes.find((s) => s.box)?.box ?? null, floors: scenes.find((s) => s.box)?.floors ?? null };
    }).sort((a, b) => b.scenes - a.scenes);
    return { books: u.books.map((b) => ({ book: b.book, scenes: b.scenes })), staged: world.staged, people, places };
  }
  // The city a place is in (its chain's top), so two streets of one name in two cities stay apart.
  function placeKey(id) { const p = world.places.get(id), chain = chainOf(id); return `${p.scale ?? ''}|${p.label}|${chain.at(-1) ?? ''}`; }
  const idsOf = (key) => { const ids = [...world.places.keys()].filter((id) => placeKey(id) === key); return ids.length ? ids : world.places.has(key) ? [key] : []; };

  function person(id) {
    const p = u.people.find((x) => x.id === id);
    if (!p) throw new Error(`no person ${id}`);
    const scenes = scenesOf.get(id) ?? [], memories = memoriesOf.get(id) ?? [];
    const visits = new Map();
    for (const s of scenes) if (s.place) visits.set(s.place, (visits.get(s.place) ?? 0) + 1);
    const met = new Map();
    for (const s of scenes) for (const x of s.people) if (x.person !== id) met.set(x.person, (met.get(x.person) ?? 0) + 1);
    const byBook = u.books.map((b) => ({ book: b.book, scenes: scenes.filter((s) => s.book === b.book).length, memories: memories.filter((m) => m.book === b.book).length })).filter((b) => b.scenes || b.memories);
    const lived = [...memories].sort((a, b) => (b.arousal + b.relevance) - (a.arousal + a.relevance)).slice(0, 12).sort((a, b) => a.atOrder - b.atOrder)
      .map((m) => ({ book: m.book, scene: m.scene, order: m.atOrder, what: m.summaryEn, mood: { arousal: m.arousal, valence: m.valence } }));
    return {
      id, name: p.name, forms: p.forms, books: byBook,
      places: [...visits].filter(([place]) => world.places.has(place)).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([place, n]) => ({ id: placeKey(place), label: world.places.get(place).label, chain: chainOf(place).slice(1, 3), scenes: n })),
      met: [...met].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([who, n]) => ({ id: who, name: u.nameOf(who), scenes: n })),
      lived, first: scenes[0] ? point(scenes[0]) : null, last: scenes.at(-1) ? point(scenes.at(-1)) : null,
      // Points to fork a call from: the last scene of each book they are in.
      forkable: byBook.map((b) => scenes.filter((s) => s.book === b.book).at(-1)).filter(Boolean).map(point),
    };
  }

  /** A place of the library (its merged id, or one book's place id). */
  function place(id) {
    const ids = idsOf(id), p = world.places.get(ids[0]);
    if (!p) throw new Error(`no place ${id}`);
    const scenes = ids.flatMap((x) => placeScenes.get(x) ?? []).sort((a, b) => a.order - b.order);
    const inside = new Map();
    for (const [cid, c] of world.places) if (ids.includes(c.parent)) { const key = placeKey(cid), e = inside.get(key) ?? inside.set(key, { id: key, label: c.label, scale: c.scale ?? null, scenes: 0 }).get(key); e.scenes += (placeScenes.get(cid) ?? []).length; }
    const children = [...inside.values()].sort((a, b) => b.scenes - a.scenes);
    id = placeKey(ids[0]);
    const who = new Map();
    for (const s of scenes) for (const x of s.people) who.set(x.person, (who.get(x.person) ?? 0) + 1);
    const built = scenes.find((s) => s.box);
    return {
      id, label: p.label, scale: p.scale ?? null, chain: chainOf(ids[0]), children, books: [...new Set(ids.map((x) => x.split('/')[0]))],
      people: [...who].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([pid, n]) => ({ id: pid, name: u.nameOf(pid), scenes: n })),
      scenes: scenes.slice(0, 60).map((s) => ({ ...point(s), people: s.people.map((x) => u.nameOf(x.person)).slice(0, 6), happens: s.happens.slice(0, 1).map((h) => `${u.nameOf(h.who)}: ${h.what}`) })),
      box: built ? { box: built.box, floors: built.floors } : null,
    };
  }

  // Forked calls: one opened world per person and point (its cards written once), a call of its own per fork.
  const opened = new Map(), calls = new Map();
  /** A scene of a book as a story point (book:<its number in the reading>), and who of the world a book's entity is. */
  const pointOf = (book, scene) => {
    const b = u.books.find((x) => x.book === book);
    if (!b) throw new Error(`no book ${book} in this world (read: ${u.books.map((x) => x.book).join(', ')})`);
    let i = b.ids.indexOf(scene);
    if (i < 0) i = b.ids.indexOf(String(scene).replace(/[#:.].*$/, ''));
    if (i < 0) throw new Error(`no scene ${scene} in ${book}`);
    return `${book}:${i + 1}`;
  };
  const personFor = (book, who) => (u.people.some((p) => p.id === who) ? who : personOf.get(`${book}/${who}`) ?? null);

  async function fork({ book, scene, person: who }) {
    const personId = personFor(book, who);
    if (!personId) throw new Error(`${who} is no one of this world's cast`);
    const at = pointOf(book, scene), key = `${personId}@${at}`;
    if (!opened.has(key)) opened.set(key, openWorld({ library: folder, person: personId, at, mock }, shared));
    const w = await opened.get(key).catch((error) => { opened.delete(key); throw error; });
    const id = randomBytes(8).toString('hex'), call = w.newCall();
    calls.set(id, { call, person: personId, at });
    if (calls.size > CALLS_KEPT) calls.delete(calls.keys().next().value);
    return { call: id, branch: call.branch, person: personId, name: w.self.name, at, mock, card: w.self.card, present: w.self.present, world: call.glimpse() };
  }
  const callOf = (id) => { const c = calls.get(id); if (!c) throw new Error('That call has ended; fork it again.'); return c.call; };
  const turn = (id, text) => callOf(id).send(typeof text === 'string' && text.trim() ? { from: 'stranger', text: text.trim().slice(0, 1000) } : null);
  const ask = (id, question) => callOf(id).ask(String(question).trim().slice(0, 600));

  /** A book's entities that are people of the world's cast: { entity: person id }. */
  const members = (book) => Object.fromEntries(u.cast.persons.flatMap((p) => p.members.filter((m) => m.book === book).map((m) => [m.entity, p.id])));

  return { library, person, place, fork, turn, ask, personFor, members, mock, close: () => u.close() };
}
