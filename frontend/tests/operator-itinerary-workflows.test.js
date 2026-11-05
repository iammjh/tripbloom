import test from 'node:test';
import assert from 'node:assert/strict';
import { addDay, addStop, updateStop, removeStop, itineraryErrors, sameItinerary, dayDate, emptyStop } from '../src/utils/operatorItinerary.js';
import { toEditorItinerary, toStoredItinerary } from '../src/operator/departureState.js';

const START = '2027-03-10T00:00:00.000Z';

test('new days are dated from the departure start, not from today', () => {
  const once = addDay({ days: [] }, START);
  const twice = addDay(once, START);
  assert.equal(once.days[0].dayNumber, 1);
  assert.equal(twice.days[1].dayNumber, 2);
  assert.equal(new Date(twice.days[1].date).getDate(), new Date(dayDate(START, 2)).getDate());
  assert.notEqual(new Date(twice.days[1].date).toDateString(), new Date().toDateString());
});

test('editing a stop never mutates the earlier editor state', () => {
  const base = addStop(addDay({ days: [] }, START), 0);
  const edited = updateStop(base, 0, 0, 'name', 'Lake walk');
  assert.equal(base.days[0].activities[0].name, '');
  assert.equal(edited.days[0].activities[0].name, 'Lake walk');
  assert.notEqual(base.days[0], edited.days[0]);
});

test('removing a stop keeps the others in order', () => {
  let editor = addStop(addDay({ days: [] }, START), 0);
  editor = updateStop(editor, 0, 0, 'name', 'First');
  editor = addStop(editor, 0);
  editor = updateStop(editor, 0, 1, 'name', 'Second');
  editor = removeStop(editor, 0, 0);
  assert.deepEqual(editor.days[0].activities.map(stop => stop.name), ['Second']);
});

test('stops without a name or time are reported with their day and position', () => {
  let editor = addStop(addDay({ days: [] }, START), 0);
  assert.deepEqual(itineraryErrors(editor), ['Day 1, stop 1: add a name.']);
  editor = updateStop(editor, 0, 0, 'time', '');
  editor = updateStop(editor, 0, 0, 'name', 'Breakfast');
  assert.deepEqual(itineraryErrors(editor), ['Day 1, stop 1: add a time.']);
  assert.deepEqual(itineraryErrors({ days: [] }), []);
});

test('the saved shape keeps stop status and drops editor-only fields', () => {
  const stored = [{ day: 1, stops: [{ time: '08:00', name: 'Ferry', location: 'Ghat', notes: '', status: 'completed' }] }];
  const editor = toEditorItinerary(stored, START);
  assert.deepEqual(toStoredItinerary(editor), stored);
});

test('sameItinerary detects an unsaved change', () => {
  const saved = toStoredItinerary(toEditorItinerary([], START));
  const changed = toStoredItinerary(addDay({ days: [] }, START));
  assert.equal(sameItinerary(saved, saved), true);
  assert.equal(sameItinerary(saved, changed), false);
});

test('a new stop starts at 09:00 with empty text', () => {
  assert.deepEqual(emptyStop(), { time: '09:00', name: '', location: '', notes: '' });
});
