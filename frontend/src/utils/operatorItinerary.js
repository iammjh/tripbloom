// Itinerary editor state for an operator. The editor works on { days: [{ dayNumber, date, activities }] };
// the server stores { day, stops } (see operator/departureState.js for the conversion).
// Every helper returns a new object, so React state is never mutated in place.

export function dayDate(startDate, dayNumber) {
  const date = new Date(startDate);
  date.setDate(date.getDate() + Number(dayNumber) - 1);
  return date;
}

export function emptyStop() {
  return { time: '09:00', name: '', location: '', notes: '' };
}

export function addDay(editor, startDate) {
  const dayNumber = editor.days.length + 1;
  return { days: [...editor.days, { dayNumber, date: dayDate(startDate, dayNumber), activities: [] }] };
}

export function addStop(editor, dayIndex) {
  return {
    days: editor.days.map((day, index) => (index === dayIndex ? { ...day, activities: [...day.activities, emptyStop()] } : day))
  };
}

export function updateStop(editor, dayIndex, stopIndex, field, value) {
  return {
    days: editor.days.map((day, index) => (index !== dayIndex ? day : {
      ...day,
      activities: day.activities.map((stop, position) => (position === stopIndex ? { ...stop, [field]: value } : stop))
    }))
  };
}

export function removeStop(editor, dayIndex, stopIndex) {
  return {
    days: editor.days.map((day, index) => (index !== dayIndex ? day : {
      ...day,
      activities: day.activities.filter((_, position) => position !== stopIndex)
    }))
  };
}

// Messages for stops that cannot be saved yet. An empty itinerary is allowed.
export function itineraryErrors(editor) {
  const errors = [];
  editor.days.forEach(day => {
    day.activities.forEach((stop, index) => {
      const place = `Day ${day.dayNumber}, stop ${index + 1}`;
      if (!String(stop.time || '').trim()) errors.push(`${place}: add a time.`);
      if (!String(stop.name || '').trim()) errors.push(`${place}: add a name.`);
    });
  });
  return errors;
}

export function sameItinerary(first, second) {
  return JSON.stringify(first) === JSON.stringify(second);
}
