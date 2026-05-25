require('dotenv').config();
const express = require('express');
const { middleware, messagingApi } = require('@line/bot-sdk');
const { appendTransaction, getSummary } = require('./sheets');
const { parseMessage } = require('./parser');

const lineConfig = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
};

const client = new messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

const app = express();

app.get('/', (_, res) => res.send('LINE Expense Bot is running'));

app.post('/webhook', middleware(lineConfig), async (req, res) => {
  res.json({ ok: true });
  await Promise.all(req.body.events.map(handleEvent));
});

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return;

  const text = event.message.text.trim();
  let reply;

  try {
    if (text === 'สรุป') {
      reply = await getSummary('today');
    } else if (text === 'สรุปเดือน') {
      reply = await getSummary('month');
    } else if (['ช่วยเหลือ', 'help', '?'].includes(text)) {
      reply = HELP_TEXT;
    } else {
      const tx = parseMessage(text);
      if (tx) {
        await appendTransaction(tx);
        const icon = tx.type === 'รายรับ' ? '💚' : '❤️';
        const bizIcon = tx.business === 'บุหรี่ไฟฟ้า' ? '🚬' : tx.business === 'ของชำ' ? '🏪' : '👤';
        reply = `✅ บันทึกแล้ว\n${icon} ${tx.type} ${tx.amount.toLocaleString()} บาท\n${bizIcon} ${tx.business}\n📝 ${tx.note}`;
      } else {
        reply = `ไม่เข้าใจ 🤔\nพิมพ์ "ช่วยเหลือ" เพื่อดูวิธีใช้`;
      }
    }
  } catch (err) {
    console.error(err);
    reply = `เกิดข้อผิดพลาด: ${err.message}`;
  }

  await client.replyMessage({
    replyToken: event.replyToken,
    messages: [{ type: 'text', text: reply }],
  });
}

const HELP_TEXT = `📌 วิธีใช้งาน

💚 บันทึกรายรับ:
รับ [จำนวน] [หมวด] [รายละเอียด]
เช่น: รับ 500 บุหรี่ ขาย pod

❤️ บันทึกรายจ่าย:
จ่าย [จำนวน] [หมวด] [รายละเอียด]
เช่น: จ่าย 200 ของชำ ค่าน้ำแข็ง

🗂️ หมวดหมู่:
• บุหรี่ / vape / ไฟฟ้า / pod
• ของชำ / ชำ / ร้าน
• ส่วนตัว / ตัว

📊 สรุปยอด:
สรุป → ยอดวันนี้
สรุปเดือน → ยอดเดือนนี้`;

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
