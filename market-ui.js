(function (root) {
  'use strict';
  root.MarketPanel = function ({ C, audio, ui, getProject, commit, render, chooseFile, esc }) {
    const Market = root.MarketWave;
    const $ = id => document.getElementById(id);
    const state = { source: 'exchange', pair: 'BTC-USD', search: 'bitcoin', results: [], chart: null, status: '' };
    let active = null;
    const dates = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    const formatDate = value => dates.format(value);

    function cancel() {
      if (!active) return;
      active.abort();
      active = null;
      state.status = 'Price request cancelled.';
    }

    async function json(url, signal) {
      const response = await fetch(url, { signal, credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error' });
      if (response.status === 429) throw Error('The price feed is busy. Try again in a minute or open a price CSV.');
      if (response.status === 404 || response.status === 400) throw Error('This market is unavailable. Try CoinGecko search or a price CSV.');
      if (!response.ok) throw Error('The price feed could not load. Try another source or a price CSV.');
      if (Number(response.headers.get('Content-Length')) > 2_000_000) throw Error('That price response is too large.');
      return response.json();
    }

    async function request(message, load, save) {
      cancel();
      const controller = new AbortController();
      active = controller;
      state.status = message;
      render();
      const timeout = setTimeout(() => controller.abort(), 12_000);
      try {
        const result = await load(controller.signal);
        if (active !== controller) return;
        save(result);
      } catch (error) {
        if (active !== controller) return;
        state.status = error.name === 'AbortError'
          ? 'The price feed timed out. Try another source or a price CSV.'
          : error instanceof TypeError
            ? 'The price feed is unreachable here. Try another source or open a price CSV.'
            : error.message;
      } finally {
        clearTimeout(timeout);
        if (active === controller) {
          active = null;
          render();
        }
      }
    }

    function keepChart(chart) {
      state.chart = chart;
      state.status = '';
      if (audio.mini?.id === 'coin-wave' || audio.miniPending === 'coin-wave') audio.stopMiniPreview();
    }

    function loadExchange() {
      const query = Market.coinbaseRequest(state.pair);
      return request('Loading ' + query.pair + '…',
        async signal => Market.coinbaseSeries(await json(query.url, signal), query), keepChart);
    }

    function findCoins() {
      const url = Market.coinGeckoSearch(state.search);
      state.results = [];
      return request('Searching CoinGecko…', async signal => Market.coinGeckoMatches(await json(url, signal)), matches => {
        state.results = matches;
        state.status = matches.length ? 'Choose a coin to load its chart.' : 'No coins found. Try a different name.';
      });
    }

    function loadCoin(id) {
      const coin = state.results.find(item => item.id === id);
      C.assert(coin, 'Choose a coin from the results.');
      return request('Loading ' + coin.name + '…', async signal => {
        const data = await json(Market.coinGeckoChart(id), signal);
        return Market.series(data.prices, coin.name + ' / USD', 'CoinGecko');
      }, keepChart);
    }

    function readCSV(text, filename) {
      const name = filename.replace(/\.csv$/i, '').trim() || 'Price CSV';
      keepChart(Market.csv(text, name));
      render();
    }

    function moveToWave(side) {
      const project = getProject();
      const patch = Market.patch(C, project.patch, state.chart, side);
      const label = state.chart.label.replace(/[\x00-\x1f]/g, '').slice(0, 25);
      const day = new Date(state.chart.through).toISOString().slice(0, 10);
      commit(() => {
        project.patch = patch;
        ui.soundName = label + ' 24h ' + day;
        ui.soundMode = 'wave';
        ui.shaper.side = side;
      }, 'Price outline added to wave ' + side.toUpperCase() + '. Shape it or keep the patch tone.');
    }

    function view() {
      const disabled = active ? 'disabled' : '';
      const inputs = {
        exchange: `<label class="field">Market<input id="market-pair" data-market-field="pair" value="${esc(state.pair)}" maxlength="34"
          placeholder="BTC-USD" autocomplete="off" ${disabled}></label>
          <button class="primary" data-market-action="exchange" ${disabled}>Load 24h chart</button>`,
        gecko: `<label class="field">Coin name or symbol<input id="market-search" data-market-field="search" value="${esc(state.search)}" maxlength="60"
          placeholder="Bitcoin" autocomplete="off" ${disabled}></label>
          <button class="primary" data-market-action="search" ${disabled}>Search coins</button>`,
        csv: '<button class="primary" data-market-action="csv">Open price CSV</button>'
      };
      const chart = state.chart;
      const mode = [['exchange', 'Coinbase Exchange'], ['gecko', 'CoinGecko search'], ['csv', 'Price CSV']];
      return `<section class="panel market-room">
        <div class="panel-head"><h2>Coin wave</h2></div>
        <div class="panel-body">
          <div class="market-inputs"><label class="field">Price source<select id="market-source">${mode.map(([id, label]) =>
            `<option value="${id}" ${id === state.source ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
            ${inputs[state.source]}${active ? '<button data-market-action="cancel">Cancel</button>' : ''}</div>
          ${state.source === 'csv' ? '<p class="subtle">Use time and price columns spanning a full day. Use ISO timestamps with a timezone or Unix time in seconds or milliseconds.</p>' : ''}
          <p id="market-status" role="status">${esc(state.status)}</p>
          ${state.source === 'gecko' && state.results.length ? `<div class="market-coins">${state.results.map(coin =>
            `<button data-market-action="coin" data-id="${esc(coin.id)}" ${disabled}>${esc(coin.symbol)} · ${esc(coin.name)}</button>`).join('')}</div>` : ''}
          ${chart ? `<div class="market-result"><div class="market-summary"><strong>${esc(chart.label)}</strong>
            <span>${esc(chart.source)} · ${chart.pointCount} prices · ${esc(formatDate(chart.from))} → ${esc(formatDate(chart.through))}</span></div>
            <div class="market-charts"><div><span>Price · oldest to newest</span><canvas id="market-price" aria-label="Coin price trace"></canvas></div>
              <div><span>32-dot loop · rounded return</span><canvas id="market-wave" aria-label="Repeating waveform from the price chart"></canvas></div></div>
            <div class="control-row market-actions">
              <button class="mini-play" data-market-action="preview" data-id="coin-wave" data-name="Coin wave"
                aria-label="Play Coin wave for 3 seconds" aria-pressed="false"><span class="mini-icon">▶</span><span class="mini-time">3s</span><span class="mini-pitch">Coin wave</span></button>
              <button class="secondary" data-market-action="wave" data-side="a">Use as wave A</button>
              <button class="secondary" data-market-action="wave" data-side="b">Use as wave B</button>
            </div></div>` : '<p class="subtle">Turn a day of price movement into a repeating outline you can play and shape.</p>'}
        </div></section>`;
    }

    function trace(canvas, points, color, returnStart) {
      if (!canvas) return;
      const ratio = Math.min(root.devicePixelRatio || 1, 2);
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      const context = canvas.getContext('2d');
      const x = phase => 6 + phase * (width - 12);
      const y = value => height * (.5 - value * .42);
      context.scale(ratio, ratio);
      context.strokeStyle = '#415452';
      context.beginPath();
      context.moveTo(x(0), y(0));
      context.lineTo(x(1), y(0));
      context.stroke();
      if (returnStart !== undefined) {
        context.fillStyle = '#29433a';
        context.fillRect(x(returnStart), 0, x(1) - x(returnStart), height);
      }
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.beginPath();
      points.forEach(([phase, value], i) => i ? context.lineTo(x(phase), y(value)) : context.moveTo(x(phase), y(value)));
      context.stroke();
    }

    function paint() {
      if (!state.chart) return;
      trace($('market-price'), state.chart.trace, '#9ad9f6');
      const points = [...state.chart.wave, state.chart.wave[0]].map((height, i) => [i / 32, height]);
      trace($('market-wave'), points, '#b8f58b', 27 / 32);
    }

    function setField(event) {
      const key = event.target.dataset.marketField;
      if (key) state[key] = event.target.value;
    }
    document.addEventListener('input', setField);
    document.addEventListener('change', event => {
      if (event.target.id !== 'market-source') return;
      cancel();
      state.source = event.target.value;
      state.status = '';
      render();
    });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Enter' || active) return;
      if (event.target.id === 'market-pair') document.querySelector('[data-market-action=exchange]')?.click();
      if (event.target.id === 'market-search') document.querySelector('[data-market-action=search]')?.click();
    });
    document.addEventListener('click', async event => {
      const button = event.target.closest('[data-market-action]');
      if (!button || button.disabled) return;
      try {
        switch (button.dataset.marketAction) {
          case 'exchange': await loadExchange(); break;
          case 'search': await findCoins(); break;
          case 'coin': await loadCoin(button.dataset.id); break;
          case 'csv': chooseFile('market-csv'); break;
          case 'cancel': cancel(); render(); break;
          case 'wave': moveToWave(button.dataset.side); break;
          case 'preview': {
            const side = ui.shaper.side;
            const patch = Market.patch(C, getProject().patch, state.chart, side);
            await audio.previewSound({ id: 'coin-wave' }, { patch, target: side }); break;
          }
        }
      } catch (error) {
        state.status = error.message;
        if ($('market-status')) $('market-status').textContent = state.status;
      }
    });
    root.addEventListener('pagehide', cancel);
    return { view, paint, readCSV, cancel };
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
