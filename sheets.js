const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_NAME = 'Expenses';
const HEADER = ['วันที่', 'เวลา', 'ประเภท', 'หมวดธุรกิจ', 'รายละเอียด', 'จำนวนเงิน'];

function getAuth() {
  let credentials;
  if (process.env.GOOGLE_CREDENTIALS) {
    credentials = JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS, 'base64').toString());
  }
  return new google.auth.GoogleAuth({
    credentials,
    keyFile: credentials ? undefined : 'service_account.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

function getBangkokDateTime() {
  const offset = 7 * 60 * 60000;
  const bkk = new Date(Date.now() + offset);
  const date = bkk.toISOString().slice(0, 10);
  const time = bkk.toISOString().slice(11, 16);
  return { date, time };
}

async function ensureHeader(sheets) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A1:F1`,
    });
    if (!res.data.values || res.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!A1`,
        valueInputOption: 'RAW',
        resource: { values: [HEADER] },
      });
    }
  } catch (err) {
    if (err.message && err.message.includes('Unable to parse range')) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        resource: { requests: [{ addSheet: { properties: { title: SHEET_NAME } } }] },
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!A1`,
        valueInputOption: 'RAW',
        resource: { values: [HEADER] },
      });
    } else {
      throw err;
    }
  }
}

async function appendTransaction(tx) {
  const auth = await getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  await ensureHeader(sheets);

  const { date, time } = getBangkokDateTime();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A:F`,
    valueInputOption: 'USER_ENTERED',
    resource: { values: [[date, time, tx.type, tx.business, tx.note, tx.amount]] },
  });
}

async function getSummary(period) {
  const auth = await getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A:F`,
  });

  const rows = (res.data.values || []).slice(1); // skip header
  if (rows.length === 0) return '📊 ยังไม่มีรายการ';

  const { date } = getBangkokDateTime();
  const thisMonth = date.slice(0, 7); // YYYY-MM

  const filtered = rows.filter(r => {
    if (!r[0]) return false;
    return period === 'today' ? r[0] === date : r[0].startsWith(thisMonth);
  });

  if (filtered.length === 0) {
    return period === 'today' ? '📊 วันนี้ยังไม่มีรายการ' : '📊 เดือนนี้ยังไม่มีรายการ';
  }

  const bizList = ['บุหรี่ไฟฟ้า', 'ของชำ', 'ส่วนตัว'];
  const periodLabel = period === 'today' ? 'วันนี้' : 'เดือนนี้';
  let summary = `📊 สรุป${periodLabel}\n${'─'.repeat(22)}\n`;

  let grandIncome = 0;
  let grandExpense = 0;

  for (const biz of bizList) {
    const bizRows = filtered.filter(r => r[3] === biz);
    if (bizRows.length === 0) continue;

    const income = bizRows.filter(r => r[2] === 'รายรับ').reduce((s, r) => s + (parseFloat(r[5]) || 0), 0);
    const expense = bizRows.filter(r => r[2] === 'รายจ่าย').reduce((s, r) => s + (parseFloat(r[5]) || 0), 0);
    grandIncome += income;
    grandExpense += expense;

    const emoji = biz === 'บุหรี่ไฟฟ้า' ? '🚬' : biz === 'ของชำ' ? '🏪' : '👤';
    summary += `\n${emoji} ${biz}\n`;
    summary += `💚 ${income.toLocaleString()} | ❤️ ${expense.toLocaleString()} | กำไร ${(income - expense).toLocaleString()}\n`;
  }

  const net = grandIncome - grandExpense;
  summary += `\n${'─'.repeat(22)}\n💰 รวมรับ ${grandIncome.toLocaleString()} บาท\n💸 รวมจ่าย ${grandExpense.toLocaleString()} บาท\n✨ กำไรสุทธิ ${net.toLocaleString()} บาท`;
  return summary;
}

module.exports = { appendTransaction, getSummary };
