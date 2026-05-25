const BUSINESS_MAP = {
  บุหรี่ไฟฟ้า: ['บุหรี่', 'บุ', 'vape', 'ไฟฟ้า', 'smoke', 'pod', '150'],
  ของชำ: ['ของชำ', 'ชำ', 'ร้าน', 'โชห่วย'],
  ส่วนตัว: ['ส่วนตัว', 'ตัว', 'personal', 'ตัวเอง'],
};

function detectBusiness(keyword) {
  const k = keyword.toLowerCase();
  for (const [biz, keywords] of Object.entries(BUSINESS_MAP)) {
    if (keywords.some(w => k.includes(w))) return biz;
  }
  return keyword;
}

function parseMessage(text) {
  const t = text.trim();

  // รับ/จ่าย [จำนวน] [หมวด] [รายละเอียด?]
  const m = t.match(/^(รับ|ได้รับ|จ่าย|ซื้อ)\s+(\d+(?:\.\d+)?)\s+(\S+)(?:\s+(.+))?$/);
  if (!m) return null;

  const isIncome = ['รับ', 'ได้รับ'].includes(m[1]);
  return {
    type: isIncome ? 'รายรับ' : 'รายจ่าย',
    amount: parseFloat(m[2]),
    business: detectBusiness(m[3]),
    note: m[4] || m[3],
  };
}

module.exports = { parseMessage };
