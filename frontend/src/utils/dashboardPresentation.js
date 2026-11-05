export function chartValues(series, filter = 'all') {
  return series.map(day => ({ date: day.date,
    received: filter === 'group' ? day.group : filter === 'personal' ? day.personal : day.group + day.personal,
    refunded: filter === 'group' ? day.groupRefunds : filter === 'personal' ? day.personalRefunds : day.refunds
  })).map(day => ({ ...day, net: Math.round((day.received - day.refunded) * 100) / 100 }));
}
