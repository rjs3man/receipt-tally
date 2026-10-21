// Turns OCR text from a receipt or a credit-card app screenshot into expense rows.
// Pure functions only, so it can be tested without the UI.
(function (global) {
  'use strict';

  const CATEGORIES = ['Dining', 'Groceries', 'Transport', 'Shopping', 'Travel', 'Subscriptions', 'Bills', 'Health', 'Entertainment', 'Other'];

  // Known merchants: [match text, display name, category]
  const BRANDS = [
    ['starbucks', 'Starbucks', 'Dining'], ['dunkin', "Dunkin'", 'Dining'], ['mcdonald', "McDonald's", 'Dining'],
    ['chipotle', 'Chipotle', 'Dining'], ['sweetgreen', 'Sweetgreen', 'Dining'], ['chick-fil-a', 'Chick-fil-A', 'Dining'],
    ['panera', 'Panera Bread', 'Dining'], ['shake shack', 'Shake Shack', 'Dining'], ['subway', 'Subway', 'Dining'],
    ['doordash', 'DoorDash', 'Dining'], ['grubhub', 'Grubhub', 'Dining'], ['uber eats', 'Uber Eats', 'Dining'],
    ['domino', "Domino's", 'Dining'], ['taco bell', 'Taco Bell', 'Dining'], ['wendy', "Wendy's", 'Dining'],
    ['whole foods', 'Whole Foods', 'Groceries'], ["trader joe", "Trader Joe's", 'Groceries'], ['safeway', 'Safeway', 'Groceries'],
    ['kroger', 'Kroger', 'Groceries'], ['wegmans', 'Wegmans', 'Groceries'], ['aldi', 'Aldi', 'Groceries'],
    ['acme', 'Acme', 'Groceries'], ['giant', 'Giant', 'Groceries'], ['publix', 'Publix', 'Groceries'],
    ['instacart', 'Instacart', 'Groceries'], ['costco', 'Costco', 'Groceries'], ['sprouts', 'Sprouts', 'Groceries'],
    ['lyft', 'Lyft', 'Transport'], ['uber', 'Uber', 'Transport'], ['shell', 'Shell', 'Transport'],
    ['exxon', 'Exxon', 'Transport'], ['chevron', 'Chevron', 'Transport'], ['sunoco', 'Sunoco', 'Transport'],
    ['wawa', 'Wawa', 'Transport'], ['septa', 'SEPTA', 'Transport'], ['amtrak', 'Amtrak', 'Transport'],
    ['mta', 'MTA', 'Transport'], ['e-zpass', 'E-ZPass', 'Transport'], ['ezpass', 'E-ZPass', 'Transport'],
    ['amazon', 'Amazon', 'Shopping'], ['target', 'Target', 'Shopping'], ['walmart', 'Walmart', 'Shopping'],
    ['best buy', 'Best Buy', 'Shopping'], ['apple store', 'Apple Store', 'Shopping'], ['nike', 'Nike', 'Shopping'],
    ['uniqlo', 'Uniqlo', 'Shopping'], ['zara', 'Zara', 'Shopping'], ['etsy', 'Etsy', 'Shopping'], ['ebay', 'eBay', 'Shopping'],
    ['ikea', 'IKEA', 'Shopping'], ['home depot', 'Home Depot', 'Shopping'], ['lowe', "Lowe's", 'Shopping'],
    ['delta', 'Delta', 'Travel'], ['united airlines', 'United Airlines', 'Travel'], ['american airlines', 'American Airlines', 'Travel'],
    ['southwest', 'Southwest', 'Travel'], ['jetblue', 'JetBlue', 'Travel'], ['marriott', 'Marriott', 'Travel'],
    ['hilton', 'Hilton', 'Travel'], ['hyatt', 'Hyatt', 'Travel'], ['airbnb', 'Airbnb', 'Travel'], ['expedia', 'Expedia', 'Travel'],
    ['netflix', 'Netflix', 'Subscriptions'], ['spotify', 'Spotify', 'Subscriptions'], ['hulu', 'Hulu', 'Subscriptions'],
    ['disney+', 'Disney+', 'Subscriptions'], ['youtube', 'YouTube', 'Subscriptions'], ['icloud', 'iCloud', 'Subscriptions'],
    ['adobe', 'Adobe', 'Subscriptions'], ['openai', 'OpenAI', 'Subscriptions'], ['anthropic', 'Anthropic', 'Subscriptions'],
    ['patreon', 'Patreon', 'Subscriptions'], ['audible', 'Audible', 'Subscriptions'],
    ['verizon', 'Verizon', 'Bills'], ['at&t', 'AT&T', 'Bills'], ['t-mobile', 'T-Mobile', 'Bills'], ['comcast', 'Comcast', 'Bills'],
    ['xfinity', 'Xfinity', 'Bills'], ['peco', 'PECO', 'Bills'], ['con edison', 'Con Edison', 'Bills'],
    ['cvs', 'CVS', 'Health'], ['walgreens', 'Walgreens', 'Health'], ['rite aid', 'Rite Aid', 'Health'],
    ['equinox', 'Equinox', 'Health'], ['planet fitness', 'Planet Fitness', 'Health'], ['orangetheory', 'Orangetheory', 'Health'],
    ['amc', 'AMC Theatres', 'Entertainment'], ['ticketmaster', 'Ticketmaster', 'Entertainment'], ['steam', 'Steam', 'Entertainment'],
    ['playstation', 'PlayStation', 'Entertainment'], ['xbox', 'Xbox', 'Entertainment'], ['stubhub', 'StubHub', 'Entertainment'],
  ];

  const KEYWORDS = {
    Dining: ['restaurant', 'cafe', 'café', 'coffee', 'pizza', 'pizzeria', 'grill', 'kitchen', 'bistro', 'taco', 'burger', 'sushi', 'bakery', 'diner', 'tavern', 'pub', 'bar', 'ramen', 'deli', 'espresso', 'server', 'table', 'gratuity', 'tip'],
    Groceries: ['grocery', 'market', 'supermarket', 'produce', 'foods'],
    Transport: ['gas', 'fuel', 'parking', 'transit', 'toll', 'taxi', 'cab', 'rideshare', 'unleaded', 'gallons'],
    Travel: ['airlines', 'airline', 'hotel', 'inn', 'resort', 'flight', 'airport'],
    Subscriptions: ['subscription', 'monthly plan', 'membership'],
    Bills: ['electric', 'utility', 'internet', 'wireless', 'water', 'insurance', 'rent'],
    Health: ['pharmacy', 'clinic', 'dental', 'medical', 'gym', 'fitness', 'rx', 'doctor'],
    Entertainment: ['cinema', 'theater', 'theatre', 'tickets', 'concert', 'museum', 'bowling'],
  };

  const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
  const RE_MON_D_Y = new RegExp('\\b' + MONTH_RE + '\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4}))?', 'i');
  const RE_D_MON_Y = new RegExp('\\b(\\d{1,2})\\s+' + MONTH_RE + '\\.?,?(?:\\s+(\\d{4}))?\\b', 'i');
  const RE_ISO = /\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/;
  const RE_MDY = /\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4}|\d{2})\b/;
  const RE_MD = /(?<![\d/])(\d{1,2})\/(\d{1,2})(?![\d/])/;

  const AMOUNT_RE = /(?<![\d.,])(\()?(-|−|–)?\s?(\$|€|£|USD\s?)?\s?(-|−|–)?(\d{1,3}(?:,\d{3})+|\d+)[.,](\d{2})(?![\d%])(?!\s?%)(\))?/g;

  // Strongest signal first.
  const TOTAL_RULES = [
    [/\b(grand\s*t[o0]t[a4][l1i|]|t[o0]t[a4][l1i|]\s*(due|charged|paid)|amount\s*(due|charged|paid)|balance\s*due|you\s*paid|order\s*t[o0]t[a4][l1i|])\b/i, 3],
    [/\bt[o0]t[a4][l1i|]\b/i, 2],
    [/\b(amount|charged|purchase|visa|mastercard|master\s*card|amex|american\s*express|discover|debit|credit|card|paid)\b/i, 1],
  ];
  const NOT_TOTAL = /\b(sub\s*-?\s*t[o0]t[a4][l1i|]|tax|tip|gratuity|discount|savings?|saved|change|cash\s*back|points|rewards|items?\s*(sold|count)|before\s*tax|suggested|balance\s*remaining|available)\b/i;
  const RECEIPT_HINTS = /\b(sub\s*-?\s*t[o0]t[a4][l1i|]|tax|qty|quantity|cashier|register|receipt|item|server|table|change\s*due)\b/i;
  const LIST_SKIP = /\b(balance|available|credit\s*limit|statement|minimum|payment\s*due|rewards|points|apr|interest\s*charged|spending\s*limit)\b/i;
  const CREDIT_WORDS = /\b(payment|thank\s*you|autopay|refund|returned|credit|cashback|reversal)\b/i;
  const MERCHANT_JUNK = /\b(receipt|welcome|thank|store\s*#|tel|phone|fax|www|http|\.com|order|transaction|date|time|cashier|server|table|guest|check|invoice|street|st\.|ave|avenue|road|rd\.|blvd|suite|ste\.?|pending|posted|merchant|copy|customer|approved|auth|ref)\b/i;

  function pad(n) { return String(n).padStart(2, '0'); }

  function isoOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  function makeDate(y, m, d) {
    if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2000 && y <= 2100)) return null;
    const dt = new Date(y, m - 1, d);
    if (dt.getMonth() !== m - 1) return null;
    return isoOf(dt);
  }

  // A date with no year belongs to the most recent year that doesn't put it in the future.
  function withInferredYear(m, d, today) {
    let iso = makeDate(today.getFullYear(), m, d);
    if (iso && iso > isoOf(new Date(today.getTime() + 2 * 86400000))) iso = makeDate(today.getFullYear() - 1, m, d);
    return iso;
  }

  function monthNum(word) { return MONTHS[word.slice(0, 3).toLowerCase()]; }

  // Returns { iso, match } or null.
  function findDate(line, today) {
    let m;
    if ((m = line.match(RE_ISO))) { const iso = makeDate(+m[1], +m[2], +m[3]); if (iso) return { iso, match: m[0] }; }
    if ((m = line.match(RE_MDY))) {
      let y = +m[3]; if (y < 100) y += 2000;
      const iso = makeDate(y, +m[1], +m[2]) || makeDate(y, +m[2], +m[1]);
      if (iso) return { iso, match: m[0] };
    }
    if ((m = line.match(RE_MON_D_Y))) {
      const iso = m[3] ? makeDate(+m[3], monthNum(m[1]), +m[2]) : withInferredYear(monthNum(m[1]), +m[2], today);
      if (iso) return { iso, match: m[0] };
    }
    if ((m = line.match(RE_D_MON_Y))) {
      const iso = m[3] ? makeDate(+m[3], monthNum(m[2]), +m[1]) : withInferredYear(monthNum(m[2]), +m[1], today);
      if (iso) return { iso, match: m[0] };
    }
    if ((m = line.match(/\btoday\b/i))) return { iso: isoOf(today), match: m[0] };
    if ((m = line.match(/\byesterday\b/i))) return { iso: isoOf(new Date(today.getTime() - 86400000)), match: m[0] };
    if ((m = line.match(RE_MD))) { const iso = withInferredYear(+m[1], +m[2], today); if (iso) return { iso, match: m[0] }; }
    return null;
  }

  // Fix common OCR slips around money: "S12.99" -> "$12.99", "12 .99" -> "12.99", "1O.5O" -> "10.50".
  function cleanLine(line) {
    return line
      .replace(/(^|[\s:])[Ss](?=\d+[.,]\d{2}(?!\d))/g, (all, pre) => pre + '$')
      .replace(/(\d)\s+([.,])\s*(\d{2})(?!\d)/g, '$1$2$3')
      .replace(/(?<=\d)[oO](?=[\d.,])|(?<=[\d.,])[oO](?=\d|\b)/g, '0')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function findAmounts(line) {
    const out = [];
    let m;
    AMOUNT_RE.lastIndex = 0;
    while ((m = AMOUNT_RE.exec(line))) {
      const value = parseFloat(m[5].replace(/,/g, '') + '.' + m[6]);
      const negative = !!(m[2] || m[4] || (m[1] && m[7]));
      out.push({ value: negative ? -value : value, index: m.index, raw: m[0], hasCurrency: !!m[3] });
    }
    return out;
  }

  function titleCase(s) {
    if (s !== s.toUpperCase()) return s;
    return s.toLowerCase().replace(/\b([a-z])/g, c => c.toUpperCase());
  }

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function hasWord(text, word) { return new RegExp('(^|[^a-z])' + escapeRe(word) + '($|[^a-z])', 'i').test(text); }

  function findBrand(text) {
    for (const [key, name, cat] of BRANDS) if (hasWord(text, key)) return { name, cat };
    return null;
  }

  function normMerchant(s) { return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

  function categorize(merchant, context, learned) {
    const key = normMerchant(merchant);
    if (learned && key && learned[key]) return learned[key];
    const brand = findBrand(merchant) || (context ? findBrand(context) : null);
    if (brand) return brand.cat;
    const hay = (merchant + ' ' + (context || '')).toLowerCase();
    for (const cat of Object.keys(KEYWORDS)) if (KEYWORDS[cat].some(w => hasWord(hay, w))) return cat;
    return 'Other';
  }

  function letters(s) { return (s.match(/[a-z]/gi) || []).length; }

  // The text left on a line once amounts, dates and card fragments are taken out.
  function textPart(line, today) {
    let s = line;
    const d = findDate(s, today);
    if (d) s = s.replace(d.match, ' ');
    s = s.replace(AMOUNT_RE, ' ')
      .replace(/\b(pending|posted|purchase|debit|credit|card|visa|mastercard|amex)\b/gi, ' ')
      .replace(/[*x•·]{2,}\s?\d{2,4}/gi, ' ')
      .replace(/[|_~>»<«]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^[^a-z0-9]+|[^a-z0-9)'.!&+]+$/gi, '');
    return s;
  }

  function guessMerchant(lines, fullText, today) {
    const brand = findBrand(fullText);
    if (brand) return brand.name;
    for (const line of lines.slice(0, 8)) {
      const t = textPart(line, today);
      if (letters(t) >= 3 && !MERCHANT_JUNK.test(t) && !/^\d/.test(t)) return titleCase(t).slice(0, 60);
    }
    return '';
  }

  function parse(text, opts) {
    opts = opts || {};
    const today = opts.today ? new Date(opts.today + 'T12:00:00') : new Date();
    const learned = opts.learned || {};
    const lines = String(text || '').split(/\r?\n/).map(cleanLine).filter(l => l.length > 0);
    const fullText = lines.join('\n');

    const info = lines.map(l => ({ line: l, amounts: findAmounts(l), date: findDate(l, today) }));
    const amountLines = info.filter(x => x.amounts.length > 0);
    const allAmounts = [];
    for (const x of amountLines) for (const a of x.amounts) if (!allAmounts.includes(Math.abs(a.value))) allAmounts.push(Math.abs(a.value));
    const candidates = allAmounts.filter(v => v > 0).sort((a, b) => b - a).slice(0, 8);
    const firstDate = (info.find(x => x.date) || {}).date;
    const docDate = firstDate ? firstDate.iso : isoOf(today);

    function single(amount, reason) {
      const merchant = guessMerchant(lines, fullText, today);
      return {
        mode: 'receipt', reason,
        items: amount == null ? [] : [{
          date: docDate, merchant, amount: Math.abs(amount),
          category: categorize(merchant, fullText, learned), checked: true, candidates,
        }],
      };
    }

    // 1) A line that says "total" (or similar) wins.
    let best = null;
    info.forEach((x, i) => {
      if (NOT_TOTAL.test(x.line) && !/grand\s*t[o0]t/i.test(x.line)) return;
      const rule = TOTAL_RULES.find(([re]) => re.test(x.line));
      if (!rule) return;
      let amt = x.amounts.length ? x.amounts[x.amounts.length - 1].value : null;
      for (let j = i + 1; amt == null && j <= i + 2 && j < info.length; j++) {
        if (info[j].amounts.length && !NOT_TOTAL.test(info[j].line)) amt = info[j].amounts[0].value;
      }
      if (amt == null || amt === 0) return;
      const score = rule[1];
      if (!best || score > best.score || (score === best.score && Math.abs(amt) > Math.abs(best.amt))) best = { score, amt };
    });

    const listy = amountLines.filter(x => !LIST_SKIP.test(x.line));
    const dateLines = info.filter(x => x.date).length;
    const looksLikeList = listy.length >= 2 && dateLines >= 2 && !RECEIPT_HINTS.test(fullText);

    if (best && (best.score >= 2 || !looksLikeList)) return single(best.amt, 'total');
    if (amountLines.length === 0) return { mode: 'none', reason: 'no amounts', items: [] };
    if (!looksLikeList) {
      if (candidates.length <= 1 || RECEIPT_HINTS.test(fullText) || listy.length < 2) return single(candidates[0] != null ? candidates[0] : null, 'largest');
    }

    // 2) Otherwise treat it as a list of card transactions.
    const items = [];
    const isDateOnly = x => x.date && !x.amounts.length && letters(textPart(x.line, today)) < 3;
    // Apps either group rows under date headings ("Today", "Oct 17") or print a date under each row.
    const firstDateOnly = info.findIndex(isDateOnly);
    const headerStyle = firstDateOnly >= 0 && firstDateOnly < info.indexOf(amountLines[0]);
    let headerDate = null;
    info.forEach((x, i) => {
      if (isDateOnly(x)) headerDate = x.date.iso;
      if (!x.amounts.length || LIST_SKIP.test(x.line)) return;
      const amt = x.amounts[x.amounts.length - 1];
      let merchant = textPart(x.line, today);
      let merchantLine = '';
      if (letters(merchant) < 3) {
        merchant = '';
        for (let j = i - 1; j >= Math.max(0, i - 2); j--) {
          if (info[j].amounts.length) break;
          const t = textPart(info[j].line, today);
          if (letters(t) >= 3) { merchant = t; merchantLine = info[j].line; break; }
        }
      }
      let date = x.date ? x.date.iso : null;
      if (!date && headerStyle) date = headerDate;
      for (const j of [i + 1, i - 1, i + 2, i - 2]) {
        if (date || j < 0 || j >= info.length) continue;
        if (isDateOnly(info[j])) date = info[j].date.iso;
      }
      const brand = findBrand(merchant);
      // Drop payment-processor prefixes like "SQ *" or "TST* ".
      const name = brand ? brand.name : titleCase(merchant.replace(/^(sq|tst|sp|py|pp|paypal|dd|ddbr|clv)\s?\*\s?/i, '')).slice(0, 60);
      const isCredit = amt.value < 0 || CREDIT_WORDS.test(x.line + ' ' + merchantLine);
      items.push({
        date: date || headerDate || docDate, merchant: name, amount: Math.abs(amt.value),
        category: categorize(name, '', learned), checked: !isCredit, credit: isCredit,
      });
    });
    return { mode: 'list', reason: 'list', items };
  }

  global.ReceiptParser = { parse, categorize, normMerchant, findDate, findAmounts, CATEGORIES, isoOf };
})(typeof window !== 'undefined' ? window : globalThis);
