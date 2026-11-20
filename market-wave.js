(function (root) {
  'use strict';
  const HOUR = 3_600_000;
  const DAY = HOUR * 24;
  const BUCKET = 900_000;
  const MAX_POINTS = 8_000;
  const COINBASE = 'https://api.exchange.coinbase.com';
  const COINGECKO = 'https://api.coingecko.com/api/v3';

  function coinbaseRequest(value, now = Date.now()) {
    const text = String(value ?? '').trim().toUpperCase();
    const pair = text.includes('-') ? text : text + '-USD';
    if (!/^[A-Z0-9]{1,16}-[A-Z0-9]{2,16}$/.test(pair)) throw Error('Enter a market such as BTC-USD or ETH-USD.');
    const through = Math.floor(now / BUCKET) * BUCKET;
    const from = through - DAY;
    const query = new URLSearchParams({
      granularity: '900', start: new Date(from).toISOString(), end: new Date(through).toISOString()
    });
    return { pair, from, through, url: COINBASE + '/products/' + pair + '/candles?' + query };
  }

  function coinbaseSeries(rows, { from, through, pair }) {
    if (!Array.isArray(rows) || rows.length > 300) throw Error('Coinbase did not return a usable chart.');
    const points = [];
    for (const row of rows) {
      if (!Array.isArray(row) || !Number.isFinite(row[0])) continue;
      const time = row[0] * 1000;
      if (time < from || time >= through || time % BUCKET !== 0) continue;
      if (time === from) points.push([time, row[3]]);
      points.push([time + BUCKET, row[4]]);
    }
    if (points.length < 2 || !points.some(row => row[0] === through)) throw Error('This market has no complete recent chart. Try CoinGecko or a price CSV.');
    return series(points, pair, 'Coinbase Exchange', HOUR);
  }

  function coinGeckoSearch(query) {
    const term = String(query ?? '').trim();
    if (!term || term.length > 60) throw Error('Enter a coin name or symbol.');
    return COINGECKO + '/search?' + new URLSearchParams({ query: term });
  }

  function coinGeckoMatches(payload) {
    if (!Array.isArray(payload?.coins)) throw Error('CoinGecko did not return search results.');
    return payload.coins.filter(coin => typeof coin?.id === 'string' && /^[a-z0-9-]{1,125}$/.test(coin.id)
      && typeof coin.name === 'string' && typeof coin.symbol === 'string')
      .slice(0, 12).map(coin => ({ id: coin.id, name: coin.name.slice(0, 64), symbol: coin.symbol.slice(0, 16).toUpperCase() }));
  }

  function coinGeckoChart(id) {
    if (typeof id !== 'string' || !/^[a-z0-9-]{1,125}$/.test(id)) throw Error('Choose a coin from the search results.');
    return COINGECKO + '/coins/' + id + '/market_chart?vs_currency=usd&days=1';
  }

  function timestamp(value) {
    if (/^\d{10}(\.\d+)?$/.test(value)) return Number(value) * 1000;
    if (/^\d{13}$/.test(value)) return Number(value);
    if (/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return Date.parse(value);
    return NaN;
  }

  function csv(value, label = 'Price CSV') {
    if (typeof value !== 'string' || value.length > 1_000_000) throw Error('Choose a price CSV under 1 MB.');
    const rows = value.trim().split(/\r?\n/);
    if (rows.length > MAX_POINTS + 1) throw Error('Use up to 8,000 price rows.');
    const fields = row => row.split(',').map(field => field.trim().replace(/^"([^"]*)"$/, '$1'));
    const headings = fields(rows[0]).map(field => field.toLowerCase());
    const timeIndex = headings.findIndex(field => ['time', 'timestamp', 'date', 'datetime'].includes(field));
    const priceIndex = headings.findIndex(field => ['price', 'close'].includes(field));
    if (timeIndex < 0 || priceIndex < 0) throw Error('Use a CSV with time and price columns. Timestamps must include a timezone or use Unix time.');
    const points = rows.slice(1).filter(row => row.trim()).map(row => {
      const columns = fields(row);
      return [timestamp(columns[timeIndex] ?? ''), columns[priceIndex] ? Number(columns[priceIndex]) : NaN];
    });
    return series(points, label || 'Price CSV', 'Price CSV', 3 * HOUR);
  }

  function series(input, label, source, maxGap = 3 * HOUR) {
    if (!Array.isArray(input) || input.length < 8 || input.length > MAX_POINTS) throw Error('The chart needs at least eight price points over a day.');
    const byTime = new Map();
    for (const point of input) {
      const [time, price] = Array.isArray(point) ? point : [];
      if (!Number.isFinite(time) || time <= 0 || time > 253402300799999 || !Number.isFinite(price) || price <= 0 || price > 1e24) {
        throw Error('The chart contains an invalid timestamp or price.');
      }
      if (byTime.has(time) && byTime.get(time) !== price) throw Error('Two prices use the same timestamp.');
      byTime.set(time, price);
    }
    const sorted = [...byTime].sort((a, b) => a[0] - b[0]);
    const through = sorted.at(-1)[0];
    const points = sorted.filter(point => point[0] >= through - DAY);
    const from = points[0][0];
    if (points.length < 8 || through - from < 23 * HOUR) throw Error('This chart covers less than a day. Use a full 24-hour series.');
    if (points.some((point, i) => i && point[0] - points[i - 1][0] > maxGap)) {
      throw Error('The chart has a long gap. Try another market or a more complete CSV.');
    }
    const prices = points.map(point => point[1]);
    const low = Math.min(...prices);
    const high = Math.max(...prices);
    if (low === high) throw Error('The price is flat across this window. Try another chart with some movement.');
    const height = price => .92 * (2 * (price - low) / (high - low) - 1);
    const trace = points.map(([time, price]) => [(time - from) / (through - from), height(price)]);
    const wave = [];
    let right = 1;
    // Leave four dots for a rounded return from the latest price to the oldest.
    // The editor draws point zero again at the end of the repeating cycle.
    for (let i = 0; i < 28; i++) {
      const phase = i / 27;
      while (trace[right][0] < phase) right++;
      const [leftPhase, leftHeight] = trace[right - 1];
      const [rightPhase, rightHeight] = trace[right];
      const mix = (phase - leftPhase) / (rightPhase - leftPhase);
      wave.push(leftHeight + (rightHeight - leftHeight) * mix);
    }
    for (let i = 1; i <= 4; i++) {
      const mix = .5 - .5 * Math.cos(Math.PI * i / 5);
      wave.push(wave[27] + (wave[0] - wave[27]) * mix);
    }
    return { label: String(label).slice(0, 48), source, from, through, pointCount: points.length, trace, wave };
  }

  function patch(C, original, chart, side) {
    C.assert(side === 'a' || side === 'b', 'Choose wave A or B.');
    C.assert(chart?.wave?.length === C.S.STEPS, 'Load a price chart first.');
    const next = structuredClone(original);
    const voice = next.project[side];
    voice.points = [...chart.wave];
    voice.shape = 'custom';
    voice.pins = [];
    return C.S.validatePatch(next);
  }

  const api = { coinbaseRequest, coinbaseSeries, coinGeckoSearch, coinGeckoMatches, coinGeckoChart, csv, series, patch };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MarketWave = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
